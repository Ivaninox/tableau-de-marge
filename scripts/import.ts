/**
 * Import FFY Marges Excel → Neon Postgres
 *
 * Gère deux formats :
 *
 * FORMAT A — "FFY_Marges_v8.xlsx" (feuilles avec préfixe 📋)
 *   Col 0: Mois | Col 1: Code | Col 2: Agent | Col 3: Type
 *   Col 4: NbH  | Col 5: Taux | Col 6: Coût ligne | Col 7: Coût total | Col 8: Vente HT
 *
 * FORMAT B — "Marges 20xx.xlsx" (Tableau de Marges)
 *   Col 0: Mois | Col 1: Code | Col 2: Agent | Col 3: NbH | Col 4: Taux
 *   Col 5: Coût | Col 6: Coût production | Col 7: Vente HT | Col 8: Bénéfice | Col 9: Marge
 *   Pour "Marges 2022 - 2023.xlsx" : 2022 en cols 0-9, 2023 en cols 11-20
 *
 * Usage :
 *   npm run import -- --file=./FFY_Marges_v8.xlsx --reset
 *   npm run import -- --file=./FFY_Marges_v8.xlsx --file=./"Marges avec AO - 2025.xlsx" --file=./"Marges 2024.xlsx" --file=./"Marges 2022 - 2023.xlsx" --reset
 */

import dotenv from 'dotenv'
import * as XLSX from 'xlsx'
import { Pool, PoolClient } from 'pg'
import path from 'path'
import fs from 'fs'

dotenv.config({ path: '.env.local' })
dotenv.config()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getArgs(name: string): string[] {
  const prefix = `--${name}=`
  return process.argv.filter(a => a.startsWith(prefix)).map(a => a.slice(prefix.length))
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

const MOIS_MAP: Record<string, number> = {
  janvier: 1, jan: 1,
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
  agent: 'AGENT', 'agent ext': 'AGENT', 'agent externe': 'AGENT', interim: 'AGENT',
  support: 'SUPPORT', impression: 'SUPPORT', 'création': 'SUPPORT', creation: 'SUPPORT',
  matériel: 'SUPPORT', materiel: 'SUPPORT', flyers: 'SUPPORT', affiches: 'SUPPORT',
  'déplacement': 'DEPLACEMENT', deplacement: 'DEPLACEMENT', transport: 'DEPLACEMENT',
  essence: 'DEPLACEMENT', 'péage': 'DEPLACEMENT', peage: 'DEPLACEMENT',
  sncf: 'DEPLACEMENT', airbnb: 'DEPLACEMENT', 'hôtel': 'DEPLACEMENT', hotel: 'DEPLACEMENT',
  'dépenses sur place': 'DEPLACEMENT', 'depenses sur place': 'DEPLACEMENT',
  'frais de vie': 'DEPLACEMENT', 'frais d\'essence': 'DEPLACEMENT',
  'frais de déplacement': 'DEPLACEMENT',
}

// Préfixes codes AO connus
const AO_PREFIXES = ['PESS', 'GIF', 'MEL']

function normType(v: string): 'CDI' | 'AGENT' | 'SUPPORT' | 'DEPLACEMENT' {
  const s = v.trim().toLowerCase()
  if (TYPE_MAP[s]) return TYPE_MAP[s] as 'CDI' | 'AGENT' | 'SUPPORT' | 'DEPLACEMENT'
  for (const [k, t] of Object.entries(TYPE_MAP)) {
    if (s.includes(k)) return t as 'CDI' | 'AGENT' | 'SUPPORT' | 'DEPLACEMENT'
  }
  return 'AGENT'
}

function parseMois(v: unknown): number {
  if (!v) return 0
  const s = String(v).trim().toLowerCase().replace(/\r\n|\r|\n/g, ' ').trim()
  if (/^\d+$/.test(s)) return parseInt(s)
  return MOIS_MAP[s] ?? 0
}

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[€\s]/g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

function codeToMois(code: string): number | null {
  const m4 = code.match(/^[A-Z]+(\d{2})(\d{2})/)
  if (m4) { const mm = parseInt(m4[1]); if (mm >= 1 && mm <= 12) return mm }
  const m3 = code.match(/^[A-Z]+(\d)(\d{2})(?:[^0-9]|$)/)
  if (m3) { const mm = parseInt(m3[1]); if (mm >= 1 && mm <= 12) return mm }
  return null
}

function codeToYear(code: string): number | null {
  const m4 = code.match(/^[A-Z]+(\d{2})(\d{2})/)
  if (m4) { const yy = parseInt(m4[2]); if (yy >= 20 && yy <= 35) return 2000 + yy }
  const m3 = code.match(/^[A-Z]+(\d)(\d{2})(?:[^0-9]|$)/)
  if (m3) { const yy = parseInt(m3[2]); if (yy >= 20 && yy <= 35) return 2000 + yy }
  return null
}

function normalizeRawCode(raw: string): string {
  let c = raw.replace(/\n[\s\S]*/g, '').trim()
  const weekMatch = c.match(/^([A-Z0-9]+)\s*\(\s*S(\d+)\s*\)\s*$/i)
  if (weekMatch) return (weekMatch[1] + 'S' + weekMatch[2]).toUpperCase()
  const parenAlpha = c.match(/^(.+?)\s+\(\s*([A-Z]{1,5})\s*\)$/i)
  if (parenAlpha) {
    c = parenAlpha[1].trim() + parenAlpha[2].toUpperCase()
  } else {
    const qualMatch = c.match(/^(.+?)\s+[–-]\s+([A-Z]{1,4})$/i)
    if (qualMatch) {
      c = qualMatch[1] + qualMatch[2].toUpperCase()
    } else {
      const numRefMatch = c.match(/^([A-Za-z][A-Za-z0-9]*\d)\s+[-–]\s+(\d[\d\s]*)$/)
      if (numRefMatch) {
        c = numRefMatch[1].trim() + 'R' + numRefMatch[2].replace(/\s/g, '')
      } else {
        const locMatch = c.match(/^([A-Za-z][A-Za-z0-9]*\d)\s+[-–]\s+([A-Za-zÀ-ÿ]{2,})$/)
        if (locMatch) {
          const loc = locMatch[2].replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase()
          c = locMatch[1].trim() + loc
        } else {
          c = c.replace(/\s+[-–(\/+].*$/, '').trim()
        }
      }
    }
  }
  c = c.replace(/-\d[\d\s]*$/, '').trim()
  return c.replace(/[^A-Z0-9]/g, '')
}

function isAoCode(code: string): boolean {
  return AO_PREFIXES.some(p => code.startsWith(p))
}

function extractClientFromCode(code: string): string {
  return code.replace(/[^A-Z]/g, '') || 'Inconnu'
}

// ─── Base de données ───────────────────────────────────────────────────────────

async function setupDb(pool: Pool, reset: boolean) {
  const client = await pool.connect()
  try {
    if (reset) {
      console.log('🗑️   --reset : suppression des données existantes...\n')
      await client.query(`
        DROP TABLE IF EXISTS cadences;
        DROP TABLE IF EXISTS lignes_couts;
        DROP TABLE IF EXISTS operations;
        DROP TABLE IF EXISTS cdi_agents;
      `)
    }

    await client.query(`
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

    const { rows } = await client.query<{ n: string }>('SELECT COUNT(*)::text as n FROM cdi_agents')
    const count = Number(rows[0]?.n ?? 0)
    if (count === 0) {
      await client.query(
        "INSERT INTO cdi_agents (prenom, date_debut) VALUES ('Raouf', '2022-01-01'), ('Achraf', '2026-01-01') ON CONFLICT (prenom) DO NOTHING"
      )
    }
  } finally {
    client.release()
  }
}

// ─── Traitement FORMAT A (FFY_Marges_v8.xlsx) ─────────────────────────────────

async function processFFYFile(workbook: XLSX.WorkBook, pool: Pool, stats: Stats) {
  const targetSheets = workbook.SheetNames.filter(n =>
    n.startsWith('📋 Saisie') || n.startsWith('📋 AO') || n.startsWith('📋 Archives')
  )

  for (const sheetName of targetSheets) {
    const isAo = sheetName.includes('AO')
    const ws = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null })

    let dataStartRow = 6
    let colOffset = 0

    for (let i = 3; i < 10; i++) {
      const row = rows[i] as unknown[]
      if (!row) continue
      const rowStr = row.map(c => String(c ?? '')).join('|').toLowerCase()
      if (rowStr.includes('code') && rowStr.includes('type')) {
        dataStartRow = i + 2
        const col0h = String(row[0] ?? '').toLowerCase()
        colOffset = col0h.includes('mois') ? 0 : 1
        break
      }
    }

    for (let i = dataStartRow; i < Math.min(dataStartRow + 60, rows.length); i++) {
      const row = rows[i] as unknown[]
      if (!row || row.every(c => c === null || c === '')) continue
      const col0 = row[0], col1 = row[1]
      const col0Empty = col0 === null || col0 === ''
      const col1Empty = col1 === null || col1 === ''
      if (col0Empty && col1Empty) continue
      if (!col0Empty) { colOffset = 0; break }
      const col1Str = String(col1 ?? '').trim().toLowerCase()
      colOffset = MOIS_MAP[col1Str] !== undefined ? 1 : 0
      break
    }

    const processedCodes = new Set<string>()
    let currentMois = 0

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      for (let i = dataStartRow; i < rows.length; i++) {
        const row = rows[i] as unknown[]
        if (!row || row.every(c => c === null || c === '')) continue
        const c = (idx: number) => row[idx + colOffset]

        const rawCode = String(c(1) ?? '').trim().replace(/\n[\s\S]*/g, '').trim()
        if (!rawCode || rawCode.length < 3) continue
        const code = normalizeRawCode(rawCode.toUpperCase())
        if (code.length < 3 || !/\d/.test(code)) continue
        if (/^(CODE|TOTAL|MOIS|INTIT|TYPE|AGENT|FRAIS)/.test(code)) continue

        const annee = codeToYear(code)
        if (!annee) continue

        const rawMois = c(0)
        if (rawMois) { const m = parseMois(rawMois); if (m > 0) currentMois = m }
        const mois = codeToMois(code) ?? currentMois
        if (mois < 1 || mois > 12) continue

        const clientName = isAo
          ? (sheetName.match(/AO\s*[—-]\s*(.+)$/)?.[1]?.trim() ?? extractClientFromCode(code))
          : extractClientFromCode(code)
        const venteHt = parseNum(row[8])
        const intitule = String(c(2) ?? '').trim().replace(/\n[\s\S]*/g, '').trim() || 'Non défini'
        const type = normType(String(c(3) ?? intitule))
        const nbH = parseNum(c(4))
        const taux = parseNum(c(5))
        const coutLigne = parseNum(c(6))
        const isHourly = nbH !== null && nbH > 0 && taux !== null && taux > 0
        const coutFixe = isHourly ? null : (coutLigne && coutLigne > 0 ? coutLigne : null)

        try {
          await client.query(
            `INSERT INTO operations (code, mois, annee, client, is_ao, prix_vente_ht)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT(code) DO UPDATE SET
               prix_vente_ht = CASE WHEN excluded.prix_vente_ht > 0 THEN excluded.prix_vente_ht ELSE operations.prix_vente_ht END,
               client = CASE WHEN operations.client = 'Inconnu' THEN excluded.client ELSE operations.client END,
               updated_at = now()`,
            [code, mois, annee, clientName, isAo ? 1 : 0, venteHt ?? 0]
          )

          const opRes = await client.query<{ id: string }>('SELECT id FROM operations WHERE code = $1', [code])
          const opId = opRes.rows[0]!.id

          if (!processedCodes.has(code)) {
            await client.query('DELETE FROM lignes_couts WHERE operation_id = $1', [opId])
            processedCodes.add(code)
          }

          if (intitule && intitule !== 'Opé' && (isHourly || coutFixe)) {
            await client.query(
              `INSERT INTO lignes_couts (operation_id, type, intitule, nb_heures, taux_horaire, cout_fixe)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [opId, type, intitule, nbH, isHourly ? taux : null, coutFixe]
            )
            stats.lignes++
          }
          stats.ops++
        } catch (e) {
          stats.errors++
          if (stats.errors <= 3) console.error(`  ⚠️  ${code}: ${e}`)
        }
      }

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    console.log(`   📄 "${sheetName}" — ${processedCodes.size} opérations`)
  }
}

// ─── Traitement FORMAT B (Tableau de Marges) ──────────────────────────────────

interface TableauSection {
  colMois: number
  colCode: number
  colAgent: number
  colNbH: number
  colTaux: number
  colCout: number
  colVente: number
  fallbackYear: number
}

function extractYearFromTitle(title: string): number | null {
  const m = title.match(/\b(202\d)\b/)
  return m ? parseInt(m[1]) : null
}

async function processTableauFile(
  workbook: XLSX.WorkBook,
  sheetName: string,
  pool: Pool,
  stats: Stats,
  cdiPrenoms: string[],
) {
  const ws = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null })

  const titleRow = rows[1] as unknown[] ?? []
  const leftTitle = String(titleRow[0] ?? '')
  const midTitle = String(titleRow[11] ?? '')
  const leftYear = extractYearFromTitle(leftTitle) ?? new Date().getFullYear()
  const midYear = extractYearFromTitle(midTitle) ?? leftYear

  const isDual = midYear !== leftYear

  const sections: TableauSection[] = [
    { colMois: 0, colCode: 1, colAgent: 2, colNbH: 3, colTaux: 4, colCout: 5, colVente: 7, fallbackYear: leftYear },
  ]
  if (isDual) {
    sections.push(
      { colMois: 11, colCode: 12, colAgent: 13, colNbH: 14, colTaux: 15, colCout: 16, colVente: 18, fallbackYear: midYear }
    )
  }

  let dataStartRow = 10
  for (let i = 8; i < 15; i++) {
    const row = rows[i] as unknown[]
    if (!row) continue
    const c1 = String(row[1] ?? '').trim()
    if (c1 && c1 !== 'XXX000' && c1 !== 'Opé' && /[A-Z]/.test(c1) && /[0-9]/.test(c1)) {
      dataStartRow = i; break
    }
    if (c1 && c1 !== 'XXX000' && c1 !== 'Opé' && /[A-Z]{3,}/.test(c1)) {
      dataStartRow = i; break
    }
  }

  for (const section of sections) {
    const processedCodes = new Set<string>()
    let currentMois = 0
    let currentCode = ''

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      for (let i = dataStartRow; i < rows.length; i++) {
        const row = rows[i] as unknown[]
        if (!row) continue

        const rawMois = row[section.colMois]
        if (rawMois) { const m = parseMois(rawMois); if (m > 0) currentMois = m }

        const rawCode = String(row[section.colCode] ?? '').trim().replace(/\n[\s\S]*/g, '').trim()
        if (rawCode && rawCode !== 'XXX000' && rawCode.length >= 2) {
          const normalized = normalizeRawCode(rawCode.toUpperCase())
          if (normalized.length >= 2 && !/^(OPÉ|OPE|FRAIS|CODE|MOIS|TEMPLATE)/.test(normalized)) {
            currentCode = normalized
          }
        }

        if (!currentCode) continue
        const annee = codeToYear(currentCode) ?? section.fallbackYear

        const mois = codeToMois(currentCode) ?? currentMois
        if (mois < 1 || mois > 12) continue

        const venteHt = parseNum(row[section.colVente])

        const intitule = String(row[section.colAgent] ?? '').trim().replace(/\n[\s\S]*/g, '').trim()
        if (!intitule || intitule === 'XXX000') continue

        const nbH = parseNum(row[section.colNbH])
        const taux = parseNum(row[section.colTaux])
        const coutLine = parseNum(row[section.colCout])
        const isHourly = nbH !== null && nbH > 0 && taux !== null && taux > 0
        const coutFixe = isHourly ? null : (coutLine && coutLine > 0 ? coutLine : null)
        if (!isHourly && !coutFixe) continue

        const firstWord = intitule.split(/\s+/)[0].toLowerCase()
        const isCDI = cdiPrenoms.some(p => p.toLowerCase() === firstWord)
        const type = isCDI ? 'CDI' : normType(intitule)

        const isAo = isAoCode(currentCode)
        const clientName = extractClientFromCode(currentCode)

        const isFirstEncounter = !processedCodes.has(currentCode)
        const venteForUpsert = isFirstEncounter ? (venteHt ?? 0) : 0

        try {
          await client.query(
            `INSERT INTO operations (code, mois, annee, client, is_ao, prix_vente_ht)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT(code) DO UPDATE SET
               prix_vente_ht = CASE WHEN excluded.prix_vente_ht > 0 THEN excluded.prix_vente_ht ELSE operations.prix_vente_ht END,
               client = CASE WHEN operations.client = 'Inconnu' THEN excluded.client ELSE operations.client END,
               updated_at = now()`,
            [currentCode, mois, annee, clientName, isAo ? 1 : 0, venteForUpsert]
          )

          const opRes = await client.query<{ id: string }>('SELECT id FROM operations WHERE code = $1', [currentCode])
          const opId = opRes.rows[0]!.id

          if (isFirstEncounter) {
            await client.query('DELETE FROM lignes_couts WHERE operation_id = $1', [opId])
            processedCodes.add(currentCode)
          }

          await client.query(
            `INSERT INTO lignes_couts (operation_id, type, intitule, nb_heures, taux_horaire, cout_fixe)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [opId, type, intitule, nbH, isHourly ? taux : null, coutFixe]
          )
          stats.ops++
          stats.lignes++
        } catch (e) {
          stats.errors++
          if (stats.errors <= 3) console.error(`  ⚠️  ${currentCode}: ${e}`)
        }
      }

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    const label = section.colCode === 1 ? 'gauche' : 'droite'
    console.log(`   📄 "${sheetName}" [${label}] — ${processedCodes.size} opérations`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Stats { ops: number; lignes: number; errors: number; skipped: number }

async function main() {
  const files = getArgs('file')
  if (files.length === 0) {
    console.error('❌  Usage : npm run import -- --file=./fichier.xlsx [--file=./autre.xlsx] [--reset]')
    process.exit(1)
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('❌  DATABASE_URL is missing. Add it to .env.local (dev) or set it in your environment.')
    process.exit(1)
  }

  const pool = new Pool({ connectionString })

  await setupDb(pool, hasFlag('reset'))

  const { rows: cdiRows } = await pool.query<{ prenom: string }>('SELECT prenom FROM cdi_agents')
  const cdiAgents = cdiRows.map(r => r.prenom)

  const stats: Stats = { ops: 0, lignes: 0, errors: 0, skipped: 0 }

  for (const filePath of files) {
    const absPath = path.resolve(filePath)
    if (!fs.existsSync(absPath)) {
      console.error(`❌  Fichier introuvable : ${absPath}`)
      continue
    }

    console.log(`\n📂  ${path.basename(absPath)}`)
    const workbook = XLSX.readFile(absPath)

    const hasFFYSheets = workbook.SheetNames.some(n => n.startsWith('📋'))

    if (hasFFYSheets) {
      await processFFYFile(workbook, pool, stats)
    } else {
      for (const sheetName of workbook.SheetNames) {
        await processTableauFile(workbook, sheetName, pool, stats, cdiAgents)
      }
    }
  }

  const { rows: countRows } = await pool.query<{ nb_ops: string; nb_lignes: string }>(`
    SELECT
      (SELECT COUNT(*)::text FROM operations) as nb_ops,
      (SELECT COUNT(*)::text FROM lignes_couts) as nb_lignes
  `)

  const nbOps = Number(countRows[0]?.nb_ops ?? 0)
  const nbLignes = Number(countRows[0]?.nb_lignes ?? 0)

  const { rows: byYear } = await pool.query<{ annee: number; nb_avec_ca: string; ca: string }>(`
    SELECT annee, COUNT(CASE WHEN prix_vente_ht > 0 THEN 1 END)::text as nb_avec_ca,
           ROUND(SUM(prix_vente_ht))::text as ca
    FROM operations GROUP BY annee ORDER BY annee
  `)

  console.log(`
✅  Import terminé !
   → Opérations en base  : ${nbOps}
   → Lignes de coûts     : ${nbLignes}
   → Erreurs             : ${stats.errors}

📊  Répartition par année :`)

  for (const row of byYear) {
    const ca = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(row.ca))
    console.log(`   ${row.annee} : ${row.nb_avec_ca} opérations avec CA — ${ca}`)
  }

  console.log('\n💡  Lancez "npm run dev" puis ouvrez http://localhost:3000\n')

  await pool.end()
}

main().catch(e => { console.error('❌', e); process.exit(1) })
