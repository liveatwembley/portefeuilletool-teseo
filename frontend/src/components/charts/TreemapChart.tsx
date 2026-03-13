'use client'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import type { EnrichedHolding } from '@/lib/types'
import { formatEuroCompact, formatPct } from '@/lib/formatters'

function pnlToColor(pnl: number): string {
  if (pnl >= 50) return '#166534'
  if (pnl >= 20) return '#15803d'
  if (pnl >= 5) return '#22c55e'
  if (pnl >= 0) return '#86efac'
  if (pnl >= -10) return '#fca5a5'
  if (pnl >= -25) return '#ef4444'
  return '#dc2626'
}

interface TreemapData {
  [key: string]: unknown
  name: string
  children: { [key: string]: unknown; name: string; size: number; pnl: number; weight: number }[]
}

export function TreemapChart({ holdings }: { holdings: EnrichedHolding[] }) {
  // Groepeer per sector
  const sectors: Record<string, TreemapData> = {}
  holdings.forEach(h => {
    const s = h.sector || 'Overig'
    if (!sectors[s]) sectors[s] = { name: s, children: [] }
    sectors[s].children.push({
      name: h.name,
      size: Math.max(h.value || 0, 0),
      pnl: h.pnl_pct || 0,
      weight: h.weight || 0,
    })
  })
  const data = Object.values(sectors).filter(s => s.children.length > 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomContent = (props: any) => {
    const { x, y, width, height, name, pnl, weight } = props
    if (width < 40 || height < 25) return null

    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={pnlToColor(pnl || 0)} rx={4} opacity={0.9} />
        <text x={x + 6} y={y + 16} fill="white" fontSize={11} fontWeight={600}>
          {width > 80 ? name : (name || '').substring(0, 6)}
        </text>
        {height > 35 && (
          <text x={x + 6} y={y + 30} fill="rgba(255,255,255,0.8)" fontSize={10}>
            {(weight || 0).toFixed(1)}%
          </text>
        )}
      </g>
    )
  }

  return (
    <div className="h-80">
      <ResponsiveContainer>
        <Treemap
          data={data}
          dataKey="size"
          stroke="#fff"
          content={<CustomContent />}
        >
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null
              const item = payload[0].payload
              return (
                <div className="bg-white rounded-xl border border-slate-200 shadow-lg px-3 py-2 text-xs">
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="text-slate-500">{formatEuroCompact(item.size)} | {formatPct(item.pnl)}</p>
                </div>
              )
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  )
}
