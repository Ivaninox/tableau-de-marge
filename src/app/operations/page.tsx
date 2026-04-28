'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { formatEur, formatMarge, margeBadgeColor, MOIS_NOMS_LONG } from '@/lib/calculations'
import { ANNEES_DISPONIBLES } from '@/lib/config'

interface Operation {
  id: number; code: string; mois: number; annee: number; client: string
  is_ao: number; prix_vente_ht: number; cout_total: number; cout_sans_cdi: number
  type_zone: string | null; cadence_valeur: number | null; poids_document: string | null
  taux_atteinte: number | null
}

// ─── Définition des colonnes ──────────────────────────────────────────────────

type ColId = 'periode' | 'code' | 'client' | 'type' | 'ca' | 'benefice' | 'cout' | 'mb' | 'me' | 'cadence' | 'atteinte' | 'actions'

interface ColDef {
  id: ColId
  label: string
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  width?: string
}

const ALL_COLS: ColDef[] = [
  { id: 'periode',  label: 'Période',    sortable: true,  align: 'left',   width: '110px' },
  { id: 'code',     label: 'Code',       sortable: true,  align: 'left',   width: '130px' },
  { id: 'client',   label: 'Client',     sortable: true,  align: 'left'   },
  { id: 'type',     label: 'Type',       sortable: false, align: 'center', width: '80px'  },
  { id: 'ca',       label: 'CA HT',      sortable: true,  align: 'right',  width: '110px' },
  { id: 'benefice', label: 'Bénéfice',   sortable: true,  align: 'right',  width: '110px' },
  { id: 'cout',     label: 'Coût',       sortable: false, align: 'right',  width: '100px' },
  { id: 'mb',       label: 'M. Brute',   sortable: true,  align: 'center', width: '90px'  },
  { id: 'me',       label: 'M. Externe', sortable: true,  align: 'center', width: '90px'  },
  { id: 'cadence',  label: 'Cadence',    sortable: true,  align: 'center', width: '100px' },
  { id: 'atteinte', label: '% Atteinte', sortable: true,  align: 'center', width: '100px' },
  { id: 'actions',  label: 'Actions',    sortable: false, align: 'center', width: '110px' },
]

type SortKey = 'code' | 'client' | 'periode' | 'ca' | 'benefice' | 'mb' | 'me' | 'cadence' | 'atteinte'
type SortDir = 'asc' | 'desc'

// ─── Composant principal ──────────────────────────────────────────────────────

export default function OperationsPage() {
  const [ops, setOps] = useState<Operation[]>([])
  const [loading, setLoading] = useState(true)

  // Filtres globaux (barre du haut)
  const [annee, setAnnee] = useState<string>('')
  const [isAo, setIsAo] = useState<string>('')
  const [q, setQ] = useState('')

  // Filtres par colonne (en-têtes)
  const [filterCode, setFilterCode]     = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterMois, setFilterMois]     = useState('')
  const [filterAnnee2, setFilterAnnee2] = useState('')

  const [deleting, setDeleting] = useState<number | null>(null)

  // Tri
  const [sortKey, setSortKey] = useState<SortKey>('periode')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Ordre des colonnes
  const [colOrder, setColOrder] = useState<ColId[]>(ALL_COLS.map(c => c.id).filter(id => id !== 'client'))

  // Drag state
  const dragCol = useRef<ColId | null>(null)
  const dragOverCol = useRef<ColId | null>(null)

  const fetchOps = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (annee) params.set('annee', annee)
    if (isAo) params.set('is_ao', isAo)
    if (q) params.set('q', q)
    fetch(`/api/operations?${params}`)
      .then(r => r.json())
      .then(d => { setOps(d); setLoading(false) })
  }, [annee, isAo, q])

  useEffect(() => { fetchOps() }, [fetchOps])

  async function deleteOp(id: number, code: string) {
    if (!confirm(`Supprimer l'opération ${code} ?`)) return
    setDeleting(id)
    await fetch(`/api/operations/${id}`, { method: 'DELETE' })
    setDeleting(null)
    fetchOps()
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  // Filtres en-tête appliqués après fetch
  const filtered = useMemo(() => ops.filter(op => {
    if (filterCode   && !op.code.toLowerCase().includes(filterCode.toLowerCase()))   return false
    if (filterClient && !op.client.toLowerCase().includes(filterClient.toLowerCase())) return false
    if (filterMois   && String(op.mois) !== filterMois)   return false
    if (filterAnnee2 && String(op.annee) !== filterAnnee2) return false
    return true
  }), [ops, filterCode, filterClient, filterMois, filterAnnee2])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let va: number | string = 0, vb: number | string = 0
    switch (sortKey) {
      case 'code':    va = a.code; vb = b.code; break
      case 'client':  va = a.client.toLowerCase(); vb = b.client.toLowerCase(); break
      case 'periode': va = a.annee * 100 + a.mois; vb = b.annee * 100 + b.mois; break
      case 'ca':      va = a.prix_vente_ht; vb = b.prix_vente_ht; break
      case 'benefice':va = a.prix_vente_ht - a.cout_total; vb = b.prix_vente_ht - b.cout_total; break
      case 'mb':
        va = a.prix_vente_ht > 0 ? (a.prix_vente_ht - a.cout_total) / a.prix_vente_ht : -999
        vb = b.prix_vente_ht > 0 ? (b.prix_vente_ht - b.cout_total) / b.prix_vente_ht : -999
        break
      case 'me':
        va = a.prix_vente_ht > 0 ? (a.prix_vente_ht - a.cout_sans_cdi) / a.prix_vente_ht : -999
        vb = b.prix_vente_ht > 0 ? (b.prix_vente_ht - b.cout_sans_cdi) / b.prix_vente_ht : -999
        break
      case 'cadence': va = a.cadence_valeur ?? -1; vb = b.cadence_valeur ?? -1; break
      case 'atteinte': va = a.taux_atteinte ?? -1; vb = b.taux_atteinte ?? -1; break
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  }), [filtered, sortKey, sortDir])

  // Drag & drop colonnes
  function onDragStart(id: ColId) { dragCol.current = id }
  function onDragOver(e: React.DragEvent, id: ColId) {
    e.preventDefault()
    dragOverCol.current = id
  }
  function onDrop() {
    if (!dragCol.current || !dragOverCol.current || dragCol.current === dragOverCol.current) return
    const from = dragCol.current, to = dragOverCol.current
    setColOrder(prev => {
      const arr = [...prev]
      const fi = arr.indexOf(from), ti = arr.indexOf(to)
      arr.splice(fi, 1)
      arr.splice(ti, 0, from)
      return arr
    })
    dragCol.current = null; dragOverCol.current = null
  }

  const cols = colOrder.map(id => ALL_COLS.find(c => c.id === id)!)

  // Clients et mois uniques pour les selects de filtre
  const uniqueClients = useMemo(() => [...new Set(ops.map(o => o.client))].sort(), [ops])
  const uniqueMois    = useMemo(() => [...new Set(ops.map(o => o.mois))].sort((a,b) => a-b), [ops])
  const uniqueAnnees  = useMemo(() => [...new Set(ops.map(o => o.annee))].sort((a,b) => b-a), [ops])

  const hasColFilter = filterCode || filterClient || filterMois || filterAnnee2

  function renderHeader(col: ColDef) {
    const sortK = col.id as SortKey
    const isSorted = col.sortable && sortKey === sortK
    return (
      <th
        key={col.id}
        draggable
        onDragStart={() => onDragStart(col.id)}
        onDragOver={e => onDragOver(e, col.id)}
        onDrop={onDrop}
        style={{ minWidth: col.width, cursor: 'grab' }}
        className={`px-3 py-2 text-${col.align ?? 'left'} text-xs font-medium text-slate-400 uppercase select-none bg-slate-800 border-b border-slate-700 group`}
      >
        <div
          className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}
          onClick={col.sortable ? () => toggleSort(sortK) : undefined}
          style={{ cursor: col.sortable ? 'pointer' : 'grab' }}
        >
          <span className="group-hover:text-slate-200 transition-colors">{col.label}</span>
          {col.sortable && (
            <span className={`text-xs ${isSorted ? 'text-indigo-400' : 'text-slate-600'}`}>
              {isSorted ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
            </span>
          )}
          {col.id !== 'actions' && (
            <span className="text-slate-600 group-hover:text-slate-500 ml-0.5" title="Glisser pour déplacer">⠿</span>
          )}
        </div>

        {/* Filtre en-tête */}
        <div className="mt-1" onClick={e => e.stopPropagation()}>
          {col.id === 'code' && (
            <input value={filterCode} onChange={e => setFilterCode(e.target.value)}
              placeholder="Filtrer..." onClick={e => e.stopPropagation()}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          )}
          {col.id === 'client' && (
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500">
              <option value="">Tous</option>
              {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {col.id === 'periode' && (
            <div className="flex gap-1">
              <select value={filterMois} onChange={e => setFilterMois(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 text-white rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="">M.</option>
                {uniqueMois.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={filterAnnee2} onChange={e => setFilterAnnee2(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 text-white rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="">An.</option>
                {uniqueAnnees.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
        </div>
      </th>
    )
  }

  function renderCell(col: ColDef, op: Operation) {
    const mb = op.prix_vente_ht > 0 ? (op.prix_vente_ht - op.cout_total) / op.prix_vente_ht : null
    const me = op.prix_vente_ht > 0 ? (op.prix_vente_ht - op.cout_sans_cdi) / op.prix_vente_ht : null

    switch (col.id) {
      case 'periode':
        return <td key={col.id} className="px-3 py-2.5 text-slate-400 text-sm whitespace-nowrap">{MOIS_NOMS_LONG[op.mois]} {op.annee}</td>
      case 'code':
        return <td key={col.id} className="px-3 py-2.5 font-mono text-indigo-300 font-medium text-sm whitespace-nowrap">{op.code}</td>
      case 'client':
        return <td key={col.id} className="px-3 py-2.5 text-slate-200 text-sm">{op.client}</td>
      case 'type':
        return (
          <td key={col.id} className="px-3 py-2.5 text-center">
            {op.is_ao === 1
              ? <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full ring-1 ring-indigo-500/40">AO</span>
              : <span className="bg-slate-700 text-slate-400 text-xs px-2 py-0.5 rounded-full">Standard</span>}
          </td>
        )
      case 'ca':
        return <td key={col.id} className="px-3 py-2.5 text-right text-slate-200 text-sm">{formatEur(op.prix_vente_ht)}</td>
      case 'benefice':
        return (
          <td key={col.id} className={`px-3 py-2.5 text-right font-medium text-sm ${op.prix_vente_ht > 0 ? (op.prix_vente_ht - op.cout_total >= 0 ? 'text-green-400' : 'text-red-400') : 'text-slate-600'}`}>
            {op.prix_vente_ht > 0 ? formatEur(op.prix_vente_ht - op.cout_total) : '—'}
          </td>
        )
      case 'cout':
        return <td key={col.id} className="px-3 py-2.5 text-right text-slate-400 text-sm">{formatEur(op.cout_total)}</td>
      case 'mb':
        return (
          <td key={col.id} className="px-3 py-2.5 text-center">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${margeBadgeColor(mb)}`}>{formatMarge(mb)}</span>
          </td>
        )
      case 'me':
        return (
          <td key={col.id} className="px-3 py-2.5 text-center">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${margeBadgeColor(me)}`}>{formatMarge(me)}</span>
          </td>
        )
      case 'cadence':
        return (
          <td key={col.id} className="px-3 py-2.5 text-center">
            {op.cadence_valeur != null ? (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-indigo-300 font-medium text-sm">
                  {op.cadence_valeur.toLocaleString('fr-FR')}
                  <span className="text-xs text-slate-500 ml-0.5">f/h</span>
                </span>
                {op.type_zone && (
                  <span className="text-xs text-slate-500 font-mono">{op.type_zone}</span>
                )}
              </div>
            ) : (
              <span className="text-slate-600 text-sm">—</span>
            )}
          </td>
        )
      case 'atteinte':
        return (
          <td key={col.id} className="px-3 py-2.5 text-center">
            {op.taux_atteinte != null ? (
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                op.taux_atteinte >= 100
                  ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/40'
                  : op.taux_atteinte >= 80
                  ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40'
                  : 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40'
              }`}>
                {op.taux_atteinte}%
              </span>
            ) : (
              <span className="text-slate-600 text-sm">—</span>
            )}
          </td>
        )
      case 'actions':
        return (
          <td key={col.id} className="px-3 py-2.5 text-center">
            <div className="flex items-center justify-center gap-2">
              <Link href={`/operations/${op.id}/edit`}
                className="text-slate-400 hover:text-white transition-colors text-xs px-2 py-1 rounded hover:bg-slate-700">
                Modifier
              </Link>
              <button onClick={() => deleteOp(op.id, op.code)} disabled={deleting === op.id}
                className="text-red-400 hover:text-red-300 transition-colors text-xs px-2 py-1 rounded hover:bg-red-900/20 disabled:opacity-50">
                {deleting === op.id ? '...' : 'Supprimer'}
              </button>
            </div>
          </td>
        )
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Opérations</h1>
          <p className="text-sm text-slate-400">
            {sorted.length !== ops.length ? `${sorted.length} / ${ops.length}` : ops.length} opération{ops.length !== 1 ? 's' : ''}
            {hasColFilter && <button onClick={() => { setFilterCode(''); setFilterClient(''); setFilterMois(''); setFilterAnnee2('') }}
              className="ml-2 text-xs text-indigo-400 hover:text-indigo-300 underline">Effacer filtres</button>}
          </p>
        </div>
        <Link href="/operations/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Nouvelle opération
        </Link>
      </div>

      {/* Filtres globaux */}
      <div className="flex flex-wrap gap-3">
        <input type="text" placeholder="Rechercher (code, client)..." value={q} onChange={e => setQ(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        <select value={annee} onChange={e => setAnnee(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option value="">Toutes les années</option>
          {ANNEES_DISPONIBLES.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex rounded-lg border border-slate-700 overflow-hidden text-sm">
          {([['', 'Tous'], ['0', 'Hors AO'], ['1', 'AO']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setIsAo(v)}
              className={`px-4 py-2 transition-colors ${isAo === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
              {l}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-600 self-center">⠿ Glissez les en-têtes pour réordonner les colonnes</p>
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>{cols.map(c => renderHeader(c))}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={cols.length} className="px-4 py-12 text-center text-slate-400">Chargement...</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={cols.length} className="px-4 py-12 text-center text-slate-500">Aucune opération trouvée</td></tr>
              ) : sorted.map(op => (
                <tr key={op.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  {cols.map(c => renderCell(c, op))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
