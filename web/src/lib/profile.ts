// Content profile: what Symph knows about a client beyond name and website.
// Research needs none of it. Writing content needs business details and voice (decision D36);
// rules, facts and examples are recommended.
import type { ClientRow, ExampleRow, FactRow, VoiceRow } from './client'

export type ProfileKey = 'business' | 'voice' | 'rules' | 'facts' | 'examples'

export type ProfileItem = {
  key: ProfileKey
  label: string
  step: number // editor: 1 is business details (/clients/:id/edit), 2 to 5 are ClientSetup steps
  done: boolean
  detail: string
  required: boolean // required before content creation
}

type Parts = {
  client: Pick<ClientRow, 'sells' | 'audience'>
  voice: Pick<VoiceRow, 'summary' | 'words_use' | 'words_avoid' | 'claims_never' | 'disclaimer'> | null
  facts: Pick<FactRow, 'status'>[]
  examples: Pick<ExampleRow, 'kind'>[]
}

export function profileItems({ client, voice, facts, examples }: Parts): ProfileItem[] {
  const rules = (voice?.words_use?.length ?? 0) + (voice?.words_avoid?.length ?? 0) + (voice?.claims_never?.length ?? 0) + (voice?.disclaimer ? 1 : 0)
  const approved = facts.filter((f) => f.status === 'approved').length
  const loved = examples.filter((e) => e.kind === 'loved').length
  const hasBusiness = !!client.sells?.trim() && !!client.audience?.trim()
  return [
    { key: 'business', label: 'Business details', step: 1, required: true, done: hasBusiness, detail: hasBusiness ? 'What they sell and who they serve' : 'Add what they sell and who they serve' },
    { key: 'voice', label: 'Voice and tone', step: 2, required: true, done: !!voice?.summary?.trim(), detail: voice?.summary?.trim() ? 'Set' : 'Not set' },
    { key: 'rules', label: 'Rules and claims', step: 3, required: false, done: rules > 0, detail: rules ? `${rules} rule${rules === 1 ? '' : 's'}` : 'None yet' },
    { key: 'facts', label: 'Facts', step: 4, required: false, done: approved > 0, detail: approved ? `${approved} approved` : 'None yet' },
    { key: 'examples', label: 'Examples', step: 5, required: false, done: loved > 0, detail: loved ? `${loved} loved` : 'None yet' },
  ]
}

export const contentReady = (items: ProfileItem[]) => items.every((i) => !i.required || i.done)
export const missingForContent = (items: ProfileItem[]) => items.filter((i) => i.required && !i.done)
