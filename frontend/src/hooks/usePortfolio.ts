'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { PortfolioOverview } from '@/lib/types'

export function usePortfolio() {
  const [data, setData] = useState<PortfolioOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.get<PortfolioOverview>('/api/portfolio/overview')
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}
