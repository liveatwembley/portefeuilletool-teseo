export interface EnrichedHolding {
  name: string
  ticker: string
  currency: string
  sector: string
  geo: string
  position_id: number
  shares: number
  price_local: number
  price_eur: number
  prev_close_local: number
  prev_close_eur: number
  avg_cost: number
  avg_cost_eur: number
  fx_rate: number
  value: number
  prev_value: number
  pnl_nominal: number
  pnl_pct: number
  day_change: number
  day_change_pct: number
  weight: number
  advice: string | null
  mandate_buy: number
  mandate_sell: number
  motivation: string | null
}

export interface PortfolioMeta {
  cash: number
  portfolio_total: number
  total_value: number
  total_prev_value: number
  day_delta: number
  day_delta_pct: number
  cash_pct: number
  fx_rates: Record<string, number>
  snapshot_date: string
}

export interface PortfolioOverview {
  meta: PortfolioMeta | null
  holdings: EnrichedHolding[]
  fx_rates: Record<string, number>
  treasury_eur: number
}

export interface Snapshot {
  id: number
  snapshot_date: string
  cash_eur: number
  total_value_eur: number
  cash_pct: number
  notes: string | null
  eur_usd: number | null
  eur_gbp: number | null
  eur_dkk: number | null
  eur_hkd: number | null
}

export interface Transaction {
  id: number
  position_id: number
  transaction_date: string
  type: 'BUY' | 'SELL'
  shares: number
  price_local: number
  price_eur: number
  fx_rate: number | null
  fees: number
  notes: string | null
  eq_positions?: {
    ticker: string
    name: string
    currency: string
  }
}

export interface FundamentalData {
  pe_trailing: number | null
  pe_forward: number | null
  pb: number | null
  dividend_yield: number | null
  market_cap: number | null
  beta: number | null
  fifty_two_week_high: number | null
  fifty_two_week_low: number | null
  avg_volume: number | null
  sector: string | null
  industry: string | null
  short_name: string | null
}

export interface ConcentrationMetrics {
  top5_weight: number
  hhi: number
  n_positions: number
}

export interface Spreadsheet {
  id: string
  name: string
}

export interface SheetTab {
  tab_name: string
  date: string
  spreadsheet: string
  sheet_id: string
}
