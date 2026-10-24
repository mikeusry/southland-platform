import { getServerEnv } from '../../lib/server-env'

export const NEXUS_NEWSLETTER_URL = 'https://nexus.southlandorganics.com/api/public/newsletter'
const NEXUS_ORIGIN = 'https://southlandorganics.com'
const NEXUS_TIMEOUT_MS = 5000

export interface NexusNewsletterPayload {
  email: string
  source: string
  first_name?: string
}

/** Fire-and-forget Nexus mint; never throws — signup must not depend on Nexus. */
export async function mintNewsletterViaNexus(
  locals: unknown,
  payload: NexusNewsletterPayload
): Promise<void> {
  const secret = getServerEnv(locals, 'NEWSLETTER_MINT_SECRET')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Origin: NEXUS_ORIGIN,
  }
  if (secret) {
    headers.Authorization = `Bearer ${secret}`
  }

  const body: Record<string, string> = {
    email: payload.email,
    source: payload.source,
    company_website: '',
  }
  if (payload.first_name) {
    body.first_name = payload.first_name
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), NEXUS_TIMEOUT_MS)

  try {
    const res = await fetch(NEXUS_NEWSLETTER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.warn(`[subscribe] Nexus newsletter failed: ${res.status} ${detail}`)
    }
  } catch (err) {
    console.warn('[subscribe] Nexus newsletter error (non-fatal):', err)
  } finally {
    clearTimeout(timeout)
  }
}
