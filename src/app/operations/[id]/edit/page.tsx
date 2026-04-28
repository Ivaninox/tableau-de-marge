import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import type { Operation, LigneCout } from '@/lib/db'
import OperationForm from '@/components/saisie/OperationForm'

interface Props { params: Promise<{ id: string }> }

export default async function EditOperationPage({ params }: Props) {
  const { id } = await params
  const db = await getDb()
  const opRes = await db.query<Operation>('SELECT * FROM operations WHERE id = $1', [id])
  const op = opRes.rows[0]
  if (!op) notFound()

  const lignesRes = await db.query<LigneCout>('SELECT * FROM lignes_couts WHERE operation_id = $1 ORDER BY id', [id])
  const lignes = lignesRes.rows

  const cadenceRes = await db.query('SELECT * FROM cadences WHERE operation_id = $1', [id])
  const cadence = cadenceRes.rows[0] ?? null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Modifier l&apos;opération</h1>
        <p className="text-sm text-slate-400">Code : <span className="font-mono text-indigo-300">{op.code}</span></p>
      </div>
      <OperationForm initialData={{ ...op, lignes, cadence }} />
    </div>
  )
}
