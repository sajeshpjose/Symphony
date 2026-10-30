import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Button, Card, Chip, Empty, PageHeader } from '../components/ui'
import { supabase } from '../lib/supabase'
import { Stepper } from './NewClient'

// Client overview. Set-up steps 2–5 (voice, rules, facts, examples) arrive in the next build step.
export function ClientPage() {
  const { id } = useParams()
  const { data: c } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
  })
  if (!c) return null
  return (
    <>
      <PageHeader
        crumb={<Link to="/clients">Clients</Link>}
        title={c.name}
        subtitle={[c.website, c.industry, c.location].filter(Boolean).join(' · ')}
        actions={<Chip tone={c.status === 'active' ? 'ok' : 'warn'}>{c.status === 'setup' ? `Set up · step ${c.setup_step} of 5` : c.status}</Chip>}
      />
      {c.status === 'setup' && <Stepper current={c.setup_step - 1} />}
      <Card>
        <Empty title="Voice and tone is next" action={<Button disabled>Continue set up</Button>}>
          The remaining set-up steps (voice, rules and claims, facts, examples) are being built next.
        </Empty>
      </Card>
    </>
  )
}
