# Lead Magnets — UX Specs & Implementation Plan

> Show value first. Capture second. Never gate the core utility.

This document covers the 4 lead magnets being built for southlandorganics.com, with UX specs informed by Perplexity research on quiz completion rates, form conversion benchmarks, and ag/turf industry patterns.

---

## Table of Contents

1. [Core Pattern](#core-pattern)
2. [Email Capture Ladder](#email-capture-ladder)
3. [Tool 1: Lawn Health Assessment Quiz](#tool-1-lawn-health-assessment-quiz)
4. [Tool 2: Product Comparison Tool](#tool-2-product-comparison-tool)
5. [Tool 3: Application Rate Calculator](#tool-3-application-rate-calculator)
6. [Tool 4: Talk to a Rep (Product Pages)](#tool-4-talk-to-a-rep)
7. [Existing Tools Status](#existing-tools-status)
8. [Analytics Events](#analytics-events)
9. [A/B Testing Priorities](#ab-testing-priorities)
10. [Benchmarks](#benchmarks)
11. [Nexus Integration](#nexus-integration)

---

## Core Pattern

Every tool follows the same philosophy:

1. **Ungated utility first** — show real value immediately
2. **Lightweight capture second** — email to save/send results
3. **Rep escalation for commercial intent** — threshold-triggered, not interruptive

This audience (farmers, superintendents, landscapers) expects fast agronomic helpers, not marketing funnels. Hard gates reduce trust in utility tools. Short quizzes and calculators with post-result opt-in produce the best balance of lead volume and lead quality at our scale.

**Optimize for qualified self-selection, not maximum raw volume.** Show results to everyone, capture email for saved results, escalate to rep only when behavior or quantity signals sales readiness.

---

## Email Capture Ladder

Progressive — don't ask for everything upfront:

| Level | What | When |
|-------|------|------|
| **1. No gate** | See core recommendation/output | Always — never hide results |
| **2. Email only** | "Save/send my results" | After results shown, before user leaves |
| **3. Name + phone + company** | Request rep contact or commercial quote | Only when user self-selects or quantity threshold |
| **4. Enrichment** | Behavior, source, product, quantity | Nexus does this automatically via scoring |

All tools POST to Nexus as fire-and-forget with honeypot + attribution.

---

## Tool 1: Lawn Health Assessment Quiz

**Goal:** 5-7 questions → personalized product recommendations for lawn care.

**Feel:** "Quick diagnosis from an agronomy helper" — not a marketing funnel.

### UX Spec

**Flow:** Multi-step wizard, one question per screen, progress bar.

| Screen | Question | Type | Notes |
|--------|----------|------|-------|
| Intro | "Find the right lawn plan in 60 seconds" | CTA button | Set expectation on time |
| Q1 | What's your main goal or problem? | Single-select cards | Greener lawn, weed control, bare spots, pest issues, general health, new lawn |
| Q2 | What region are you in? | Single-select | Southeast, Northeast, Midwest, Southwest, West, Pacific NW |
| Q3 | Sun or shade? | Single-select with icons | Full sun, Partial shade, Mostly shade |
| Q4 | How big is your lawn? | Chip selector | Under 2,000 sq ft, 2,000-5,000, 5,000-10,000, 10,000-20,000, 20,000+ |
| Q5 | How bad is the issue? | 3-point scale | Just starting / Moderate / Severe |
| Q6 | (Conditional) Do you have pets or kids? | Yes/No | Only if pest-related goal selected |
| Q7 | (Conditional) What type of grass? | Single-select | Bermuda, Fescue, Zoysia, St. Augustine, Not sure |
| Results | Diagnosis + recommendations | Full page | Show immediately, no gate |

**Question types:**
- Multiple choice / button cards for most (fastest, lowest friction)
- Image selection only where it reduces ambiguity (shade level, bare spots)
- Sliders only for severity — not for factual inputs like lawn size

**Results page:**
- Diagnosis summary ("Your lawn likely needs...")
- 2-3 recommended products with "why this product" rationale
- Application timing ("Best applied in...")
- Quantity shortcut (link to Application Rate Calculator)
- CTA buttons: "Add to Cart" + "Calculate How Much I Need"

**Email capture (below results):**
- Placement: after the first recommendation block, not before
- Card: "Email My Lawn Plan"
- Copy: "Get a seasonal plan + application timeline sent to your inbox"
- Fields: Email (required), First Name (optional)
- Honeypot + attribution

**Nexus payload:**
```json
{
  "source": "website_form",
  "form_type": "contact",
  "lead_type": "product_quiz",
  "email": "...",
  "first_name": "...",
  "message": "Lawn Quiz: Goal=weed_control, Region=southeast, Sun=partial, Size=5000-10000, Severity=moderate. Recommended: Genesis + South 40.",
  "gclid": "...", "utm_source": "...", "utm_medium": "...", "utm_campaign": "...",
  "landing_page": "/tools/lawn-quiz",
  "website": ""
}
```

**Lead score:** 20 (product_quiz)

### Completion Targets

| Metric | Target | Source |
|--------|--------|--------|
| Start-to-finish | 50-70% (warm traffic), 35-55% (mixed) | Outgrow/Interact benchmarks |
| Result-to-email | 10-25% | Estimated from value-based post-result opt-in patterns |

---

## Tool 2: Product Comparison Tool

**Goal:** Interactive comparison of biological vs. conventional approaches, framed as scenario-based decision support.

**Feel:** "Help me choose the right approach for my operation" — not "chemicals are bad."

### UX Spec

**Flow:** Scenario builder → comparison cards → evidence drawer.

**NOT a static "us vs. them" table as the primary experience.**

| Section | Content |
|---------|---------|
| **Scenario builder** (top) | 3-4 inputs: customer type (poultry/turf/lawn/ag), area/flock size band, goal (disease prevention, odor, soil health, growth), priority (cost, safety, long-term results) |
| **Comparison cards** (main) | Tailored cards showing: Recommended biological approach, Common conventional alternative, Key differences by OUTCOME (not ideology) |
| **Evidence drawer** (expandable) | Labels, FAQ, trial notes, extension citations, tech sheets |

**Comparison criteria (5-7 rows above fold):**

| Criteria | Biological | Conventional |
|----------|-----------|--------------|
| Application frequency | e.g., Monthly | e.g., Quarterly |
| Cost per acre/house | Calculated | Calculated |
| Re-entry/safety interval | None | 24-48 hours |
| Soil biology impact | Builds over time | May suppress |
| Odor management | Primary mechanism | Masking |
| Compatibility | Integrates with existing | May conflict |
| Long-term efficacy | Improves with use | Consistent but no compounding |

**Tone rules:**
- Compare on operational outcomes: odor, handling, compatibility, re-entry, turf stress risk, soil program fit
- Use "best fit when..." language instead of "better than chemicals"
- Acknowledge context: "Conventional options may act faster in some cases; biological programs support longer-term soil and system goals"
- Put recommendations in neutral agronomic voice

**Email capture:** Same pattern — below results, "Email this comparison" with scenario context included.

**Nexus payload:** `lead_type: 'lead_magnet'` (score 18)

**Rep escalation:** "Talk through my scenario" CTA at bottom, pre-filled with scenario inputs.

---

## Tool 3: Application Rate Calculator

**Goal:** Select product → enter area → get exact quantities + cost + add-to-cart.

**Feel:** Trust the output enough to buy the calculated quantity.

### UX Spec

**Flow:**

| Step | Input | UX |
|------|-------|-----|
| 1 | Select product | Dropdown with top 10-15 products |
| 2 | Select use case / preset | "1/4 acre lawn", "18-hole course", "4-house poultry farm" |
| 3 | Enter area | Number input with unit toggle (sq ft ↔ acres ↔ houses) |
| 4 | See results | Instant — no submit button needed |

**Output:**
- **Single recommended quantity** (not a range — reduces decision burden)
- Expandable "min-max range" for conditions where label rates vary
- Number of containers to purchase (rounds up)
- Estimated cost at retail
- Application frequency recommendation
- "How we calculated this" expandable showing rate assumptions
- Direct "Add to Cart" button for calculated quantity
- Label/tech sheet link for verification

**Trust elements (priority order):**
1. Unit toggle (sq ft / acres / houses) — no page refresh
2. "How we calculated this" expandable line
3. Common presets matching real customer scenarios
4. Packaging logic: "You need 3 gallons; this covers 12,000 sq ft with 8% overage"
5. "Typical range" microcopy where rates vary
6. Direct label/tech-sheet link

**Commercial threshold:**
- If calculated quantity > 10 gallons or > $500, replace primary CTA with "Request Pallet/Commercial Pricing"
- Keep secondary "Add sample/initial qty to cart"
- Pre-fill product, quantity, unit, use case into rep form

**Email capture:** "Save Your Application Plan" below results — email only.

**Nexus payload:** `lead_type: 'roi_calculator'` (score 22)

---

## Tool 4: Talk to a Rep

**Goal:** Inline "get help" form on every product page, pre-filled with the product being viewed.

**Feel:** Service-oriented, not sales-qualified. "Get application help from a product specialist."

### UX Spec

**Placement:**
- **Desktop:** Button-expanded inline form below Add to Cart / price / application details
- **Mobile:** Sticky bottom "Need help?" button → expands into inline drawer (not modal)
- **Never:** Exit-intent popup (feels aggressive for serious buyers)

**Trigger:** User-initiated button by default. Contextual emphasis after calculator threshold or repeated spec interaction.

**Fields:**

| Field | Required | Notes |
|-------|----------|-------|
| Name | Yes | First + last |
| Email | Yes | |
| Phone | Optional (DTC), Encouraged (B2B) | |
| Company | Optional (DTC), Required (commercial pages) | |
| Message | Optional | Pre-filled: "I have a question about [Product Name]" |
| Hidden: product, SKU, page URL, quantity, UTM/gclid | Auto | |

**Trust copy (test these):**
- "Get application help from a product specialist"
- "Average response: under 2 business hours" (only if operationally reliable)
- "We'll reach out about [Product Name]" (personalized)

**Nexus payload:**
```json
{
  "source": "website_form",
  "form_type": "contact",
  "lead_type": "lead_magnet",
  "email": "...",
  "first_name": "...",
  "phone": "...",
  "company": "...",
  "message": "Product inquiry: [Product Name] ([SKU]). [User message]",
  "gclid": "...", "utm_source": "...",
  "landing_page": "/products/[handle]",
  "website": ""
}
```

**Lead score:** 18 (lead_magnet)

---

## Existing Tools Status

| Tool | URL | Captures Lead? | Posts to Nexus? | Action Needed |
|------|-----|---------------|-----------------|---------------|
| Erosion Control Calculator | `/erosion-control-seed-calculator/` | No | No | Add "Save Your Recommendation" email capture below results |
| Build-a-Case (bundle) | `/build-a-case/` | No (checkout only) | No | Low priority — transactional tool |
| Contact Form | `/contact/` | Yes | Yes (dual-write) | Working ✅ |
| Distribution Form | `/distribution/` | Yes | Yes (dual-write) | Working ✅ |
| Email Capture | Footer, podcasts, blog | Email only | No (Klaviyo only) | Consider adding Nexus POST |
| Outcome Surveys | `/survey/backyard/`, `/survey/commercial/` | Post-purchase | No (BigQuery/point.dog) | Not a lead magnet |

---

## Analytics Events

Track step-by-step behavior, not just submissions.

### Shared events (all tools)

| Event | Properties |
|-------|-----------|
| `tool_viewed` | tool_name, page_url |
| `tool_started` | tool_name, entry_point |
| `step_completed` | tool_name, step_number, step_name, answer_value |
| `tool_completed` | tool_name, result_summary, time_elapsed_seconds |
| `result_viewed` | tool_name, result_type, products_shown |
| `email_capture_viewed` | tool_name, placement |
| `email_submitted` | tool_name, has_phone, has_name |
| `rep_form_opened` | tool_name, trigger (button/threshold/auto) |
| `rep_form_submitted` | tool_name, product_context, has_company |
| `add_to_cart_clicked` | tool_name, product_handle, quantity, calculated_cost |

### Quiz-specific events

| Event | Properties |
|-------|-----------|
| `quiz_question_answered` | question_id, answer_value, time_on_question |
| `quiz_branch_taken` | from_question, to_question, condition |
| `quiz_result_product_clicked` | product_handle, position_in_list |

### Calculator-specific events

| Event | Properties |
|-------|-----------|
| `calculator_product_selected` | product_handle |
| `calculator_preset_used` | preset_name |
| `calculator_unit_switched` | from_unit, to_unit |
| `calculator_threshold_crossed` | quantity, estimated_cost |

### Comparison-specific events

| Event | Properties |
|-------|-----------|
| `comparison_scenario_set` | customer_type, area, goal, priority |
| `comparison_evidence_expanded` | criteria_name |
| `comparison_cta_clicked` | cta_type (calculator/rep/cart) |

---

## A/B Testing Priorities

Test the highest-leverage structural choice first, not button color.

### Quiz

1. Email capture location: immediately under summary vs below product recommendations
2. 5 questions vs 7 questions with branching
3. Card answers vs mixed cards/images for diagnostic screens
4. CTA: "Get my plan" vs "See recommendations"

### Comparison

1. Scenario-builder-first vs side-by-side-table-first
2. Outcome labels: "Best fit for your goal" vs "Compare options"
3. Cost-over-time module shown by default vs behind expand

### Calculator

1. Presets shown first vs manual entry first
2. Single recommendation vs single + expandable range
3. Add-to-cart as primary CTA vs "Review recommendation" first

### Rep Form

1. Inline expansion near buy box vs sticky bottom on mobile
2. 3 fields vs 5 fields for commercial pages
3. Trust copy shown vs hidden (response time promise)

---

## Benchmarks

| Pattern | Benchmark | Source |
|---------|-----------|--------|
| Short quiz completion (3-7 questions) | 65-85% | Outgrow (general, not ag-specific) |
| Product recommendation quiz completion | 40-60% | Outgrow |
| Quiz start-to-finish average | 55.5% | Interact (cross-industry) |
| Quiz start-to-lead average | 37.6% | Interact |
| Popup form conversion | 3.09% avg, 9.28% top 10% | IvyForms/Sumo |
| Inline form conversion | 2-5% typical | IvyForms |
| Form completion uplift from exclusivity wording | +10.6% | Typeform |

**Note:** These are general B2B/DTC benchmarks, not agriculture-specific. Use directionally.

---

## Nexus Integration

All tools use the same Nexus integration pattern:

### POST pattern
```javascript
// Fire-and-forget — never block user experience
const honeypot = formData.get('website')
if (honeypot) return // Bot detected

fetch('https://nexus.southlandorganics.com/api/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    source: 'website_form',
    form_type: 'contact', // or 'distribution' for B2B tools
    lead_type: 'product_quiz', // or 'roi_calculator', 'erosion_calculator', 'lead_magnet'
    email: '...',
    first_name: '...',
    phone: '...',
    company: '...',
    message: 'Tool results context here',
    gclid: sessionStorage.getItem('sl_gclid') || null,
    utm_source: sessionStorage.getItem('sl_utm_source') || null,
    utm_medium: sessionStorage.getItem('sl_utm_medium') || null,
    utm_campaign: sessionStorage.getItem('sl_utm_campaign') || null,
    landing_page: sessionStorage.getItem('sl_landing_page') || window.location.pathname,
    website: '', // honeypot — must be empty
  }),
}).catch(() => {}) // Silent fail
```

### Lead types and scores (registered in Nexus)

| Lead Type | Score | Use For |
|-----------|-------|---------|
| `erosion_calculator` | 22 | Erosion control seed calculator |
| `roi_calculator` | 22 | Application rate calculator, cost comparisons |
| `product_quiz` | 20 | Lawn health quiz, product recommendation quizzes |
| `lead_magnet` | 18 | Generic — request sample, talk to rep, comparison tool |

### What Nexus does automatically

- Composite scoring (Fit + Intent + Engagement) on creation
- Auto-assignment to sales rep (phone match or BU round-robin)
- Funnel stage promotion (score ≥50 = MQL, ≥80 = SQL-ready)
- HubSpot lifecycle sync
- SLA timer starts
- Appears in leads inbox with score breakdown

---

## Related

- [Lead Scoring SOP](LEAD-SCORING-SOP.md) — How scoring and qualification works
- [uARZO Flow](UARZO-FLOW.md) — Full customer journey framework
- [uARZO Playbook](UARZO-PLAYBOOK.md) — Stage-by-stage messaging

---

**Cross-repo note:** This doc is mirrored at `~/CODING/southland-inventory/docs/LEAD-MAGNETS.md`. If you update this copy, sync the other. This repo (southland-platform) builds the tools; Nexus receives the leads.

*Last updated: 2026-04-05*
