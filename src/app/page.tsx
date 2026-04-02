'use client'
import { useState, useEffect } from 'react'
import KPICard from '@/components/dashboard/KPICard'
import ChartCAMensuel from '@/components/dashboard/ChartCAMensuel'
import ChartMarge from '@/components/dashboard/ChartMarge'
import ChartOperations from '@/components/dashboard/ChartOperations'
import TableMensuel from '@/components/dashboard/TableMensuel'
import TableComparaisonAnnees from '@/components/dashboard/TableComparaisonAnnees'
import TableAOvsHorsAO from '@/components/dashboard/TableAOvsHorsAO'
import TableRepartitionCouts from '@/components/dashboard/TableRepartitionCouts'
import TableCadences from '@/components/dashboard/TableCadences'
import { formatEur, formatMarge, margeBadgeColor } from '@/lib/calculations'
import { ANNEES_DISPONIBLES } from '@/lib/config'

interface Kpi {
  ca: number; cout: number; benefice: number
  margeBrute: number | null; margeExterne: number | null; nbOps: number
  cout_cdi: number; cout_agent: number; cout_support: number; cout_deplacement: number
}

interface DashboardData {
  annee: number
  kpis: Kpi
  kpisPrev: Kpi
  monthly: Array<{ mois: number; ca: number; cout: number; benefice: number; margeBrute: number | null; margeExterne: number | null; nbOps: number; cout_cdi: number; cout_agent: number; cout_support: number; cout_deplacement: number }>
  byAnnee: Array<{ annee: number; ca: number; cout: number; benefice: number; margeBrute: number | null; margeExterne: number | null; nbOps: number }>
  aoByMonth: Array<{ mois: number; ao: { ca: number; margeBrute: number | null; nbOps: number }; horsAo: { ca: number; margeBrute: number | null; nbOps: number } }>
  aoByAnnee: Array<{ annee: number; ao: { ca: number; margeBrute: number | null; nbOps: number }; horsAo: { ca: number; margeBrute: number | null; nbOps: number } }>
  multiYearMonthly: Array<{ annee: number; monthly: Array<{ mois: number; margeBrute: number | null; margeExterne: number | null; ca: number }> }>
  cadenceByZone: Array<{ type_zone: string; nb_ops: number; cadence_moy: number; cadence_min: number; cadence_max: number }>
}

export default function Dashboard() {
  const currentYear = new Date().getFullYear()
  const [annee, setAnnee] = useState(currentYear)
  const [isAo, setIsAo] = useState<'' | '0' | '1'>('')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ annee: String(annee) })
    if (isAo) params.set('is_ao', isAo)
    fetch(`/api/dashboard?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [annee, isAo])

  const delta = (cur: number | null, prev: number | null): number | null => {
    if (cur === null || prev === null || prev === 0) return null
    return (cur - prev) * 100
  }

  const deltaCA = data && data.kpisPrev.ca > 0
    ? ((data.kpis.ca - data.kpisPrev.ca) / data.kpisPrev.ca) * 100
    : null

  const coutAggreg = data ? {
    ca: data.kpis.ca,
    cout: data.kpis.cout,
    cout_cdi: data.kpis.cout_cdi,
    cout_agent: data.kpis.cout_agent,
    cout_support: data.kpis.cout_support,
    cout_deplacement: data.kpis.cout_deplacement,
  } : null

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400">Analyse des marges opérations</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filtre AO */}
          <div className="flex rounded-lg border border-slate-700 overflow-hidden text-sm">
            {([['', 'Tous'], ['0', 'Hors AO'], ['1', 'AO']] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setIsAo(v)}
                className={`px-4 py-2 transition-colors ${isAo === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
              >{l}</button>
            ))}
          </div>
          {/* Sélecteur année */}
          <select
            value={annee}
            onChange={e => setAnnee(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {ANNEES_DISPONIBLES.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : !data ? (
        <div className="text-center text-slate-400 py-20">Erreur de chargement</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KPICard
              title="CA Total HT"
              value={formatEur(data.kpis.ca)}
              delta={deltaCA}
            />
            <KPICard
              title="Bénéfice brut"
              value={formatEur(data.kpis.benefice)}
              colorClass={data.kpis.benefice >= 0 ? 'text-green-400' : 'text-red-400'}
            />
            <KPICard
              title="Marge Brute"
              value={formatMarge(data.kpis.margeBrute)}
              colorClass={margeBadgeColor(data.kpis.margeBrute).split(' ')[1]}
              delta={delta(data.kpis.margeBrute, data.kpisPrev.margeBrute)}
            />
            <KPICard
              title="Marge Externe"
              value={formatMarge(data.kpis.margeExterne)}
              colorClass={margeBadgeColor(data.kpis.margeExterne).split(' ')[1]}
              delta={delta(data.kpis.margeExterne, data.kpisPrev.margeExterne)}
            />
            <KPICard
              title="Nb Opérations"
              value={String(data.kpis.nbOps)}
              sub={`vs ${data.kpisPrev.nbOps} en ${annee - 1}`}
            />
            <KPICard
              title="Coût total"
              value={formatEur(data.kpis.cout)}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ChartCAMensuel data={data.monthly} />
            <ChartMarge data={data.multiYearMonthly} annee={annee} />
          </div>
          <div className="max-w-lg">
            <ChartOperations data={data.monthly} />
          </div>

          {/* Tables */}
          <TableMensuel data={data.monthly} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <TableComparaisonAnnees data={data.byAnnee} />
            {coutAggreg && <TableRepartitionCouts data={coutAggreg} />}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <TableAOvsHorsAO data={data.aoByMonth} mode="mois" />
            <TableAOvsHorsAO data={data.aoByAnnee} mode="annee" />
          </div>

          <TableCadences data={data.cadenceByZone} />
        </>
      )}
    </div>
  )
}
