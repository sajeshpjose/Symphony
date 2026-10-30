// Claude models and prices used for cost tracking.
// Prices in USD per million tokens, from https://platform.claude.com/docs/en/about-claude/pricing (checked Oct 29, 2026).
// Update here when pricing changes; every cost shown in the app comes from this table.

export const MODELS = {
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-5-5',
  opus: 'claude-opus-5-5',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

export const MODEL_LABELS: Record<ModelId, string> = {
  'claude-sonnet-5-5': 'Claude Sonnet',
  'claude-haiku-5-5': 'Claude Haiku',
  'claude-opus-5-5': 'Claude Opus',
};

type Price = { input: number; output: number; cacheWrite: number; cacheHit: number };

// Haiku 5.5 has a higher tier for prompts over 100k tokens.
const PRICES: Record<ModelId, { base: Price; long?: Price }> = {
  'claude-sonnet-5-5': { base: { input: 2, output: 10, cacheWrite: 2.5, cacheHit: 0.1 } },
  'claude-haiku-5-5': {
    base: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheHit: 0.01 },
    long: { input: 0.5, output: 2.5, cacheWrite: 0.625, cacheHit: 0.05 },
  },
  'claude-opus-5-5': { base: { input: 4, output: 20, cacheWrite: 5, cacheHit: 0.2 } },
};

export const WEB_SEARCH_USD_PER_SEARCH = 0.01;
export const BATCH_DISCOUNT = 0.5;

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  web_searches?: number;
};

export function costUsd(model: string, u: Usage, opts: { batch?: boolean } = {}): number {
  const entry = PRICES[model as ModelId];
  if (!entry) return 0;
  const promptTokens = u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  const p = entry.long && promptTokens > 100_000 ? entry.long : entry.base;
  // Batch discount applies to input and output; cache prices are taken as listed.
  const io = (u.input_tokens * p.input + u.output_tokens * p.output) * (opts.batch ? BATCH_DISCOUNT : 1);
  const cache = (u.cache_creation_input_tokens ?? 0) * p.cacheWrite + (u.cache_read_input_tokens ?? 0) * p.cacheHit;
  const search = (u.web_searches ?? 0) * WEB_SEARCH_USD_PER_SEARCH;
  return (io + cache) / 1_000_000 + search;
}

export const TASKS = ['research', 'topics', 'post', 'social', 'keywords'] as const;
export type Task = (typeof TASKS)[number];

export const TASK_LABELS: Record<Task, string> = {
  research: 'Research report',
  topics: 'Suggest 5 topics',
  post: 'Write blog post',
  social: 'Social copy',
  keywords: 'Image keywords',
};
