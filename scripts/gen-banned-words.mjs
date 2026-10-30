// Regenerates packages/core/src/banned-words.ts from the content skill's list.
// Run after editing skills/client-content-pack/references/banned-words.txt:  node scripts/gen-banned-words.mjs
import { readFileSync, writeFileSync } from 'node:fs'
const src = 'skills/client-content-pack/references/banned-words.txt'
const words = readFileSync(src, 'utf8').split('\n').map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#'))
writeFileSync(
  'packages/core/src/banned-words.ts',
  `// Generated from ${src} by scripts/gen-banned-words.mjs. Do not edit by hand.\n// A trailing * matches any ending.\nexport const BANNED_WORDS: string[] = ${JSON.stringify(words, null, 2)};\n`,
)
console.log(`${words.length} banned words written`)
