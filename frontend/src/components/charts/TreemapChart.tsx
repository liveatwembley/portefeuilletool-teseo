'use client'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import type { EnrichedHolding } from '@/lib/types'
import { formatEuro, formatPct } from '@/lib/formatters'
import { useIsDark } from '@/hooks/useIsDark'
import { SECTOR_COLORS } from '@/lib/colors'

// --- SECTOR COLOR PALETTE ---
// Deep, muted tones that work in both light and dark mode
// Each sector gets a distinct hue, text is always white for maximum contrast

const SECTOR_PALETTE = [
  '#2563eb', // blue
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#059669', // emerald
  '#d97706', // amber
  '#dc2626', // red
  '#4f46e5', // indigo
  '#0d9488', // teal
  '#c026d3', // fuchsia
  '#ea580c', // orange
  '#1B3A5C', // navy (brand)
  '#6366f1', // light indigo
  '#15803d', // green
  '#db2777', // pink
  '#854d0e', // dark amber
]

const CASH_COLOR = '#64748b' // slate-500

// --- DATA TYPES ---

interface TreemapChild {
  [key: string]: unknown
  name: string
  ticker: string
  size: number
  pnl: number
  pnl_nominal: number
  weight: number
  value: number
  sectorIndex: number
}

interface TreemapData {
  [key: string]: unknown
  name: string
  children: TreemapChild[]
}

// --- CUSTOM CONTENT ---

function CustomContentInner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: any,
  isDark: boolean,
) {
  const { x, y, width, height, ticker, pnl, weight, sectorIndex } = props

  if (props.children) return null

  const isCash = ticker === 'CASH'
  const fill = isCash ? CASH_COLOR : SECTOR_PALETTE[sectorIndex % SECTOR_PALETTE.length]
  const strokeColor = isDark ? '#1e293b' : '#ffffff'

  // P&L indicator: subtle brightness variation
  // Positive P&L = slightly lighter, negative = slightly darker
  const brightness = pnl > 0 ? 1.1 : pnl < -10 ? 0.85 : 1.0

  if (width < 40 || height < 25) {
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={fill} stroke={strokeColor} strokeWidth={2} opacity={brightness} />
      </g>
    )
  }

  // Always use white text — all sector colors are dark enough
  const textColor = '#ffffff'
  const subColor = 'rgba(255,255,255,0.7)'

  const showWeight = width >= 65 && height >= 40
  const showPnl = width >= 85 && height >= 52
  const tickerSize = width < 70 ? 10 : width < 110 ? 11 : 13
  const labelToShow = ticker || ''

  const lineHeight = tickerSize + 4
  const totalLines = 1 + (showWeight ? 1 : 0) + (showPnl ? 1 : 0)
  const blockHeight = totalLines * lineHeight
  const startY = y + (height - blockHeight) / 2 + tickerSize

  // P&L color indicator
  const pnlTextColor = pnl >= 0 ? '#86efac' : '#fca5a5' // green-300 / red-300

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke={strokeColor} strokeWidth={2} opacity={brightness} />
      <text
        x={x + width / 2}
        y={showPnl || showWeight ? startY : startY}
        fill={textColor}
        fontSize={tickerSize}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="auto"
      >
        {labelToShow}
      </text>
      {showWeight && (
        <text
          x={x + width / 2}
          y={startY + lineHeight}
          fill={subColor}
          fontSize={tickerSize - 2}
          textAnchor="middle"
          dominantBaseline="auto"
        >
          {(weight || 0).toFixed(1)}%
        </text>
      )}
      {showPnl && (
        <text
          x={x + width / 2}
          y={startY + lineHeight * 2}
          fill={pnlTextColor}
          fontSize={tickerSize - 2}
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="auto"
        >
          {pnl >= 0 ? '+' : ''}{(pnl || 0).toFixed(1)}%
        </text>
      )}
    </g>
  )
}

// --- TOOLTIP ---

function CustomTooltipInner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { active, payload }: any,
  isDark: boolean,
) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload as TreemapChild
  if (!item.ticker) return null

  const pnlColorClass = (item.pnl || 0) >= 0
    ? isDark ? 'text-green-400' : 'text-green-700'
    : isDark ? 'text-red-400' : 'text-red-600'

  return (
    <div className={`rounded-xl border shadow-xl px-4 py-3 text-sm min-w-[200px] ${
      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
    }`}>
      <p className={`font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.name}</p>
      <div className={`grid grid-cols-2 gap-x-4 gap-y-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        <span>Ticker</span>
        <span className={`text-right font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.ticker}</span>
        <span>Waarde</span>
        <span className={`text-right font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{formatEuro(item.value)}</span>
        <span>Gewicht</span>
        <span className={`text-right font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{(item.weight || 0).toFixed(1)}%</span>
        <span>P&L</span>
        <span className={`text-right font-semibold ${pnlColorClass}`}>{formatEuro(item.pnl_nominal)}</span>
        <span>Rendement</span>
        <span className={`text-right font-semibold ${pnlColorClass}`}>{formatPct(item.pnl)}</span>
      </div>
    </div>
  )
}

// --- MAIN COMPONENT ---

export function TreemapChart({ holdings, cash }: { holdings: EnrichedHolding[], cash?: number }) {
  const isDark = useIsDark()

  // Bouw sectorindex op — elke sector krijgt een unieke kleur
  const sectorList: string[] = []
  holdings.forEach(h => {
    const s = h.sector || 'Overig'
    if (!sectorList.includes(s)) sectorList.push(s)
  })

  // Groepeer per sector
  const sectors: Record<string, TreemapData> = {}
  holdings.forEach(h => {
    const s = h.sector || 'Overig'
    const sectorIndex = sectorList.indexOf(s)
    if (!sectors[s]) sectors[s] = { name: s, children: [] }
    sectors[s].children.push({
      name: h.name,
      ticker: h.ticker,
      size: Math.max(h.value || 0, 0.01),
      pnl: h.pnl_pct || 0,
      pnl_nominal: h.pnl_nominal || 0,
      weight: h.weight || 0,
      value: h.value || 0,
      sectorIndex,
    })
  })

  // Cash blok
  if (cash && cash > 0) {
    const totalValue = holdings.reduce((sum, h) => sum + (h.value || 0), 0) + cash
    const cashWeight = (cash / totalValue) * 100
    sectors['Cash'] = {
      name: 'Cash',
      children: [{
        name: 'Cash',
        ticker: 'CASH',
        size: cash,
        pnl: 0,
        pnl_nominal: 0,
        weight: cashWeight,
        value: cash,
        sectorIndex: -1,
      }],
    }
  }

  const data = Object.values(sectors).filter(s => s.children.length > 0)
  if (data.length === 0) return null

  const strokeColor = isDark ? '#1e293b' : '#ffffff'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomContent = (props: any) => CustomContentInner(props, isDark)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = (props: any) => CustomTooltipInner(props, isDark)

  return (
    <div>
      <div className="h-72 md:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            aspectRatio={4 / 3}
            stroke={strokeColor}
            content={<CustomContent />}
          >
            <Tooltip content={<CustomTooltip />} cursor={false} />
          </Treemap>
        </ResponsiveContainer>
      </div>
      {/* Sector legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 px-1">
        {sectorList.map((sector, i) => (
          <div key={sector} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: SECTOR_PALETTE[i % SECTOR_PALETTE.length] }}
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{sector}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
