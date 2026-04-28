import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const db = await getDb()
  const opRes = await db.query('SELECT * FROM operations WHERE id = $1', [id])
  const op = opRes.rows[0]
  if (!op) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })

  const lignesRes = await db.query('SELECT * FROM lignes_couts WHERE operation_id = $1 ORDER BY id', [id])
  const cadenceRes = await db.query('SELECT * FROM cadences WHERE operation_id = $1', [id])
  const cadence = cadenceRes.rows[0] ?? null
  return NextResponse.json({ ...op, lignes: lignesRes.rows, cadence })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const db = await getDb()
  const body = await req.json()
  const { code, mois, annee, client, is_ao, prix_vente_ht, notes, lignes } = body

  try {
    const clientConn = await db.connect()
    try {
      await clientConn.query('BEGIN')
      await clientConn.query(
        `UPDATE operations
         SET code=$1, mois=$2, annee=$3, client=$4, is_ao=$5, prix_vente_ht=$6, notes=$7, updated_at=now()
         WHERE id=$8`,
        [String(code).toUpperCase(), mois, annee, client, is_ao ? 1 : 0, prix_vente_ht ?? 0, notes ?? null, id]
      )

      await clientConn.query('DELETE FROM lignes_couts WHERE operation_id = $1', [id])

      if (Array.isArray(lignes)) {
        for (const l of lignes) {
          await clientConn.query(
            `INSERT INTO lignes_couts (operation_id, type, intitule, nb_heures, taux_horaire, cout_fixe)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, l.type, l.intitule, l.nb_heures ?? null, l.taux_horaire ?? null, l.cout_fixe ?? null]
          )
        }
      }

      if (body.cadence) {
        const c = body.cadence
        await clientConn.query(
          `INSERT INTO cadences (operation_id, superficie, type_zone, nb_flyers, nb_heures, poids_document, cadence_estimee)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT(operation_id) DO UPDATE SET
             superficie=excluded.superficie,
             type_zone=excluded.type_zone,
             nb_flyers=excluded.nb_flyers,
             nb_heures=excluded.nb_heures,
             poids_document=excluded.poids_document,
             cadence_estimee=excluded.cadence_estimee,
             updated_at=now()`,
          [id, c.superficie ?? null, c.type_zone ?? null, c.nb_flyers ?? null, c.nb_heures ?? null, c.poids_document ?? null, c.cadence_estimee ?? null]
        )
      } else {
        await clientConn.query('DELETE FROM cadences WHERE operation_id = $1', [id])
      }

      await clientConn.query('COMMIT')
    } catch (err) {
      await clientConn.query('ROLLBACK')
      throw err
    } finally {
      clientConn.release()
    }
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const db = await getDb()
  await db.query('DELETE FROM operations WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
