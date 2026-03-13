'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPct } from '@/lib/formatters'
import { ADVICE_COLORS } from '@/lib/colors'

// --- TYPES ---

interface EarningsEntry {
  ticker: string
  name: string
  sector: string
  earnings_date: string | null
  weight: number
}

interface ThesisData {
  ticker: string
  thesis: string
  kpis: string
  last_review: string
}

// --- HELPERS ---

function formatDutchDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatMonthYear(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
}

function daysFromNow(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function groupByMonth(entries: EarningsEntry[]): Record<string, EarningsEntry[]> {
  const groups: Record<string, EarningsEntry[]> = {}
  for (const entry of entries) {
    if (!entry.earnings_date) continue
    const key = entry.earnings_date.slice(0, 7) // YYYY-MM
    if (!groups[key]) groups[key] = []
    groups[key].push(entry)
  }
  return groups
}

// --- SECTOR BADGE ---

function SectorBadge({ sector }: { sector: string }) {
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
      {sector}
    </span>
  )
}

// --- EARNINGS CALENDAR SECTION ---

function EarningsCalendar({
  entries,
  loading,
  error,
  onRetry,
}: {
  entries: EarningsEntry[]
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/30 mb-3">
          <svg className="w-6 h-6 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{error}</p>
        <button
          onClick={onRetry}
          className="text-sm text-[#1B3A5C] dark:text-[#E8B34A] font-medium hover:underline"
        >
          Opnieuw proberen
        </button>
      </div>
    )
  }

  const withDate = entries.filter((e) => e.earnings_date)
  const withoutDate = entries.filter((e) => !e.earnings_date)

  if (withDate.length === 0 && withoutDate.length === 0) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">
        Geen earnings data beschikbaar
      </p>
    )
  }

  const grouped = groupByMonth(withDate)
  const monthKeys = Object.keys(grouped).sort()

  return (
    <div className="space-y-6">
      {monthKeys.map((monthKey) => {
        const monthEntries = grouped[monthKey]
        const label = formatMonthYear(monthKey + '-01')

        return (
          <div key={monthKey}>
            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              {label}
            </h3>
            <div className="space-y-1">
              {monthEntries.map((entry) => {
                const days = daysFromNow(entry.earnings_date!)
                const isUpcoming = days >= 0 && days <= 7
                const isPast = days < 0

                return (
                  <div
                    key={entry.ticker}
                    className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                      isUpcoming
                        ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40'
                        : isPast
                        ? 'bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/30'
                        : 'bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60'
                    }`}
                  >
                    {/* Datum */}
                    <div className="flex-shrink-0 w-20 text-center">
                      <p className={`text-sm font-semibold ${
                        isPast
                          ? 'text-slate-400 dark:text-slate-500'
                          : isUpcoming
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {formatDutchDate(entry.earnings_date!).split(' ').slice(0, 2).join(' ')}
                      </p>
                      {isUpcoming && (
                        <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                          {days === 0 ? 'Vandaag' : days === 1 ? 'Morgen' : `Over ${days} dagen`}
                        </p>
                      )}
                      {isPast && days >= -30 && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {Math.abs(days)} dagen geleden
                        </p>
                      )}
                    </div>

                    {/* Divider */}
                    <div className={`w-px h-8 flex-shrink-0 ${
                      isPast ? 'bg-slate-200 dark:bg-slate-700' : 'bg-slate-300 dark:bg-slate-600'
                    }`} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium truncate ${
                          isPast
                            ? 'text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}>
                          {entry.name}
                        </p>
                        <span className={`text-xs ${
                          isPast ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          {entry.ticker}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <SectorBadge sector={entry.sector} />
                      </div>
                    </div>

                    {/* Gewicht */}
                    <div className="flex-shrink-0 text-right">
                      <p className={`text-sm font-medium ${
                        isPast ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {formatPct(entry.weight, 1)}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">gewicht</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Posities zonder earnings datum */}
      {withoutDate.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            Geen datum bekend
          </h3>
          <div className="space-y-1">
            {withoutDate.map((entry) => (
              <div
                key={entry.ticker}
                className="flex items-center gap-3 px-4 py-3 rounded-md bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/30"
              >
                <div className="flex-shrink-0 w-20 text-center">
                  <p className="text-xs text-slate-300 dark:text-slate-600">--</p>
                </div>
                <div className="w-px h-8 flex-shrink-0 bg-slate-200 dark:bg-slate-700" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-400 dark:text-slate-500 truncate">{entry.name}</p>
                  <span className="text-xs text-slate-300 dark:text-slate-600">{entry.ticker}</span>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-medium text-slate-400 dark:text-slate-500">{formatPct(entry.weight, 1)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// --- THESIS CARD ---

function ThesisCard({
  entry,
}: {
  entry: EarningsEntry
}) {
  const [expanded, setExpanded] = useState(false)
  const [thesis, setThesis] = useState<ThesisData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editThesis, setEditThesis] = useState('')
  const [editKpis, setEditKpis] = useState('')
  const [editLastReview, setEditLastReview] = useState('')

  const fetchThesis = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<ThesisData>(`/api/earnings/thesis/${encodeURIComponent(entry.ticker)}`)
      setThesis(data)
      setEditThesis(data.thesis || '')
      setEditKpis(data.kpis || '')
      setEditLastReview(data.last_review || '')
    } catch {
      // stille fout
    } finally {
      setLoading(false)
    }
  }, [entry.ticker])

  const handleToggle = () => {
    if (!expanded && !thesis) {
      fetchThesis()
    }
    setExpanded((prev) => !prev)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/api/earnings/thesis/${encodeURIComponent(entry.ticker)}`, {
        thesis: editThesis,
        kpis: editKpis,
        last_review: editLastReview,
      })
      setThesis({
        ticker: entry.ticker,
        thesis: editThesis,
        kpis: editKpis,
        last_review: editLastReview,
      })
    } catch {
      // stille fout
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{entry.name}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{entry.ticker}</p>
          </div>
          <SectorBadge sector={entry.sector} />
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {thesis && thesis.thesis && (
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              Thesis ingevuld
            </span>
          )}
          <svg
            className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {/* Content */}
      <div
        className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
          expanded ? 'max-h-[600px]' : 'max-h-0'
        }`}
      >
        <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700/30 pt-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Thesis */}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Thesis (waarom hebben we dit?)
                </label>
                <textarea
                  value={editThesis}
                  onChange={(e) => setEditThesis(e.target.value)}
                  rows={3}
                  placeholder="Beschrijf de investmentthesis..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 dark:focus:ring-[#1B3A5C]/40 focus:border-[#1B3A5C] placeholder:text-slate-300 dark:placeholder:text-slate-500 resize-none"
                />
              </div>

              {/* KPIs */}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  KPIs (wat volgen we?)
                </label>
                <textarea
                  value={editKpis}
                  onChange={(e) => setEditKpis(e.target.value)}
                  rows={2}
                  placeholder="Bijv. omzetgroei, marges, marktaandeel..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 dark:focus:ring-[#1B3A5C]/40 focus:border-[#1B3A5C] placeholder:text-slate-300 dark:placeholder:text-slate-500 resize-none"
                />
              </div>

              {/* Laatste review */}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Laatste review
                </label>
                <input
                  type="date"
                  value={editLastReview}
                  onChange={(e) => setEditLastReview(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 dark:focus:ring-[#1B3A5C]/40 focus:border-[#1B3A5C]"
                />
              </div>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-[#1B3A5C] text-white text-sm font-medium hover:bg-[#162f4a] transition-colors disabled:opacity-50"
              >
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- MAIN PAGE ---

export default function EarningsPage() {
  const [entries, setEntries] = useState<EarningsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCalendar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<EarningsEntry[]>('/api/earnings/calendar')
      setEntries(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fout bij laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCalendar()
  }, [fetchCalendar])

  // Posities gesorteerd op naam voor thesis tracker
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => a.name.localeCompare(b.name))
  }, [entries])

  return (
    <div className="space-y-8">
      {/* --- EARNINGS KALENDER --- */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#1B3A5C] flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              Earnings Kalender
            </h1>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Aankomende kwartaalcijfers van portefeuilleposities
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700/60 p-5">
          <EarningsCalendar
            entries={entries}
            loading={loading}
            error={error}
            onRetry={fetchCalendar}
          />
        </div>
      </section>

      {/* --- THESIS TRACKER --- */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#1B3A5C] flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              Investment Thesis Tracker
            </h1>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Vastleggen waarom we elke positie aanhouden en welke KPIs we volgen
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{error}</p>
            <button
              onClick={fetchCalendar}
              className="text-sm text-[#1B3A5C] dark:text-[#E8B34A] font-medium hover:underline"
            >
              Opnieuw proberen
            </button>
          </div>
        ) : sortedEntries.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">
            Geen posities gevonden
          </p>
        ) : (
          <div className="space-y-2">
            {sortedEntries.map((entry) => (
              <ThesisCard key={entry.ticker} entry={entry} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
