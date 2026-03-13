'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Transaction } from '@/lib/types'
import { formatEuro, formatNumber } from '@/lib/formatters'
import { Skeleton } from '@/components/ui/skeleton'

// --- TYPES ---

interface Position {
  id: number
  ticker: string
  name: string
  currency: string
}

interface TransactionForm {
  ticker: string
  transaction_date: string
  type: 'BUY' | 'SELL'
  shares: string
  price_local: string
  price_eur: string
  fx_rate: string
  fees: string
  notes: string
}

const EMPTY_FORM: TransactionForm = {
  ticker: '',
  transaction_date: '',
  type: 'BUY',
  shares: '',
  price_local: '',
  price_eur: '',
  fx_rate: '',
  fees: '0',
  notes: '',
}

// --- HELPERS ---

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// --- SKELETON ---

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full rounded-lg" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  )
}

// --- MODAL ---

function TransactionModal({
  open,
  onClose,
  positions,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  positions: Position[]
  onSuccess: () => void
}) {
  const [form, setForm] = useState<TransactionForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM)
      setFeedback(null)
    }
  }, [open])

  function updateField(field: keyof TransactionForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFeedback(null)

    if (!form.ticker || !form.transaction_date || !form.shares || !form.price_local || !form.price_eur) {
      setFeedback({ type: 'error', message: 'Vul alle verplichte velden in.' })
      return
    }

    const shares = parseFloat(form.shares)
    const priceLocal = parseFloat(form.price_local)
    const priceEur = parseFloat(form.price_eur)

    if (isNaN(shares) || shares <= 0) {
      setFeedback({ type: 'error', message: 'Aantal moet een positief getal zijn.' })
      return
    }
    if (isNaN(priceLocal) || priceLocal <= 0 || isNaN(priceEur) || priceEur <= 0) {
      setFeedback({ type: 'error', message: 'Prijs moet een positief getal zijn.' })
      return
    }

    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        ticker: form.ticker,
        transaction_date: form.transaction_date,
        type: form.type,
        shares,
        price_local: priceLocal,
        price_eur: priceEur,
      }
      if (form.fx_rate && parseFloat(form.fx_rate) > 0) body.fx_rate = parseFloat(form.fx_rate)
      if (form.fees && parseFloat(form.fees) > 0) body.fees = parseFloat(form.fees)
      if (form.notes.trim()) body.notes = form.notes.trim()

      await api.post('/api/transactions/', body)
      setFeedback({ type: 'success', message: 'Transactie opgeslagen.' })
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 600)
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Opslaan mislukt.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal card */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700/60 shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Nieuwe transactie</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Positie */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Positie *</label>
            <select
              value={form.ticker}
              onChange={e => updateField('ticker', e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/30 dark:focus:ring-[#1B3A5C]/50 focus:border-[#1B3A5C]"
            >
              <option value="">Selecteer een positie...</option>
              {positions.map(p => (
                <option key={p.id} value={p.ticker}>
                  {p.ticker} - {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateField('type', 'BUY')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.type === 'BUY'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => updateField('type', 'SELL')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.type === 'SELL'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                SELL
              </button>
            </div>
          </div>

          {/* Datum */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Datum *</label>
            <input
              type="date"
              value={form.transaction_date}
              onChange={e => updateField('transaction_date', e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/30 dark:focus:ring-[#1B3A5C]/50 focus:border-[#1B3A5C]"
            />
          </div>

          {/* Aantal + Prijs lokaal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Aantal *</label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.shares}
                onChange={e => updateField('shares', e.target.value)}
                placeholder="100"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/30 dark:focus:ring-[#1B3A5C]/50 focus:border-[#1B3A5C] placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prijs (lokaal) *</label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.price_local}
                onChange={e => updateField('price_local', e.target.value)}
                placeholder="25.50"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/30 dark:focus:ring-[#1B3A5C]/50 focus:border-[#1B3A5C] placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Prijs EUR + Wisselkoers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prijs EUR *</label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.price_eur}
                onChange={e => updateField('price_eur', e.target.value)}
                placeholder="25.50"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/30 dark:focus:ring-[#1B3A5C]/50 focus:border-[#1B3A5C] placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Wisselkoers</label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.fx_rate}
                onChange={e => updateField('fx_rate', e.target.value)}
                placeholder="1.0850"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/30 dark:focus:ring-[#1B3A5C]/50 focus:border-[#1B3A5C] placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Kosten */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kosten</label>
            <input
              type="number"
              step="any"
              min="0"
              value={form.fees}
              onChange={e => updateField('fees', e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/30 dark:focus:ring-[#1B3A5C]/50 focus:border-[#1B3A5C] placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Notities */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notities</label>
            <textarea
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
              rows={2}
              placeholder="Optionele opmerking..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/30 dark:focus:ring-[#1B3A5C]/50 focus:border-[#1B3A5C] resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Feedback */}
          {feedback && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                feedback.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/40'
                  : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/40'
              }`}
            >
              {feedback.message}
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg text-sm font-medium bg-[#1B3A5C] text-white hover:bg-[#162f4a] transition-colors disabled:opacity-50"
            >
              {submitting ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// --- PAGE ---

export default function TransactiesPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [txs, pos] = await Promise.all([
        api.get<Transaction[]>('/api/transactions/'),
        api.get<Position[]>('/api/positions/'),
      ])
      const sorted = [...txs].sort(
        (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
      )
      setTransactions(sorted)
      setPositions(pos)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden mislukt.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- LOADING ---
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700/60 p-5">
          <TableSkeleton />
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
          onClick={fetchData}
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">Transacties</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1B3A5C] text-white text-sm font-medium hover:bg-[#162f4a] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Transactie toevoegen
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700/60 p-5">
        {transactions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 dark:text-slate-500 text-sm">Nog geen transacties gevonden.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-slate-700/60">
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky left-0 bg-white dark:bg-slate-800">Datum</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aandeel</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aantal</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Prijs</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Prijs EUR</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kosten</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Notities</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, idx) => {
                  const pos = tx.eq_positions
                  const isBuy = tx.type === 'BUY'
                  return (
                    <tr
                      key={tx.id}
                      className={`border-b border-slate-100 dark:border-slate-700/30 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors ${
                        idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-700/10' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap sticky left-0 bg-inherit">
                        {formatDate(tx.transaction_date)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="text-slate-900 dark:text-slate-100 font-medium">{pos?.name || '—'}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">{pos?.ticker || '—'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isBuy
                              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200/60 dark:border-green-800/40'
                              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200/60 dark:border-red-800/40'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                        {formatNumber(tx.shares)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                        {formatNumber(tx.price_local, 2)}
                        {pos?.currency && pos.currency !== 'EUR' && (
                          <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">{pos.currency}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                        {formatEuro(tx.price_eur)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                        {tx.fees > 0 ? formatEuro(tx.fees) : '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                        {tx.notes || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        positions={positions}
        onSuccess={fetchData}
      />
    </div>
  )
}
