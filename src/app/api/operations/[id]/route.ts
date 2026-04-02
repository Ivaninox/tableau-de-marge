import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const db = getDb()
  const op = db.prepare('SELECT * FROM operations WHERE id = ?').get(id)
  if (!op) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })

  const lignes = db.prepare('SELECT * FROM lignes_couts WHERE operation_id = ? ORDER BY id').all(id)
  const cadence = db.prepare('SELECT * FROM cadences WHERE operation_id = ?').get(id) ?? null
  return NextResponse.json({ ...op, lignes, cadence })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const db = getDb()
  const body = await req.json()
  const { code, mois, annee, client, is_ao, prix_vente_ht, notes, lignes } = body

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE operations SET code=?, mois=?, annee=?, client=?, is_ao=?, prix_vente_ht=?, notes=?, updated_at=datetime('now')
      WHERE id=?
    `).run(code.toUpperCase(), mois, annee, client, is_ao ? 1 : 0, prix_vente_ht ?? 0, notes ?? null, id)

    db.prepare('DELETE FROM lignes_couts WHERE operation_id = ?').run(id)

    const insertLigne = db.prepare(`
      INSERT INTO lignes_couts (operation_id, type, intitule, nb_heures, taux_horaire, cout_fixe)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    if (Array.isArray(lignes)) {
      for (const l of lignes) {
        insertLigne.run(id, l.type, l.intitule, l.nb_heures ?? null, l.taux_horaire ?? null, l.cout_fixe ?? null)
      }
    }

    if (body.cadence) {
      const c = body.cadence
      db.prepare(`
        INSERT INTO cadences (operation_id, superficie, type_zone, nb_flyers, nb_heures, poids_document)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(operation_id) DO UPDATE SET
          superficie=excluded.superficie, type_zone=excluded.type_zone,
          nb_flyers=excluded.nb_flyers, nb_heures=excluded.nb_heures,
          poids_document=excluded.poids_document,
          updated_at=datetime('now')
      `).run(id, c.superficie ?? null, c.type_zone ?? null, c.nb_flyers ?? null, c.nb_heures ?? null, c.poids_document ?? null)
    } else {
      db.prepare('DELETE FROM cadences WHERE operation_id = ?').run(id)
    }
  })

  try {
    transaction()
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM operations WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
