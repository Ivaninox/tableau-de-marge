import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const annee = Number(searchParams.get('annee') ?? new Date().getFullYear())
  const isAo = searchParams.get('is_ao') // '0', '1', or null (all)

  // Build AO filter clause
  const aoClause = isAo === '0' ? 'AND o.is_ao = 0' : isAo === '1' ? 'AND o.is_ao = 1' : ''

  // Base query: operations with aggregated costs
  function queryOps(anneeFilter?: number, aoFilter?: string) {
    const af = anneeFilter !== undefined ? `AND o.annee = ${anneeFilter}` : ''
    const aof = aoFilter ?? aoClause
    return db.prepare(`
      SELECT
        o.id, o.mois, o.annee, o.client, o.is_ao, o.prix_vente_ht,
        COALESCE(SUM(COALESCE(lc.nb_heures,0)*COALESCE(lc.taux_horaire,0) + COALESCE(lc.cout_fixe,0)), 0) AS cout_total,
        COALESCE(SUM(CASE WHEN lc.type != 'CDI' THEN COALESCE(lc.nb_heures,0)*COALESCE(lc.taux_horaire,0) + COALESCE(lc.cout_fixe,0) ELSE 0 END), 0) AS cout_sans_cdi,
        COALESCE(SUM(CASE WHEN lc.type = 'CDI' THEN COALESCE(lc.nb_heures,0)*COALESCE(lc.taux_horaire,0) + COALESCE(lc.cout_fixe,0) ELSE 0 END), 0) AS cout_cdi,
        COALESCE(SUM(CASE WHEN lc.type = 'AGENT' THEN COALESCE(lc.nb_heures,0)*COALESCE(lc.taux_horaire,0) + COALESCE(lc.cout_fixe,0) ELSE 0 END), 0) AS cout_agent,
        COALESCE(SUM(CASE WHEN lc.type = 'SUPPORT' THEN COALESCE(lc.nb_heures,0)*COALESCE(lc.taux_horaire,0) + COALESCE(lc.cout_fixe,0) ELSE 0 END), 0) AS cout_support,
        COALESCE(SUM(CASE WHEN lc.type = 'DEPLACEMENT' THEN COALESCE(lc.nb_heures,0)*COALESCE(lc.taux_horaire,0) + COALESCE(lc.cout_fixe,0) ELSE 0 END), 0) AS cout_deplacement
      FROM operations o
      LEFT JOIN lignes_couts lc ON lc.operation_id = o.id
      WHERE o.prix_vente_ht > 0 ${af} ${aof}
      GROUP BY o.id
    `).all() as OpRow[]
  }

  interface OpRow {
    id: number
    mois: number
    annee: number
    client: string
    is_ao: number
    prix_vente_ht: number
    cout_total: number
    cout_sans_cdi: number
    cout_cdi: number
    cout_agent: number
    cout_support: number
    cout_deplacement: number
  }

  function agg(rows: OpRow[]) {
    const ca = rows.reduce((s, r) => s + r.prix_vente_ht, 0)
    const cout = rows.reduce((s, r) => s + r.cout_total, 0)
    const coutSansCdi = rows.reduce((s, r) => s + r.cout_sans_cdi, 0)
    const benefice = ca - cout
    const margeBrute = ca > 0 ? benefice / ca : null
    const margeExterne = ca > 0 ? (ca - coutSansCdi) / ca : null
    return {
      ca, cout, coutSansCdi, benefice, margeBrute, margeExterne,
      nbOps: rows.length,
      cout_cdi: rows.reduce((s, r) => s + r.cout_cdi, 0),
      cout_agent: rows.reduce((s, r) => s + r.cout_agent, 0),
      cout_support: rows.reduce((s, r) => s + r.cout_support, 0),
      cout_deplacement: rows.reduce((s, r) => s + r.cout_deplacement, 0),
    }
  }

  // Current year data
  const currentRows = queryOps(annee)
  const kpis = agg(currentRows)

  // Previous year data (same AO filter)
  const prevRows = queryOps(annee - 1)
  const kpisPrev = agg(prevRows)

  // Monthly breakdown for current year
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const rows = currentRows.filter(r => r.mois === m)
    return { mois: m, ...agg(rows) }
  })

  // Multi-year comparison (all AO filters ignored here → show global)
  const annees = [2022, 2023, 2024, 2025, 2026]
  const byAnnee = annees.map(y => {
    const rows = queryOps(y, '') // no AO filter for comparison table
    return { annee: y, ...agg(rows) }
  })

  // AO vs Hors AO by month (current year)
  const aoByMonth = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const aoRows = currentRows.filter(r => r.mois === m && r.is_ao === 1)
    const horsAoRows = currentRows.filter(r => r.mois === m && r.is_ao === 0)
    return {
      mois: m,
      ao: agg(aoRows),
      horsAo: agg(horsAoRows),
    }
  })

  // AO vs Hors AO by year
  const aoByAnnee = annees.map(y => {
    const allRows = queryOps(y, '')
    const aoRows = allRows.filter(r => r.is_ao === 1)
    const horsAoRows = allRows.filter(r => r.is_ao === 0)
    return {
      annee: y,
      ao: agg(aoRows),
      horsAo: agg(horsAoRows),
    }
  })

  // Multi-year monthly margin curves (for comparison chart)
  const multiYearMonthly = annees.map(y => {
    const rows = queryOps(y, '')
    return {
      annee: y,
      monthly: Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        const mRows = rows.filter(r => r.mois === m)
        const a = agg(mRows)
        return { mois: m, margeBrute: a.margeBrute, margeExterne: a.margeExterne, ca: a.ca }
      }),
    }
  })

  // Cadences par type de zone + poids de document (toutes années ou filtrée)
  const cadenceByZone = db.prepare(`
    SELECT
      c.type_zone,
      c.poids_document,
      COUNT(*) as nb_ops,
      ROUND(AVG(CAST(c.nb_flyers AS REAL) / c.nb_heures)) as cadence_moy,
      ROUND(MIN(CAST(c.nb_flyers AS REAL) / c.nb_heures)) as cadence_min,
      ROUND(MAX(CAST(c.nb_flyers AS REAL) / c.nb_heures)) as cadence_max
    FROM cadences c
    JOIN operations o ON o.id = c.operation_id
    WHERE c.type_zone IS NOT NULL AND c.nb_flyers > 0 AND c.nb_heures > 0
      ${aoClause}
    GROUP BY c.type_zone, c.poids_document
    ORDER BY c.type_zone, c.poids_document
  `).all() as { type_zone: string; poids_document: string | null; nb_ops: number; cadence_moy: number; cadence_min: number; cadence_max: number }[]

  return NextResponse.json({
    annee,
    kpis,
    kpisPrev,
    monthly,
    byAnnee,
    aoByMonth,
    aoByAnnee,
    multiYearMonthly,
    cadenceByZone,
  })
}
