import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const agents = db.prepare('SELECT * FROM cdi_agents ORDER BY date_debut').all()
  return NextResponse.json(agents)
}

export async function POST(req: NextRequest) {
  const db = getDb()
  const { prenom, date_debut } = await req.json()
  if (!prenom || !date_debut) {
    return NextResponse.json({ error: 'Champs requis' }, { status: 400 })
  }
  try {
    const result = db.prepare('INSERT INTO cdi_agents (prenom, date_debut) VALUES (?, ?)').run(prenom, date_debut)
    return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const db = getDb()
  const { id } = await req.json()
  db.prepare('DELETE FROM cdi_agents WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
