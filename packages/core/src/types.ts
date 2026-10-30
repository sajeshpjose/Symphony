// Shapes stored in jsonb columns. Keep in sync with supabase/migrations.

export type Channel = 'linkedin' | 'facebook' | 'instagram';
export const CHANNELS: Channel[] = ['linkedin', 'facebook', 'instagram'];
export const CHANNEL_LABELS: Record<Channel, string> = { linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram' };

export type CheckStatus = 'pass' | 'warn' | 'fail';
export type Check = { id: string; label: string; status: CheckStatus; note?: string };

export type SocialPost = { text: string; hashtags?: string[] };
export type Social = Partial<Record<Channel, SocialPost>>;

export type ImageKeyword = { phrase: string; why?: string };

export type ClaimStatus = 'verified' | 'ask_client' | 'removed';
export type Claim = { claim: string; source: string; status: ClaimStatus; reason?: string };

export type ClientStatus = 'setup' | 'active' | 'paused';
export type PostStatus = 'writing' | 'to_review' | 'reviewed' | 'failed';
export type TopicStatus = 'suggested' | 'writing' | 'written' | 'dropped';
export type ResearchStatus = 'queued' | 'running' | 'ready' | 'failed';
