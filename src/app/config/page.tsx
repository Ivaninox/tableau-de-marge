'use client'
import { useState, useEffect } from 'react'

interface CdiAgent { id: number; prenom: string; date_debut: string; date_fin: string | null }

export default function ConfigPage() {
  const [agents, setAgents] = useState<CdiAgent[]>([])
  const [prenom, setPrenom] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [saving, setSaving] = useState(false)

  function load() {
    fetch('/api/cdi-agents').then(r => r.json()).then(setAgents)
  }
  useEffect(() => { load() }, [])

  async function addAgent(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/cdi-agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prenom, date_debut: dateDebut }),
    })
    setPrenom(''); setDateDebut('')
    setSaving(false)
    load()
  }

  async function deleteAgent(id: number) {
    if (!confirm('Supprimer cet agent CDI ?')) return
    await fetch('/api/cdi-agents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuration</h1>
        <p className="text-sm text-slate-400">Paramètres de l&apos;application</p>
      </div>

      {/* CDI Agents */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">Agents CDI</h2>
          <p className="text-sm text-slate-400 mt-1">
            Les coûts de ces agents sont exclus du calcul de la <strong className="text-slate-300">Marge Externe</strong>.
          </p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="py-2 text-left text-xs font-medium text-slate-400 uppercase">Prénom</th>
              <th className="py-2 text-left text-xs font-medium text-slate-400 uppercase">Depuis</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {agents.map(a => (
              <tr key={a.id} className="border-b border-slate-700/50">
                <td className="py-3 text-slate-200 font-medium">{a.prenom}</td>
                <td className="py-3 text-slate-400">{a.date_debut}</td>
                <td className="py-3 text-right">
                  <button onClick={() => deleteAgent(a.id)}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/20 transition-colors">
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form onSubmit={addAgent} className="flex gap-3 pt-2">
          <input
            type="text" required
            value={prenom} onChange={e => setPrenom(e.target.value)}
            placeholder="Prénom"
            className="flex-1 bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <input
            type="date" required
            value={dateDebut} onChange={e => setDateDebut(e.target.value)}
            className="bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button type="submit" disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60">
            Ajouter
          </button>
        </form>
      </div>

      {/* Seuils de marge */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-3">Seuils de marge (lecture seule)</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block flex-shrink-0" />
            <span className="text-slate-400">Rouge :</span>
            <span className="text-slate-200">Marge &lt; 40 %</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-orange-500 inline-block flex-shrink-0" />
            <span className="text-slate-400">Orange :</span>
            <span className="text-slate-200">Marge entre 40 % et 65 %</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block flex-shrink-0" />
            <span className="text-slate-400">Vert :</span>
            <span className="text-slate-200">Marge ≥ 65 %</span>
          </div>
        </div>
      </div>
    </div>
  )
}
