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

interface SnapshotRow {
  id: number
  snapshot_date: string
  total_value_eur: number
  cash_eur: number
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

function formatDateNL(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit' })
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
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

export default function RendementPage() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        <p className="text-slate-400 mb-4">Kan data niet laden.</p>
        {error && <p className="text-sm text-slate-400 mb-4">{error}</p>}
        <button onClick={fetchData} className="text-sm text-[#1B3A5C] hover:underline">Opnieuw proberen</button>
      </div>
    )
  }

  const { snapshots, benchmarks } = data

  if (snapshots.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400 mb-4">Geen snapshots gevonden.</p>
        <p className="text-sm text-slate-400">Importeer data om het rendement te bekijken.</p>
      </div>
    )
  }

  // --- KPI CALCULATIONS ---

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  )
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const rendement = last.total_value_eur - first.total_value_eur
  const rendementPct = first.total_value_eur > 0
    ? ((last.total_value_eur - first.total_value_eur) / first.total_value_eur) * 100
    : 0

  // --- CHART DATA ---

  const benchmarkKeys = Object.keys(benchmarks || {})
  const portfolioBase = first.total_value_eur

  // Build a date-indexed map for merging
  const dateMap: Record<string, Record<string, number>> = {}

  sorted.forEach(s => {
    if (!dateMap[s.snapshot_date]) dateMap[s.snapshot_date] = {}
    dateMap[s.snapshot_date]['portfolio'] = s.total_value_eur
  })

  // Normalize benchmarks to portfolio starting value
  benchmarkKeys.forEach(key => {
    const points = benchmarks[key]
    if (!points || points.length === 0) return
    const normalized = normalizeToBase(
      points.map(p => ({ date: p.date, value: p.close })),
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
      acc[key] = dateMap[date][key] ?? null
      return acc
    }, {} as Record<string, number | null>),
  }))

  // Benchmark colors
  const benchmarkColors = [SECTOR_COLORS[1], SECTOR_COLORS[2], SECTOR_COLORS[4]]

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Rendement</h1>

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
          value={formatNumber(snapshots.length)}
          sublabel={`${formatDateNL(first.snapshot_date)} - ${formatDateNL(last.snapshot_date)}`}
        />
      </div>

      {/* Performance chart */}
      <h2 className="text-sm font-semibold text-slate-900 mb-3">Waardeontwikkeling</h2>
      <div className="bg-white rounded-2xl border border-slate-200/60 p-5 hover:shadow-sm transition-shadow">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          Portefeuillewaarde over tijd
          {benchmarkKeys.length > 0 && (
            <span className="text-slate-400 font-normal ml-2">
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
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              tickFormatter={(v: unknown) => `${(Number(v) / 1000).toFixed(0)}K`}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <Tooltip
              formatter={(value: unknown, name: unknown) => [
                formatEuro(Number(value)),
                name === 'portfolio' ? 'Portefeuille' : String(name),
              ]}
              labelFormatter={(label: unknown) => formatDateNL(String(label))}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '13px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
              }}
            />
            <Legend
              formatter={(value: string) => value === 'portfolio' ? 'Portefeuille' : value}
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
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
            {benchmarkKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={benchmarkColors[i % benchmarkColors.length]}
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
