/**
 * Lead Capture Utilities
 *
 * Shared utilities for all lead magnet tools:
 * - Nexus POST helper (fire-and-forget)
 * - Attribution capture (UTM, gclid, landing page)
 * - Analytics event tracking (tool-specific GA4 events)
 *
 * Pattern: Show value first, capture second, never gate core utility.
 */

// =============================================================================
// TYPES
// =============================================================================

export type LeadType = 'erosion_calculator' | 'roi_calculator' | 'product_quiz' | 'lead_magnet'

export type FormType = 'contact' | 'distribution'

export interface NexusLeadPayload {
  source: 'website_form'
  form_type: FormType
  lead_type: LeadType
  email: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  company?: string | null
  message: string
  gclid?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  landing_page?: string | null
  website: '' // honeypot — must be empty
}

export interface Attribution {
  gclid: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  landing_page: string
}

// =============================================================================
// ATTRIBUTION
// =============================================================================

/** Collect attribution from sessionStorage + localStorage fallback */
export function getAttribution(): Attribution {
  if (typeof window === 'undefined') {
    return {
      gclid: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      landing_page: '/',
    }
  }

  const gclid =
    sessionStorage.getItem('sl_gclid') ||
    (() => {
      try {
        const raw = localStorage.getItem('_pd_attribution')
        return raw ? JSON.parse(raw).gclid : null
      } catch {
        return null
      }
    })() ||
    null

  return {
    gclid,
    utm_source: sessionStorage.getItem('sl_utm_source') || null,
    utm_medium: sessionStorage.getItem('sl_utm_medium') || null,
    utm_campaign: sessionStorage.getItem('sl_utm_campaign') || null,
    landing_page: sessionStorage.getItem('sl_landing_page') || window.location.pathname,
  }
}

// =============================================================================
// HONEYPOT
// =============================================================================

/** Returns true if the honeypot field is filled (bot detected) */
export function isBot(formData: FormData): boolean {
  return !!formData.get('website')
}

// =============================================================================
// NEXUS POST
// =============================================================================

const NEXUS_LEADS_URL = 'https://nexus.southlandorganics.com/api/leads'

/**
 * Fire-and-forget POST to Nexus. Never blocks user experience.
 *
 * Why fetch+keepalive instead of sendBeacon: sendBeacon with a JSON Blob
 * triggers a CORS preflight that the beacon queue can't issue, so Chrome
 * silently returns true but drops the request and Safari refuses outright.
 * This caused ~2 days of form submissions (Apr 21–23 2026) to reach
 * HubSpot Collected Forms but never land in Nexus. `fetch(…, { keepalive: true })`
 * is the modern replacement — it survives page navigation just like sendBeacon
 * but handles preflights correctly. keepalive bodies are capped at 64KB (well
 * above our payload size).
 */
export function postToNexus(payload: NexusLeadPayload): void {
  const body = JSON.stringify(payload)

  if (typeof fetch !== 'undefined') {
    fetch(NEXUS_LEADS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
    return
  }

  // Ancient-browser fallback. text/plain avoids CORS preflight entirely; the
  // Nexus endpoint accepts either content type.
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(NEXUS_LEADS_URL, new Blob([body], { type: 'text/plain' }))
  }
}

/** Build and send a lead to Nexus with attribution auto-filled */
export function submitLead(opts: {
  leadType: LeadType
  formType?: FormType
  email: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  company?: string | null
  message: string
}): void {
  const attribution = getAttribution()
  postToNexus({
    source: 'website_form',
    form_type: opts.formType ?? 'contact',
    lead_type: opts.leadType,
    email: opts.email,
    first_name: opts.firstName ?? null,
    last_name: opts.lastName ?? null,
    phone: opts.phone ?? null,
    company: opts.company ?? null,
    message: opts.message,
    ...attribution,
    website: '',
  })
}

// =============================================================================
// ANALYTICS EVENTS
// =============================================================================

interface DataLayerEvent {
  event: string
  [key: string]: unknown
}

function pushEvent(evt: DataLayerEvent): void {
  if (typeof window === 'undefined') return
  const w = window as unknown as { dataLayer?: DataLayerEvent[] }
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push(evt)
}

// --- Shared tool events ---

export function trackToolViewed(toolName: string): void {
  pushEvent({
    event: 'tool_viewed',
    tool_name: toolName,
    page_url: window.location.pathname,
  })
}

export function trackToolStarted(toolName: string, entryPoint?: string): void {
  pushEvent({
    event: 'tool_started',
    tool_name: toolName,
    entry_point: entryPoint ?? 'direct',
  })
}

export function trackStepCompleted(
  toolName: string,
  stepNumber: number,
  stepName: string,
  answerValue?: string
): void {
  pushEvent({
    event: 'step_completed',
    tool_name: toolName,
    step_number: stepNumber,
    step_name: stepName,
    answer_value: answerValue,
  })
}

export function trackToolCompleted(
  toolName: string,
  resultSummary: string,
  timeElapsed?: number
): void {
  pushEvent({
    event: 'tool_completed',
    tool_name: toolName,
    result_summary: resultSummary,
    time_elapsed_seconds: timeElapsed,
  })
}

export function trackResultViewed(
  toolName: string,
  resultType: string,
  productsShown?: string[]
): void {
  pushEvent({
    event: 'result_viewed',
    tool_name: toolName,
    result_type: resultType,
    products_shown: productsShown,
  })
}

export function trackEmailCaptureViewed(toolName: string, placement: string): void {
  pushEvent({
    event: 'email_capture_viewed',
    tool_name: toolName,
    placement,
  })
}

export function trackEmailSubmitted(toolName: string, hasPhone: boolean, hasName: boolean): void {
  pushEvent({
    event: 'email_submitted',
    tool_name: toolName,
    has_phone: hasPhone,
    has_name: hasName,
  })
}

export function trackRepFormOpened(
  toolName: string,
  trigger: 'button' | 'threshold' | 'auto'
): void {
  pushEvent({
    event: 'rep_form_opened',
    tool_name: toolName,
    trigger,
  })
}

export function trackRepFormSubmitted(
  toolName: string,
  productContext?: string,
  hasCompany?: boolean
): void {
  pushEvent({
    event: 'rep_form_submitted',
    tool_name: toolName,
    product_context: productContext,
    has_company: hasCompany,
  })
}

export function trackAddToCartClicked(
  toolName: string,
  productHandle: string,
  quantity: number,
  calculatedCost?: number
): void {
  pushEvent({
    event: 'add_to_cart_clicked',
    tool_name: toolName,
    product_handle: productHandle,
    quantity,
    calculated_cost: calculatedCost,
  })
}

// --- Calculator-specific events ---

export function trackCalculatorProductSelected(productHandle: string): void {
  pushEvent({
    event: 'calculator_product_selected',
    product_handle: productHandle,
  })
}

export function trackCalculatorPresetUsed(presetName: string): void {
  pushEvent({
    event: 'calculator_preset_used',
    preset_name: presetName,
  })
}

export function trackCalculatorUnitSwitched(fromUnit: string, toUnit: string): void {
  pushEvent({
    event: 'calculator_unit_switched',
    from_unit: fromUnit,
    to_unit: toUnit,
  })
}

export function trackCalculatorThresholdCrossed(quantity: number, estimatedCost: number): void {
  pushEvent({
    event: 'calculator_threshold_crossed',
    quantity,
    estimated_cost: estimatedCost,
  })
}

// --- Quiz-specific events ---

export function trackQuizQuestionAnswered(
  questionId: string,
  answerValue: string,
  timeOnQuestion?: number
): void {
  pushEvent({
    event: 'quiz_question_answered',
    question_id: questionId,
    answer_value: answerValue,
    time_on_question: timeOnQuestion,
  })
}

export function trackQuizBranchTaken(
  fromQuestion: string,
  toQuestion: string,
  condition: string
): void {
  pushEvent({
    event: 'quiz_branch_taken',
    from_question: fromQuestion,
    to_question: toQuestion,
    condition,
  })
}

export function trackQuizResultProductClicked(productHandle: string, position: number): void {
  pushEvent({
    event: 'quiz_result_product_clicked',
    product_handle: productHandle,
    position_in_list: position,
  })
}

// --- Comparison-specific events ---

export function trackComparisonScenarioSet(scenario: {
  customerType: string
  area: string
  goal: string
  priority: string
}): void {
  pushEvent({
    event: 'comparison_scenario_set',
    customer_type: scenario.customerType,
    area: scenario.area,
    goal: scenario.goal,
    priority: scenario.priority,
  })
}

export function trackComparisonEvidenceExpanded(criteriaName: string): void {
  pushEvent({
    event: 'comparison_evidence_expanded',
    criteria_name: criteriaName,
  })
}

export function trackComparisonCtaClicked(ctaType: 'calculator' | 'rep' | 'cart'): void {
  pushEvent({
    event: 'comparison_cta_clicked',
    cta_type: ctaType,
  })
}
