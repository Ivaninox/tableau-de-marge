'use client'
import { formatEur, formatMarge, margeBadgeColor, MOIS_NOMS_LONG } from '@/lib/calculations'

interface Segment { ca: number; margeBrute: number | null; nbOps: number }
interface Row { mois?: number; annee?: number; ao: Segment; horsAo: Segment }

export default function TableAOvsHorsAO({ data, mode }: { data: Row[]; mode: 'mois' | 'annee' }) {
  const active = data.filter(d => d.ao.ca > 0 || d.horsAo.ca > 0)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">AO vs Hors AO — par {mode === 'mois' ? 'mois' : 'année'}</h3>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-indigo-400 rounded-full inline-block" />AO</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-slate-400 rounded-full inline-block" />Hors AO</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">{mode === 'mois' ? 'Mois' : 'Année'}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-indigo-400 uppercase">CA AO</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-indigo-400 uppercase">Marge AO</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">CA H.AO</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Marge H.AO</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Nb AO</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Nb H.AO</th>
            </tr>
          </thead>
          <tbody>
            {active.map(d => (
              <tr key={mode === 'mois' ? d.mois : d.annee} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-slate-200 font-medium">
                  {mode === 'mois' ? MOIS_NOMS_LONG[d.mois!] : d.annee}
                </td>
                <td className="px-4 py-3 text-right text-slate-300">{d.ao.ca > 0 ? formatEur(d.ao.ca) : '—'}</td>
                <td className="px-4 py-3 text-center">
                  {d.ao.ca > 0
                    ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${margeBadgeColor(d.ao.margeBrute)}`}>{formatMarge(d.ao.margeBrute)}</span>
                    : <span className="text-slate-600">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-right text-slate-300">{d.horsAo.ca > 0 ? formatEur(d.horsAo.ca) : '—'}</td>
                <td className="px-4 py-3 text-center">
                  {d.horsAo.ca > 0
                    ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${margeBadgeColor(d.horsAo.margeBrute)}`}>{formatMarge(d.horsAo.margeBrute)}</span>
                    : <span className="text-slate-600">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-center text-slate-400">{d.ao.nbOps || '—'}</td>
                <td className="px-4 py-3 text-center text-slate-400">{d.horsAo.nbOps || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
