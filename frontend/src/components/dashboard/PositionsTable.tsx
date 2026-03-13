'use client'
import type { EnrichedHolding } from '@/lib/types'
import { formatEuro, formatPct, formatNumber, formatLocalPrice, pnlColor } from '@/lib/formatters'
import { ADVICE_COLORS } from '@/lib/colors'

export function PositionsTable({ holdings }: { holdings: EnrichedHolding[] }) {
  const sorted = [...holdings].sort((a, b) => (b.value || 0) - (a.value || 0))

  return (
    <div className="relative overflow-x-auto rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider sticky left-0 bg-white z-10">Aandeel</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Sector</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Aantal</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Koers</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Waarde</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">P&L</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">P&L %</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Dag %</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Gewicht</th>
            <th className="text-center py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Advies</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => (
            <tr
              key={h.ticker}
              className="border-b border-slate-50 even:bg-slate-50/30 hover:bg-slate-100/50 transition-colors"
            >
              <td className="py-3 px-4 sticky left-0 bg-inherit z-10">
                <div className="font-medium text-slate-900">{h.name}</div>
                <div className="text-xs text-slate-400">{h.ticker}</div>
              </td>
              <td className="py-3 px-4 text-slate-500 text-xs">{h.sector}</td>
              <td className="py-3 px-4 text-right text-slate-700">{formatNumber(h.shares)}</td>
              <td className="py-3 px-4 text-right">
                {h.currency !== 'EUR' ? (
                  <>
                    <div className="text-slate-700">{formatLocalPrice(h.price_local, h.currency)}</div>
                    <div className="text-xs text-slate-400">{formatEuro(h.price_eur)}</div>
                  </>
                ) : (
                  <div className="text-slate-700">{formatEuro(h.price_eur)}</div>
                )}
              </td>
              <td className="py-3 px-4 text-right font-medium text-slate-900">{formatEuro(h.value)}</td>
              <td className={`py-3 px-4 text-right font-medium ${pnlColor(h.pnl_nominal)}`}>
                {formatEuro(h.pnl_nominal)}
              </td>
              <td className={`py-3 px-4 text-right font-medium ${pnlColor(h.pnl_pct)}`}>
                {formatPct(h.pnl_pct)}
              </td>
              <td className={`py-3 px-4 text-right ${pnlColor(h.day_change_pct)}`}>
                {formatPct(h.day_change_pct)}
              </td>
              <td className="py-3 px-4 text-right text-slate-700">{(h.weight || 0).toFixed(1)}%</td>
              <td className="py-3 px-4 text-center">
                {h.advice && (
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: ADVICE_COLORS[h.advice.toLowerCase()] || '#6b7280' }}
                  >
                    {h.advice}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
