export function formatEuro(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatEuroCompact(amount: number | null | undefined): string {
  if (amount == null) return '—'
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `€${(amount / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `€${(amount / 1_000).toFixed(0)}K`
  return formatEuro(amount)
}

export function formatPct(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('nl-BE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatMarketCap(value: number | null | undefined): string {
  if (value == null) return '—'
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  return `$${formatNumber(value)}`
}

export function dualPrice(priceEur: number, priceLocal: number | null, currency: string): string {
  const eurStr = formatEuro(priceEur)
  if (!priceLocal || currency === 'EUR') return eurStr
  const symbols: Record<string, string> = { USD: '$', GBP: '£', DKK: 'kr', HKD: 'HK$' }
  const sym = symbols[currency] || currency
  return `${eurStr} (${sym}${priceLocal.toFixed(2)})`
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', GBP: '£', DKK: 'kr ', HKD: 'HK$' }

export function formatLocalPrice(price: number | null | undefined, currency: string): string {
  if (price == null) return '—'
  const sym = CURRENCY_SYMBOLS[currency] || currency + ' '
  return `${sym}${price.toFixed(2)}`
}

export function pnlColor(value: number | null | undefined): string {
  if (value == null || value === 0) return 'text-slate-500'
  return value > 0 ? 'text-green-700' : 'text-red-600'
}

export function pnlBgColor(value: number | null | undefined): string {
  if (value == null || value === 0) return 'bg-slate-50'
  return value > 0 ? 'bg-green-50' : 'bg-red-50'
}
