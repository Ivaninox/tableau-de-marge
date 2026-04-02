import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import type { Operation, LigneCout } from '@/lib/db'
import OperationForm from '@/components/saisie/OperationForm'

interface Props { params: Promise<{ id: string }> }

export default async function EditOperationPage({ params }: Props) {
  const { id } = await params
  const db = getDb()
  const op = db.prepare('SELECT * FROM operations WHERE id = ?').get(id) as Operation | undefined
  if (!op) notFound()

  const lignes = db.prepare('SELECT * FROM lignes_couts WHERE operation_id = ? ORDER BY id').all(id) as LigneCout[]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Modifier l&apos;opération</h1>
        <p className="text-sm text-slate-400">Code : <span className="font-mono text-indigo-300">{op.code}</span></p>
      </div>
      <OperationForm initialData={{ ...op, lignes }} />
    </div>
  )
}
