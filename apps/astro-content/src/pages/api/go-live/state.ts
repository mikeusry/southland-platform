/**
 * Go-Live State Persistence API
 *
 * GET  /api/go-live/state — read saved state from JSON file
 * POST /api/go-live/state — write state to JSON file
 *
 * File: apps/astro-content/go-live-state.json (gitignored)
 *
 * Uses node:fs in dev (Node SSR). On Cloudflare Workers where fs is
 * unavailable, falls back to an in-memory store so the page still loads
 * (state won't survive worker restarts, but localStorage on the client
 * is the primary store anyway).
 */
import type { APIRoute } from 'astro'

// Dynamic fs import — unavailable on CF Workers
let fsRead: ((path: string, enc: string) => Promise<string>) | null = null
let fsWrite: ((path: string, data: string, enc: string) => Promise<void>) | null = null
let STATE_FILE = ''

// In-memory fallback for CF Workers
let memoryState: string | null = null

try {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  fsRead = fs.readFile as any
  fsWrite = fs.writeFile as any
  STATE_FILE = path.join(process.cwd(), 'go-live-state.json')
} catch {
  // Running on CF Workers — fs not available, use in-memory fallback
}

export const GET: APIRoute = async () => {
  try {
    if (fsRead) {
      const raw = await fsRead(STATE_FILE, 'utf-8')
      return new Response(raw, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    // In-memory fallback
    return new Response(memoryState ?? JSON.stringify(null), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return new Response(JSON.stringify(null), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ error: true, message: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const json = JSON.stringify(body, null, 2)
    if (fsWrite) {
      await fsWrite(STATE_FILE, json, 'utf-8')
    } else {
      memoryState = json
    }
    return new Response(JSON.stringify({ ok: true, savedAt: new Date().toISOString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: true, message: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
