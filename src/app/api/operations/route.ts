import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const annee = searchParams.get('annee')
  const isAo = searchParams.get('is_ao')
  const q = searchParams.get('q')

  let where = '1=1'
  const params: (string | number)[] = []

  if (annee) { where += ' AND o.annee = ?'; params.push(Number(annee)) }
  if (isAo === '1' || isAo === '0') { where += ' AND o.is_ao = ?'; params.push(Number(isAo)) }
  if (q) { where += ' AND (o.code LIKE ? OR o.client LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }

  const operations = db.prepare(`
    SELECT o.*,
      COALESCE(SUM(COALESCE(lc.nb_heures,0)*COALESCE(lc.taux_horaire,0) + COALESCE(lc.cout_fixe,0)), 0) as cout_total,
      COALESCE(SUM(CASE WHEN lc.type != 'CDI' THEN COALESCE(lc.nb_heures,0)*COALESCE(lc.taux_horaire,0) + COALESCE(lc.cout_fixe,0) ELSE 0 END), 0) as cout_sans_cdi,
      c.type_zone, c.nb_flyers, c.nb_heures as cadence_heures, c.poids_document,
      CASE WHEN c.nb_flyers > 0 AND c.nb_heures > 0
        THEN ROUND(CAST(c.nb_flyers AS REAL) / c.nb_heures)
        ELSE NULL END as cadence_valeur
    FROM operations o
    LEFT JOIN lignes_couts lc ON lc.operation_id = o.id
    LEFT JOIN cadences c ON c.operation_id = o.id
    WHERE ${where}
    GROUP BY o.id
    ORDER BY o.annee DESC, o.mois DESC, o.code
  `).all(...params)

  return NextResponse.json(operations)
}

export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { code, mois, annee, client, is_ao, prix_vente_ht, notes, lignes } = body

  if (!code || !mois || !annee || !client) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  const insertOp = db.prepare(`
    INSERT INTO operations (code, mois, annee, client, is_ao, prix_vente_ht, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const insertLigne = db.prepare(`
    INSERT INTO lignes_couts (operation_id, type, intitule, nb_heures, taux_horaire, cout_fixe)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const upsertCadence = db.prepare(`
    INSERT INTO cadences (operation_id, superficie, type_zone, nb_flyers, nb_heures, poids_document)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(operation_id) DO UPDATE SET
      superficie=excluded.superficie, type_zone=excluded.type_zone,
      nb_flyers=excluded.nb_flyers, nb_heures=excluded.nb_heures,
      poids_document=excluded.poids_document,
      updated_at=datetime('now')
  `)

  const transaction = db.transaction(() => {
    const result = insertOp.run(
      code.toUpperCase(),
      mois,
      annee,
      client,
      is_ao ? 1 : 0,
      prix_vente_ht ?? 0,
      notes ?? null
    )
    const opId = result.lastInsertRowid

    if (Array.isArray(lignes)) {
      for (const l of lignes) {
        insertLigne.run(opId, l.type, l.intitule, l.nb_heures ?? null, l.taux_horaire ?? null, l.cout_fixe ?? null)
      }
    }

    if (body.cadence) {
      const c = body.cadence
      upsertCadence.run(opId, c.superficie ?? null, c.type_zone ?? null, c.nb_flyers ?? null, c.nb_heures ?? null, c.poids_document ?? null)
    }

    return opId
  })

  try {
    const id = transaction()
    return NextResponse.json({ id }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: `Le code "${code}" existe déjà` }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
