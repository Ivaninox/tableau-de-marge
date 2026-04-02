import path from 'path'
import fs from 'fs'

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
let _db: any = null

export function getDb() {
  if (_db) return _db

  // Use require() so webpack does not attempt to bundle better-sqlite3
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3')

  const DATA_DIR = path.join(process.cwd(), 'data')
  const DB_PATH = path.join(DATA_DIR, 'marges.db')

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')

  _db.exec(`
    CREATE TABLE IF NOT EXISTS operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      mois INTEGER NOT NULL CHECK(mois BETWEEN 1 AND 12),
      annee INTEGER NOT NULL,
      client TEXT NOT NULL,
      is_ao INTEGER NOT NULL DEFAULT 0,
      prix_vente_ht REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lignes_couts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('CDI', 'AGENT', 'SUPPORT', 'DEPLACEMENT')),
      intitule TEXT NOT NULL,
      nb_heures REAL,
      taux_horaire REAL,
      cout_fixe REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cdi_agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prenom TEXT UNIQUE NOT NULL,
      date_debut TEXT NOT NULL,
      date_fin TEXT
    );

    CREATE TABLE IF NOT EXISTS cadences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_id INTEGER NOT NULL UNIQUE REFERENCES operations(id) ON DELETE CASCADE,
      superficie REAL,
      type_zone TEXT,
      nb_flyers INTEGER,
      nb_heures REAL,
      poids_document TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_operations_annee ON operations(annee);
    CREATE INDEX IF NOT EXISTS idx_operations_mois ON operations(mois, annee);
    CREATE INDEX IF NOT EXISTS idx_lignes_operation ON lignes_couts(operation_id);
    CREATE INDEX IF NOT EXISTS idx_cadences_operation ON cadences(operation_id);
  `)

  // Migrations : ajout de colonnes manquantes sur les bases existantes
  const cadenceCols = (_db.prepare("PRAGMA table_info(cadences)").all() as { name: string }[]).map(r => r.name)
  if (!cadenceCols.includes('poids_document')) {
    _db.exec("ALTER TABLE cadences ADD COLUMN poids_document TEXT")
  }

  // Seed CDI agents on first run
  const count = (_db.prepare('SELECT COUNT(*) as n FROM cdi_agents').get() as { n: number }).n
  if (count === 0) {
    _db.prepare("INSERT OR IGNORE INTO cdi_agents (prenom, date_debut) VALUES ('Raouf', '2022-01-01'), ('Achraf', '2026-01-01')").run()
  }

  return _db
}
