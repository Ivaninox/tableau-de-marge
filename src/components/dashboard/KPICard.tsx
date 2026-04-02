'use client'
import clsx from 'clsx'

interface Props {
  title: string
  value: string
  sub?: string
  delta?: number | null
  colorClass?: string
}

export default function KPICard({ title, value, sub, delta, colorClass }: Props) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col gap-2">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
      <p className={clsx('text-2xl font-bold', colorClass ?? 'text-white')}>{value}</p>
      {sub && <p className="text-sm text-slate-400">{sub}</p>}
      {delta !== undefined && delta !== null && (
        <div className={clsx(
          'flex items-center gap-1 text-sm font-medium',
          delta >= 0 ? 'text-green-400' : 'text-red-400'
        )}>
          <span>{delta >= 0 ? '↑' : '↓'}</span>
          <span>{Math.abs(delta).toFixed(1)} % vs N-1</span>
        </div>
      )}
    </div>
  )
}
