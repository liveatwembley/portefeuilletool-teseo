'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line,
  ComposedChart,
} from 'recharts'
import { api } from '@/lib/api'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEuro, formatPct, formatNumber } from '@/lib/formatters'
import { COLOR_BRAND, SECTOR_COLORS } from '@/lib/colors'
import { useIsDark } from '@/hooks/useIsDark'

interface SnapshotRow {
  id: number
  snapshot_date: string
  total_value_eur: number | null
  cash_eur: number | null
  cash_pct?: number | null
}

interface BenchmarkPoint {
  date: string
  close: number
}

interface PerformanceData {
  snapshots: SnapshotRow[]
  benchmarks: Record<string, BenchmarkPoint[]>
}

// --- DATE FORMATTING ---

function formatDateNL(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit' })
  } catch {
    return '—'
  }
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
  } catch {
    return '—'
  }
}

// --- NORMALIZATION ---

function normalizeToBase(values: { date: string; value: number }[], baseValue: number) {
  if (values.length === 0) return []
  const startValue = values[0].value
  if (startValue === 0) return values.map(v => ({ date: v.date, value: baseValue }))
  return values.map(v => ({
    date: v.date,
    value: (v.value / startValue) * baseValue,
  }))
}

// --- BENCHMARK CONFIG ---

const BENCHMARK_COLORS: Record<string, string> = {
  'S&P 500': '#2563eb',
  'MSCI World': '#7c3aed',
  'AEX': '#ea580c',
  'STOXX 600': '#0891b2',
  'Nasdaq': '#db2777',
}

const DEFAULT_BENCHMARKS = ['S&P 500', 'MSCI World']

export default function RendementPage() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<Set<string>>(new Set(DEFAULT_BENCHMARKS))
  const isDark = useIsDark()

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(null)
    api.get<PerformanceData>('/api/portfolio/performance')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-40 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400 dark:text-slate-500 mb-4">Kan data niet laden.</p>
        {error && <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">{error}</p>}
        <button onClick={fetchData} className="text-sm text-[#1B3A5C] dark:text-[#E8B34A] hover:underline">Opnieuw proberen</button>
      </div>
    )
  }

  const { snapshots, benchmarks } = data

  // Filter out snapshots with null/undefined total_value_eur
  const validSnapshots = (snapshots ?? []).filter(
    (s): s is SnapshotRow & { total_value_eur: number } =>
      s.total_value_eur != null && s.snapshot_date != null
  )

  if (validSnapshots.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400 dark:text-slate-500 mb-4">Geen data beschikbaar.</p>
        <p className="text-sm text-slate-400 dark:text-slate-500">Importeer data om het rendement te bekijken.</p>
      </div>
    )
  }

  // --- KPI CALCULATIONS ---

  const sorted = [...validSnapshots].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  )
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const rendement = last.total_value_eur - first.total_value_eur
  const rendementPct = first.total_value_eur > 0
    ? ((last.total_value_eur - first.total_value_eur) / first.total_value_eur) * 100
    : 0

  // --- CHART DATA ---

  const toggleBenchmark = (key: string) => {
    setSelectedBenchmarks(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const safeBenchmarks = benchmarks ?? {}
  const allBenchmarkKeys = Object.keys(safeBenchmarks)
  const benchmarkKeys = allBenchmarkKeys.filter(k => selectedBenchmarks.has(k))
  const portfolioBase = first.total_value_eur

  const dateMap: Record<string, Record<string, number>> = {}

  sorted.forEach(s => {
    if (!dateMap[s.snapshot_date]) dateMap[s.snapshot_date] = {}
    dateMap[s.snapshot_date]['portfolio'] = s.total_value_eur
  })

  benchmarkKeys.forEach(key => {
    const points = safeBenchmarks[key]
    if (!points || !Array.isArray(points) || points.length === 0) return
    const validPoints = points.filter(p => p.date != null && p.close != null)
    if (validPoints.length === 0) return
    const normalized = normalizeToBase(
      validPoints.map(p => ({ date: p.date, value: p.close })),
      portfolioBase
    )
    normalized.forEach(p => {
      if (!dateMap[p.date]) dateMap[p.date] = {}
      dateMap[p.date][key] = p.value
    })
  })

  const allDates = Object.keys(dateMap).sort()
  const chartData = allDates.map(date => ({
    date,
    portfolio: dateMap[date]['portfolio'] ?? null,
    ...benchmarkKeys.reduce((acc, key) => {
      acc[key] = dateMap[date]?.[key] ?? null
      return acc
    }, {} as Record<string, number | null>),
  }))

  const gridColor = isDark ? '#334155' : '#e2e8f0'
  const tickColor = isDark ? '#64748b' : '#94a3b8'

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">Rendement</h1>

      {/* KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Huidige waarde"
          value={formatEuro(last.total_value_eur)}
          sublabel={`Per ${formatDateNL(last.snapshot_date)}`}
          hero
        />
        <KpiCard
          label="Rendement"
          value={formatEuro(rendement)}
          delta={formatPct(rendementPct)}
          pnlValue={rendement}
          sublabel={`Sinds ${formatDateNL(first.snapshot_date)}`}
        />
        <KpiCard
          label="Aantal snapshots"
          value={formatNumber(validSnapshots.length)}
          sublabel={`${formatDateNL(first.snapshot_date)} - ${formatDateNL(last.snapshot_date)}`}
        />
      </div>

      {/* Performance chart */}
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Waardeontwikkeling</h2>

      {/* Benchmark toggles */}
      {allBenchmarkKeys.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 self-center mr-1">Benchmarks:</span>
          {allBenchmarkKeys.map(key => {
            const isActive = selectedBenchmarks.has(key)
            const color = BENCHMARK_COLORS[key] ?? SECTOR_COLORS[0]
            return (
              <button
                key={key}
                onClick={() => toggleBenchmark(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${
                  isActive
                    ? 'border-transparent text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-500'
                }`}
                style={isActive ? { backgroundColor: color } : undefined}
              >
                <span className="inline-block w-2.5 h-0.5 rounded-full" style={{ backgroundColor: color, opacity: isActive ? 1 : 0.5 }} />
                {key}
              </button>
            )
          })}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700/60 p-5 hover:shadow-sm transition-shadow">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Portefeuillewaarde over tijd
          {benchmarkKeys.length > 0 && (
            <span className="text-slate-400 dark:text-slate-500 font-normal ml-2">
              (benchmarks genormaliseerd naar startwaarde)
            </span>
          )}
        </h3>
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLOR_BRAND} stopOpacity={0.15} />
                <stop offset="95%" stopColor={COLOR_BRAND} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={{ fontSize: 11, fill: tickColor }}
              tickLine={false}
              axisLine={{ stroke: gridColor }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              tickFormatter={(v: unknown) => {
                const n = Number(v)
                if (isNaN(n)) return '—'
                return `${(n / 1000).toFixed(0)}K`
              }}
              tick={{ fontSize: 11, fill: tickColor }}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <Tooltip
              formatter={(value: unknown, name: unknown) => {
                const n = Number(value)
                return [
                  isNaN(n) ? '—' : formatEuro(n),
                  name === 'portfolio' ? 'Portefeuille' : String(name ?? ''),
                ]
              }}
              labelFormatter={(label: unknown) => formatDateNL(label != null ? String(label) : null)}
              contentStyle={{
                borderRadius: '12px',
                border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                fontSize: '13px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                color: isDark ? '#e2e8f0' : '#1e293b',
              }}
            />
            <Legend
              formatter={(value: string) => value === 'portfolio' ? 'Portefeuille' : value}
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px', color: isDark ? '#94a3b8' : undefined }}
            />
            <Area
              type="monotone"
              dataKey="portfolio"
              stroke={COLOR_BRAND}
              strokeWidth={2}
              fill="url(#portfolioGradient)"
              dot={false}
              connectNulls
              name="portfolio"
            />
            {benchmarkKeys.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={BENCHMARK_COLORS[key] ?? SECTOR_COLORS[0]}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
                name={key}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
