'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { EnrichedHolding, FundamentalData } from '@/lib/types'
import { formatEuro, formatMarketCap, formatNumber } from '@/lib/formatters'
import { Skeleton } from '@/components/ui/skeleton'

interface HoldingsResponse {
  holdings: EnrichedHolding[]
  fundamentals: Record<string, FundamentalData>
  meta: Record<string, unknown>
}

// --- 52W RANGE BAR ---
function FiftyTwoWeekBar({ low, high, current }: { low: number; high: number; current: number }) {
  if (low >= high) return <span className="text-slate-400">—</span>
  const pct = Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100))
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <span className="text-[10px] text-slate-400 w-10 text-right">{formatNumber(low, 0)}</span>
      <div className="relative flex-1 h-1.5 bg-slate-200 rounded-full">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#1B3A5C] border-2 border-white shadow-sm"
          style={{ left: `calc(${pct}% - 5px)` }}
        />
      </div>
      <span className="text-[10px] text-slate-400 w-10">{formatNumber(high, 0)}</span>
    </div>
  )
}

// --- SORT HELPERS ---
type SortKey = 'name' | 'sector' | 'price_eur' | 'pe' | 'pb' | 'div_yield' | 'market_cap' | 'beta' | 'value'
type SortDir = 'asc' | 'desc'

function getSortValue(h: EnrichedHolding, f: FundamentalData | undefined, key: SortKey): number | string {
  switch (key) {
    case 'name': return h.name.toLowerCase()
    case 'sector': return (h.sector || '').toLowerCase()
    case 'price_eur': return h.price_eur || 0
    case 'pe': return f?.pe_trailing ?? -Infinity
    case 'pb': return f?.pb ?? -Infinity
    case 'div_yield': return f?.dividend_yield ?? -Infinity
    case 'market_cap': return f?.market_cap ?? -Infinity
    case 'beta': return f?.beta ?? -Infinity
    case 'value': return h.value || 0
    default: return 0
  }
}

export default function HoldingsPage() {
  const [data, setData] = useState<HoldingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    api.get<HoldingsResponse>('/api/portfolio/holdings')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' || key === 'sector' ? 'asc' : 'desc')
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 mb-2 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!data?.holdings?.length) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p className="text-lg">Geen holdings gevonden.</p>
        <p className="text-sm mt-2">Ga naar Data Sync om data te importeren.</p>
      </div>
    )
  }

  const { holdings, fundamentals } = data

  const sorted = [...holdings].sort((a, b) => {
    const fa = fundamentals[a.ticker]
    const fb = fundamentals[b.ticker]
    const va = getSortValue(a, fa, sortKey)
    const vb = getSortValue(b, fb, sortKey)
    if (typeof va === 'string' && typeof vb === 'string') {
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    }
    const na = va as number
    const nb = vb as number
    // Push -Infinity to the bottom regardless of sort direction
    if (na === -Infinity && nb === -Infinity) return 0
    if (na === -Infinity) return 1
    if (nb === -Infinity) return -1
    return sortDir === 'asc' ? na - nb : nb - na
  })

  const columns: { key: SortKey; label: string; align?: string }[] = [
    { key: 'name', label: 'Naam' },
    { key: 'sector', label: 'Sector' },
    { key: 'price_eur', label: 'Koers', align: 'right' },
    { key: 'value', label: '52W Range' },
    { key: 'pe', label: 'P/E', align: 'right' },
    { key: 'pb', label: 'P/B', align: 'right' },
    { key: 'div_yield', label: 'Div. Yield', align: 'right' },
    { key: 'market_cap', label: 'Market Cap', align: 'right' },
    { key: 'beta', label: 'Beta', align: 'right' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Holdings Analyse</h1>

      <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {columns.map(col => (
                  <th
                    key={col.key}
                    onClick={() => col.key !== 'value' ? handleSort(col.key) : undefined}
                    className={`px-4 py-3 font-medium text-slate-500 text-xs whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    } ${col.key !== 'value' ? 'cursor-pointer hover:text-slate-700 select-none' : ''}`}
                  >
                    {col.label}{col.key !== 'value' ? sortIndicator(col.key) : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(h => {
                const f = fundamentals[h.ticker]
                return (
                  <tr key={h.ticker} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    {/* Naam */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{h.name}</div>
                      <div className="text-xs text-slate-400">{h.ticker}</div>
                    </td>
                    {/* Sector */}
                    <td className="px-4 py-3 text-slate-600">{h.sector || '—'}</td>
                    {/* Koers */}
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {formatEuro(h.price_eur)}
                    </td>
                    {/* 52W Range */}
                    <td className="px-4 py-3">
                      {f?.fifty_two_week_low != null && f?.fifty_two_week_high != null ? (
                        <FiftyTwoWeekBar
                          low={f.fifty_two_week_low}
                          high={f.fifty_two_week_high}
                          current={h.price_eur}
                        />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {/* P/E */}
                    <td className="px-4 py-3 text-right text-slate-700">
                      {f?.pe_trailing != null ? formatNumber(f.pe_trailing, 1) : '—'}
                    </td>
                    {/* P/B */}
                    <td className="px-4 py-3 text-right text-slate-700">
                      {f?.pb != null ? formatNumber(f.pb, 1) : '—'}
                    </td>
                    {/* Div. Yield */}
                    <td className="px-4 py-3 text-right text-slate-700">
                      {f?.dividend_yield != null ? `${(f.dividend_yield * 100).toFixed(2)}%` : '—'}
                    </td>
                    {/* Market Cap */}
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatMarketCap(f?.market_cap)}
                    </td>
                    {/* Beta */}
                    <td className="px-4 py-3 text-right text-slate-700">
                      {f?.beta != null ? formatNumber(f.beta, 2) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
