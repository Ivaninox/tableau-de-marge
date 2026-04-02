import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const rows = db.prepare(
    "SELECT DISTINCT client FROM operations WHERE client != '' ORDER BY client COLLATE NOCASE"
  ).all() as { client: string }[]
  return NextResponse.json(rows.map(r => r.client))
}
