'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { TYPES_COUT, ANNEES_DISPONIBLES } from '@/lib/config'
import {
  coutLigne, coutTotal, coutSansCDI,
  margeBrute, margeExterne, formatMarge, formatEurDec, margeBadgeColor, MOIS_NOMS_LONG,
} from '@/lib/calculations'

// ─── Types de zones pour la cadence ──────────────────────────────────────────

const TYPES_ZONE = [
  { value: 'U1', label: '(U1) +95% boîtes collectives' },
  { value: 'U2', label: '(U2) 75% à 95% boîtes collectives' },
  { value: 'S1', label: '(S1) 55% à 75% boîtes collectives' },
  { value: 'S2', label: '(S2) 45% à 55% boîtes collectives' },
  { value: 'S3', label: '(S3) 25% à 45% boîtes collectives' },
  { value: 'R1', label: '(R1) 10% à 25% boîtes collectives' },
  { value: 'R2', label: '(R2) -10% boîtes collectives' },
]

const POIDS_DOCUMENT = [
  { value: 'leger',        label: 'Léger (80 – 135g)' },
  { value: 'epais',        label: 'Épais (170 – 250g)' },
  { value: 'lourd',        label: 'Lourd (250 – 350g)' },
  { value: 'tres_lourd',   label: 'Très lourd (350 – 500g)' },
  { value: 'super_lourd',  label: 'Super lourd (>500g)' },
]

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface LigneForm {
  id: string
  type: 'CDI' | 'AGENT' | 'SUPPORT' | 'DEPLACEMENT'
  intitule: string
  nb_heures: string
  taux_horaire: string
  cout_fixe: string
}

interface CadenceForm {
  superficie: string
  type_zone: string
  nb_flyers: string
  nb_heures: string
  poids_document: string
}

interface FormData {
  code: string
  mois: number
  annee: number
  client: string
  is_ao: boolean
  prix_vente_ht: string
  notes: string
  lignes: LigneForm[]
  cadence: CadenceForm
}

function newLigne(): LigneForm {
  return { id: crypto.randomUUID(), type: 'AGENT', intitule: '', nb_heures: '', taux_horaire: '', cout_fixe: '' }
}

function parseLigne(l: LigneForm) {
  return {
    type: l.type,
    nb_heures: l.nb_heures ? Number(l.nb_heures) : null,
    taux_horaire: l.taux_horaire ? Number(l.taux_horaire) : null,
    cout_fixe: l.cout_fixe ? Number(l.cout_fixe) : null,
  }
}

interface Props {
  initialData?: {
    id: number
    code: string; mois: number; annee: number; client: string; is_ao: number
    prix_vente_ht: number; notes: string | null
    lignes: Array<{ type: string; intitule: string; nb_heures: number | null; taux_horaire: number | null; cout_fixe: number | null }>
    cadence?: { superficie: number | null; type_zone: string | null; nb_flyers: number | null; nb_heures: number | null; poids_document: string | null } | null
  }
}

// ─── Composant ClientSelect ────────────────────────────────────────────────────

function ClientSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [clients, setClients] = useState<string[]>([])
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients)
  }, [])

  // Sync query when value changes externally (e.g. on edit load)
  useEffect(() => { setQuery(value) }, [value])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.trim()
    ? clients.filter(c => c.toLowerCase().includes(query.trim().toLowerCase()))
    : clients

  function select(c: string) {
    onChange(c)
    setQuery(c)
    setOpen(false)
  }

  function handleInput(v: string) {
    setQuery(v)
    onChange(v)
    setOpen(true)
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        required
        value={query}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Rechercher ou saisir un client..."
        className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {filtered.map(c => (
            <li key={c}
              onMouseDown={() => select(c)}
              className={clsx(
                'px-3 py-2 text-sm cursor-pointer hover:bg-slate-700 transition-colors',
                c === value ? 'text-indigo-300 bg-indigo-900/30' : 'text-slate-200'
              )}>
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function OperationForm({ initialData }: Props) {
  const router = useRouter()
  const isEdit = !!initialData

  const [form, setForm] = useState<FormData>(() => {
    if (initialData) {
      const cad = initialData.cadence
      return {
        code: initialData.code,
        mois: initialData.mois,
        annee: initialData.annee,
        client: initialData.client,
        is_ao: initialData.is_ao === 1,
        prix_vente_ht: String(initialData.prix_vente_ht),
        notes: initialData.notes ?? '',
        lignes: initialData.lignes.map(l => ({
          id: crypto.randomUUID(),
          type: l.type as LigneForm['type'],
          intitule: l.intitule,
          nb_heures: l.nb_heures !== null ? String(l.nb_heures) : '',
          taux_horaire: l.taux_horaire !== null ? String(l.taux_horaire) : '',
          cout_fixe: l.cout_fixe !== null ? String(l.cout_fixe) : '',
        })),
        cadence: {
          superficie: cad?.superficie != null ? String(cad.superficie) : '',
          type_zone: cad?.type_zone ?? '',
          nb_flyers: cad?.nb_flyers != null ? String(cad.nb_flyers) : '',
          nb_heures: cad?.nb_heures != null ? String(cad.nb_heures) : '',
          poids_document: cad?.poids_document ?? '',
        },
      }
    }
    const now = new Date()
    return {
      code: '', mois: now.getMonth() + 1, annee: now.getFullYear(),
      client: '', is_ao: false, prix_vente_ht: '', notes: '', lignes: [newLigne()],
      cadence: { superficie: '', type_zone: '', nb_flyers: '', nb_heures: '', poids_document: '' },
    }
  })

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Real-time margin computation
  const parsedLignes = form.lignes.map(parseLigne)
  const ca = Number(form.prix_vente_ht) || 0
  const cout = coutTotal(parsedLignes)
  const coutSCDI = coutSansCDI(parsedLignes)
  const mb = margeBrute(ca, cout)
  const me = margeExterne(ca, coutSCDI)
  const benefice = ca - cout

  // Cadence calculation
  const cadenceFlyers = Number(form.cadence.nb_flyers) || 0
  const cadenceHeures = Number(form.cadence.nb_heures) || 0
  const cadenceResult = cadenceFlyers > 0 && cadenceHeures > 0
    ? Math.round(cadenceFlyers / cadenceHeures)
    : null

  function setField<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function setCadence(k: keyof CadenceForm, v: string) {
    setForm(f => ({ ...f, cadence: { ...f.cadence, [k]: v } }))
  }

  function setLigne(id: string, k: keyof LigneForm, v: string) {
    setForm(f => ({ ...f, lignes: f.lignes.map(l => l.id === id ? { ...l, [k]: v } : l) }))
  }

  function addLigne() {
    setForm(f => ({ ...f, lignes: [...f.lignes, newLigne()] }))
  }

  function removeLigne(id: string) {
    setForm(f => ({ ...f, lignes: f.lignes.filter(l => l.id !== id) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const cad = form.cadence
    const cadencePayload = (cad.nb_flyers || cad.nb_heures || cad.superficie || cad.type_zone || cad.poids_document) ? {
      superficie: cad.superficie ? Number(cad.superficie) : null,
      type_zone: cad.type_zone || null,
      nb_flyers: cad.nb_flyers ? Number(cad.nb_flyers) : null,
      nb_heures: cad.nb_heures ? Number(cad.nb_heures) : null,
      poids_document: cad.poids_document || null,
    } : null

    const payload = {
      code: form.code.toUpperCase(),
      mois: form.mois,
      annee: form.annee,
      client: form.client,
      is_ao: form.is_ao,
      prix_vente_ht: Number(form.prix_vente_ht) || 0,
      notes: form.notes || null,
      lignes: form.lignes.map(l => ({ ...parseLigne(l), intitule: l.intitule })),
      cadence: cadencePayload,
    }

    try {
      const url = isEdit ? `/api/operations/${initialData!.id}` : '/api/operations'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? 'Erreur inconnue')
        setSaving(false)
        return
      }
      router.push('/operations')
    } catch {
      setError('Erreur réseau')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Infos générales */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">Informations générales</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Code opération *</label>
            <input
              type="text"
              required
              value={form.code}
              onChange={e => setField('code', e.target.value.toUpperCase())}
              placeholder="ex: PESS0426"
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2.5 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-xs text-slate-500 mt-1">Doit se terminer par les 2 derniers chiffres de l&apos;année</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Mois *</label>
            <select required value={form.mois} onChange={e => setField('mois', Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              {MOIS_NOMS_LONG.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Année *</label>
            <select required value={form.annee} onChange={e => setField('annee', Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              {ANNEES_DISPONIBLES.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Client *</label>
            <ClientSelect value={form.client} onChange={v => setField('client', v)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Prix de vente HT *</label>
            <div className="relative">
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={form.prix_vente_ht}
                onChange={e => setField('prix_vente_ht', e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Type d&apos;opération *</label>
          <div className="flex gap-4">
            {([false, true] as const).map(v => (
              <label key={String(v)} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="is_ao"
                  checked={form.is_ao === v}
                  onChange={() => setField('is_ao', v)}
                  className="w-4 h-4 accent-indigo-500"
                />
                <span className={clsx('text-sm', form.is_ao === v ? 'text-white' : 'text-slate-400')}>
                  {v ? 'Appel d\'Offres (AO)' : 'Standard'}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Notes (optionnel)</label>
          <textarea
            value={form.notes}
            onChange={e => setField('notes', e.target.value)}
            rows={2}
            placeholder="Remarques, contexte..."
            className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
        </div>
      </div>

      {/* Lignes de coûts */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-white">Lignes de coûts</h2>
          <button type="button" onClick={addLigne}
            className="text-sm text-indigo-400 hover:text-indigo-300 border border-indigo-500/40 hover:border-indigo-400 px-3 py-1.5 rounded-lg transition-colors">
            + Ajouter une ligne
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Saisissez toutes les lignes ici. La <span className="text-slate-400">Marge Externe</span> est calculée automatiquement en excluant les lignes de type <span className="text-slate-400">Agent CDI</span> — pas besoin de saisir deux fois.
        </p>

        {form.lignes.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">Aucune ligne — cliquez sur « Ajouter »</p>
        ) : (
          <div className="space-y-2">
            <div className="hidden sm:grid grid-cols-[160px_1fr_90px_90px_90px_80px_36px] gap-2 text-xs font-medium text-slate-400 uppercase px-1">
              <span>Type</span><span>Intitulé</span><span className="text-right">Heures</span>
              <span className="text-right">Taux /h</span><span className="text-right">Coût fixe</span>
              <span className="text-right">Total</span><span />
            </div>

            {form.lignes.map((l) => {
              const pl = parseLigne(l)
              const total = coutLigne(pl)
              return (
                <div key={l.id}
                  className="grid grid-cols-1 sm:grid-cols-[160px_1fr_90px_90px_90px_80px_36px] gap-2 items-center bg-slate-900/60 rounded-lg p-2">
                  <select
                    value={l.type}
                    onChange={e => setLigne(l.id, 'type', e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    {TYPES_COUT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>

                  <input
                    type="text"
                    value={l.intitule}
                    onChange={e => setLigne(l.id, 'intitule', e.target.value)}
                    placeholder="Prénom / intitulé"
                    className="bg-slate-900 border border-slate-700 text-white rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />

                  <input
                    type="number" min="0" step="0.5"
                    value={l.nb_heures}
                    onChange={e => setLigne(l.id, 'nb_heures', e.target.value)}
                    placeholder="0"
                    className="bg-slate-900 border border-slate-700 text-white rounded-md px-2 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />

                  <input
                    type="number" min="0" step="0.01"
                    value={l.taux_horaire}
                    onChange={e => setLigne(l.id, 'taux_horaire', e.target.value)}
                    placeholder="0.00 €"
                    className="bg-slate-900 border border-slate-700 text-white rounded-md px-2 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />

                  <input
                    type="number" min="0" step="0.01"
                    value={l.cout_fixe}
                    onChange={e => setLigne(l.id, 'cout_fixe', e.target.value)}
                    placeholder="0.00 €"
                    className="bg-slate-900 border border-slate-700 text-white rounded-md px-2 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />

                  <div className="text-right text-sm font-medium text-slate-200 px-1">
                    {total > 0 ? formatEurDec(total) : <span className="text-slate-600">—</span>}
                  </div>

                  <button type="button" onClick={() => removeLigne(l.id)}
                    disabled={form.lignes.length === 1}
                    className="flex items-center justify-center w-8 h-8 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-20">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cadence */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-1">Cadence <span className="text-slate-500 font-normal text-sm">(facultatif)</span></h2>
        <p className="text-xs text-slate-500 mb-4">
          Renseignez ces champs pour calculer la performance de distribution. La cadence (flyers/heure) est affichée automatiquement.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Superficie (km²)</label>
            <input
              type="number" min="0" step="0.01"
              value={form.cadence.superficie}
              onChange={e => setCadence('superficie', e.target.value)}
              placeholder="ex: 12.5"
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Type de zone</label>
            <select
              value={form.cadence.type_zone}
              onChange={e => setCadence('type_zone', e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              <option value="">— Sélectionner —</option>
              {TYPES_ZONE.map(z => (
                <option key={z.value} value={z.value}>{z.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Flyers distribués</label>
            <input
              type="number" min="0" step="1"
              value={form.cadence.nb_flyers}
              onChange={e => setCadence('nb_flyers', e.target.value)}
              placeholder="ex: 5000"
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Heures terrain</label>
            <input
              type="number" min="0" step="0.5"
              value={form.cadence.nb_heures}
              onChange={e => setCadence('nb_heures', e.target.value)}
              placeholder="ex: 8"
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Poids du document</label>
            <select
              value={form.cadence.poids_document}
              onChange={e => setCadence('poids_document', e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              <option value="">— Sélectionner —</option>
              {POIDS_DOCUMENT.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Résultat cadence */}
        <div className="mt-4 flex items-center gap-3">
          <div className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
            cadenceResult !== null
              ? 'bg-indigo-900/30 border-indigo-500/40'
              : 'bg-slate-900/40 border-slate-700'
          )}>
            <div className="text-xs font-medium text-slate-400 uppercase">Cadence</div>
            <div className={clsx(
              'text-xl font-bold',
              cadenceResult !== null ? 'text-indigo-300' : 'text-slate-600'
            )}>
              {cadenceResult !== null ? `${cadenceResult.toLocaleString('fr-FR')} flyers/h` : '—'}
            </div>
          </div>
          {form.cadence.type_zone && (
            <div className="text-xs text-slate-500">
              Zone <span className="text-slate-300 font-medium">{form.cadence.type_zone}</span>
              {' · '}{TYPES_ZONE.find(z => z.value === form.cadence.type_zone)?.label.replace(/^\([A-Z0-9]+\)\s*/, '')}
            </div>
          )}
        </div>
      </div>

      {/* Aperçu des marges */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Aperçu des marges</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <p className="text-xs text-slate-400 mb-1">CA HT</p>
            <p className="text-lg font-bold text-white">{ca > 0 ? formatEurDec(ca) : '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400 mb-1">Coût total</p>
            <p className="text-lg font-bold text-slate-300">{cout > 0 ? formatEurDec(cout) : '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400 mb-1">Bénéfice</p>
            <p className={clsx('text-lg font-bold', benefice >= 0 ? 'text-green-400' : 'text-red-400')}>
              {ca > 0 ? formatEurDec(benefice) : '—'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400 mb-1">Coût hors CDI</p>
            <p className="text-lg font-bold text-slate-300">{coutSCDI > 0 ? formatEurDec(coutSCDI) : '—'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900/60 rounded-xl p-4 text-center">
            <p className="text-xs font-medium text-slate-400 uppercase mb-2">Marge Brute</p>
            <p className={clsx('text-3xl font-bold', margeBadgeColor(mb).split(' ')[1])}>
              {formatMarge(mb)}
            </p>
            <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all', mb !== null && mb < 0.4 ? 'bg-red-500' : mb !== null && mb < 0.65 ? 'bg-orange-500' : 'bg-green-500')}
                style={{ width: mb !== null ? `${Math.max(0, Math.min(100, mb * 100))}%` : '0%' }}
              />
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-xl p-4 text-center">
            <p className="text-xs font-medium text-slate-400 uppercase mb-2">Marge Externe</p>
            <p className={clsx('text-3xl font-bold', margeBadgeColor(me).split(' ')[1])}>
              {formatMarge(me)}
            </p>
            <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all', me !== null && me < 0.4 ? 'bg-red-500' : me !== null && me < 0.65 ? 'bg-orange-500' : 'bg-green-500')}
                style={{ width: me !== null ? `${Math.max(0, Math.min(100, me * 100))}%` : '0%' }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">CDI exclus du calcul</p>
          </div>
        </div>
      </div>

      {/* Error & Submit */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => router.push('/operations')}
          className="text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 px-5 py-2.5 rounded-lg text-sm transition-colors">
          Annuler
        </button>
        <button type="submit" disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors">
          {saving ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Enregistrer l\'opération'}
        </button>
      </div>
    </form>
  )
}
