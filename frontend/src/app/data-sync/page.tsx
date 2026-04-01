'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { formatEuro, formatPct } from '@/lib/formatters'
import { Skeleton } from '@/components/ui/skeleton'
import type { Spreadsheet, SheetTab, Snapshot } from '@/lib/types'

// --- LIVE REFRESH SECTION ---

function LiveRefreshCard() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleRefresh = async () => {
    setLoading(true)
    setResult(null)
    try {
      await api.post<{ status: string }>('/api/sync/live-refresh')
      setResult({ ok: true, message: 'Portefeuille succesvol ververst met actuele koersen.' })
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Onbekende fout bij verversing.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700/60 p-5">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Live Refresh</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
        Herbereken portefeuille met actuele koersen en wisselkoersen
      </p>

      <button
        onClick={handleRefresh}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2.5 w-full sm:w-auto px-8 py-3 rounded-md bg-[#1B3A5C] text-white text-sm font-semibold hover:bg-[#162f4a] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Bezig met verversen...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Ververs Nu
          </>
        )}
      </button>

      {result && (
        <div className={`mt-4 rounded-lg px-4 py-3 text-sm font-medium ${result.ok ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/40' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40'}`}>
          {result.message}
        </div>
      )}
    </div>
  )
}

// --- GOOGLE SHEETS IMPORT SECTION ---

function SheetsImportCard() {
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([])
  const [sheetsLoading, setSheetsLoading] = useState(true)
  const [sheetsError, setSheetsError] = useState<string | null>(null)

  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [tabs, setTabs] = useState<SheetTab[]>([])
  const [tabsLoading, setTabsLoading] = useState(false)

  const [importingTab, setImportingTab] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Load spreadsheets on mount
  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<Spreadsheet[]>('/api/sync/sheets/list')
        setSpreadsheets(data)
      } catch (err) {
        setSheetsError(err instanceof Error ? err.message : 'Kan spreadsheets niet laden.')
      } finally {
        setSheetsLoading(false)
      }
    }
    load()
  }, [])

  // Load tabs when spreadsheet is selected
  useEffect(() => {
    if (!selectedSheet) {
      setTabs([])
      return
    }
    const loadTabs = async () => {
      setTabsLoading(true)
      setImportResult(null)
      try {
        const data = await api.get<SheetTab[]>(`/api/sync/sheets/${selectedSheet}/tabs`)
        setTabs(data)
      } catch {
        setTabs([])
      } finally {
        setTabsLoading(false)
      }
    }
    loadTabs()
  }, [selectedSheet])

  const handleImport = async (tab: SheetTab) => {
    setImportingTab(tab.tab_name)
    setImportResult(null)
    try {
      await api.post<{ status: string }>(`/api/sync/sheets/import?sheet_id=${encodeURIComponent(tab.sheet_id)}&tab_name=${encodeURIComponent(tab.tab_name)}`)
      setImportResult({ ok: true, message: `Tab "${tab.tab_name}" succesvol geimporteerd.` })
    } catch (err) {
      setImportResult({ ok: false, message: err instanceof Error ? err.message : 'Import mislukt.' })
    } finally {
      setImportingTab(null)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700/60 p-5">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Google Sheets Import</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
        Importeer portefeuilledata vanuit Google Sheets nota&apos;s
      </p>

      {/* Step 1: Select spreadsheet */}
      {sheetsLoading ? (
        <Skeleton className="h-10 w-full rounded-lg" />
      ) : sheetsError ? (
        <div className="rounded-lg px-4 py-3 text-sm font-medium bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40">
          {sheetsError}
        </div>
      ) : (
        <div className="mb-4 relative z-20">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
            Selecteer spreadsheet ({spreadsheets.length} gevonden)
          </label>
          <select
            value={selectedSheet}
            onChange={(e) => setSelectedSheet(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 dark:focus:ring-[#1B3A5C]/40 focus:border-[#1B3A5C] appearance-none cursor-pointer"
            style={{ WebkitAppearance: 'menulist' }}
          >
            <option value="">-- Kies een spreadsheet --</option>
            {spreadsheets.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {spreadsheets.length === 0 && !sheetsLoading && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Geen spreadsheets gevonden. Controleer de Google Sheets credentials.
            </p>
          )}
        </div>
      )}

      {/* Step 2: Show tabs */}
      {selectedSheet && tabsLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      )}

      {selectedSheet && !tabsLoading && tabs.length > 0 && (
        <div className="border border-slate-200/60 dark:border-slate-700/60 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200/60 dark:border-slate-700/60">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tab</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Datum</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">Spreadsheet</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actie</th>
              </tr>
            </thead>
            <tbody>
              {tabs.map((tab) => (
                <tr key={tab.tab_name} className="border-b border-slate-100 dark:border-slate-700/30 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{tab.tab_name}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{tab.date}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 truncate max-w-[200px] hidden sm:table-cell">{tab.spreadsheet}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleImport(tab)}
                      disabled={importingTab !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B3A5C] text-white text-xs font-medium hover:bg-[#162f4a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {importingTab === tab.tab_name ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Bezig...
                        </>
                      ) : (
                        'Importeer'
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedSheet && !tabsLoading && tabs.length === 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">Geen tabs gevonden in deze spreadsheet.</p>
      )}

      {importResult && (
        <div className={`mt-4 rounded-lg px-4 py-3 text-sm font-medium ${importResult.ok ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/40' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40'}`}>
          {importResult.message}
        </div>
      )}
    </div>
  )
}

// --- SYNC HISTORY SECTION ---

function SyncHistoryCard() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api.get<Snapshot[]>('/api/sync/history')
      setSnapshots(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kan geschiedenis niet laden.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700/60 p-5">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Sync Geschiedenis</h2>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg px-4 py-3 text-sm font-medium bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40">
          {error}
        </div>
      ) : snapshots.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Geen snapshots gevonden.</p>
      ) : (
        <div className="border border-slate-200/60 dark:border-slate-700/60 rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200/60 dark:border-slate-700/60">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Datum</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Portefeuillewaarde</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cash</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cash %</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Notities</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap) => (
                <tr key={snap.id} className="border-b border-slate-100 dark:border-slate-700/30 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{snap.snapshot_date}</td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300 tabular-nums">{formatEuro(snap.total_value_eur)}</td>
                  <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 tabular-nums">{formatEuro(snap.cash_eur)}</td>
                  <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 tabular-nums">{formatPct(snap.cash_pct, 1)}</td>
                  <td className="px-4 py-3 text-slate-400 dark:text-slate-500 truncate max-w-[200px]">{snap.notes || '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// --- PAGE ---

export default function DataSyncPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">Data Sync</h1>
      <LiveRefreshCard />
      <SheetsImportCard />
      <SyncHistoryCard />
    </div>
  )
}
