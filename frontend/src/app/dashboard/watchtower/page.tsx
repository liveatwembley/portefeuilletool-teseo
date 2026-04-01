'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { formatEuro, formatPct } from '@/lib/formatters'
import { Skeleton } from '@/components/ui/skeleton'

interface WatchlistItem {
  id: number
  ticker: string
  name: string
  sector: string | null
  owner: string | null
  bio: string | null
  comment: string | null
  trigger_buy: number | null
  trigger_sell: number | null
  current_price: number
  prev_close: number
  day_change_pct: number
  pe: number | null
  pb: number | null
  dividend_yield: number | null
  market_cap: number | null
  fifty_two_week_high: number | null
  fifty_two_week_low: number | null
  alert: 'buy' | 'sell' | null
}

// --- INLINE EDIT CELL ---

function EditableText({ value, placeholder, onSave, className }: {
  value: string | null
  placeholder: string
  onSave: (val: string) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value || '')

  const handleSave = () => {
    if (text !== (value || '')) onSave(text)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') { setText(value || ''); setEditing(false) }
        }}
        className="w-full text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
        placeholder={placeholder}
      />
    )
  }

  return (
    <button onClick={() => setEditing(true)} className={`text-left w-full ${className || ''}`} title="Klik om te bewerken">
      {value ? (
        <span className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer">
          {value}
        </span>
      ) : (
        <span className="text-xs text-slate-300 dark:text-slate-600 hover:text-slate-400 dark:hover:text-slate-500 transition-colors cursor-pointer">
          {placeholder}
        </span>
      )}
    </button>
  )
}

// --- ADD FORM ---

function AddTickerForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [ticker, setTicker] = useState('')
  const [name, setName] = useState('')
  const [sector, setSector] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!ticker.trim() || !name.trim()) return
    setSaving(true)
    try {
      await api.post('/api/watchlist/', { ticker: ticker.trim().toUpperCase(), name: name.trim(), sector: sector.trim() || null })
      setTicker('')
      setName('')
      setSector('')
      setOpen(false)
      onAdded()
    } catch {
      // stille fout
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1B3A5C] text-white text-sm font-medium hover:bg-[#162f4a] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Toevoegen
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="Ticker (bv. AAPL)"
        className="text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 w-32 focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]" />
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam"
        className="text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 w-48 focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]" />
      <input type="text" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Sector"
        className="text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 w-40 focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]" />
      <button onClick={handleSubmit} disabled={saving || !ticker.trim() || !name.trim()}
        className="px-3 py-2 rounded-lg bg-[#1B3A5C] text-white text-sm font-medium hover:bg-[#162f4a] transition-colors disabled:opacity-50">
        {saving ? '...' : 'Opslaan'}
      </button>
      <button onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
        Annuleren
      </button>
    </div>
  )
}

// --- MAIN PAGE ---

export default function WatchtowerPage() {
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(null)
    api.get<WatchlistItem[]>('/api/watchlist/')
      .then(setItems)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleUpdate = async (id: number, field: string, value: string | number | null) => {
    try {
      await api.put(`/api/watchlist/${id}`, { [field]: value })
      fetchData()
    } catch {
      // stille fout
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/watchlist/${id}`)
      fetchData()
    } catch {
      // stille fout
    }
  }

  const formatMarketCap = (mc: number | null) => {
    if (!mc) return '—'
    if (mc >= 1e12) return `${(mc / 1e12).toFixed(1)}T`
    if (mc >= 1e9) return `${(mc / 1e9).toFixed(1)}B`
    if (mc >= 1e6) return `${(mc / 1e6).toFixed(0)}M`
    return `${mc}`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-48 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400 dark:text-slate-500 mb-4">Kan watchlist niet laden.</p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">{error}</p>
        <button onClick={fetchData} className="text-sm text-[#1B3A5C] dark:text-[#E8B34A] hover:underline">Opnieuw proberen</button>
      </div>
    )
  }

  // Groepeer per sector
  const sectors = new Map<string, WatchlistItem[]>()
  items.forEach(item => {
    const s = item.sector || 'Overig'
    if (!sectors.has(s)) sectors.set(s, [])
    sectors.get(s)!.push(item)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Watchtower</h1>
        <AddTickerForm onAdded={fetchData} />
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-400 dark:text-slate-500">Geen aandelen op de watchlist.</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">Voeg een ticker toe om te beginnen.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Aandeel</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sector</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Koers</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dag %</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">PE</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">P/B</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Div %</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">MCap</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Owner</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider min-w-[120px]">Bio</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider min-w-[120px]">Commentaar</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Triggers</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const rowAlert = item.alert === 'buy'
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : item.alert === 'sell'
                    ? 'bg-red-50 dark:bg-red-900/20'
                    : ''

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-slate-50 dark:border-slate-700/30 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors ${rowAlert}`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        {item.name}
                        {item.alert && (
                          <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${item.alert === 'buy' ? 'bg-green-500' : 'bg-red-500'}`}
                            title={item.alert === 'buy' ? 'Kooptriger bereikt!' : 'Verkooptriger bereikt!'} />
                        )}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{item.ticker}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">{item.sector || '—'}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-slate-100">
                      {item.current_price ? `$${item.current_price.toFixed(2)}` : '—'}
                    </td>
                    <td className={`py-3 px-4 text-right ${(item.day_change_pct || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatPct(item.day_change_pct)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">{item.pe ? item.pe.toFixed(1) : '—'}</td>
                    <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">{item.pb ? item.pb.toFixed(1) : '—'}</td>
                    <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                      {item.dividend_yield ? `${(item.dividend_yield * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">{formatMarketCap(item.market_cap)}</td>
                    <td className="py-3 px-4">
                      <EditableText value={item.owner} placeholder="+ owner" onSave={(v) => handleUpdate(item.id, 'owner', v)} />
                    </td>
                    <td className="py-3 px-4">
                      <EditableText value={item.bio} placeholder="+ bio" onSave={(v) => handleUpdate(item.id, 'bio', v)} />
                    </td>
                    <td className="py-3 px-4">
                      <EditableText value={item.comment} placeholder="+ commentaar" onSave={(v) => handleUpdate(item.id, 'comment', v)} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="text-xs space-y-0.5">
                        {item.trigger_buy && <div className="text-green-600 dark:text-green-400">K: ${item.trigger_buy}</div>}
                        {item.trigger_sell && <div className="text-red-600 dark:text-red-400">V: ${item.trigger_sell}</div>}
                        {!item.trigger_buy && !item.trigger_sell && <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title="Verwijderen"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
