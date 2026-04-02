import OperationForm from '@/components/saisie/OperationForm'

export default function NewOperationPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Nouvelle opération</h1>
        <p className="text-sm text-slate-400">Saisissez les informations de l'opération terrain</p>
      </div>
      <OperationForm />
    </div>
  )
}
