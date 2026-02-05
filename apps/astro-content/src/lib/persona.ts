/**
 * Persona Utilities
 *
 * Shared utilities for reading/writing persona data across the site.
 * Used by Reality Tunnels to personalize content based on visitor type.
 *
 * Personas:
 * - backyard: Backyard Betty (hobby chicken keepers)
 * - commercial: Broiler Bill (commercial poultry)
 * - lawn: Turf Pro Taylor (lawn & garden)
 * - general: Skipped personalization
 * - null: Unknown (hasn't selected yet)
 */

export type PersonaId = 'backyard' | 'commercial' | 'lawn' | 'general' | null

export interface PersonaData {
  id: PersonaId
  selectedAt: string
  source: 'decision_engine' | 'url_param' | 'inferred' | 'manual'
}

export interface PersonaConfig {
  id: PersonaId
  label: string
  shortLabel: string
  color: string
  bgColor: string
  landingPage: string
  ctaText: string
  ctaHref: string
}

// Persona configurations
export const PERSONA_CONFIG: Record<Exclude<PersonaId, null>, PersonaConfig> = {
  backyard: {
    id: 'backyard',
    label: 'Backyard Flock',
    shortLabel: 'Backyard',
    color: '#92400e', // amber-800
    bgColor: '#fef3c7', // amber-100
    landingPage: '/poultry/backyard/',
    ctaText: 'Shop Backyard Products',
    ctaHref: '/shop/poultry/backyard/',
  },
  commercial: {
    id: 'commercial',
    label: 'Commercial Poultry',
    shortLabel: 'Commercial',
    color: '#166534', // green-800
    bgColor: '#dcfce7', // green-100
    landingPage: '/poultry/commercial/',
    ctaText: 'Talk to a Specialist',
    ctaHref: '/contact/commercial/',
  },
  lawn: {
    id: 'lawn',
    label: 'Lawn & Garden',
    shortLabel: 'Lawn',
    color: '#065f46', // emerald-800
    bgColor: '#d1fae5', // emerald-100
    landingPage: '/lawn/',
    ctaText: 'Shop Lawn Products',
    ctaHref: '/shop/lawn/',
  },
  general: {
    id: 'general',
    label: 'All Products',
    shortLabel: 'Browse',
    color: '#374151', // gray-700
    bgColor: '#f3f4f6', // gray-100
    landingPage: '/shop/',
    ctaText: 'Shop All Products',
    ctaHref: '/shop/',
  },
}

// Storage keys
const STORAGE_KEY = 'southland_persona'
const COOKIE_NAME = 'sl_persona'
const COOKIE_DAYS = 365

/**
 * Set a cookie (works on client-side only)
 */
function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  const domain = window.location.hostname.replace(/^www\./, '')
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; domain=.${domain}; SameSite=Lax`
}

/**
 * Get a cookie value (works on client-side only)
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop()!.split(';').shift()!)
  }
  return null
}

/**
 * Get the stored persona data
 */
export function getPersona(): PersonaData | null {
  if (typeof window === 'undefined') return null

  // Check localStorage first
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored) as PersonaData
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  // Check cookie fallback
  const cookieVal = getCookie(COOKIE_NAME)
  if (cookieVal && isValidPersonaId(cookieVal)) {
    return {
      id: cookieVal as PersonaId,
      selectedAt: '',
      source: 'decision_engine',
    }
  }

  return null
}

/**
 * Get just the persona ID (convenience function)
 */
export function getPersonaId(): PersonaId {
  const data = getPersona()
  return data?.id ?? null
}

/**
 * Set the persona
 */
export function setPersona(personaId: PersonaId, source: PersonaData['source'] = 'manual'): void {
  if (typeof window === 'undefined' || !personaId) return

  const data: PersonaData = {
    id: personaId,
    selectedAt: new Date().toISOString(),
    source,
  }

  // Store in localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

  // Store in cookie for cross-subdomain/server access
  setCookie(COOKIE_NAME, personaId, COOKIE_DAYS)

  // Dispatch custom event for other components to react
  window.dispatchEvent(new CustomEvent('persona-changed', { detail: data }))
}

/**
 * Clear the stored persona
 */
export function clearPersona(): void {
  if (typeof window === 'undefined') return

  localStorage.removeItem(STORAGE_KEY)
  setCookie(COOKIE_NAME, '', -1) // Expire the cookie

  window.dispatchEvent(new CustomEvent('persona-changed', { detail: null }))
}

/**
 * Check if a string is a valid persona ID
 */
export function isValidPersonaId(value: string): value is Exclude<PersonaId, null> {
  return ['backyard', 'commercial', 'lawn', 'general'].includes(value)
}

/**
 * Get the config for a persona
 */
export function getPersonaConfig(personaId: PersonaId): PersonaConfig | null {
  if (!personaId || personaId === null) return null
  return PERSONA_CONFIG[personaId] ?? null
}

/**
 * Check if the current persona matches any of the given IDs
 */
export function isPersona(...personaIds: PersonaId[]): boolean {
  const currentId = getPersonaId()
  return personaIds.includes(currentId)
}

/**
 * Get persona from URL parameter (for tracking links)
 * e.g., ?persona=commercial
 */
export function getPersonaFromUrl(): PersonaId {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const param = params.get('persona')

  if (param && isValidPersonaId(param)) {
    return param
  }

  return null
}

/**
 * Initialize persona from URL if present
 * Call this on page load to handle tracking links
 */
export function initPersonaFromUrl(): boolean {
  const urlPersona = getPersonaFromUrl()
  if (urlPersona) {
    setPersona(urlPersona, 'url_param')
    return true
  }
  return false
}

/**
 * Journey stages for the customer journey
 */
export type JourneyStage =
  | 'unaware'
  | 'aware'
  | 'receptive'
  | 'zmot'
  | 'objections'
  | 'test_prep'
  | 'challenge'
  | 'success'
  | 'commitment'
  | 'evangelist'

const STAGE_COOKIE_NAME = 'sl_stage'

/**
 * Get the current journey stage from cookie
 */
export function getJourneyStage(): JourneyStage {
  const cookieVal = getCookie(STAGE_COOKIE_NAME)
  if (cookieVal && isValidJourneyStage(cookieVal)) {
    return cookieVal
  }
  return 'unaware'
}

/**
 * Set the journey stage
 */
export function setJourneyStage(stage: JourneyStage): void {
  if (typeof window === 'undefined') return
  setCookie(STAGE_COOKIE_NAME, stage, COOKIE_DAYS)
}

/**
 * Check if a string is a valid journey stage
 */
export function isValidJourneyStage(value: string): value is JourneyStage {
  return [
    'unaware',
    'aware',
    'receptive',
    'zmot',
    'objections',
    'test_prep',
    'challenge',
    'success',
    'commitment',
    'evangelist',
  ].includes(value)
}
