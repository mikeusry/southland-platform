/**
 * Persona Utilities
 *
 * Shared utilities for reading/writing persona data across the site.
 * Used by Reality Tunnels to personalize content based on visitor type.
 *
 * Two-tier identity model:
 * - SegmentId: 'poultry' | 'turf' | 'waste' | 'general' (homepage routing)
 * - PersonaId: 10 personas + 'general' (hub page routing)
 *
 * Segments fan out into personas on hub pages:
 *   poultry → bill, betty, bob, tom, greg
 *   turf    → taylor, gary, hannah, maggie
 *   waste   → sam
 */

// =============================================================================
// TYPES
// =============================================================================

export type PersonaId =
  | 'bill'
  | 'betty'
  | 'bob'
  | 'tom'
  | 'greg'
  | 'taylor'
  | 'gary'
  | 'hannah'
  | 'maggie'
  | 'sam'
  | 'general'
  | null

export type SegmentId = 'poultry' | 'turf' | 'waste' | 'general'

export interface PersonaData {
  id: PersonaId
  segmentId: SegmentId
  selectedAt: string
  source:
    | 'decision_engine'
    | 'hero'
    | 'url_param'
    | 'inferred'
    | 'manual'
    | 'segment_hub'
    | 'experiment'
}

export interface PersonaConfig {
  id: Exclude<PersonaId, null>
  label: string
  shortLabel: string
  color: string
  bgColor: string
  landingPage: string
  ctaText: string
  ctaHref: string
}

export interface SegmentConfig {
  id: SegmentId
  label: string
  color: string
  bgColor: string
  hubPage: string
  personaSlugs: Exclude<PersonaId, null | 'general'>[]
}

// =============================================================================
// LEGACY MIGRATION
// =============================================================================

/** Maps old persona IDs to new ones. Used in getPersona() for silent migration. */
const LEGACY_PERSONA_MAP: Record<string, Exclude<PersonaId, null>> = {
  backyard: 'betty',
  commercial: 'bill',
  lawn: 'taylor',
}

// =============================================================================
// PERSONA → SEGMENT MAPPING
// =============================================================================

export const PERSONA_TO_SEGMENT: Record<Exclude<PersonaId, null>, SegmentId> = {
  bill: 'poultry',
  betty: 'poultry',
  bob: 'poultry',
  tom: 'poultry',
  greg: 'poultry',
  taylor: 'turf',
  gary: 'turf',
  hannah: 'turf',
  maggie: 'turf',
  sam: 'waste',
  general: 'general',
}

// =============================================================================
// SEGMENT CONFIG
// =============================================================================

export const SEGMENT_CONFIG: Record<SegmentId, SegmentConfig> = {
  poultry: {
    id: 'poultry',
    label: 'Poultry',
    color: '#166534',
    bgColor: '#f0fdf4',
    hubPage: '/poultry/',
    personaSlugs: ['bill', 'betty', 'bob', 'tom', 'greg'],
  },
  turf: {
    id: 'turf',
    label: 'Turf & Soil',
    color: '#065f46',
    bgColor: '#ecfdf5',
    hubPage: '/lawn/',
    personaSlugs: ['taylor', 'gary', 'hannah', 'maggie'],
  },
  waste: {
    id: 'waste',
    label: 'Septic & Waste',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    hubPage: '/waste/',
    personaSlugs: ['sam'],
  },
  general: {
    id: 'general',
    label: 'All Products',
    color: '#374151',
    bgColor: '#f3f4f6',
    hubPage: '/shop/',
    personaSlugs: [],
  },
}

// =============================================================================
// PERSONA CONFIG (11 entries: 10 personas + general)
// =============================================================================

export const PERSONA_CONFIG: Record<Exclude<PersonaId, null>, PersonaConfig> = {
  bill: {
    id: 'bill',
    label: 'Broiler Bill',
    shortLabel: 'Commercial',
    color: '#166534',
    bgColor: '#f0fdf4',
    landingPage: '/poultry/commercial/',
    ctaText: 'Get a Grow-out Program Quote',
    ctaHref: '/contact/commercial/',
  },
  betty: {
    id: 'betty',
    label: 'Backyard Betty',
    shortLabel: 'Backyard',
    color: '#92400e',
    bgColor: '#fffbeb',
    landingPage: '/poultry/backyard/',
    ctaText: 'Start a Backyard Flock Bundle',
    ctaHref: '/shop/poultry/backyard/',
  },
  bob: {
    id: 'bob',
    label: 'Breeder Bob',
    shortLabel: 'Breeders',
    color: '#1e40af',
    bgColor: '#eff6ff',
    landingPage: '/poultry/breeders/',
    ctaText: 'Breeder Programs',
    ctaHref: '/poultry/breeders/',
  },
  tom: {
    id: 'tom',
    label: 'Turkey Tom',
    shortLabel: 'Turkey',
    color: '#9a3412',
    bgColor: '#fff7ed',
    landingPage: '/poultry/turkey/',
    ctaText: 'Turkey Solutions',
    ctaHref: '/poultry/turkey/',
  },
  greg: {
    id: 'greg',
    label: 'Game Bird Greg',
    shortLabel: 'Game Birds',
    color: '#4338ca',
    bgColor: '#eef2ff',
    landingPage: '/poultry/game-birds/',
    ctaText: 'Game Bird Programs',
    ctaHref: '/poultry/game-birds/',
  },
  taylor: {
    id: 'taylor',
    label: 'Turf Pro Taylor',
    shortLabel: 'Turf Pro',
    color: '#065f46',
    bgColor: '#ecfdf5',
    landingPage: '/lawn/',
    ctaText: 'Build Your Turf Program',
    ctaHref: '/lawn/',
  },
  gary: {
    id: 'gary',
    label: 'Golf Course Gary',
    shortLabel: 'Golf Course',
    color: '#0e7490',
    bgColor: '#ecfeff',
    landingPage: '/lawn/golf/',
    ctaText: 'Golf Course Programs',
    ctaHref: '/lawn/golf/',
  },
  hannah: {
    id: 'hannah',
    label: 'Homeowner Hannah',
    shortLabel: 'Homeowner',
    color: '#be185d',
    bgColor: '#fdf2f8',
    landingPage: '/lawn/homeowner/',
    ctaText: 'Get a Safe Lawn Plan',
    ctaHref: '/lawn/homeowner/',
  },
  maggie: {
    id: 'maggie',
    label: 'Market Gardener Maggie',
    shortLabel: 'Market Garden',
    color: '#a16207',
    bgColor: '#fefce8',
    landingPage: '/garden/',
    ctaText: 'Market Garden Soil Program',
    ctaHref: '/garden/',
  },
  sam: {
    id: 'sam',
    label: 'Septic Sam',
    shortLabel: 'Septic',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    landingPage: '/waste/',
    ctaText: 'Fix Septic Odor Fast',
    ctaHref: '/waste/',
  },
  general: {
    id: 'general',
    label: 'All Products',
    shortLabel: 'Browse',
    color: '#374151',
    bgColor: '#f3f4f6',
    landingPage: '/shop/',
    ctaText: 'Shop All Products',
    ctaHref: '/shop/',
  },
}

// =============================================================================
// STORAGE
// =============================================================================

const STORAGE_KEY = 'southland_persona'
const PERSONA_COOKIE = 'sl_persona'
const SEGMENT_COOKIE = 'sl_segment'
const COOKIE_DAYS = 365

function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  const domain = window.location.hostname.replace(/^www\./, '')
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; domain=.${domain}; SameSite=Lax`
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop()!.split(';').shift()!)
  }
  return null
}

// =============================================================================
// PERSONA GETTERS/SETTERS
// =============================================================================

/**
 * Get the stored persona data.
 * Handles legacy migration: 'backyard'→'betty', 'commercial'→'bill', 'lawn'→'taylor'
 */
export function getPersona(): PersonaData | null {
  if (typeof window === 'undefined') return null

  // Check localStorage first
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      const data = JSON.parse(stored) as PersonaData

      // Legacy migration: upgrade old IDs
      if (data.id && data.id in LEGACY_PERSONA_MAP) {
        data.id = LEGACY_PERSONA_MAP[data.id as string] as PersonaId
        data.segmentId = getSegmentForPersona(data.id!)
        // Rewrite with new ID
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        setCookie(PERSONA_COOKIE, data.id!, COOKIE_DAYS)
        setCookie(SEGMENT_COOKIE, data.segmentId, COOKIE_DAYS)
      }

      // Defensive: ensure segmentId is set and consistent
      if (data.id && data.id !== 'general') {
        const correctSegment = getSegmentForPersona(data.id)
        if (data.segmentId && data.segmentId !== correctSegment) {
          data.segmentId = correctSegment
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
          setCookie(SEGMENT_COOKIE, data.segmentId, COOKIE_DAYS)
        }
        if (!data.segmentId) {
          data.segmentId = correctSegment
        }
      }

      return data
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  // Check persona cookie fallback
  const cookieVal = getCookie(PERSONA_COOKIE)
  if (cookieVal) {
    // Handle legacy cookie values
    const personaId = LEGACY_PERSONA_MAP[cookieVal]
      ? (LEGACY_PERSONA_MAP[cookieVal] as PersonaId)
      : isValidPersonaId(cookieVal)
        ? (cookieVal as PersonaId)
        : null

    if (personaId) {
      const segmentId = getSegmentForPersona(personaId)
      const data: PersonaData = {
        id: personaId,
        segmentId,
        selectedAt: '',
        source: 'decision_engine',
      }
      // Rewrite to localStorage + updated cookie
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      setCookie(PERSONA_COOKIE, personaId, COOKIE_DAYS)
      setCookie(SEGMENT_COOKIE, segmentId, COOKIE_DAYS)
      return data
    }
  }

  // Check if we have a segment but no persona (homepage-level selection)
  const segmentCookie = getCookie(SEGMENT_COOKIE)
  if (segmentCookie && isValidSegmentId(segmentCookie)) {
    return {
      id: null,
      segmentId: segmentCookie as SegmentId,
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
 * Get the segment ID for the current visitor.
 * Returns segment even if no persona is set (homepage-level selection).
 */
export function getSegmentId(): SegmentId | null {
  const data = getPersona()
  return data?.segmentId ?? null
}

/**
 * Set the persona (from hub page selection or direct assignment)
 */
export function setPersona(
  personaId: Exclude<PersonaId, null>,
  source: PersonaData['source'] = 'manual',
): void {
  if (typeof window === 'undefined' || !personaId) return

  const segmentId = getSegmentForPersona(personaId)
  const data: PersonaData = {
    id: personaId,
    segmentId,
    selectedAt: new Date().toISOString(),
    source,
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  setCookie(PERSONA_COOKIE, personaId, COOKIE_DAYS)
  setCookie(SEGMENT_COOKIE, segmentId, COOKIE_DAYS)

  window.dispatchEvent(new CustomEvent('persona-changed', { detail: data }))
}

/**
 * Set the segment only (from homepage-level selection).
 * Does NOT set a persona — visitor routes to segment hub page for persona refinement.
 */
export function setSegment(
  segmentId: SegmentId,
  source: PersonaData['source'] = 'decision_engine',
): void {
  if (typeof window === 'undefined' || !segmentId) return

  const data: PersonaData = {
    id: null,
    segmentId,
    selectedAt: new Date().toISOString(),
    source,
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  setCookie(SEGMENT_COOKIE, segmentId, COOKIE_DAYS)
  // Do NOT set persona cookie — only segment is known

  window.dispatchEvent(new CustomEvent('persona-changed', { detail: data }))
}

/**
 * Clear the stored persona.
 * Preserves segment so visitor stays in segment-level experience.
 */
export function clearPersona(): void {
  if (typeof window === 'undefined') return

  const currentSegment = getSegmentId()

  // Clear persona but keep segment
  setCookie(PERSONA_COOKIE, '', -1)

  if (currentSegment && currentSegment !== 'general') {
    // Rewrite storage with segment only
    const data: PersonaData = {
      id: null,
      segmentId: currentSegment,
      selectedAt: new Date().toISOString(),
      source: 'manual',
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } else {
    localStorage.removeItem(STORAGE_KEY)
    setCookie(SEGMENT_COOKIE, '', -1)
  }

  window.dispatchEvent(new CustomEvent('persona-changed', { detail: null }))
}

// =============================================================================
// VALIDATORS
// =============================================================================

const VALID_PERSONA_IDS = Object.keys(PERSONA_CONFIG) as string[]

/**
 * Check if a string is a valid persona ID
 */
export function isValidPersonaId(value: string): value is Exclude<PersonaId, null> {
  return VALID_PERSONA_IDS.includes(value)
}

/**
 * Check if a string is a valid segment ID
 */
export function isValidSegmentId(value: string): value is SegmentId {
  return ['poultry', 'turf', 'waste', 'general'].includes(value)
}

// =============================================================================
// LOOKUPS
// =============================================================================

/**
 * Get the segment for a persona
 */
export function getSegmentForPersona(personaId: Exclude<PersonaId, null>): SegmentId {
  return PERSONA_TO_SEGMENT[personaId] ?? 'general'
}

/**
 * Get the config for a persona
 */
export function getPersonaConfig(personaId: PersonaId): PersonaConfig | null {
  if (!personaId) return null
  return PERSONA_CONFIG[personaId] ?? null
}

/**
 * Get the config for a segment
 */
export function getSegmentConfig(segmentId: SegmentId): SegmentConfig {
  return SEGMENT_CONFIG[segmentId] ?? SEGMENT_CONFIG.general
}

/**
 * Check if the current persona matches any of the given IDs
 */
export function isPersona(...personaIds: PersonaId[]): boolean {
  const currentId = getPersonaId()
  return personaIds.includes(currentId)
}

/**
 * Check if the current segment matches any of the given IDs
 */
export function isSegment(...segmentIds: SegmentId[]): boolean {
  const currentSegment = getSegmentId()
  return currentSegment !== null && segmentIds.includes(currentSegment)
}

/**
 * Get persona from URL parameter (for tracking links)
 * e.g., ?persona=bill or ?segment=poultry
 */
export function getPersonaFromUrl(): PersonaId {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const param = params.get('persona')

  if (param && isValidPersonaId(param)) {
    return param
  }

  // Legacy support
  if (param && param in LEGACY_PERSONA_MAP) {
    return LEGACY_PERSONA_MAP[param] as PersonaId
  }

  return null
}

/**
 * Get segment from URL parameter
 */
export function getSegmentFromUrl(): SegmentId | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const param = params.get('segment')

  if (param && isValidSegmentId(param)) {
    return param
  }

  return null
}

/**
 * Initialize persona from URL if present
 */
export function initPersonaFromUrl(): boolean {
  const urlPersona = getPersonaFromUrl()
  if (urlPersona) {
    setPersona(urlPersona, 'url_param')
    return true
  }

  const urlSegment = getSegmentFromUrl()
  if (urlSegment) {
    setSegment(urlSegment, 'url_param')
    return true
  }

  return false
}

// =============================================================================
// JOURNEY STAGES
// =============================================================================

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

export function getJourneyStage(): JourneyStage {
  const cookieVal = getCookie(STAGE_COOKIE_NAME)
  if (cookieVal && isValidJourneyStage(cookieVal)) {
    return cookieVal
  }
  return 'unaware'
}

export function setJourneyStage(stage: JourneyStage): void {
  if (typeof window === 'undefined') return
  setCookie(STAGE_COOKIE_NAME, stage, COOKIE_DAYS)
}

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
