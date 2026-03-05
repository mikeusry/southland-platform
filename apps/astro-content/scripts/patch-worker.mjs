/**
 * Post-build patch: Inject MessageChannel polyfill into the Astro renderer chunk.
 *
 * `wrangler pages deploy` validates the worker bundle WITHOUT applying
 * compatibility_flags (nodejs_compat_v2), so React SSR's use of MessageChannel
 * causes deploy failures. This script injects a minimal polyfill at the top of
 * the renderer chunk so the validation passes.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CHUNKS_DIR = join(import.meta.dirname, '..', 'dist', '_worker.js', 'chunks')
const POLYFILL = `if(typeof globalThis.MessageChannel==='undefined'){globalThis.MessageChannel=class MessageChannel{constructor(){this.port1={onmessage:null,postMessage(d){if(this._other?.onmessage)this._other.onmessage({data:d})}};this.port2={onmessage:null,postMessage(d){if(this._other?.onmessage)this._other.onmessage({data:d})}};this.port1._other=this.port2;this.port2._other=this.port1}}}
`

const files = readdirSync(CHUNKS_DIR).filter((f) => f.startsWith('_@astro-renderers'))

if (files.length === 0) {
  console.log('⚠️  No renderer chunk found — skipping MessageChannel patch')
  process.exit(0)
}

for (const file of files) {
  const path = join(CHUNKS_DIR, file)
  const content = readFileSync(path, 'utf8')
  if (content.includes('MessageChannel') && !content.startsWith('if(typeof globalThis.MessageChannel')) {
    writeFileSync(path, POLYFILL + content)
    console.log(`✅ Patched ${file} with MessageChannel polyfill`)
  } else {
    console.log(`⏭️  ${file} — already patched or no MessageChannel usage`)
  }
}
