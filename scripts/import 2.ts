/**
 * Script d'import Excel → SQLite
 * Usage : npm run import -- --file=./FFY_Marges_v8.xlsx
 *
 * Format Excel attendu (une ligne par coût) :
 * Colonne A : Code opération  (ex: PESS0426)
 * Colonne B : Mois            (1–12 ou "Janvier"…)
 * Colonne C : Année           (ex: 2026)
 * Colonne D : Client          (ex: Pessac)
 * Colonne E : AO              (oui / 1 / true  ou  non / 0 / false)
 * Colonne F : Prix vente HT   (ex: 10000)
 * Colonne G : Type coût       (CDI / Agent / Support / Déplacement)
 * Colonne H : Intitulé        (ex: Raouf)
 * Colonne I : Nb heures       (ex: 35)
 * Colonne J : Taux horaire    (ex: 15)
 * Colonne K : Coût fixe       (ex: 500)
 *
 * Les colonnes peuvent aussi être en-têtes nommées (non sensible à la casse).
 * Si votre Excel a une structure différente, modifiez COLUMN_MAP ci-dessous.
 */

import * as XLSX from 'xlsx'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// ─── Configuration des colonnes ───────────────────────────────────────────────
// Mettez ici les noms exacts de vos en-têtes (insensible à la casse),
// ou les indices 0-based si pas d'en-tête (ex: 0 = colonne A)
const COLUMN_MAP = {
  code:          ['code', 'code opération', 'code operation', 'ref', 'référence', 0],
  mois:          ['mois', 'month', 1],
  annee:         ['annee', 'année', 'year', 'an', 2],
  client:        ['client', 3],
  is_ao:         ['ao', 'appel offres', 'appel d\'offres', 4],
  prix_vente_ht: ['prix vente ht', 'prix vente', 'ca ht', 'vente ht', 'prix ht', 5],
  type:          ['type', 'type cout', 'type coût', 'type coùt', 6],
  intitule:      ['intitule', 'intitulé', 'prénom', 'prenom', 'libelle', 'libellé', 7],
  nb_heures:     ['nb heures', 'heures', 'h', 8],
  taux_horaire:  ['taux horaire', 'taux', 'taux/h', 9],
  cout_fixe:     ['cout fixe', 'coût fixe', 'montant fixe', 'fixe', 10],
}

const MOIS_MAP: Record<string, number> = {
  janvier: 1, jan: 1, january: 1,
  février: 2, fevrier: 2, fev: 2, feb: 2, february: 2,
  mars: 3, mar: 3, march: 3,
  avril: 4, avr: 4, apr: 4, april: 4,
  mai: 5, may: 5,
  juin: 6, jun: 6, june: 6,
  juillet: 7, jul: 7, july: 7,
  août: 8, aout: 8, aug: 8, august: 8,
  septembre: 9, sep: 9, sept: 9, september: 9,
  octobre: 10, oct: 10, october: 10,
  novembre: 11, nov: 11, november: 11,
  décembre: 12, decembre: 12, dec: 12, december: 12,
}

const TYPE_MAP: Record<string, string> = {
  cdi: 'CDI', 'agent cdi': 'CDI',
  agent: 'AGENT', 'agent ext': 'AGENT', 'agent externe': 'AGENT',
  support: 'SUPPORT', impression: 'SUPPORT', création: 'SUPPORT', creation: 'SUPPORT',
  déplacement: 'DEPLACEMENT', deplacement: 'DEPLACEMENT', transport: 'DEPLACEMENT',
  essence: 'DEPLACEMENT', péage: 'DEPLACEMENT', peage: 'DEPLACEMENT',
  sncf: 'DEPLACEMENT', airbnb: 'DEPLACEMENT', hôtel: 'DEPLACEMENT', hotel: 'DEPLACEMENT',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getArg(name: string): string | null {
  const prefix = `--${name}=`
  const arg = process.argv.find(a => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : null
}

function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase()
}

function findCol(row: Record<string, unknown>, headers: (string | number)[]): unknown {
  for (const h of headers) {
    if (typeof h === 'number') {
      const keys = Object.keys(row)
      if (keys[h] !== undefined) return row[keys[h]]
    } else {
      const key = Object.keys(row).find(k => norm(k) === h)
      if (key !== undefined) return row[key]
    }
  }
  return undefined
}

function parseMois(v: unknown): number {
  if (typeof v === 'number') return Math.round(v)
  const s = norm(v)
  if (/^\d+$/.test(s)) return parseInt(s)
  return MOIS_MAP[s] ?? 0
}

function parseAo(v: unknown): boolean {
  const s = norm(v)
  return s === 'oui' || s === 'yes' || s === '1' || s === 'true' || s === 'x'
}

function parseType(v: unknown): string {
  const s = norm(v)
  return TYPE_MAP[s] ?? 'AGENT'
}

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[€\s,]/g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = getArg('file') ?? getArg('f')
  if (!filePath) {
    console.error('❌  Usage : npm run import -- --file=./mon_fichier.xlsx')
    process.exit(1)
  }

  const absPath = path.resolve(filePath)
  if (!fs.existsSync(absPath)) {
    console.error(`❌  Fichier introuvable : ${absPath}`)
    process.exit(1)
  }

  console.log(`📂  Lecture de : ${absPath}`)
  const workbook = XLSX.readFile(absPath)

  // Try to find the sheet with the most data
  let sheetName = workbook.SheetNames[0]
  let maxRows = 0
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
    if (rows.length > maxRows) { maxRows = rows.length; sheetName = name }
  }
  console.log(`📋  Feuille : "${sheetName}" (${maxRows} lignes)`)

  const ws = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: false })

  if (rows.length === 0) {
    console.error('❌  Aucune ligne trouvée dans la feuille.')
    process.exit(1)
  }

  // Show first row to help diagnose
  console.log('\n🔍  En-têtes détectés :', Object.keys(rows[0]).join(' | '))
  console.log('    Exemple ligne 1  :', JSON.stringify(rows[0]))
  console.log()

  // Open DB
  const DATA_DIR = path.join(process.cwd(), 'data')
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  const DB_PATH = path.join(DATA_DIR, 'marges.db')

  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Init schema (same as lib/db.ts)
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_operations_annee ON operations(annee);
    CREATE INDEX IF NOT EXISTS idx_lignes_operation ON lignes_couts(operation_id);
  `)

  // Seed CDI agents
  const count = (db.prepare('SELECT COUNT(*) as n FROM cdi_agents').get() as { n: number }).n
  if (count === 0) {
    db.prepare("INSERT OR IGNORE INTO cdi_agents (prenom, date_debut) VALUES ('Raouf', '2022-01-01'), ('Achraf', '2026-01-01')").run()
  }

  const insertOp = db.prepare(`
    INSERT OR IGNORE INTO operations (code, mois, annee, client, is_ao, prix_vente_ht)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const getOpId = db.prepare('SELECT id FROM operations WHERE code = ?')
  const insertLigne = db.prepare(`
    INSERT INTO lignes_couts (operation_id, type, intitule, nb_heures, taux_horaire, cout_fixe)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const updatePrix = db.prepare('UPDATE operations SET prix_vente_ht = ?, client = ?, mois = ?, annee = ?, is_ao = ? WHERE code = ?')

  let imported = 0, skipped = 0, errors = 0

  const importAll = db.transaction(() => {
    for (const row of rows) {
      const code = String(findCol(row, COLUMN_MAP.code) ?? '').toUpperCase().trim()
      if (!code) { skipped++; continue }

      const mois = parseMois(findCol(row, COLUMN_MAP.mois))
      const annee = parseInt(String(findCol(row, COLUMN_MAP.annee) ?? '0'))
      const client = String(findCol(row, COLUMN_MAP.client) ?? '').trim()
      const is_ao = parseAo(findCol(row, COLUMN_MAP.is_ao))
      const prix_vente_ht = parseNum(findCol(row, COLUMN_MAP.prix_vente_ht)) ?? 0
      const type = parseType(findCol(row, COLUMN_MAP.type))
      const intitule = String(findCol(row, COLUMN_MAP.intitule) ?? type).trim() || type
      const nb_heures = parseNum(findCol(row, COLUMN_MAP.nb_heures))
      const taux_horaire = parseNum(findCol(row, COLUMN_MAP.taux_horaire))
      const cout_fixe = parseNum(findCol(row, COLUMN_MAP.cout_fixe))

      if (!mois || !annee) { skipped++; continue }

      try {
        // Upsert operation
        insertOp.run(code, mois, annee, client || 'Inconnu', is_ao ? 1 : 0, prix_vente_ht)
        // Update prix/client if operation already existed (in case multiple rows share the same code)
        if (prix_vente_ht > 0 || client) {
          const existing = getOpId.get(code) as { id: number }
          updatePrix.run(prix_vente_ht, client || 'Inconnu', mois, annee, is_ao ? 1 : 0, code)
          // Add cost line
          const hasLigne = nb_heures || taux_horaire || cout_fixe
          if (hasLigne) {
            insertLigne.run(existing.id, type, intitule, nb_heures, taux_horaire, cout_fixe)
          }
        }
        imported++
      } catch (e) {
        console.error(`  ⚠️  Ligne ignorée (${code}): ${e}`)
        errors++
      }
    }
  })

  importAll()

  const nbOps = (db.prepare('SELECT COUNT(*) as n FROM operations').get() as { n: number }).n
  const nbLignes = (db.prepare('SELECT COUNT(*) as n FROM lignes_couts').get() as { n: number }).n

  console.log(`✅  Import terminé !`)
  console.log(`   Lignes traitées : ${rows.length}`)
  console.log(`   Importées       : ${imported}`)
  console.log(`   Ignorées        : ${skipped}`)
  console.log(`   Erreurs         : ${errors}`)
  console.log(`   → Opérations en base : ${nbOps}`)
  console.log(`   → Lignes de coûts   : ${nbLignes}`)
  console.log()
  console.log('💡  Si les colonnes n\'ont pas été reconnues, modifiez COLUMN_MAP dans scripts/import.ts')
  console.log('    puis relancez : npm run import -- --file=./votre_fichier.xlsx')

  db.close()
}

main().catch(e => { console.error('❌', e); process.exit(1) })
