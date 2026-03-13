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
  const colorClass = pnlValue != null ? pnlColor(pnlValue) : 'text-slate-900 dark:text-slate-100'
  const borderAccent = pnlValue != null
    ? pnlValue > 0
      ? 'border-l-green-500'
      : pnlValue < 0
        ? 'border-l-red-500'
        : ''
    : ''

  return (
    <div
      className={[
        'rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 p-5',
        hero ? 'col-span-2 sm:col-span-2 lg:col-span-2' : '',
        pnlValue != null ? `border-l-[3px] ${borderAccent}` : '',
      ].filter(Boolean).join(' ')}
    >
      <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`${hero ? 'text-3xl' : 'text-2xl'} font-semibold ${colorClass} tracking-tight`}>
        {value}
      </p>
      {delta && (
        <span
          className={[
            'inline-block mt-1.5 px-2 py-0.5 rounded-md text-xs font-medium',
            pnlValue != null && pnlValue > 0 ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : '',
            pnlValue != null && pnlValue < 0 ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : '',
            pnlValue == null || pnlValue === 0 ? 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400' : '',
          ].filter(Boolean).join(' ')}
        >
          {delta}
        </span>
      )}
      {sublabel && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{sublabel}</p>
      )}
    </div>
  )
}
