/**
 * Source: https://github.com/disposable-email-domains/disposable-email-domains/blob/ba992a0b4c867db3ff39605696bb7de9fbb2e11f/disposable_email_blocklist.conf (CC0-1.0), upstream commit 2026-11-08, vendored 2026-11-09. No runtime fetch.
 */
import disposableList from './disposable-email-domains.json' with { type: 'json' }

const DISPOSABLE_DOMAINS = new Set(disposableList.domains.map((domain) => domain.toLowerCase()))

/** Exact domain or a parent on the vendored list. `com` is not on the list. */
export function isDisposableDomain(domain: string): boolean {
  let host = domain.toLowerCase().replace(/\.$/, '')
  while (host.includes('.')) {
    if (DISPOSABLE_DOMAINS.has(host)) return true
    const dot = host.indexOf('.')
    host = host.slice(dot + 1)
  }
  return false
}
