import type { LigneCout } from './db'

export function coutLigne(l: Pick<LigneCout, 'nb_heures' | 'taux_horaire' | 'cout_fixe'>): number {
  return (l.nb_heures ?? 0) * (l.taux_horaire ?? 0) + (l.cout_fixe ?? 0)
}

export function coutTotal(lignes: Pick<LigneCout, 'type' | 'nb_heures' | 'taux_horaire' | 'cout_fixe'>[]): number {
  return lignes.reduce((s, l) => s + coutLigne(l), 0)
}

export function coutSansCDI(lignes: Pick<LigneCout, 'type' | 'nb_heures' | 'taux_horaire' | 'cout_fixe'>[]): number {
  return lignes.filter(l => l.type !== 'CDI').reduce((s, l) => s + coutLigne(l), 0)
}

export function margeBrute(prixVenteHt: number, cout: number): number | null {
  if (!prixVenteHt) return null
  return (prixVenteHt - cout) / prixVenteHt
}

export function margeExterne(prixVenteHt: number, coutSCDI: number): number | null {
  if (!prixVenteHt) return null
  return (prixVenteHt - coutSCDI) / prixVenteHt
}

export function margeColor(m: number | null): string {
  if (m === null) return 'text-slate-400'
  if (m < 0.4) return 'text-red-400'
  if (m < 0.65) return 'text-orange-400'
  return 'text-green-400'
}

export function margeBadgeColor(m: number | null): string {
  if (m === null) return 'bg-slate-700 text-slate-300'
  if (m < 0.4) return 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40'
  if (m < 0.65) return 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40'
  return 'bg-green-500/20 text-green-400 ring-1 ring-green-500/40'
}

export function margeBarColor(m: number | null): string {
  if (m === null) return '#64748b'
  if (m < 0.4) return '#f87171'
  if (m < 0.65) return '#fb923c'
  return '#4ade80'
}

export function formatMarge(m: number | null): string {
  if (m === null) return '—'
  return `${(m * 100).toFixed(1)} %`
}

export function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatEurDec(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export const MOIS_NOMS = [
  '', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
  'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
]

export const MOIS_NOMS_LONG = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
