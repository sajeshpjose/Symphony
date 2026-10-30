import { Card, Empty, PageHeader } from '../components/ui'

// Placeholder for screens coming in the next build steps.
export function Soon({ title, children }: { title: string; children: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <Empty title="Coming next">{children}</Empty>
      </Card>
    </>
  )
}
