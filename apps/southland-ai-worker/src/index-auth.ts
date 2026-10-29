// Bearer check for /index/* . The secret is a worker binding (INDEX_ADMIN_SECRET).
// Comparison walks every byte of both strings so a mismatch does not return early.

export type IndexAuthDecision = { ok: true } | { ok: false; status: 401 | 503; error: string }

export function authorizeIndexRequest(
  request: Request,
  secret: string | undefined
): IndexAuthDecision {
  if (typeof secret !== 'string' || secret.trim().length === 0) {
    return { ok: false, status: 503, error: 'Indexing unavailable' }
  }

  const token = readBearerToken(request.headers.get('Authorization'))
  const matches = timingSafeEqual(token ?? '', secret)
  if (token === null || !matches) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  return { ok: true }
}

function readBearerToken(header: string | null): string | null {
  if (!header) return null
  const match = /^Bearer (.+)$/i.exec(header)
  if (!match) return null
  return match[1]
}

function timingSafeEqual(leftValue: string, rightValue: string): boolean {
  const encoder = new TextEncoder()
  const left = encoder.encode(leftValue)
  const right = encoder.encode(rightValue)
  let mismatch = left.length ^ right.length
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i++) {
    mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0)
  }
  return mismatch === 0
}
