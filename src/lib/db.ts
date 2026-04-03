import { Pool } from 'pg'

// Types only — no top-level DB initialization to avoid webpack issues
export interface Operation {
  id: number
  code: string
  mois: number
  annee: number
  client: string
  is_ao: number
  prix_vente_ht: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LigneCout {
  id: number
  operation_id: number
  type: 'CDI' | 'AGENT' | 'SUPPORT' | 'DEPLACEMENT'
  intitule: string
  nb_heures: number | null
  taux_horaire: number | null
  cout_fixe: number | null
  created_at: string
}

export interface CdiAgent {
  id: number
  prenom: string
  date_debut: string
  date_fin: string | null
}

export interface OperationWithLignes extends Operation {
  lignes: LigneCout[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: Pool | null = null
let _init: Promise<void> | null = null

async function initDb(db: Pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS operations (
      id BIGSERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      mois INTEGER NOT NULL CHECK(mois BETWEEN 1 AND 12),
      annee INTEGER NOT NULL,
      client TEXT NOT NULL,
      is_ao INTEGER NOT NULL DEFAULT 0,
      prix_vente_ht DOUBLE PRECISION NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS lignes_couts (
      id BIGSERIAL PRIMARY KEY,
      operation_id BIGINT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('CDI', 'AGENT', 'SUPPORT', 'DEPLACEMENT')),
      intitule TEXT NOT NULL,
      nb_heures DOUBLE PRECISION,
      taux_horaire DOUBLE PRECISION,
      cout_fixe DOUBLE PRECISION,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS cdi_agents (
      id BIGSERIAL PRIMARY KEY,
      prenom TEXT UNIQUE NOT NULL,
      date_debut DATE NOT NULL,
      date_fin DATE
    );

    CREATE TABLE IF NOT EXISTS cadences (
      id BIGSERIAL PRIMARY KEY,
      operation_id BIGINT NOT NULL UNIQUE REFERENCES operations(id) ON DELETE CASCADE,
      superficie DOUBLE PRECISION,
      type_zone TEXT,
      nb_flyers INTEGER,
      nb_heures DOUBLE PRECISION,
      poids_document TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_operations_annee ON operations(annee);
    CREATE INDEX IF NOT EXISTS idx_operations_mois ON operations(mois, annee);
    CREATE INDEX IF NOT EXISTS idx_lignes_operation ON lignes_couts(operation_id);
    CREATE INDEX IF NOT EXISTS idx_cadences_operation ON cadences(operation_id);
  `)

  const { rows } = await db.query<{ n: string }>('SELECT COUNT(*)::text as n FROM cdi_agents')
  const count = Number(rows[0]?.n ?? 0)
  if (count === 0) {
    await db.query(
      "INSERT INTO cdi_agents (prenom, date_debut) VALUES ('Raouf', '2022-01-01'), ('Achraf', '2026-01-01') ON CONFLICT (prenom) DO NOTHING"
    )
  }
}

export async function getDb() {
  if (_db) return _db

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is missing. Add it to .env.local (dev) and Vercel environment variables (prod).')
  }

  _db = new Pool({ connectionString })
  if (!_init) {
    _init = initDb(_db)
  }
  await _init
  return _db
}
