'use client'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import type { EnrichedHolding } from '@/lib/types'
import { formatEuro, formatPct } from '@/lib/formatters'

// --- COLOR UTILITIES ---

function interpolateColor(c1: [number, number, number], c2: [number, number, number], t: number): string {
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * t)
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * t)
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * t)
  return `rgb(${r},${g},${b})`
}

function pnlToColor(pnl: number): string {
  // Deep green (#15803d) at +20% and above
  // Neutral light at 0%
  // Deep red (#dc2626) at -15% and below
  const deepGreen: [number, number, number] = [21, 128, 61]
  const lightGreen: [number, number, number] = [187, 247, 208]
  const lightRed: [number, number, number] = [254, 202, 202]
  const deepRed: [number, number, number] = [220, 38, 38]

  if (pnl >= 20) return `rgb(${deepGreen.join(',')})`
  if (pnl > 0) {
    const t = pnl / 20
    return interpolateColor(lightGreen, deepGreen, t)
  }
  if (pnl === 0) return `rgb(${lightGreen.join(',')})`
  if (pnl >= -15) {
    const t = Math.abs(pnl) / 15
    return interpolateColor(lightRed, deepRed, t)
  }
  return `rgb(${deepRed.join(',')})`
}

function luminance(hex: string): number {
  // Parse rgb(...) or hex
  let r: number, g: number, b: number
  const rgbMatch = hex.match(/rgb\((\d+),(\d+),(\d+)\)/)
  if (rgbMatch) {
    r = parseInt(rgbMatch[1]) / 255
    g = parseInt(rgbMatch[2]) / 255
    b = parseInt(rgbMatch[3]) / 255
  } else {
    const h = hex.replace('#', '')
    r = parseInt(h.substring(0, 2), 16) / 255
    g = parseInt(h.substring(2, 4), 16) / 255
    b = parseInt(h.substring(4, 6), 16) / 255
  }
  // sRGB relative luminance
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function textColorForBg(bgColor: string): string {
  return luminance(bgColor) > 0.3 ? '#1e293b' : '#ffffff'
}

function subtextColorForBg(bgColor: string): string {
  return luminance(bgColor) > 0.3 ? 'rgba(30,41,59,0.65)' : 'rgba(255,255,255,0.75)'
}

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
}

interface TreemapData {
  [key: string]: unknown
  name: string
  children: TreemapChild[]
}

// --- CUSTOM CONTENT ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomContent(props: any) {
  const { x, y, width, height, name, ticker, pnl, weight } = props

  // Skip sector-level group rectangles (they have children)
  if (props.children) return null

  const fill = pnlToColor(pnl || 0)
  const textColor = textColorForBg(fill)
  const subColor = subtextColorForBg(fill)

  // Too small to show anything — just render the colored cell
  if (width < 50 || height < 30) {
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#e2e8f0" strokeWidth={1} />
      </g>
    )
  }

  // Medium cell: ticker only
  const showWeight = width >= 70 && height >= 45
  // Large cell: also show name
  const showName = width >= 100 && height >= 55

  // Dynamic font sizing
  const tickerSize = width < 70 ? 10 : width < 120 ? 11 : 12
  const labelToShow = ticker || (name || '').substring(0, 8)

  // Center content vertically
  const lineHeight = tickerSize + 3
  const totalLines = 1 + (showWeight ? 1 : 0) + (showName ? 1 : 0)
  const blockHeight = totalLines * lineHeight
  const startY = y + (height - blockHeight) / 2 + tickerSize

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#e2e8f0" strokeWidth={1} />
      {showName && (
        <text
          x={x + width / 2}
          y={startY}
          fill={subColor}
          fontSize={tickerSize - 1}
          textAnchor="middle"
          dominantBaseline="auto"
        >
          {width >= 140 ? name : (name || '').substring(0, Math.floor(width / 7))}
        </text>
      )}
      <text
        x={x + width / 2}
        y={showName ? startY + lineHeight : startY}
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
          y={(showName ? startY + lineHeight : startY) + lineHeight}
          fill={subColor}
          fontSize={tickerSize - 1}
          textAnchor="middle"
          dominantBaseline="auto"
        >
          {(weight || 0).toFixed(1)}%
        </text>
      )}
    </g>
  )
}

// --- TOOLTIP ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload as TreemapChild
  if (!item.ticker) return null

  const pnlColor = (item.pnl || 0) >= 0 ? 'text-green-700' : 'text-red-600'

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xl px-4 py-3 text-sm min-w-[180px]">
      <p className="font-semibold text-slate-900 mb-1">{item.name}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-600">
        <span>Ticker</span>
        <span className="text-right font-medium text-slate-900">{item.ticker}</span>
        <span>Waarde</span>
        <span className="text-right font-medium text-slate-900">{formatEuro(item.value)}</span>
        <span>P&L</span>
        <span className={`text-right font-medium ${pnlColor}`}>{formatEuro(item.pnl_nominal)}</span>
        <span>Rendement</span>
        <span className={`text-right font-medium ${pnlColor}`}>{formatPct(item.pnl)}</span>
        <span>Gewicht</span>
        <span className="text-right font-medium text-slate-900">{(item.weight || 0).toFixed(1)}%</span>
      </div>
    </div>
  )
}

// --- MAIN COMPONENT ---

export function TreemapChart({ holdings, cash }: { holdings: EnrichedHolding[], cash?: number }) {
  // Groepeer per sector
  const sectors: Record<string, TreemapData> = {}
  holdings.forEach(h => {
    const s = h.sector || 'Overig'
    if (!sectors[s]) sectors[s] = { name: s, children: [] }
    sectors[s].children.push({
      name: h.name,
      ticker: h.ticker,
      size: Math.max(h.value || 0, 0.01),
      pnl: h.pnl_pct || 0,
      pnl_nominal: h.pnl_nominal || 0,
      weight: h.weight || 0,
      value: h.value || 0,
    })
  })

  // Voeg cash toe als apart blok
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
      }],
    }
  }

  const data = Object.values(sectors).filter(s => s.children.length > 0)

  if (data.length === 0) return null

  return (
    <div className="h-72 md:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke="#e2e8f0"
          content={<CustomContent />}
        >
          <Tooltip content={<CustomTooltip />} cursor={false} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  )
}
