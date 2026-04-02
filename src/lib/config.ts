// Contrats AO long-terme identifiés
export const AO_CLIENTS = ['Pessac', 'Gif-sur-Yvette']

// Années disponibles pour le sélecteur
export const ANNEES_DISPONIBLES = [2022, 2023, 2024, 2025, 2026]

// Types de coûts
export const TYPES_COUT = [
  { value: 'CDI', label: 'Agent CDI' },
  { value: 'AGENT', label: 'Agent' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'DEPLACEMENT', label: 'Déplacement' },
] as const

export type TypeCout = 'CDI' | 'AGENT' | 'SUPPORT' | 'DEPLACEMENT'

export const TYPE_COUT_COLORS: Record<TypeCout, string> = {
  CDI: '#818cf8',
  AGENT: '#60a5fa',
  SUPPORT: '#34d399',
  DEPLACEMENT: '#fbbf24',
}

export const TYPE_COUT_LABELS: Record<TypeCout, string> = {
  CDI: 'Agent CDI',
  AGENT: 'Agent',
  SUPPORT: 'Support',
  DEPLACEMENT: 'Déplacement',
}
