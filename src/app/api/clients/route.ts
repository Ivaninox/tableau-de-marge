import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = await getDb()
  const { rows } = await db.query<{ client: string }>(
    "SELECT DISTINCT client, lower(client) as sort_key FROM operations WHERE client <> '' ORDER BY lower(client)"
  )
  return NextResponse.json(rows.map(r => r.client))
}
