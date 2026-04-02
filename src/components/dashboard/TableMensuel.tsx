'use client'
import { formatEur, formatMarge, margeBadgeColor, MOIS_NOMS_LONG } from '@/lib/calculations'

interface MonthData {
  mois: number; ca: number; cout: number; benefice: number
  margeBrute: number | null; margeExterne: number | null; nbOps: number
}

export default function TableMensuel({ data }: { data: MonthData[] }) {
  const totCa = data.reduce((s, d) => s + d.ca, 0)
  const totCout = data.reduce((s, d) => s + d.cout, 0)
  const totBenef = data.reduce((s, d) => s + d.benefice, 0)
  const totNb = data.reduce((s, d) => s + d.nbOps, 0)
  const totMB = totCa > 0 ? totBenef / totCa : null
  const totCoutSansCdi = data.reduce((s, d) => s + (d.ca - (d.margeExterne ?? 0) * d.ca), 0)
  const totME = totCa > 0 ? (totCa - totCoutSansCdi) / totCa : null

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-200">Récapitulatif mensuel</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Mois</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">CA HT</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Coût</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Bénéfice</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">M. Brute</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">M. Externe</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Nb opés</th>
            </tr>
          </thead>
          <tbody>
            {data.map(d => (
              <tr key={d.mois} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-slate-300 font-medium">{MOIS_NOMS_LONG[d.mois]}</td>
                <td className="px-4 py-3 text-right text-slate-200">{d.ca > 0 ? formatEur(d.ca) : '—'}</td>
                <td className="px-4 py-3 text-right text-slate-400">{d.cout > 0 ? formatEur(d.cout) : '—'}</td>
                <td className={`px-4 py-3 text-right font-medium ${d.benefice >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {d.ca > 0 ? formatEur(d.benefice) : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {d.margeBrute !== null && d.ca > 0
                    ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${margeBadgeColor(d.margeBrute)}`}>{formatMarge(d.margeBrute)}</span>
                    : <span className="text-slate-600">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-center">
                  {d.margeExterne !== null && d.ca > 0
                    ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${margeBadgeColor(d.margeExterne)}`}>{formatMarge(d.margeExterne)}</span>
                    : <span className="text-slate-600">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-center text-slate-300">{d.nbOps > 0 ? d.nbOps : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-700/50">
              <td className="px-4 py-3 text-slate-200 font-semibold">Total</td>
              <td className="px-4 py-3 text-right text-white font-semibold">{formatEur(totCa)}</td>
              <td className="px-4 py-3 text-right text-slate-300 font-semibold">{formatEur(totCout)}</td>
              <td className={`px-4 py-3 text-right font-semibold ${totBenef >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatEur(totBenef)}</td>
              <td className="px-4 py-3 text-center">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${margeBadgeColor(totMB)}`}>{formatMarge(totMB)}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${margeBadgeColor(totME)}`}>{formatMarge(totME)}</span>
              </td>
              <td className="px-4 py-3 text-center text-white font-semibold">{totNb}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
