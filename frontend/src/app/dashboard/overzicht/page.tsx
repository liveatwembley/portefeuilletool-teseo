'use client'
import { usePortfolio } from '@/hooks/usePortfolio'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { PositionsTable } from '@/components/dashboard/PositionsTable'
import { SectorDonut } from '@/components/charts/SectorDonut'
import { TreemapChart } from '@/components/charts/TreemapChart'
import { formatEuro, formatPct, formatNumber } from '@/lib/formatters'
import { Skeleton } from '@/components/ui/skeleton'

export default function OverzichtPage() {
  const { data, loading } = usePortfolio()

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  if (!data?.meta) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p className="text-lg">Geen portefeuilledata gevonden.</p>
        <p className="text-sm mt-2">Ga naar Data Sync om data te importeren.</p>
      </div>
    )
  }

  const { meta, holdings } = data
  const totalPnl = holdings.reduce((sum, h) => sum + (h.pnl_nominal || 0), 0)
  const totalPnlPct = meta.total_value > 0 ? (totalPnl / (meta.total_value - totalPnl)) * 100 : 0
  const winners = holdings.filter(h => (h.pnl_pct || 0) > 0).length
  const losers = holdings.filter(h => (h.pnl_pct || 0) < 0).length

  // Sector data
  const sectorMap: Record<string, number> = {}
  holdings.forEach(h => {
    const s = h.sector || 'Overig'
    sectorMap[s] = (sectorMap[s] || 0) + (h.value || 0)
  })
  const sectorData = Object.entries(sectorMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // Currency data
  const currMap: Record<string, number> = {}
  holdings.forEach(h => {
    const c = h.currency || 'EUR'
    currMap[c] = (currMap[c] || 0) + (h.value || 0)
  })
  const currData = Object.entries(currMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // Best/worst
  const sorted = [...holdings].sort((a, b) => (b.pnl_pct || 0) - (a.pnl_pct || 0))
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]

  return (
    <div className="space-y-6">
      {/* KPI Bar */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard
          label="Portefeuillewaarde"
          value={formatEuro(meta.portfolio_total)}
          sublabel={`Snapshot ${meta.snapshot_date}`}
          hero
        />
        <KpiCard
          label="Totaal P&L"
          value={formatEuro(totalPnl)}
          delta={formatPct(totalPnlPct)}
          pnlValue={totalPnl}
        />
        <KpiCard
          label="Dag"
          value={formatEuro(meta.day_delta)}
          delta={formatPct(meta.day_delta_pct)}
          pnlValue={meta.day_delta}
        />
        <KpiCard
          label="Cash"
          value={formatEuro(meta.cash)}
          sublabel={`${meta.cash_pct.toFixed(1)}%`}
        />
        <KpiCard
          label="Posities"
          value={formatNumber(holdings.length)}
          sublabel={`${winners}W / ${losers}L`}
        />
      </div>

      {/* Quick insights */}
      <div className="grid grid-cols-4 gap-3">
        {meta.fx_rates?.['EUR/USD'] && (
          <div className="rounded-xl bg-white border border-slate-200/60 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-slate-400">EUR/USD</span>
            <span className="text-sm font-medium text-slate-700">{meta.fx_rates['EUR/USD'].toFixed(4)}</span>
          </div>
        )}
        {meta.fx_rates?.['EUR/GBP'] && (
          <div className="rounded-xl bg-white border border-slate-200/60 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-slate-400">EUR/GBP</span>
            <span className="text-sm font-medium text-slate-700">{meta.fx_rates['EUR/GBP'].toFixed(4)}</span>
          </div>
        )}
        {best && (
          <div className="rounded-xl bg-green-50 border border-green-200/60 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-green-600">Beste</span>
            <span className="text-sm font-medium text-green-700">{best.name} {formatPct(best.pnl_pct)}</span>
          </div>
        )}
        {worst && (
          <div className="rounded-xl bg-red-50 border border-red-200/60 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-red-600">Slechtste</span>
            <span className="text-sm font-medium text-red-700">{worst.name} {formatPct(worst.pnl_pct)}</span>
          </div>
        )}
      </div>

      {/* Treemap */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Portefeuille Treemap</h2>
        <TreemapChart holdings={holdings} />
      </div>

      {/* Sector + Currency donuts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Sectoren</h2>
          <SectorDonut data={sectorData} />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Valuta</h2>
          <SectorDonut data={currData} />
        </div>
      </div>

      {/* Positions table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Alle Posities</h2>
        <PositionsTable holdings={holdings} />
      </div>
    </div>
  )
}
