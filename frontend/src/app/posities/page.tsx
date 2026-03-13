'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { usePortfolio } from '@/hooks/usePortfolio'
import { api } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import {
  formatEuro,
  formatPct,
  formatNumber,
  formatLocalPrice,
  formatMarketCap,
  pnlColor,
  pnlBgColor,
} from '@/lib/formatters'
import { ADVICE_COLORS, COLOR_BRAND, QARP_TICKERS } from '@/lib/colors'
import { useIsDark } from '@/hooks/useIsDark'
import type { EnrichedHolding, FundamentalData, Transaction } from '@/lib/types'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// --- TYPES ---

interface PricePoint {
  date: string
  close: number
}

interface PositionDetail {
  position: { id: number; ticker: string; name: string; currency: string; sector: string; country: string }
  holding: EnrichedHolding
  fundamentals: FundamentalData | null
  style: { row: number | null; col: number | null }
  transactions: Transaction[]
}

type Period = '1M' | '3M' | '6M' | '1Y'

const PERIOD_DAYS: Record<Period, number> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
}

// --- POSITION LIST ITEM ---

function PositionListItem({
  holding,
  active,
  onClick,
}: {
  holding: EnrichedHolding
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-700/30 last:border-b-0 transition-colors ${
        active ? 'bg-slate-50 dark:bg-slate-700/50 border-l-2 border-l-[#1B3A5C]' : 'hover:bg-slate-50/60 dark:hover:bg-slate-700/30'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{holding.name}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{holding.ticker}</p>
        </div>
        <div className="text-right ml-3 flex-shrink-0">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {formatLocalPrice(holding.price_local, holding.currency)}
          </p>
          <p className={`text-xs font-medium ${pnlColor(holding.day_change_pct)}`}>
            {formatPct(holding.day_change_pct)}
          </p>
        </div>
      </div>
      <div className="mt-1">
        <div
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pnlBgColor(holding.pnl_pct)} ${pnlColor(holding.pnl_pct)}`}
        >
          P&L {formatPct(holding.pnl_pct)}
        </div>
      </div>
    </button>
  )
}

// --- STYLE BOX ---

const STYLE_LABELS_ROW = ['Large', 'Mid', 'Small']
const STYLE_LABELS_COL = ['Value', 'Blend', 'Growth']

function StyleBox({ row, col }: { row: number | null; col: number | null }) {
  return (
    <div className="inline-block">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="w-6" />
            {STYLE_LABELS_COL.map((label) => (
              <th key={label} className="text-[10px] text-slate-400 dark:text-slate-500 font-normal px-1 pb-1 text-center">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STYLE_LABELS_ROW.map((rowLabel, ri) => (
            <tr key={rowLabel}>
              <td className="text-[10px] text-slate-400 dark:text-slate-500 pr-1 text-right">{rowLabel}</td>
              {STYLE_LABELS_COL.map((_, ci) => {
                const isActive = row === ri + 1 && col === ci + 1
                return (
                  <td key={ci} className="p-0.5">
                    <div
                      className={`w-7 h-7 rounded border ${
                        isActive
                          ? 'bg-[#1B3A5C] border-[#1B3A5C]'
                          : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                      }`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- FUNDAMENTALS GRID ---

function FundamentalsGrid({
  fundamentals,
  currency,
}: {
  fundamentals: FundamentalData | null
  currency: string
}) {
  if (!fundamentals) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">Geen fundamentele data beschikbaar.</p>
  }

  const items = [
    { label: 'P/E', value: fundamentals.pe_trailing != null ? fundamentals.pe_trailing.toFixed(1) : null },
    { label: 'P/B', value: fundamentals.pb != null ? fundamentals.pb.toFixed(2) : null },
    { label: 'Div. Yield', value: fundamentals.dividend_yield != null ? `${(fundamentals.dividend_yield * 100).toFixed(2)}%` : null },
    { label: 'Marktkapitalisatie', value: formatMarketCap(fundamentals.market_cap) },
    { label: 'Beta', value: fundamentals.beta != null ? fundamentals.beta.toFixed(2) : null },
    { label: '52W Hoog', value: fundamentals.fifty_two_week_high != null ? formatLocalPrice(fundamentals.fifty_two_week_high, currency) : null },
    { label: '52W Laag', value: fundamentals.fifty_two_week_low != null ? formatLocalPrice(fundamentals.fifty_two_week_low, currency) : null },
    { label: 'Gem. Volume', value: fundamentals.avg_volume != null ? formatNumber(fundamentals.avg_volume) : null },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-slate-50 dark:bg-slate-700/50 px-3 py-2.5">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">{item.label}</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.value ?? '—'}</p>
        </div>
      ))}
    </div>
  )
}

// --- TRANSACTION TABLE ---

function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">Geen transacties gevonden.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-2 pr-3 text-xs font-medium text-slate-400 dark:text-slate-500">Datum</th>
            <th className="text-left py-2 pr-3 text-xs font-medium text-slate-400 dark:text-slate-500">Type</th>
            <th className="text-right py-2 pr-3 text-xs font-medium text-slate-400 dark:text-slate-500">Stuks</th>
            <th className="text-right py-2 pr-3 text-xs font-medium text-slate-400 dark:text-slate-500">Prijs</th>
            <th className="text-right py-2 text-xs font-medium text-slate-400 dark:text-slate-500">Kosten</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className="border-b border-slate-100 dark:border-slate-700/30 last:border-b-0">
              <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{tx.transaction_date}</td>
              <td className="py-2 pr-3">
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    tx.type === 'BUY'
                      ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}
                >
                  {tx.type === 'BUY' ? 'Koop' : 'Verkoop'}
                </span>
              </td>
              <td className="py-2 pr-3 text-right text-slate-700 dark:text-slate-300">{formatNumber(tx.shares)}</td>
              <td className="py-2 pr-3 text-right text-slate-700 dark:text-slate-300">{formatEuro(tx.price_eur)}</td>
              <td className="py-2 text-right text-slate-400 dark:text-slate-500">{formatEuro(tx.fees)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- ADVICE SECTION ---

function AdviceSection({
  ticker,
  advice,
  motivation,
  onUpdated,
}: {
  ticker: string
  advice: string | null
  motivation: string | null
  onUpdated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editAdvice, setEditAdvice] = useState(advice || '')
  const [editMotivation, setEditMotivation] = useState(motivation || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/api/positions/${encodeURIComponent(ticker)}/advice`, {
        advice: editAdvice,
        motivation: editMotivation,
      })
      setEditing(false)
      onUpdated()
    } catch {
      // silently fail
    } finally {
      setSaving(false)
    }
  }

  const adviceLower = (advice || '').toLowerCase()
  const badgeColor = ADVICE_COLORS[adviceLower] || '#6b7280'

  if (editing) {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Advies</label>
          <select
            value={editAdvice}
            onChange={(e) => setEditAdvice(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 dark:focus:ring-[#1B3A5C]/40 focus:border-[#1B3A5C]"
          >
            <option value="">— Selecteer —</option>
            <option value="Kopen">Kopen</option>
            <option value="Koopman">Koopman</option>
            <option value="Houden">Houden</option>
            <option value="Verkopen">Verkopen</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Motivatie</label>
          <textarea
            value={editMotivation}
            onChange={(e) => setEditMotivation(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 dark:focus:ring-[#1B3A5C]/40 focus:border-[#1B3A5C] resize-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[#1B3A5C] text-white text-sm font-medium hover:bg-[#162f4a] transition-colors disabled:opacity-50"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Annuleren
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        {advice ? (
          <span
            className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: badgeColor }}
          >
            {advice}
          </span>
        ) : (
          <span className="text-sm text-slate-400 dark:text-slate-500">Geen advies</span>
        )}
        {motivation && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{motivation}</p>
        )}
      </div>
      <button
        onClick={() => {
          setEditAdvice(advice || '')
          setEditMotivation(motivation || '')
          setEditing(true)
        }}
        className="flex-shrink-0 text-xs text-[#1B3A5C] dark:text-[#E8B34A] font-medium hover:underline"
      >
        Bewerken
      </button>
    </div>
  )
}

// --- PRICE CHART ---

function PriceChart({ ticker }: { ticker: string }) {
  const [period, setPeriod] = useState<Period>('1Y')
  const [allData, setAllData] = useState<PricePoint[]>([])
  const [loading, setLoading] = useState(true)
  const isDark = useIsDark()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get<{ data: PricePoint[] }>(`/api/positions/${encodeURIComponent(ticker)}/history`)
      .then((res) => {
        if (!cancelled) setAllData(res.data || [])
      })
      .catch(() => {
        if (!cancelled) setAllData([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [ticker])

  const filteredData = useMemo(() => {
    if (allData.length === 0) return []
    const days = PERIOD_DAYS[period]
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return allData.filter((p) => p.date >= cutoffStr)
  }, [allData, period])

  if (loading) {
    return <Skeleton className="h-48 rounded-xl" />
  }

  if (filteredData.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Geen koersdata beschikbaar.</p>
  }

  const prices = filteredData.map((p) => p.close)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const isPositive = filteredData[filteredData.length - 1].close >= filteredData[0].close
  const chartColor = isPositive ? '#15803d' : '#dc2626'
  const tickColor = isDark ? '#64748b' : '#94a3b8'

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {(['1M', '3M', '6M', '1Y'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              period === p
                ? 'bg-[#1B3A5C] text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={filteredData}>
          <defs>
            <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColor} stopOpacity={0.15} />
              <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: tickColor }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(d: string) => {
              const date = new Date(d)
              return `${date.getDate()}/${date.getMonth() + 1}`
            }}
            minTickGap={40}
          />
          <YAxis
            domain={[minPrice * 0.98, maxPrice * 1.02]}
            tick={{ fontSize: 10, fill: tickColor }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              color: isDark ? '#e2e8f0' : '#1e293b',
            }}
            formatter={(value) => [Number(value).toFixed(2), 'Koers']}
            labelFormatter={(label) => {
              const d = new Date(label)
              return d.toLocaleDateString('nl-NL')
            }}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke={chartColor}
            strokeWidth={1.5}
            fill={`url(#grad-${ticker})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// --- DETAIL PANEL ---

function DetailPanel({
  ticker,
  holding,
  onAdviceUpdated,
}: {
  ticker: string
  holding: EnrichedHolding
  onAdviceUpdated: () => void
}) {
  const [detail, setDetail] = useState<PositionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.get<PositionDetail>(`/api/positions/${encodeURIComponent(ticker)}`)
      setDetail(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fout bij laden')
    } finally {
      setLoading(false)
    }
  }, [ticker])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-48 rounded-xl" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-20 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{error}</p>
        <button
          onClick={fetchDetail}
          className="text-sm text-[#1B3A5C] dark:text-[#E8B34A] font-medium hover:underline"
        >
          Opnieuw proberen
        </button>
      </div>
    )
  }

  if (!detail) return null

  const { fundamentals, style, transactions } = detail
  const isNonEur = holding.currency !== 'EUR'

  // Holding period calculation
  const holdingPeriod = (() => {
    if (!transactions || transactions.length === 0) return null
    const dates = transactions.map(tx => tx.transaction_date).filter(Boolean).sort()
    if (dates.length === 0) return null
    const earliest = new Date(dates[0])
    const now = new Date()
    const totalMonths = (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth())
    const years = Math.floor(totalMonths / 12)
    const months = totalMonths % 12
    const duration = years > 0
      ? months > 0 ? `${years}j ${months}m` : `${years}j`
      : `${totalMonths}m`
    const dateStr = earliest.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
    return { dateStr, duration }
  })()

  return (
    <div className="space-y-6">
      {/* --- HEADER --- */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{holding.name}</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500">
          {holding.ticker}
          {QARP_TICKERS.has(holding.ticker) && (
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#E8B34A] text-white ml-1">QARP</span>
          )}
          {' '}&middot; {holding.sector} &middot; {holding.geo}
        </p>
        <div className="flex items-baseline gap-3 mt-2">
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatLocalPrice(holding.price_local, holding.currency)}
          </span>
          <span className={`text-sm font-semibold ${pnlColor(holding.day_change_pct)}`}>
            {formatPct(holding.day_change_pct)}
          </span>
        </div>
        {isNonEur && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatEuro(holding.price_eur)}</p>
        )}
        {/* Holding period */}
        {holdingPeriod ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            In portefeuille sinds {holdingPeriod.dateStr} ({holdingPeriod.duration})
          </p>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">Geen transactiehistorie</p>
        )}
      </div>

      {/* --- POSITIE SAMENVATTING --- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 px-3 py-2.5">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Stuks</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatNumber(holding.shares)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 px-3 py-2.5">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Waarde</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatEuro(holding.value)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 px-3 py-2.5">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Gem. Kostprijs</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatEuro(holding.avg_cost_eur)}</p>
        </div>
        <div className={`rounded-xl px-3 py-2.5 ${pnlBgColor(holding.pnl_nominal)}`}>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">P&L</p>
          <p className={`text-sm font-semibold ${pnlColor(holding.pnl_nominal)}`}>
            {formatEuro(holding.pnl_nominal)} ({formatPct(holding.pnl_pct)})
          </p>
        </div>
      </div>

      {/* --- KOERSGRAFIEK --- */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Koersverloop</h3>
        <PriceChart ticker={ticker} />
      </div>

      {/* --- FUNDAMENTALS --- */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Fundamentele Data</h3>
        <FundamentalsGrid fundamentals={fundamentals} currency={holding.currency} />
      </div>

      {/* --- STYLE BOX + ADVIES --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Morningstar Style Box</h3>
          {style.row != null && style.col != null ? (
            <StyleBox row={style.row} col={style.col} />
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">Geen stijlclassificatie beschikbaar.</p>
          )}
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Advies</h3>
          <AdviceSection
            ticker={ticker}
            advice={holding.advice}
            motivation={holding.motivation}
            onUpdated={() => {
              fetchDetail()
              onAdviceUpdated()
            }}
          />
        </div>
      </div>

      {/* --- TRANSACTIES --- */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Transactiehistorie</h3>
        <TransactionTable transactions={transactions} />
      </div>
    </div>
  )
}

// --- MAIN PAGE ---

export default function PositiesPage() {
  const { data, loading, error, refresh } = usePortfolio()
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const sortedHoldings = useMemo(() => {
    if (!data?.holdings) return []
    return [...data.holdings].sort((a, b) => b.value - a.value)
  }, [data?.holdings])

  const filteredHoldings = useMemo(() => {
    if (!search.trim()) return sortedHoldings
    const q = search.toLowerCase()
    return sortedHoldings.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.ticker.toLowerCase().includes(q) ||
        (h.sector || '').toLowerCase().includes(q)
    )
  }, [sortedHoldings, search])

  const selectedHolding = useMemo(
    () => sortedHoldings.find((h) => h.ticker === selectedTicker) || null,
    [sortedHoldings, selectedTicker]
  )

  // --- LOADING ---
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
          <div className="md:col-span-2">
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  // --- ERROR ---
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

  // --- EMPTY ---
  if (!data?.holdings || data.holdings.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400 dark:text-slate-500">
        <p className="text-lg">Geen posities gevonden.</p>
        <p className="text-sm mt-2">Ga naar Data Sync om data te importeren.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">Posities</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* --- POSITIELIJST --- */}
        <div className="md:col-span-1">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-700/30">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 dark:text-slate-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Zoek positie..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 dark:focus:ring-[#1B3A5C]/40 focus:border-[#1B3A5C] placeholder:text-slate-300 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
              {filteredHoldings.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">Geen resultaten</p>
              ) : (
                filteredHoldings.map((h) => (
                  <PositionListItem
                    key={h.ticker}
                    holding={h}
                    active={selectedTicker === h.ticker}
                    onClick={() => setSelectedTicker(h.ticker)}
                  />
                ))
              )}
            </div>

            {/* Count */}
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700/30 bg-slate-50/50 dark:bg-slate-700/20">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {filteredHoldings.length} van {sortedHoldings.length} posities
              </p>
            </div>
          </div>
        </div>

        {/* --- DETAIL PANEL --- */}
        <div className="md:col-span-2">
          {selectedTicker && selectedHolding ? (
            <DetailPanel
              key={selectedTicker}
              ticker={selectedTicker}
              holding={selectedHolding}
              onAdviceUpdated={refresh}
            />
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5 flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <svg
                  className="w-12 h-12 text-slate-200 dark:text-slate-600 mx-auto mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                </svg>
                <p className="text-sm text-slate-400 dark:text-slate-500">Selecteer een positie om details te bekijken</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
