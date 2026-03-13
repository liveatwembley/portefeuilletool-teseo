import { pnlColor } from '@/lib/formatters'

interface KpiCardProps {
  label: string
  value: string
  delta?: string | null
  sublabel?: string | null
  hero?: boolean
  pnlValue?: number | null
}

export function KpiCard({ label, value, delta, sublabel, hero = false, pnlValue }: KpiCardProps) {
  const colorClass = pnlValue != null ? pnlColor(pnlValue) : 'text-slate-900'

  return (
    <div className={`rounded-2xl border border-slate-200/60 bg-white p-5 ${hero ? 'col-span-2' : ''}`}>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`${hero ? 'text-3xl' : 'text-xl'} font-semibold ${colorClass} tracking-tight`}>
        {value}
      </p>
      {delta && (
        <p className={`text-sm mt-0.5 ${pnlValue != null ? pnlColor(pnlValue) : 'text-slate-500'}`}>
          {delta}
        </p>
      )}
      {sublabel && (
        <p className="text-xs text-slate-400 mt-1">{sublabel}</p>
      )}
    </div>
  )
}
