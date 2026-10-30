// /research/:id/pdf: the client report laid out as pages (Paged.js), ready for Save as PDF.
import '@fontsource/poppins/300.css'
import '@fontsource/poppins/500.css'
import { Previewer } from 'pagedjs'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button, Note } from '../components/ui'
import { ReportDocument } from '../report/ReportDocument'
import reportCss from '../report/report.css?raw'
import { useRun } from '../lib/research'

// Screen-only chrome around the pages; hidden when printing.
const screenCss = `
  @media screen {
    body { background: #e9e8e4 !important; }
    .pagedjs_pages { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 72px 0 40px; }
    .pagedjs_page { background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.12); }
  }
  @media print {
    .rd-toolbar, .rd-source { display: none !important; }
    body { background: #fff !important; }
  }
`

export function ResearchPdf() {
  const { id } = useParams()
  const { data: run, error } = useRun(id)
  const source = useRef<HTMLDivElement>(null)
  const target = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<number | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!run?.report || !source.current || !target.current || started.current) return
    started.current = true
    const title = `${run.report.client.name} brand intelligence report v1`
    document.title = title
    ;(async () => {
      try {
        await document.fonts.load('300 12pt Poppins')
        await document.fonts.load('500 12pt Poppins')
        await document.fonts.ready
        const tpl = document.createElement('template')
        tpl.innerHTML = source.current!.innerHTML
        const flow = await new Previewer().preview(tpl.content, [{ 'report.css': reportCss }], target.current!)
        setPages(flow.total)
      } catch (e) {
        setFailed((e as Error).message)
      }
    })()
  }, [run])

  if (error) return <div className="p-8"><Note tone="bad">{(error as Error).message}</Note></div>
  if (!run) return <div className="p-8 text-fg-3">Loading…</div>
  if (!run.report) return <div className="p-8"><Note tone="warn">This run has no report yet.</Note></div>

  return (
    <>
      <style>{screenCss}</style>
      <div className="rd-toolbar fixed inset-x-0 top-0 z-10 flex items-center gap-3 border-b border-line bg-surface px-5 py-3">
        <Link to={`/research/${run.id}`} className="text-sm text-fg-2 hover:text-ink">← Back to the run</Link>
        <span className="flex-1 text-sm text-fg-2">
          {failed ? `Layout failed: ${failed}` : pages ? `${pages} pages. In the print dialog choose Save as PDF and turn off headers and footers.` : 'Laying out pages…'}
        </span>
        <Button variant="primary" disabled={!pages} onClick={() => window.print()}>Save as PDF</Button>
      </div>
      <div ref={source} className="rd-source" style={{ display: 'none' }}>
        <ReportDocument report={run.report} claims={run.claims ?? []} />
      </div>
      <div ref={target} />
    </>
  )
}
