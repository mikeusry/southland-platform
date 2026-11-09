/**
 * Address syntax and common-provider typos for newsletter signup.
 * Safe to import from the browser. Disposable domains and DNS stay on the server.
 *
 * Real signups keep apostrophes, `&`, leading or trailing `_`/`-`, plus-tags,
 * and IDN domains. `|` and `=` stay rejected.
 */

export type EmailVerdict = { ok: true; email: string; domain: string } | { ok: false }

/** The one new line shown on a newsletter form. */
export const SUBSCRIBE_EMAIL_ERROR = 'Enter a valid email address.'

export function subscribeEmailError(suggestion?: string): string {
  if (suggestion) return `${SUBSCRIBE_EMAIL_ERROR} Did you mean ${suggestion}?`
  return SUBSCRIBE_EMAIL_ERROR
}

const LOCAL_ATOM = /^[a-z0-9!#$%&'*+/?^_`{}~-]+$/
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/**
 * Obvious misspellings only. Not a distance match, so farm domains are left alone.
 * Keys are the typed domain; values are the provider to suggest.
 */
const TYPO_DOMAINS: Readonly<Record<string, string>> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmaul.com': 'gmail.com',
  'gmsil.com': 'gmail.com',
  'gemail.com': 'gmail.com',
  'ggmail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.om': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yhaoo.com': 'yahoo.com',
  'yahho.com': 'yahoo.com',
  'yafoo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.cm': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'hotmal.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'hotmali.com': 'hotmail.com',
  'hotmall.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.cm': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outloook.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'outluk.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlook.cm': 'outlook.com',
  'outlook.con': 'outlook.com',
  'iclod.com': 'icloud.com',
  'iclou.com': 'icloud.com',
  'iclud.com': 'icloud.com',
  'iclould.com': 'icloud.com',
  'icloud.co': 'icloud.com',
  'icloud.cm': 'icloud.com',
  'icloud.con': 'icloud.com',
}

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code <= 31 || code === 127) return true
  }
  return false
}

function isLocalPart(local: string): boolean {
  if (local.length > 64) return false
  const parts = local.split('.')
  return parts.every((part) => part.length > 0 && LOCAL_ATOM.test(part))
}

/** Structural check on the typed domain, before punycode can collapse bad labels. */
function domainShapeOk(domain: string): boolean {
  if (domain.includes('..')) return false
  const labels = domain.split('.')
  if (labels.length < 2) return false
  const tld = labels[labels.length - 1]
  if (!tld || tld.length < 2) return false
  for (const label of labels) {
    if (!label || label.startsWith('-') || label.endsWith('-') || label.length > 63) return false
    if (/[/:?#\\%_]/.test(label)) return false
  }
  return true
}

function isMailDomain(ascii: string): boolean {
  if (ascii.length > 253) return false
  const labels = ascii.split('.')
  if (labels.length < 2) return false
  const tld = labels[labels.length - 1]
  if (!tld || tld.length < 2) return false
  return labels.every((label) => DOMAIN_LABEL.test(label))
}

export function parseSubscribeEmail(raw: string): EmailVerdict {
  const email = raw.trim().toLowerCase()
  if (!email || email.length > 254) return { ok: false }
  if (email.includes('|') || email.includes('=')) return { ok: false }
  if (/\s/.test(email) || hasControlChar(email)) return { ok: false }
  const at = email.indexOf('@')
  if (at <= 0 || at !== email.lastIndexOf('@')) return { ok: false }
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (!isLocalPart(local) || !domainShapeOk(domain)) return { ok: false }
  let ascii = domain
  try {
    ascii = new URL(`http://${domain}`).hostname.replace(/\.$/, '')
  } catch {
    return { ok: false }
  }
  if (!isMailDomain(ascii)) return { ok: false }
  return { ok: true, email: `${local}@${domain}`, domain: ascii }
}

function correctedDomain(domain: string): string | null {
  const direct = TYPO_DOMAINS[domain]
  if (direct) return direct
  const labels = domain.split('.')
  for (let i = 1; i < labels.length - 1; i++) {
    const suffix = labels.slice(i).join('.')
    const replacement = TYPO_DOMAINS[suffix]
    if (replacement) return `${labels.slice(0, i).join('.')}.${replacement}`
  }
  return null
}

/** Full address to offer, or null when the domain is not an obvious provider typo. */
export function emailTypoSuggestion(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at <= 0) return null
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const corrected = correctedDomain(domain)
  if (!corrected || corrected === domain) return null
  return `${local}@${corrected}`
}

/** Client check: syntax and the typo list. Null means the form may submit. */
export function subscribeAddressIssue(raw: string): string | null {
  const parsed = parseSubscribeEmail(raw)
  if (!parsed.ok) return subscribeEmailError()
  const suggestion = emailTypoSuggestion(parsed.email)
  if (suggestion) return subscribeEmailError(suggestion)
  return null
}
