'use client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { MOIS_NOMS } from '@/lib/calculations'

interface YearData {
  annee: number
  monthly: { mois: number; margeBrute: number | null; margeExterne: number | null; ca: number }[]
}

const COLORS = ['#6366f1', '#60a5fa', '#4ade80', '#fbbf24', '#f472b6']

export default function ChartMarge({ data, annee }: { data: YearData[]; annee: number }) {
  // Build chart data: one row per month, one column per (year × metric)
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const row: Record<string, string | number> = { name: MOIS_NOMS[m] }
    for (const yd of data) {
      const md = yd.monthly[i]
      if (md.ca > 0) {
        row[`MB ${yd.annee}`] = md.margeBrute !== null ? +(md.margeBrute * 100).toFixed(1) : 0
        row[`ME ${yd.annee}`] = md.margeExterne !== null ? +(md.margeExterne * 100).toFixed(1) : 0
      }
    }
    return row
  })

  // Current year lines are solid, others dashed
  const lines: { key: string; color: string; dash?: string }[] = []
  data.forEach((yd, i) => {
    const isCurrent = yd.annee === annee
    lines.push({ key: `MB ${yd.annee}`, color: COLORS[i % COLORS.length], dash: isCurrent ? undefined : '4 4' })
    lines.push({ key: `ME ${yd.annee}`, color: COLORS[i % COLORS.length], dash: isCurrent ? '2 2' : '8 4 2 4' })
  })

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-1">Évolution des marges — comparaison pluriannuelle</h3>
      <p className="text-xs text-slate-500 mb-4">Trait plein = Marge Brute, trait pointillé = Marge Externe</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => `${v}%`} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v: number, name: string) => [`${v}%`, name]}
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} />
          <ReferenceLine y={65} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.5} />
          {lines.map(l => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              stroke={l.color}
              strokeWidth={2}
              strokeDasharray={l.dash}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
