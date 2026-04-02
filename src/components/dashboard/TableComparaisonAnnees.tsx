'use client'
import { formatEur, formatMarge, margeBadgeColor } from '@/lib/calculations'

interface AnneeData {
  annee: number; ca: number; cout: number; benefice: number
  margeBrute: number | null; margeExterne: number | null; nbOps: number
}

export default function TableComparaisonAnnees({ data }: { data: AnneeData[] }) {
  const active = data.filter(d => d.ca > 0)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-200">Comparaison par année</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Année</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">CA HT</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Coût</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Bénéfice</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">M. Brute</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">M. Externe</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Nb opés</th>
            </tr>
          </thead>
          <tbody>
            {active.map((d, i) => {
              const prev = active[i - 1]
              const deltaCA = prev && prev.ca > 0 ? ((d.ca - prev.ca) / prev.ca * 100) : null
              return (
                <tr key={d.annee} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 text-slate-200 font-bold text-base">{d.annee}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-slate-200 font-medium">{formatEur(d.ca)}</div>
                    {deltaCA !== null && (
                      <div className={`text-xs ${deltaCA >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {deltaCA >= 0 ? '↑' : '↓'} {Math.abs(deltaCA).toFixed(1)}%
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">{formatEur(d.cout)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${d.benefice >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatEur(d.benefice)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${margeBadgeColor(d.margeBrute)}`}>
                      {formatMarge(d.margeBrute)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${margeBadgeColor(d.margeExterne)}`}>
                      {formatMarge(d.margeExterne)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-300">{d.nbOps}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
