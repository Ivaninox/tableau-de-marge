'use client'

interface CadenceZone {
  type_zone: string
  poids_document: string | null
  nb_ops: number
  cadence_moy: number
  cadence_min: number
  cadence_max: number
}

const ZONE_LABELS: Record<string, string> = {
  U1: '+95% boîtes collectives',
  U2: '75% à 95% boîtes collectives',
  S1: '55% à 75% boîtes collectives',
  S2: '45% à 55% boîtes collectives',
  S3: '25% à 45% boîtes collectives',
  R1: '10% à 25% boîtes collectives',
  R2: 'Moins de 10% boîtes collectives',
}

const POIDS_LABELS: Record<string, string> = {
  leger:       'Léger',
  epais:       'Épais',
  lourd:       'Lourd',
  tres_lourd:  'Très lourd',
  super_lourd: 'Super lourd',
}

function cadenceColor(v: number) {
  if (v >= 1200) return 'text-green-400'
  if (v >= 800) return 'text-yellow-400'
  return 'text-red-400'
}

export default function TableCadences({ data }: { data: CadenceZone[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-3">Cadences par type de zone</h2>
        <p className="text-sm text-slate-500 text-center py-4">
          Aucune donnée de cadence — renseignez le bloc Cadence dans les opérations.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700">
        <h2 className="text-base font-semibold text-white">Cadences par type de zone</h2>
        <p className="text-xs text-slate-500 mt-0.5">Flyers distribués par heure · basé sur {data.reduce((s, r) => s + r.nb_ops, 0)} opérations renseignées</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Zone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Poids</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Ops</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Min</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Moyenne</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Max</th>
            </tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr key={`${row.type_zone}-${row.poids_document ?? 'null'}`} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                <td className="px-4 py-3">
                  <span className="bg-indigo-500/20 text-indigo-300 text-xs font-bold px-2 py-0.5 rounded font-mono">
                    {row.type_zone}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{ZONE_LABELS[row.type_zone] ?? row.type_zone}</td>
                <td className="px-4 py-3 text-slate-300 text-xs">
                  {row.poids_document ? (POIDS_LABELS[row.poids_document] ?? row.poids_document) : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3 text-center text-slate-400">{row.nb_ops}</td>
                <td className="px-4 py-3 text-right text-slate-400">
                  {row.cadence_min.toLocaleString('fr-FR')}
                </td>
                <td className={`px-4 py-3 text-right font-bold ${cadenceColor(row.cadence_moy)}`}>
                  {row.cadence_moy.toLocaleString('fr-FR')}
                  <span className="text-xs font-normal text-slate-500 ml-1">f/h</span>
                </td>
                <td className="px-4 py-3 text-right text-slate-400">
                  {row.cadence_max.toLocaleString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
