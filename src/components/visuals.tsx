import type { ReportPage, Slide } from '../data/types'
import { companyById } from '../data/companies'

export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)']

export function Donut({ items, size = 96 }: { items: { name: string; pct: number }[]; size?: number }) {
  const r = 38, c = 2 * Math.PI * r
  let acc = 0
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Donut chart">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--inset)" strokeWidth="18" />
      {items.map((it, i) => {
        const len = (it.pct / 100) * c
        const el = <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={SERIES[i % SERIES.length]} strokeWidth="18"
          strokeDasharray={`${Math.max(0, len - 1.2)} ${c}`} strokeDashoffset={-acc} transform="rotate(-90 50 50)" />
        acc += len
        return el
      })}
    </svg>
  )
}

export function StackedBars({ data, keys, colors, height = 190 }: { data: { label: string; [k: string]: number | string }[]; keys: string[]; colors: string[]; height?: number }) {
  const max = Math.max(...data.map((d) => keys.reduce((s, k) => s + (d[k] as number), 0)))
  const top = Math.ceil(max / 20) * 20
  const W = 280, H = height, padL = 26, padB = 20, padT = 8
  const bw = (W - padL) / data.length
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / top)
  const ticks = [0, top / 4, top / 2, (3 * top) / 4, top]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Stacked bar chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="0.6" />
          <text x={padL - 5} y={y(t) + 3} textAnchor="end" className="axis">{t}</text>
        </g>
      ))}
      {data.map((d, i) => {
        let acc = 0
        return (
          <g key={i}>
            {keys.map((k, j) => {
              const v = d[k] as number
              const y0 = y(acc), y1 = y(acc + v)
              acc += v
              return <rect key={k} x={padL + i * bw + bw * 0.18} width={bw * 0.64} y={y1} height={Math.max(0, y0 - y1)} fill={colors[j]} />
            })}
            {i % 3 === 0 && <text x={padL + i * bw + bw / 2} y={H - 5} textAnchor="middle" className="axis">{d.label}</text>}
          </g>
        )
      })}
    </svg>
  )
}

/* Slide rendered as an original 16:9 layout from structured data */
export function SlideView({ slide, companyId, mini }: { slide: Slide; companyId: string; mini?: boolean }) {
  const c = companyById(companyId)
  const max = Math.max(...(slide.bars?.map((b) => b.value) ?? [1]))
  return (
    <div className={`slide${mini ? ' mini' : ''}`} style={{ ['--brand' as string]: c.color }}>
      {slide.kind === 'cover' ? (
        <div className="slide-cover">
          <div className="slide-cover-text">
            <div className="slide-cover-title">{slide.title}</div>
            <div className="slide-cover-rule" />
            <div className="slide-cover-sub">{slide.subtitle}</div>
          </div>
          <div className="slide-cover-art"><span>{c.monogram}</span></div>
        </div>
      ) : (
        <>
          <div className="slide-title">{slide.title}</div>
          {slide.subtitle && <div className="slide-sub">{slide.subtitle}</div>}
          {slide.kind === 'bars' && (
            <div className="slide-bars">
              {slide.bars!.map((b) => (
                <div key={b.label} className="slide-bar">
                  <span className="slide-bar-val">{b.value}{slide.key === 'capex' || slide.key === 'organic' ? '%' : ''}</span>
                  <span className="slide-bar-fill" style={{ height: `${(b.value / max) * 100}%` }} />
                  <span className="slide-bar-label">{b.label}</span>
                </div>
              ))}
            </div>
          )}
          {slide.kind === 'kpis' && (
            <div className="slide-kpis">
              {slide.kpis!.map((k) => (
                <div key={k.label} className="slide-kpi"><b>{k.value}</b><span>{k.label}</span>{k.delta && <em>{k.delta}</em>}</div>
              ))}
            </div>
          )}
          {slide.kind === 'text' && <ul className="slide-list">{slide.bullets!.map((b) => <li key={b}>{b}</li>)}</ul>}
          <div className="slide-foot">{c.name}</div>
        </>
      )}
    </div>
  )
}

/* A report page rendered as paper */
export function PaperPage({ page, companyId, findTerm, exhibit }: { page: ReportPage; companyId: string; findTerm?: string; exhibit?: boolean }) {
  const c = companyById(companyId)
  const hl = (s: string) => {
    if (!findTerm) return s
    const re = new RegExp(`(${findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig')
    return s.split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))
  }
  return (
    <div className="paper">
      {exhibit && <div className="paper-exhibit">Exhibit 99.1</div>}
      {exhibit && <div className="paper-brand"><span style={{ background: c.color }}>{c.monogram}</span>{c.name}</div>}
      {page.blocks.map((b, i) => {
        if (b.t === 'h') return <h4 key={i}>{hl(b.text)}</h4>
        if (b.t === 'p') return <p key={i}>{hl(b.text)}</p>
        if (b.t === 'ul') return <ul key={i}>{b.items.map((x) => <li key={x}>{hl(x)}</li>)}</ul>
        return (
          <table key={i}><tbody>{b.rows.map((r, ri) => <tr key={ri}>{r.map((cell, ci) => (ri === 0 ? <th key={ci}>{cell}</th> : <td key={ci}>{cell}</td>))}</tr>)}</tbody></table>
        )
      })}
    </div>
  )
}
