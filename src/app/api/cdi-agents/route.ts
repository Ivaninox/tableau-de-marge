import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = await getDb()
  const { rows } = await db.query('SELECT * FROM cdi_agents ORDER BY date_debut')
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const db = await getDb()
  const { prenom, date_debut } = await req.json()
  if (!prenom || !date_debut) {
    return NextResponse.json({ error: 'Champs requis' }, { status: 400 })
  }
  try {
    const { rows } = await db.query<{ id: string }>(
      'INSERT INTO cdi_agents (prenom, date_debut) VALUES ($1, $2) RETURNING id::text as id',
      [prenom, date_debut]
    )
    return NextResponse.json({ id: rows[0]?.id }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const db = await getDb()
  const { id } = await req.json()
  await db.query('DELETE FROM cdi_agents WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
