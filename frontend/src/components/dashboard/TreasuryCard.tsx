'use client'
import { useState, useRef, useEffect } from 'react'
import { formatEuro } from '@/lib/formatters'
import { api } from '@/lib/api'

interface TreasuryCardProps {
  value: number
  onSaved: () => void
}

export function TreasuryCard({ value, onSaved }: TreasuryCardProps) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleEdit = () => {
    setInputValue(value.toString())
    setEditing(true)
  }

  const handleSave = async () => {
    const parsed = parseFloat(inputValue.replace(',', '.'))
    if (isNaN(parsed) || parsed < 0) return

    setSaving(true)
    try {
      await api.put('/api/portfolio/settings', { treasury_eur: parsed })
      setEditing(false)
      onSaved()
    } catch {
      // stille fallback
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div className="group relative rounded-lg border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800 p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Treasury (BNP)
        </p>
        {!editing && (
          <button
            onClick={handleEdit}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
            title="Bewerken"
          >
            <svg className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2 mt-1">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] dark:focus:ring-[#4a7ab5]"
            placeholder="0.00"
            disabled={saving}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1B3A5C] text-white hover:bg-[#162f4a] disabled:opacity-50 transition-colors"
          >
            {saving ? '...' : 'Opslaan'}
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="shrink-0 px-2 py-1.5 text-xs font-medium rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Annuleer
          </button>
        </div>
      ) : (
        <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          {formatEuro(value)}
        </p>
      )}

      <p className="text-xs mt-1.5 text-slate-400 dark:text-slate-500">Externe cash</p>
    </div>
  )
}
