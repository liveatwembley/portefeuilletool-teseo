'use client'
import { useState } from 'react'
import type { EnrichedHolding } from '@/lib/types'
import { formatEuro, formatPct, formatNumber, formatLocalPrice, pnlColor } from '@/lib/formatters'
import { ADVICE_COLORS, QARP_TICKERS } from '@/lib/colors'
import { api } from '@/lib/api'

const ADVICE_OPTIONS = ['Kopen', 'Koopman', 'Houden', 'Verkopen']

// --- COMMENT CELL ---

function CommentCell({ holding, onUpdated }: { holding: EnrichedHolding; onUpdated?: () => void }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [value, setValue] = useState(holding.motivation || '')

  const handleSave = async () => {
    if (value === (holding.motivation || '')) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await api.put(`/api/positions/${encodeURIComponent(holding.ticker)}/advice`, {
        motivation: value,
      })
      setEditing(false)
      onUpdated?.()
    } catch {
      // stille fout
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        disabled={saving}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') { setValue(holding.motivation || ''); setEditing(false) }
        }}
        className="w-full text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
        placeholder="Commentaar..."
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group/comment text-left w-full"
      title="Klik om te bewerken"
    >
      {holding.motivation ? (
        <span className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
          {holding.motivation}
        </span>
      ) : (
        <span className="text-xs text-slate-300 dark:text-slate-600 group-hover/comment:text-slate-400 dark:group-hover/comment:text-slate-500 transition-colors">
          + commentaar
        </span>
      )}
    </button>
  )
}

// --- MANDATE CELL ---

function MandateCell({ holding, onUpdated }: { holding: EnrichedHolding; onUpdated?: () => void }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [buyVal, setBuyVal] = useState(holding.mandate_buy || 0)
  const [sellVal, setSellVal] = useState(holding.mandate_sell || 0)

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/api/positions/${encodeURIComponent(holding.ticker)}/mandate`, {
        mandate_buy: buyVal || null,
        mandate_sell: sellVal || null,
      })
      setEditing(false)
      onUpdated?.()
    } catch {
      // stille fout
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-green-600 dark:text-green-400 font-medium w-3">K</span>
          <input type="number" autoFocus disabled={saving} value={buyVal || ''} onChange={(e) => setBuyVal(Number(e.target.value))}
            className="w-16 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            placeholder="0" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-red-600 dark:text-red-400 font-medium w-3">V</span>
          <input type="number" disabled={saving} value={sellVal || ''} onChange={(e) => setSellVal(Number(e.target.value))}
            className="w-16 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            placeholder="0" />
        </div>
        <div className="flex gap-1">
          <button onClick={handleSave} disabled={saving} className="text-[10px] text-green-600 dark:text-green-400 hover:underline">Opslaan</button>
          <button onClick={() => setEditing(false)} className="text-[10px] text-slate-400 hover:underline">Annuleren</button>
        </div>
      </div>
    )
  }

  const hasBuy = holding.mandate_buy && holding.mandate_buy > 0
  const hasSell = holding.mandate_sell && holding.mandate_sell > 0

  if (!hasBuy && !hasSell) {
    return (
      <button onClick={() => setEditing(true)} className="group/mandate" title="Klik om mandaat in te stellen">
        <span className="text-xs text-slate-300 dark:text-slate-600 group-hover/mandate:text-slate-400 dark:group-hover/mandate:text-slate-500 transition-colors">
          + mandaat
        </span>
      </button>
    )
  }

  return (
    <button onClick={() => setEditing(true)} className="text-left" title="Klik om te bewerken">
      <div className="text-xs space-y-0.5">
        {hasBuy && <div className="text-green-600 dark:text-green-400">K: {holding.currency !== 'EUR' ? `${holding.currency} ` : '€'}{holding.mandate_buy}</div>}
        {hasSell && <div className="text-red-600 dark:text-red-400">V: {holding.currency !== 'EUR' ? `${holding.currency} ` : '€'}{holding.mandate_sell}</div>}
      </div>
    </button>
  )
}

// --- ADVICE CELL ---

function AdviceCell({ holding, onUpdated }: { holding: EnrichedHolding; onUpdated?: () => void }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleChange = async (value: string) => {
    setSaving(true)
    try {
      await api.put(`/api/positions/${encodeURIComponent(holding.ticker)}/advice`, {
        advice: value,
      })
      setEditing(false)
      onUpdated?.()
    } catch {
      // stille fout
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <select
        autoFocus
        disabled={saving}
        defaultValue={holding.advice || ''}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setEditing(false)}
        className="text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
      >
        <option value="">—</option>
        {ADVICE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )
  }

  const adviceLower = (holding.advice || '').toLowerCase()
  const color = ADVICE_COLORS[adviceLower] || '#6b7280'

  return (
    <button
      onClick={() => setEditing(true)}
      className="group/advice inline-flex items-center gap-1"
      title="Klik om te bewerken"
    >
      {holding.advice ? (
        <span
          className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white cursor-pointer hover:opacity-80 transition-opacity"
          style={{ backgroundColor: color }}
        >
          {holding.advice}
        </span>
      ) : (
        <span className="text-xs text-slate-300 dark:text-slate-600 group-hover/advice:text-slate-400 dark:group-hover/advice:text-slate-500 transition-colors">
          + advies
        </span>
      )}
    </button>
  )
}

export function PositionsTable({ holdings, onAdviceUpdated }: { holdings: EnrichedHolding[]; onAdviceUpdated?: () => void }) {
  const sorted = [...holdings].sort((a, b) => (b.value || 0) - (a.value || 0))

  return (
    <div className="relative overflow-x-auto rounded-md">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider sticky left-0 bg-white dark:bg-slate-800 z-10">Aandeel</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sector</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Aantal</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Koers</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Waarde</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">P&L</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">P&L %</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dag %</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Gewicht</th>
            <th className="text-center py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Advies</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider min-w-[100px]">Mandaat</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider min-w-[150px]">Commentaar</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => (
            <tr
              key={h.ticker}
              className="border-b border-slate-50 dark:border-slate-700/30 even:bg-slate-50/30 dark:even:bg-slate-700/10 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors"
            >
              <td className="py-3 px-4 sticky left-0 bg-inherit z-10">
                <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1">
                  {h.name}
                  {(h.pnl_pct || 0) > 15 && (h.day_change_pct || 0) > 0 && (
                    <span className="inline-block w-2 h-2 rounded-full bg-green-400 dark:bg-green-500 flex-shrink-0" title="Momentum: >15% rendement en vandaag positief" />
                  )}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500">
                  {h.ticker}
                  {QARP_TICKERS.has(h.ticker) && (
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#E8B34A] text-white ml-1">QARP</span>
                  )}
                </div>
              </td>
              <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-xs">{h.sector}</td>
              <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">{formatNumber(h.shares)}</td>
              <td className="py-3 px-4 text-right">
                {h.currency !== 'EUR' ? (
                  <>
                    <div className="text-slate-700 dark:text-slate-300">{formatLocalPrice(h.price_local, h.currency)}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">{formatEuro(h.price_eur)}</div>
                  </>
                ) : (
                  <div className="text-slate-700 dark:text-slate-300">{formatEuro(h.price_eur)}</div>
                )}
              </td>
              <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-slate-100">{formatEuro(h.value)}</td>
              <td className={`py-3 px-4 text-right font-medium ${pnlColor(h.pnl_nominal)}`}>
                {formatEuro(h.pnl_nominal)}
              </td>
              <td className={`py-3 px-4 text-right font-medium ${pnlColor(h.pnl_pct)}`}>
                {formatPct(h.pnl_pct)}
              </td>
              <td className={`py-3 px-4 text-right ${pnlColor(h.day_change_pct)}`}>
                {formatPct(h.day_change_pct)}
              </td>
              <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">{(h.weight || 0).toFixed(1)}%</td>
              <td className="py-3 px-4 text-center">
                <AdviceCell holding={h} onUpdated={onAdviceUpdated} />
              </td>
              <td className="py-3 px-4">
                <MandateCell holding={h} onUpdated={onAdviceUpdated} />
              </td>
              <td className="py-3 px-4">
                <CommentCell holding={h} onUpdated={onAdviceUpdated} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
