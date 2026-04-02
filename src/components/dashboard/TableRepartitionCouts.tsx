'use client'
import { formatEur } from '@/lib/calculations'
import { TYPE_COUT_COLORS, TYPE_COUT_LABELS, TypeCout } from '@/lib/config'

interface Props {
  data: {
    ca: number
    cout: number
    cout_cdi: number
    cout_agent: number
    cout_support: number
    cout_deplacement: number
  }
}

export default function TableRepartitionCouts({ data }: Props) {
  const { ca, cout, cout_cdi, cout_agent, cout_support, cout_deplacement } = data
  const types: { key: TypeCout; val: number }[] = [
    { key: 'CDI', val: cout_cdi },
    { key: 'AGENT', val: cout_agent },
    { key: 'SUPPORT', val: cout_support },
    { key: 'DEPLACEMENT', val: cout_deplacement },
  ]

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-200">Répartition des coûts</h3>
      </div>
      <div className="p-5">
        {/* Stacked bar */}
        {cout > 0 && (
          <div className="flex rounded-full overflow-hidden h-3 mb-4">
            {types.map(t => {
              const pct = (t.val / cout) * 100
              return pct > 0 ? (
                <div
                  key={t.key}
                  style={{ width: `${pct}%`, backgroundColor: TYPE_COUT_COLORS[t.key] }}
                  title={`${TYPE_COUT_LABELS[t.key]}: ${pct.toFixed(1)}%`}
                />
              ) : null
            })}
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="py-2 text-left text-xs font-medium text-slate-400 uppercase">Type</th>
              <th className="py-2 text-right text-xs font-medium text-slate-400 uppercase">Montant</th>
              <th className="py-2 text-right text-xs font-medium text-slate-400 uppercase">% du coût</th>
              <th className="py-2 text-right text-xs font-medium text-slate-400 uppercase">% du CA</th>
            </tr>
          </thead>
          <tbody>
            {types.map(t => (
              <tr key={t.key} className="border-b border-slate-700/50">
                <td className="py-2.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: TYPE_COUT_COLORS[t.key] }} />
                  <span className="text-slate-300">{TYPE_COUT_LABELS[t.key]}</span>
                </td>
                <td className="py-2.5 text-right text-slate-200">{formatEur(t.val)}</td>
                <td className="py-2.5 text-right text-slate-400">
                  {cout > 0 ? `${(t.val / cout * 100).toFixed(1)} %` : '—'}
                </td>
                <td className="py-2.5 text-right text-slate-400">
                  {ca > 0 ? `${(t.val / ca * 100).toFixed(1)} %` : '—'}
                </td>
              </tr>
            ))}
            <tr className="border-t border-slate-600">
              <td className="py-2.5 text-slate-200 font-semibold">Total coûts</td>
              <td className="py-2.5 text-right text-white font-semibold">{formatEur(cout)}</td>
              <td className="py-2.5 text-right text-slate-300">100 %</td>
              <td className="py-2.5 text-right text-slate-300">{ca > 0 ? `${(cout / ca * 100).toFixed(1)} %` : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
