import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const db = await getDb()
  const { searchParams } = new URL(req.url)
  const annee = searchParams.get('annee')
  const isAo = searchParams.get('is_ao')
  const q = searchParams.get('q')

  const clauses: string[] = ['1=1']
  const params: (string | number)[] = []

  if (annee) {
    params.push(Number(annee))
    clauses.push(`o.annee = $${params.length}`)
  }
  if (isAo === '1' || isAo === '0') {
    params.push(Number(isAo))
    clauses.push(`o.is_ao = $${params.length}`)
  }
  if (q) {
    params.push(`%${q}%`)
    const p1 = `$${params.length}`
    params.push(`%${q}%`)
    const p2 = `$${params.length}`
    clauses.push(`(o.code ILIKE ${p1} OR o.client ILIKE ${p2})`)
  }

  const { rows: operations } = await db.query(`
    SELECT
      o.*,
      COALESCE(SUM(COALESCE(lc.nb_heures, 0) * COALESCE(lc.taux_horaire, 0) + COALESCE(lc.cout_fixe, 0)), 0) AS cout_total,
      COALESCE(SUM(CASE WHEN lc.type != 'CDI'
        THEN COALESCE(lc.nb_heures, 0) * COALESCE(lc.taux_horaire, 0) + COALESCE(lc.cout_fixe, 0)
        ELSE 0 END), 0) AS cout_sans_cdi,
      c.type_zone,
      c.nb_flyers,
      c.nb_heures AS cadence_heures,
      c.poids_document,
      c.cadence_estimee,
      CASE WHEN c.nb_flyers > 0 AND c.nb_heures > 0
        THEN ROUND((c.nb_flyers::numeric / c.nb_heures)::numeric)
        ELSE NULL END AS cadence_valeur,
      CASE WHEN c.nb_flyers > 0 AND c.nb_heures > 0 AND c.cadence_estimee > 0
        THEN ROUND(((c.nb_flyers::numeric / c.nb_heures) / c.cadence_estimee * 100)::numeric)
        ELSE NULL END AS taux_atteinte
    FROM operations o
    LEFT JOIN lignes_couts lc ON lc.operation_id = o.id
    LEFT JOIN cadences c ON c.operation_id = o.id
    WHERE ${clauses.join(' AND ')}
    GROUP BY o.id, c.type_zone, c.nb_flyers, c.nb_heures, c.poids_document, c.cadence_estimee
    ORDER BY o.annee DESC, o.mois DESC, o.code
  `, params)

  return NextResponse.json(operations)
}

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await req.json()
  const { code, mois, annee, client, is_ao, prix_vente_ht, notes, lignes } = body

  if (!code || !mois || !annee || !client) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  try {
    const clientConn = await db.connect()
    try {
      await clientConn.query('BEGIN')

      const { rows } = await clientConn.query<{ id: string }>(
        `INSERT INTO operations (code, mois, annee, client, is_ao, prix_vente_ht, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id::text as id`,
        [
          String(code).toUpperCase(),
          mois,
          annee,
          client,
          is_ao ? 1 : 0,
          prix_vente_ht ?? 0,
          notes ?? null,
        ]
      )
      const opId = rows[0]!.id

      if (Array.isArray(lignes)) {
        for (const l of lignes) {
          await clientConn.query(
            `INSERT INTO lignes_couts (operation_id, type, intitule, nb_heures, taux_horaire, cout_fixe)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [opId, l.type, l.intitule, l.nb_heures ?? null, l.taux_horaire ?? null, l.cout_fixe ?? null]
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
          [opId, c.superficie ?? null, c.type_zone ?? null, c.nb_flyers ?? null, c.nb_heures ?? null, c.poids_document ?? null, c.cadence_estimee ?? null]
        )
      }

      await clientConn.query('COMMIT')
      return NextResponse.json({ id: opId }, { status: 201 })
    } catch (err) {
      await clientConn.query('ROLLBACK')
      throw err
    } finally {
      clientConn.release()
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('UNIQUE') || msg.includes('duplicate key')) {
      return NextResponse.json({ error: `Le code "${code}" existe déjà` }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
