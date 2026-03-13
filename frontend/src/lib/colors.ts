export const COLOR_BRAND = '#1B3A5C'
export const COLOR_POSITIVE = '#15803d'
export const COLOR_NEGATIVE = '#dc2626'
export const COLOR_ACCENT = '#E8B34A'
export const COLOR_NEUTRAL = '#6b7280'
export const COLOR_MUTED = '#94a3b8'
export const COLOR_BG = '#f8fafc'

export const ADVICE_COLORS: Record<string, string> = {
  houden: COLOR_NEUTRAL,
  koopman: COLOR_POSITIVE,
  kopen: COLOR_ACCENT,
  verkopen: COLOR_NEGATIVE,
}

// QARP-bedrijven (Quality at a Reasonable Price) - per januari 2026
export const QARP_TICKERS = new Set([
  'AAPL', 'BRK-B', 'DPZ', 'EW', 'MAR', 'MA', 'TT', 'V', 'WAT', 'ZTS'
])

export const SECTOR_COLORS = [
  '#1B3A5C', '#2563eb', '#7c3aed', '#db2777', '#ea580c',
  '#15803d', '#0891b2', '#4f46e5', '#c026d3', '#d97706',
  '#059669', '#6366f1',
]
