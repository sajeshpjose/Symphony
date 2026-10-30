// The client report as a printable document, laid out by Paged.js with report.css.
// Matches the skill's PDF (skills/client-intelligence-report/scripts/build_outputs.py): dark cover,
// contents with page numbers, numbered sections, sources and method, dark back page.
import type { Block, ReportData, ResearchClaim, Section } from '@symph/core'
import { Chart } from './Chart'
import { Mark } from './Mark'

const AGENCY = { website: 'dotyello.com', email: 'hello@dotyello.com' }

const pad = (n: number) => String(n).padStart(2, '0')
const anchor = (key: string) => `rd-sec-${key}`

function citedIds(sections: Section[]): Set<string> {
  const ids = new Set<string>()
  const add = (xs?: string[]) => xs?.forEach((i) => ids.add(i))
  for (const s of sections)
    for (const b of s.blocks) {
      if (b.type === 'paragraph' || b.type === 'callout') add(b.claim_ids)
      if (b.type === 'bullets' || b.type === 'facts') b.items.forEach((it) => add(it.claim_ids))
      if (b.type === 'table') b.rows.forEach((r) => r.forEach((c) => add(c.claim_ids)))
      if (b.type === 'chart') {
        add(b.claim_ids)
        ;(b.series ?? [{ items: b.items ?? [] }]).forEach((ser) => ser.items.forEach((it) => add(it.claim_ids)))
      }
    }
  return ids
}

// One row per source the report cites; exports and Google profiles by name only.
function sourceRows(report: ReportData, claims: ResearchClaim[]): string[] {
  const ids = citedIds(report.sections)
  const rows: string[] = []
  for (const c of claims) {
    if (!ids.has(c.id) || !c.source_url) continue
    const url = c.source_url
    const label = url.startsWith('file://')
      ? c.source_title || `Client export ${url.slice(7)}`
      : url.startsWith('google-business-profile')
        ? 'Google Business Profile listings'
        : `${c.source_title && c.source_title !== url ? `${c.source_title} ` : ''}${url}`
    if (!rows.includes(label)) rows.push(label)
  }
  return rows
}

function BlockDoc({ block: b }: { block: Block }) {
  switch (b.type) {
    case 'paragraph':
      return <p className={b.lead ? 'rd-lead' : 'rd-p'}>{b.text}</p>
    case 'callout':
      return (
        <div className="rd-callout">
          {b.title && <div className="rd-callout-title">{b.title}</div>}
          <div className="rd-callout-text">{b.text}</div>
        </div>
      )
    case 'bullets':
      return (
        <ul className="rd-bullets">
          {b.items.map((it, i) => <li key={i}>{it.text}</li>)}
        </ul>
      )
    case 'facts':
      return (
        <div className="rd-facts" style={{ gridTemplateColumns: `repeat(${Math.min(b.items.length, 4)}, 1fr)` }}>
          {b.items.slice(0, 4).map((it, i) => (
            <div key={i} className="rd-fact">
              <div className="rd-fact-value">{it.value}</div>
              <div className="rd-fact-label">{it.label}</div>
            </div>
          ))}
        </div>
      )
    case 'table':
      return (
        <table className="rd-table">
          {b.headers?.length > 0 && (
            <thead>
              <tr>{b.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
            </thead>
          )}
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j}>{c.text}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )
    case 'chart':
      return (
        <figure className="rd-figure">
          <Chart block={b} />
          {b.caption && <figcaption className="rd-small">{b.caption}</figcaption>}
        </figure>
      )
  }
}

function SectionHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="rd-head">
      <div className="rd-head-num">{pad(n)}</div>
      <div className="rd-head-rule" />
      <h2 className="rd-head-title">{title}</h2>
    </div>
  )
}

export function ReportDocument({ report, claims, version = 'v1' }: { report: ReportData; claims: ResearchClaim[]; version?: string }) {
  const client = report.client.name
  const sections = report.sections
  const sourcesN = sections.length + 1
  const sources = sourceRows(report, claims)
  const meta = [report.client.url, report.client.location, report.client.industry].filter(Boolean)
  return (
    <div className="rd-doc">

      <section className="rd-cover">
        <Mark size="0.55in" color="#ffffff" className="rd-cover-mark" />
        <div className="rd-cover-kicker">Brand Intelligence Report</div>
        <h1 className="rd-cover-name">{client}</h1>
        <div className="rd-accent" />
        <div className="rd-cover-meta">
          {meta.map((m) => <div key={m}>{m}</div>)}
        </div>
        <div className="rd-cover-foot">
          <span>Version {version.replace('v', '')}  |  {report.date}</span>
          <span>Confidential. Prepared for {client}</span>
        </div>
      </section>

      <section className="rd-contents">
        {/* Running element for the page footer; placed after the cover so it does not open a page of its own. */}
        <div className="rd-footmark">
          <Mark size="11pt" />
        </div>
        <h1 className="rd-h1">Contents</h1>
        <ol className="rd-toc">
          {[...sections.map((s) => ({ key: s.key, title: s.title })), { key: 'sources', title: 'Sources and method' }].map((s, i) => (
            <li key={s.key}>
              <span className="rd-toc-num">{pad(i + 1)}</span>
              <span className="rd-toc-title">{s.title}</span>
              <a className="rd-toc-page" href={`#${anchor(s.key)}`} />
            </li>
          ))}
        </ol>
        <p className="rd-small rd-intro">
          This report sets out what we found about {client} from publicly available information, as a shared starting point for our work together. Every
          statement is drawn from the business's own channels or from independent sources, listed at the end.
        </p>
      </section>

      {sections.map((s, i) => (
        <section key={s.key} id={anchor(s.key)} className={i === 0 ? 'rd-section rd-first' : 'rd-section'}>
          {/* The heading stays with the first block so a section never starts at the foot of a page. */}
          <div className="rd-keep">
            <SectionHead n={i + 1} title={s.title} />
            {s.blocks[0] && <BlockDoc block={s.blocks[0]} />}
          </div>
          {s.blocks.slice(1).map((b, j) => (
            <BlockDoc key={j} block={b} />
          ))}
        </section>
      ))}

      <section id={anchor('sources')} className="rd-section rd-sources">
        <SectionHead n={sourcesN} title="Sources and method" />
        <p className="rd-p">
          This report is based on publicly available information reviewed on {report.date}. A statement appears only when {client} says it on its own
          channels or when independent sources support it. Business details change, so please tell us about anything that is out of date.
        </p>
        {sources.length > 0 && (
          <table className="rd-table rd-table-sources">
            <thead>
              <tr>
                <th>Source</th>
                <th>Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s}>
                  <td>{s}</td>
                  <td>{report.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rd-back">
        <div className="rd-back-body">
          <Mark size="0.9in" color="#ffffff" />
          <div className="rd-accent" />
          <div className="rd-back-contact">
            <div>{AGENCY.website}</div>
            <div>{AGENCY.email}</div>
          </div>
        </div>
        <div className="rd-back-foot">Prepared for {client}. Based on publicly available information reviewed on {report.date}.</div>
      </section>
    </div>
  )
}
