// Bar, column and line charts in the report palette (charcoal and greys, no colour).
// Port of make_chart() in skills/client-intelligence-report/scripts/build_outputs.py; units are points
// on a 468 pt (6.5 in) wide drawing, so the chart prints at the size the builder drew it.
import { chartSeries, type ChartBlock } from '@symph/core'
import type { ReactNode } from 'react'

const PRIMARY = '#222222'
const TEXT = '#222222'
const MUTED = '#6B6B6B'
const RULE = '#DDDBD6'
const SHADES = [PRIMARY, '#8C8C8C', '#C4C2BC', '#E0DEDA']
const HEAD = "Poppins, 'Liberation Sans', Arial, sans-serif"
const BODY = "'Liberation Sans', Arial, Helvetica, sans-serif"
const W = 468

function fmtNum(v: number): string {
  if (!Number.isInteger(v)) return Math.abs(v) >= 10 ? v.toLocaleString('en-US', { maximumFractionDigits: 1 }) : v.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return v.toLocaleString('en-US')
}

function wrap(label: string, width: number, max = 3): string[] {
  const lines: string[] = []
  let cur = ''
  for (const w of label.split(/\s+/)) {
    if (cur && cur.length + w.length + 1 > width) {
      lines.push(cur)
      cur = w
    } else cur = `${cur} ${w}`.trim()
  }
  if (cur) lines.push(cur)
  return lines.slice(0, max)
}

export function Chart({ block: b }: { block: ChartBlock }) {
  const series = chartSeries(b)
  const unit = b.unit ?? ''
  const titleH = b.title ? 26 : 0
  const title = b.title ? (
    <text x={0} y={12} fontFamily={HEAD} fontWeight={500} fontSize={10.5} fill={PRIMARY}>
      {b.title}
    </text>
  ) : null
  const legend = (top: number) =>
    series.length > 1 ? (
      <g>
        {series.reduce<{ x: number; nodes: ReactNode[] }>(
          (acc, ser, si) => {
            acc.nodes.push(
              <g key={si}>
                <rect x={acc.x} y={top} width={10} height={10} fill={SHADES[si % SHADES.length]} />
                <text x={acc.x + 14} y={top + 9} fontFamily={BODY} fontSize={8.5} fill={MUTED}>
                  {ser.name}
                </text>
              </g>,
            )
            acc.x += 20 + ser.name.length * 5.2
            return acc
          },
          { x: 0, nodes: [] },
        ).nodes}
      </g>
    ) : null

  if (b.kind === 'bar') {
    const items = series[0].items
    const n = items.length
    const rowH = 22
    const gap = 8
    const labelW = Math.min(190, Math.max(70, Math.max(...items.map((i) => i.label.length)) * 5.6))
    const barMax = W - labelW - 70
    const H = n * (rowH + gap) + titleH
    const mx = Math.max(...items.map((i) => i.value)) || 1
    const anyHi = items.some((i) => i.highlight)
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="rd-chart" role="img" aria-label={b.title}>
        {title}
        {items.map((it, k) => {
          const y = titleH + k * (rowH + gap)
          const w = Math.max((it.value / mx) * barMax, 1.5)
          const fill = it.highlight || n === 1 ? PRIMARY : SHADES[anyHi ? 2 : 1]
          return (
            <g key={k}>
              <text x={0} y={y + rowH - 7} fontFamily={BODY} fontSize={9} fill={TEXT}>
                {it.label}
              </text>
              <rect x={labelW} y={y} width={w} height={rowH} fill={fill} />
              <text x={labelW + w + 6} y={y + rowH - 7} fontFamily={HEAD} fontWeight={500} fontSize={9} fill={PRIMARY}>
                {fmtNum(it.value) + unit}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  if (b.kind === 'column') {
    const items0 = series[0].items
    const n = items0.length
    const ns = series.length
    const H = 190 + titleH
    const plotH = 120
    const base = H - 42
    const mx = Math.max(...series.flatMap((s) => s.items.map((i) => i.value))) || 1
    const groupW = W / n
    const bw = Math.min(34, (groupW - 12) / ns)
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="rd-chart" role="img" aria-label={b.title}>
        {title}
        {legend(titleH)}
        <line x1={0} y1={base} x2={W} y2={base} stroke={RULE} strokeWidth={0.6} />
        {items0.map((it0, k) => {
          const x0 = k * groupW + (groupW - bw * ns) / 2
          return (
            <g key={k}>
              {series.map((ser, si) => {
                const it = ser.items[k]
                if (!it) return null
                const h = Math.max((it.value / mx) * plotH, 1)
                const x = x0 + si * bw
                return (
                  <g key={si}>
                    <rect x={x} y={base - h} width={bw - 2} height={h} fill={it.highlight ? PRIMARY : SHADES[si % SHADES.length]} />
                    <text x={x + (bw - 2) / 2} y={base - h - 4} textAnchor="middle" fontFamily={HEAD} fontWeight={500} fontSize={8} fill={PRIMARY}>
                      {fmtNum(it.value) + unit}
                    </text>
                  </g>
                )
              })}
              {wrap(it0.label, 14).map((ln, li) => (
                <text key={li} x={k * groupW + groupW / 2} y={base + 14 + li * 11} textAnchor="middle" fontFamily={BODY} fontSize={8.5} fill={MUTED}>
                  {ln}
                </text>
              ))}
            </g>
          )
        })}
      </svg>
    )
  }

  // line
  const H = 170 + titleH
  const plotH = 110
  const base = H - 34
  const mx = Math.max(...series.flatMap((s) => s.items.map((i) => i.value))) || 1
  const n = series[0].items.length
  const step = (W - 20) / Math.max(n - 1, 1)
  const xy = (k: number, v: number) => [10 + k * step, base - (v / mx) * plotH] as const
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="rd-chart" role="img" aria-label={b.title}>
      {title}
      {legend(titleH)}
      <line x1={10} y1={base} x2={W - 10} y2={base} stroke={RULE} strokeWidth={0.6} />
      {series[0].items.map((it, k) => (
        <text key={k} x={10 + k * step} y={base + 14} textAnchor="middle" fontFamily={BODY} fontSize={8} fill={MUTED}>
          {it.label}
        </text>
      ))}
      {series.map((ser, si) => {
        const color = SHADES[si % SHADES.length]
        return (
          <g key={si}>
            <polyline points={ser.items.map((it, k) => xy(k, it.value).join(',')).join(' ')} fill="none" stroke={color} strokeWidth={1.6} />
            {ser.items.map((it, k) => {
              const [x, y] = xy(k, it.value)
              const show = it.highlight || k === ser.items.length - 1 || it.value === mx
              return (
                <g key={k}>
                  <circle cx={x} cy={y} r={2.4} fill={color} />
                  {show && (
                    <text x={x} y={y - 6} textAnchor="middle" fontFamily={HEAD} fontWeight={500} fontSize={8} fill={PRIMARY}>
                      {fmtNum(it.value) + unit}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
