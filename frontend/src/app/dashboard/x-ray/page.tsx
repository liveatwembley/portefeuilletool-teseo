'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPct, formatNumber } from '@/lib/formatters'
import { SECTOR_COLORS, ADVICE_COLORS } from '@/lib/colors'
import { useIsDark } from '@/hooks/useIsDark'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts'

interface BreakdownItem {
  name: string
  weight: number
  value?: number
  count?: number
}

interface RawXRayData {
  concentration: { top5_weight: number; hhi: number; n_positions: number }
  sectors: { sector: string; weight: number; value?: number; pnl?: number; count?: number }[]
  geo: { geo: string; weight: number; value?: number; count?: number }[]
  currencies: { currency: string; weight: number; value?: number; count?: number }[]
  advice: { advice: string; count: number; value?: number }[]
}

interface XRayData {
  concentration: { top5_weight: number; hhi: number; n_positions: number }
  sectors: BreakdownItem[]
  geo: BreakdownItem[]
  currencies: BreakdownItem[]
  advice: BreakdownItem[]
}

function normalizeXRayData(raw: RawXRayData): XRayData {
  const totalAdviceCount = raw.advice.reduce((sum, a) => sum + a.count, 0) || 1
  return {
    concentration: raw.concentration,
    sectors: raw.sectors.map((s) => ({ name: s.sector, weight: s.weight, value: s.value, count: s.count })),
    geo: raw.geo.map((g) => ({ name: g.geo, weight: g.weight, value: g.value, count: g.count })),
    currencies: raw.currencies.map((c) => ({ name: c.currency, weight: c.weight, value: c.value, count: c.count })),
    advice: raw.advice.map((a) => ({ name: a.advice, weight: (a.count / totalAdviceCount) * 100, value: a.value, count: a.count })),
  }
}

function HorizontalBarChart({ data, colorIndex = 0 }: { data: BreakdownItem[]; colorIndex?: number }) {
  const isDark = useIsDark()
  const chartData = data.map((d) => ({
    name: d.name,
    weight: +d.weight.toFixed(1),
    value: d.value,
  }))

  return (
    <ResponsiveContainer width="100%" height={data.length * 36 + 20}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" tickFormatter={(v) => `${v}%`} fontSize={11} stroke={isDark ? '#64748b' : '#94a3b8'} />
        <YAxis type="category" dataKey="name" width={100} fontSize={12} stroke={isDark ? '#94a3b8' : '#64748b'} tickLine={false} />
        <Tooltip
          formatter={(v: unknown) => `${Number(v).toFixed(1)}%`}
          contentStyle={{
            borderRadius: '12px',
            border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
            fontSize: '12px',
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#e2e8f0' : '#1e293b',
          }}
        />
        <Bar dataKey="weight" radius={[0, 6, 6, 0]} barSize={20}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={SECTOR_COLORS[(i + colorIndex) % SECTOR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function AdviesDonut({ data }: { data: BreakdownItem[] }) {
  const isDark = useIsDark()
  const chartData = data.map((d) => ({
    name: d.name,
    value: +d.weight.toFixed(1),
    count: d.count || 0,
  }))

  const getColor = (name: string) => {
    const key = name.toLowerCase()
    return ADVICE_COLORS[key] || '#94a3b8'
  }

  return (
    <div className="flex items-center gap-6">
      <div className="w-48 h-48">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={chartData}
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((d, i) => (
                <Cell key={i} fill={getColor(d.name)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: unknown) => `${Number(v).toFixed(1)}%`}
              contentStyle={{
                borderRadius: '12px',
                border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                fontSize: '12px',
                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                color: isDark ? '#e2e8f0' : '#1e293b',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: getColor(item.name) }}
              />
              <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-xs">
              {item.value.toFixed(1)}% ({item.count})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function XRayPage() {
  const [data, setData] = useState<XRayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(null)
    api.get<RawXRayData>('/api/portfolio/xray')
      .then((raw) => setData(normalizeXRayData(raw)))
      .catch((err) => setError(err.message))
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
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

  const { concentration, sectors, geo, currencies, advice } = data
  const hhi = concentration.hhi
  const hhiLabel = hhi < 1000 ? 'Goed gespreid' : hhi < 1500 ? 'Matig geconcentreerd' : 'Sterk geconcentreerd'

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">X-Ray Analyse</h1>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Top-5 gewicht"
          value={formatPct(concentration.top5_weight)}
          sublabel={concentration.top5_weight > 60 ? 'Geconcentreerd' : 'Gespreid'}
        />
        <KpiCard
          label="HHI Index"
          value={formatNumber(hhi, 1)}
          sublabel={hhiLabel}
        />
        <KpiCard
          label="Aantal posities"
          value={formatNumber(concentration.n_positions)}
        />
      </div>

      {/* Concentration warnings */}
      {(concentration.n_positions > 30 || hhi > 1500 || concentration.top5_weight > 60) && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300 space-y-1">
          {concentration.n_positions > 30 && (
            <p>Let op: meer dan 30 posities. Principe 8 adviseert max 30 voor 95% van het kapitaal.</p>
          )}
          {hhi > 1500 && (
            <p>Waarschuwing: portefeuille is sterk geconcentreerd (HHI &gt; 1500).</p>
          )}
          {concentration.top5_weight > 60 && (
            <p>Top-5 posities vormen meer dan 60% van de portefeuille.</p>
          )}
        </div>
      )}

      {/* Sector + Geografie */}
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Verdeling per categorie</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5 hover:shadow-sm transition-shadow">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Sectoren</h3>
          <HorizontalBarChart data={sectors} />
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5 hover:shadow-sm transition-shadow">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Geografie</h3>
          <HorizontalBarChart data={geo} colorIndex={3} />
        </div>
      </div>

      {/* Valuta + Advies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5 hover:shadow-sm transition-shadow">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Valuta</h3>
          <HorizontalBarChart data={currencies} colorIndex={6} />
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5 hover:shadow-sm transition-shadow">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Adviesverdeling</h3>
          <AdviesDonut data={advice} />
        </div>
      </div>
    </div>
  )
}
