'use client'
import { useState } from 'react'
import { usePortfolio } from '@/hooks/usePortfolio'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { TreasuryCard } from '@/components/dashboard/TreasuryCard'
import { PositionsTable } from '@/components/dashboard/PositionsTable'
import { SectorDonut } from '@/components/charts/SectorDonut'
import { TreemapChart } from '@/components/charts/TreemapChart'
import { formatEuro, formatPct, formatNumber } from '@/lib/formatters'
import { Skeleton } from '@/components/ui/skeleton'

export default function OverzichtPage() {
  const { data, loading, error, refresh } = usePortfolio()
  const [showCash, setShowCash] = useState(false)

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`r2-${i}`} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/30 mb-4">
          <svg className="w-8 h-8 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-1">Fout bij laden</p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">{error}</p>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1B3A5C] text-white text-sm font-medium hover:bg-[#162f4a] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          Opnieuw proberen
        </button>
      </div>
    )
  }

  if (!data?.meta) {
    return (
      <div className="text-center py-20 text-slate-400 dark:text-slate-500">
        <p className="text-lg">Geen portefeuilledata gevonden.</p>
        <p className="text-sm mt-2">Ga naar Data Sync om data te importeren.</p>
      </div>
    )
  }

  const { meta, holdings } = data
  const treasury_eur = data.treasury_eur || 0
  const winners = holdings.filter(h => (h.pnl_pct || 0) > 0).length
  const losers = holdings.filter(h => (h.pnl_pct || 0) < 0).length

  // Cash sublabel with Buffett Indicator context (treasury meegerekend)
  const totalPortfolio = meta.portfolio_total + treasury_eur
  const totalCash = meta.cash + treasury_eur
  const cashPct = totalPortfolio > 0 ? (totalCash / totalPortfolio) * 100 : 0
  const cashSublabel = cashPct > 10
    ? `${cashPct.toFixed(1)}% — overweeg te investeren`
    : cashPct > 7.5
      ? `${cashPct.toFixed(1)}% — hoog`
      : `${cashPct.toFixed(1)}%`
  const cashSublabelColor = cashPct > 10
    ? 'text-amber-600 dark:text-amber-400'
    : cashPct > 7.5
      ? 'text-amber-500 dark:text-amber-400'
      : undefined

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
      {/* Page title */}
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">Portefeuille Overzicht</h1>

      {/* KPI Bar — Row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Portefeuillewaarde"
          value={formatEuro(meta.portfolio_total + treasury_eur)}
          sublabel={`Snapshot ${meta.snapshot_date}`}
          hero
        />
        <KpiCard
          label="Dagresultaat"
          value={formatEuro(meta.day_delta)}
          delta={formatPct(meta.day_delta_pct)}
          pnlValue={meta.day_delta}
        />
        <KpiCard
          label="Posities"
          value={formatNumber(holdings.length)}
          sublabel={`${winners}W / ${losers}L`}
        />
      </div>

      {/* KPI Bar — Row 2: Liquide middelen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Cash (IBKR)"
          value={formatEuro(meta.cash)}
          sublabel={`${totalPortfolio > 0 ? (meta.cash / totalPortfolio * 100).toFixed(1) : '0.0'}% van portefeuille`}
        />
        <TreasuryCard value={treasury_eur} onSaved={refresh} />
        <KpiCard
          label="Totaal Liquide Middelen"
          value={formatEuro(totalCash)}
          sublabel={cashSublabel}
          sublabelClassName={cashSublabelColor}
        />
      </div>

      {/* Quick insights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {meta.fx_rates?.['EUR/USD'] && (
          <div className="rounded-md bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-slate-400 dark:text-slate-500">EUR/USD</span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{meta.fx_rates['EUR/USD'].toFixed(4)}</span>
          </div>
        )}
        {meta.fx_rates?.['EUR/GBP'] && (
          <div className="rounded-md bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-slate-400 dark:text-slate-500">EUR/GBP</span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{meta.fx_rates['EUR/GBP'].toFixed(4)}</span>
          </div>
        )}
        {best && (
          <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200/60 dark:border-green-800/40 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-green-600 dark:text-green-400">Beste</span>
            <span className="text-sm font-medium text-green-700 dark:text-green-400 truncate ml-2">{best.name} {formatPct(best.pnl_pct)}</span>
          </div>
        )}
        {worst && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/40 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-red-600 dark:text-red-400">Slechtste</span>
            <span className="text-sm font-medium text-red-700 dark:text-red-400 truncate ml-2">{worst.name} {formatPct(worst.pnl_pct)}</span>
          </div>
        )}
      </div>

      {/* --- VERDELING --- */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Verdeling</h2>

        {/* Treemap */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700/60 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Portefeuille Treemap</h3>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-slate-400 dark:text-slate-500">Incl. cash</span>
              <button
                onClick={() => setShowCash(!showCash)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showCash ? 'bg-[#1B3A5C]' : 'bg-slate-200 dark:bg-slate-600'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${showCash ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
              </button>
            </label>
          </div>
          <TreemapChart holdings={holdings} cash={showCash ? totalCash : undefined} />
        </div>

        {/* Sector + Currency donuts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700/60 p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Sectoren</h3>
            <SectorDonut data={sectorData} />
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700/60 p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Valuta</h3>
            <SectorDonut data={currData} />
          </div>
        </div>
      </div>

      {/* --- POSITIES --- */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Posities</h2>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700/60 p-5">
          <PositionsTable holdings={holdings} onAdviceUpdated={refresh} />
        </div>
      </div>
    </div>
  )
}
