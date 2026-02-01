# Southland Organics CDP Playbook

> **Version:** 1.0
> **Created:** February 2026
> **Status:** Strategic Plan - Ready for Implementation

---

## Executive Summary

This playbook defines the comprehensive Customer Data Platform (CDP) strategy for Southland Organics, combining:

- **Persona-based segmentation** (4 defined customer archetypes)
- **Hero Journey stage tracking** (10 stages from unAware to Evangelist)
- **Vector-powered content matching** (semantic search and recommendations)
- **Real-time personalization** (Reality Tunnels serving persona × stage content)
- **Outcome tracking** (FCR, mortality, problem-solved metrics as proof points)

The goal: Transform southlandorganics.com from a generic e-commerce site into a **persona-aware, journey-stage-intelligent platform** that serves the right content to the right customer at the right time.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The Four Personas](#2-the-four-personas)
3. [The Hero Journey Stages](#3-the-hero-journey-stages)
4. [Persona × Stage Content Matrix](#4-persona--stage-content-matrix)
5. [Site Structure & Navigation](#5-site-structure--navigation)
6. [CDP Technical Implementation](#6-cdp-technical-implementation)
7. [The Five CDP-Powered Features](#7-the-five-cdp-powered-features)
8. [Event Schema & Data Model](#8-event-schema--data-model)
9. [Outcome Tracking System](#9-outcome-tracking-system)
10. [Content Gap Analysis](#10-content-gap-analysis)
11. [Access Ladder & Funnel Metrics](#11-access-ladder--funnel-metrics)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Guardrails & Constraints](#13-guardrails--constraints)
14. [Appendix: SQL Queries](#14-appendix-sql-queries)

---

## 1. Architecture Overview

### The Complete Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ACTIVATION LAYER                            │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │    Astro    │  │   Shopify   │  │ Cloudflare  │  │  Klaviyo  │  │
│  │  (content)  │  │ (commerce)  │  │   (edge)    │  │  (email)  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ reads persona + stage
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                        REAL-TIME LAYER                              │
│                                                                     │
│           Cloudflare Workers + KV (persona/stage cache)             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Visitor arrives → Worker scores → KV caches → Site reads   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ scores events against embeddings
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                          CDP BRAIN                                  │
│                                                                     │
│                    BigQuery (source of truth)                       │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  Events  │  │ Personas │  │ Outcomes │  │ Vectors  │           │
│  │ (pixel)  │  │ (scores) │  │(FCR,etc) │  │(embeds)  │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Journey  │  │  Ladder  │  │   Gap    │  │ Negative │           │
│  │  Stages  │  │  Rungs   │  │ Analysis │  │ Signals  │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ syncs from
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                        SOURCE SYSTEMS                               │
│                                                                     │
│  Shopify  │  Supabase  │  Apify (crawl)  │  Typeform  │  Sales CRM │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Website Visit
     │
     ├─→ pd-pixel fires events
     │        │
     │        ▼
     │   Cloudflare Worker
     │        │
     │        ├─→ Compute persona score (vector similarity)
     │        ├─→ Detect journey stage (behavioral signals)
     │        ├─→ Cache in KV (24hr TTL)
     │        └─→ Forward to BigQuery
     │
     ├─→ Site reads KV at edge
     │        │
     │        └─→ Serve persona × stage content (Reality Tunnel)
     │
     └─→ User takes action
              │
              ├─→ Guide completed → Explicit persona + stage
              ├─→ Purchase → Stage = test_prep
              ├─→ Survey response → Stage = success (or not)
              └─→ Referral → Stage = evangelist
```

### Existing Infrastructure (Already Built)

| Component | Location | Status |
|-----------|----------|--------|
| Vector embeddings (1536-dim) | Supabase `website_content`, `products`, `brand_knowledge` | ✅ Active |
| Semantic search functions | Supabase `search_website_content()`, `find_content_for_persona()` | ✅ Active |
| Apify crawler | Weekly crawl, 1000 pages | ✅ Active |
| BigQuery CDP | `southland-warehouse.cdp` | ✅ Active |
| Persona definitions | Supabase `personas` table | ✅ Active |
| PMax campaign mapping | 10 campaigns configured | ✅ Active |
| Audience exports | CSV files in Mothership | ✅ Active |

---

## 2. The Four Personas

### Overview

| Persona | Audience % | Avg LTV | Primary Channel | Status |
|---------|------------|---------|-----------------|--------|
| **Broiler Bill** | 44% | $903 | Phone (bulk) | ✅ Labeled |
| **Backyard Betty** | 42% | $77 | Online (Shopify) | ✅ Labeled |
| **Turf Pro Taylor** | 8% | TBD | Online | ⏳ Pending |
| **Mold Molly** | 6% | TBD | Online | ⏳ Pending |

---

### Persona 1: Broiler Bill

**The Commercial Poultry Operator**

#### Demographics
- **Age:** 35-65
- **Location:** Southeast US (GA, TX, NC, PA, OH, IN)
- **Operation:** 50,000+ birds, commercial integrator
- **Decision Style:** Data-driven, ROI-focused

#### Values
- Efficiency and profitability
- Proven solutions with measurable results
- Biosecurity and compliance
- Flock health that impacts the bottom line

#### Pain Points
- Gut health management affecting FCR
- Ammonia control in houses
- Antibiotic alternatives (regulatory pressure)
- Litter quality degradation
- Mortality spikes

#### Fears
- Disease outbreaks
- FDA compliance issues
- Settlement ranking drops
- Cost overruns affecting margins

#### Trust Signals
- University research
- Field trial data
- Other farmers' proven results
- Veterinarian recommendations
- Measurable performance metrics

#### Keywords Used
- FCR, feed conversion ratio
- Mortality rates, settlement rankings
- Gut health, probiotics
- Biosecurity, USDA approved
- Commercial poultry, integrator

#### Purchase Behavior
- **Channel:** Phone calls for bulk orders (34% of revenue)
- **Frequency:** ~45 day cadence
- **Order Size:** $200-$2,000+
- **Products:** Hen Helper (48x ROAS), Big Ole Bird (10.97x ROAS), Catalyst (6.62x ROAS)

#### Content Preferences
- Technical language
- Data sheets and research papers
- ROI calculators
- Case studies with hard numbers
- Direct sales contact

#### Site Experience Needs
- Phone number prominent in header
- Bulk pricing visible
- Data sheets easily accessible
- Commercial-specific landing page
- Sales team consultation CTA

---

### Persona 2: Backyard Betty

**The Hobby Flock Owner**

#### Demographics
- **Age:** 25-55 (broader range)
- **Location:** Suburban/rural, nationwide (CA, FL, NY, WA over-indexed)
- **Operation:** Under 50 birds, backyard/hobby
- **Decision Style:** Emotional, community-influenced

#### Values
- Organic and natural products
- Chicken health and happiness
- Sustainable practices
- Simplicity in care
- Community connection

#### Pain Points
- Basic chicken health issues (soft shells, lethargy)
- Keeping flock healthy naturally
- Simple supplement programs
- Affordable solutions for small operations
- Easy application and dosing

#### Fears
- Sick or dying chickens
- Antibiotics and chemicals in products
- Overly complex supplement regimens
- High costs for small flocks
- Making mistakes as a new chicken owner

#### Trust Signals
- Customer testimonials and reviews
- Simple, clear instructions
- Organic certifications
- Small business story
- Facebook group community

#### Keywords Used
- Backyard chickens, hobby poultry
- Organic, natural, safe
- Supplements, probiotics
- Small flock, pet chickens
- Egg production, healthy hens

#### Purchase Behavior
- **Channel:** Online/Shopify
- **Frequency:** Seasonal (peak in spring/summer)
- **Order Size:** $20-$100
- **Products:** Starter bundles, Hen Helper 16oz, Big Ole Bird

#### Content Preferences
- Friendly, approachable tone
- Simple guides and FAQs
- Community stories and testimonials
- Visual content (photos, videos)
- "Happy, healthy hens" messaging

#### Site Experience Needs
- Beginner-friendly navigation
- Bundle deals highlighted
- Simple product descriptions
- Community/testimonial sections
- Chat or email support

---

### Persona 3: Turf Pro Taylor

**The Lawn Care Professional/Enthusiast**

#### Demographics
- **Age:** 30-60
- **Location:** Nationwide, over-indexed in South
- **Role:** Landscaper, lawn care business owner, or serious homeowner
- **Decision Style:** Results-focused, professional

#### Values
- Professional-grade results
- Organic/sustainable solutions
- Efficiency (time and cost)
- Reputation and quality

#### Pain Points
- Fire ant infestations
- Lawn damage (dog spots, disease)
- Chemical-free solutions for clients
- Effective organic alternatives

#### Products
- Torched Fire Ant Killer
- Dog Spot Lawn Repair
- Future: soil amendments

#### Status
⏳ Pending CDP labeling - requires heuristic rules in BigQuery

---

### Persona 4: Mold Molly

**The Sanitization Specialist**

#### Demographics
- **Role:** Property manager, facilities manager, remediation professional
- **Need:** Mold, mildew, sanitization solutions

#### Products
- D2 Sanitizers brand
- Alpet products
- PAA solutions

#### Status
⏳ Pending CDP labeling - separate brand (D2 Sanitizers)

---

### Persona Operating Rules

**Every page, campaign, email, and product MUST answer:**

1. **Which persona is this for?**
2. **Which journey stage does it serve?**

**If it doesn't clearly map → kill it or merge it.**

---

## 3. The Hero Journey Stages

### The 10 Stages

Traditional buyer's journeys start with "awareness" but immediately break into those who know they have a problem and those who don't. We dive directly into the breaking points.

```
PRE-PURCHASE                          POST-PURCHASE
─────────────────────────────────────────────────────────────────────

unAware → Aware → Receptive → ZMOT → Objections → Test Prep → Challenge → Success → Commitment → Evangelist
   │        │         │         │        │            │           │          │          │           │
   │        │         │         │        │            │           │          │          │           └─ Promotes products
   │        │         │         │        │            │           │          │          └─ Repeat buyer
   │        │         │         │        │            │           │          └─ Achieved outcome
   │        │         │         │        │            │           └─ Using product, attacking problem
   │        │         │         │        │            └─ Purchased, preparing to implement
   │        │         │         │        └─ Narrowing choices, has questions
   │        │         │         └─ Researching guides, comparing options
   │        │         └─ Knows solution, not convinced it's worth it
   │        └─ Knows problem, doesn't know solution
   └─ Doesn't know they have a problem
```

---

### Stage Definitions

#### Stage 1: unAware

**Definition:** Part of target demographic but doesn't yet know they have a problem.

**Content Strategy:** Create content highlighting issues they could face as a result of not taking action.

**Examples:**
- A poultry farmer who doesn't know bacteria causes health problems in their houses
- A homeowner who doesn't realize natural oils can effectively kill insects

**Observable Signals:**
- Landed from broad search, social, or display ads
- No problem-related queries
- Browsing generally, no specific intent

**Content Types:**
- Educational blogs about hidden problems
- "Did you know..." content
- Podcast episodes on industry issues
- Social content highlighting problems

---

#### Stage 2: Aware

**Definition:** Knows they have a problem but doesn't know the solution.

**Content Strategy:**
- Name the desire
- Prove the solution exists
- Illustrate that we understand their problem
- Show the mechanism of accomplishment

**Observable Signals:**
- Searching symptoms/problems ("runny poop chickens", "ammonia smell coop")
- Reading problem-focused content
- Asking questions in community

**Content Types:**
- "Why this happens" guides
- Problem-solution articles
- Symptom explainers
- "How probiotics fix gut health" content

---

#### Stage 3: Receptive

**Definition:** Knows the product and benefits exist but hasn't crystallized them into a need. Doesn't fully feel the effort is worth the result.

**Content Strategy:**
- Deepen the pain
- Convince them ignoring the situation makes it worse
- Show that life cannot go on as-is

**Observable Signals:**
- Viewed solution content but hasn't engaged deeper
- Read guide but no calculator/cart/guide action
- Multiple sessions without progression

**Content Types:**
- "What happens if you ignore this" content
- Cost-of-inaction calculators
- Urgency-building case studies
- "Life without solving this" stories

---

#### Stage 4: ZMOT (Zero Moment of Truth)

**Definition:** Committed to the journey. Researching all potential guides to lead them to the promised land.

**Content Strategy:**
- Position as the trusted guide
- Provide comparison content
- Showcase expertise and credibility

**Observable Signals:**
- Comparing products/brands
- Reading testimonials and reviews
- Using calculators and tools
- Multiple sessions, deepening engagement

**Content Types:**
- Comparison guides ("Southland vs alternatives")
- Expert positioning content
- Tool/calculator experiences
- Detailed case studies
- "Why choose us" content

---

#### Stage 5: Objections

**Definition:** Narrowing down guide choices. Sees you as viable but has questions. What are those questions? Why are you the guide?

**Content Strategy:**
- Answer specific objections
- Provide guarantees and risk reversal
- Offer proof points and data

**Observable Signals:**
- Viewing specific product pages repeatedly
- Reading FAQ content
- Viewing pricing pages
- Cart abandonment
- Contact form started but not submitted

**Content Types:**
- FAQ pages (persona-specific)
- Guarantee and return policy
- Data sheets and specifications
- "Is this safe?" content
- Pricing transparency
- Customer support availability

---

#### Stage 6: Test Prep

**Definition:** Made their choice but might still bail after paying. Testing the waters on committing to the journey. Gathering supplementations and preparing to implement.

**Content Strategy:**
- Reinforce decision
- Prepare them for success
- Reduce buyer's remorse

**Observable Signals:**
- Order confirmed
- Pre-delivery window (0-7 days)
- Opening confirmation emails

**Content Types:**
- Order confirmation with value reinforcement
- "What to expect" guides
- Preparation checklists
- "How to get the most from your order"
- Welcome sequences

---

#### Stage 7: Challenge

**Definition:** The real test. They attack the problem.

**Content Strategy:**
- Support their implementation
- Define success metrics
- Provide troubleshooting
- Check in on progress

**Key Questions:**
- Have you defined success?
- What is the best possible outcome?
- What is the minimum outcome to be deemed a success?

**Observable Signals:**
- 7-60 days post-delivery
- Opening support emails
- Visiting help/support content
- Potential return/refund inquiry

**Content Types:**
- "Week 1: What you should be seeing"
- Troubleshooting guides
- Application tips
- Check-in email sequences
- Support availability

---

#### Stage 8: Success

**Definition:** They achieved success. Do they agree? Do you agree? What's next?

**Content Strategy:**
- Capture the outcome
- Celebrate the win
- Introduce next steps
- Request testimonial/review

**Observable Signals:**
- Positive survey response
- Review submitted
- Reorder initiated
- Engagement with "what's next" content

**Content Types:**
- Outcome capture survey
- Celebration messaging
- "What's next for your flock" content
- Review/testimonial request
- Cross-sell recommendations

---

#### Stage 9: Commitment

**Definition:** Bought in. Committed to continue repurchasing.

**Content Strategy:**
- Reward loyalty
- Deepen relationship
- Introduce premium options
- Build community connection

**Observable Signals:**
- 2+ orders
- Subscription/auto-ship active
- Bulk account inquiry
- High engagement with content

**Content Types:**
- Loyalty program
- Auto-ship/subscription offers
- Bulk pricing for high-volume
- Early access to new products
- VIP community access

---

#### Stage 10: Evangelist

**Definition:** They promote our products to others.

**Content Strategy:**
- Enable and reward promotion
- Capture UGC
- Co-marketing opportunities
- Ambassador program

**Observable Signals:**
- Referral code used
- UGC submitted
- Testimonial approved for public use
- Social sharing
- Community leadership

**Content Types:**
- Ambassador/referral program
- UGC campaigns
- Co-marketing opportunities
- Community leadership roles
- Public testimonial features

---

### Stage Detection Logic

```typescript
function detectJourneyStage(visitor: VisitorData): JourneyStage {
  const {
    hasOrdered,
    orderCount,
    daysSinceFirstOrder,
    hasSubmittedReview,
    hasReferredOthers,
    outcomeReported,
    outcomePositive,
    pagesViewed,
    searchQueries,
    cartAbandoned,
    toolsUsed,
    hasBulkAccount
  } = visitor;

  // POST-PURCHASE STAGES (explicit signals)
  if (hasReferredOthers || hasSubmittedReview) return 'evangelist';
  if (orderCount >= 3 || hasBulkAccount) return 'commitment';
  if (outcomeReported && outcomePositive) return 'success';
  if (hasOrdered && daysSinceFirstOrder >= 7 && daysSinceFirstOrder <= 60) return 'challenge';
  if (hasOrdered && daysSinceFirstOrder < 7) return 'test_prep';

  // PRE-PURCHASE STAGES (inferred from behavior)
  if (cartAbandoned || viewedFAQ || viewedPricing || repeatProductPageViews) return 'objections';
  if (viewedTestimonials || viewedComparison || usedCalculator || multipleSessions) return 'zmot';
  if (viewedSolutionContent && !engagedDeeper) return 'receptive';
  if (searchedProblemTerms || viewedProblemContent) return 'aware';

  return 'unaware';
}
```

---

## 4. Persona × Stage Content Matrix

### Broiler Bill Content Map

| Stage | Content Type | Example Title | CTA |
|-------|--------------|---------------|-----|
| **unAware** | Educational blog, podcast | "The Hidden Cost of Poor Gut Health in Commercial Flocks" | "Calculate your potential loss →" |
| **Aware** | Problem-solution guide | "Why FCR Drops and How Probiotics Fix It" | "See the research →" |
| **Receptive** | Pain amplification + ROI | "A 0.05 FCR Improvement = $X per House per Year" | "Talk to our commercial team →" |
| **ZMOT** | Comparison, case studies | "Southland vs Synthetic Antibiotics: The Data" | "Request bulk pricing →" |
| **Objections** | FAQ, guarantees, data | "Will This Work in My Houses?" / "Application Rates" | "Schedule a call →" |
| **Test Prep** | Onboarding | "Your Hen Helper Order: What to Expect" | "Download application guide →" |
| **Challenge** | Check-in sequence | "Week 2: What You Should Be Seeing in Your Flock" | "Report your results →" |
| **Success** | Outcome capture | "Share Your FCR Improvement Results" | "Leave a review →" |
| **Commitment** | Bulk/subscription | "Lock in Your Bulk Pricing for the Year" | "Set up auto-ship →" |
| **Evangelist** | Ambassador program | "Refer a Fellow Farmer, Earn Rewards" | "Get your referral code →" |

### Backyard Betty Content Map

| Stage | Content Type | Example Title | CTA |
|-------|--------------|---------------|-----|
| **unAware** | Social, lifestyle | "5 Signs Your Backyard Flock Isn't as Healthy as You Think" | "Take the quiz →" |
| **Aware** | Symptom guide | "Why Are My Chickens' Eggs Soft? (And How to Fix It)" | "Read the guide →" |
| **Receptive** | Community proof | "How Sarah's Flock Bounced Back in 2 Weeks" | "See her story →" |
| **ZMOT** | Comparison, reviews | "Best Natural Chicken Supplements (2026 Guide)" | "Shop our bundles →" |
| **Objections** | FAQ, reassurance | "Is This Safe for My Chickens?" / "How Do I Use It?" | "Chat with us →" |
| **Test Prep** | Welcome sequence | "Your Order Is On Its Way! Here's How to Get Started" | "Join our Facebook group →" |
| **Challenge** | Tips + community | "Day 7: Are You Seeing These Changes?" | "Share in the group →" |
| **Success** | Celebration | "Your Flock Is Thriving!" | "Share your story →" |
| **Commitment** | Loyalty program | "Your Flock's Favorites, Auto-Shipped Monthly" | "Set up subscription →" |
| **Evangelist** | UGC program | "Share Your Flock Photos for a Chance to Win" | "Submit your photo →" |

### Turf Pro Taylor Content Map

| Stage | Content Type | Example Title | CTA |
|-------|--------------|---------------|-----|
| **unAware** | Problem education | "The True Cost of Fire Ant Damage to Lawns" | "Assess your risk →" |
| **Aware** | Solution intro | "Why Chemical Treatments Fail (And What Works)" | "See the alternative →" |
| **Receptive** | Results proof | "How Torched Eliminated Fire Ants in 48 Hours" | "Watch the video →" |
| **ZMOT** | Comparison | "Torched vs Chemical Fire Ant Killers" | "Shop now →" |
| **Objections** | Safety/application | "Safe for Pets and Kids" / "Coverage Calculator" | "Calculate your needs →" |
| **Test Prep** | Application guide | "Your Torched Order: Application Tips" | "Download the guide →" |
| **Challenge** | Check-in | "Day 3: The Fire Ants Should Be Gone" | "Still seeing ants? →" |
| **Success** | Outcome capture | "Fire Ant Free! Share Your Lawn" | "Leave a review →" |
| **Commitment** | Seasonal program | "Seasonal Fire Ant Prevention Program" | "Subscribe & save →" |
| **Evangelist** | Referral | "Refer a Neighbor, Both Get 20% Off" | "Share your code →" |

---

## 5. Site Structure & Navigation

### Primary Navigation

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Logo]   Poultry ▼   Lawn ▼   Resources ▼   Podcast   About   🛒  │
└─────────────────────────────────────────────────────────────────────┘
```

### Poultry Mega Menu

Split by persona intent:

```
POULTRY ▼
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  FOR BACKYARD FLOCKS            FOR COMMERCIAL OPERATIONS            │
│  ─────────────────────          ──────────────────────────           │
│  🐔 Starter Bundles             📊 Bulk Pricing & Volume             │
│  🥚 Hen Helper                  📞 Call for Commercial Orders        │
│  💊 Big Ole Bird Probiotics         (800) XXX-XXXX                   │
│  🌿 Mother Load ACV                                                  │
│                                 PRODUCTS                             │
│  SHOP ALL BACKYARD →            ─────────                            │
│                                 Hen Helper (all sizes)               │
│  GUIDES & RESOURCES             Big Ole Bird Probiotics              │
│  ─────────────────              Catalyst Vitamins                    │
│  Beginner's Guide               Litter Life                          │
│  Gut Health 101                 Desecticide (Poultry)                │
│  Seasonal Care Tips                                                  │
│                                 VIEW DATA SHEETS →                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Lawn Dropdown

```
LAWN ▼
┌─────────────────────────────┐
│  🔥 Torched Fire Ant Killer │
│  🐕 Dog Spot Lawn Repair    │
│  🌱 Shop All Lawn Care      │
│  ─────────────────────────  │
│  📖 Fire Ant Guide          │
│  📖 Lawn Recovery Tips      │
└─────────────────────────────┘
```

### Resources Dropdown

```
RESOURCES ▼
┌─────────────────────────────────────────────────────────┐
│  LEARN                        SUPPORT                   │
│  ─────                        ───────                   │
│  📚 Blog                      ❓ FAQs                   │
│  🔬 Science & Research        📞 Contact Us             │
│  📊 Product Data Sheets       🚚 Shipping & Returns     │
│  🎓 Guides & How-Tos                                    │
│                               FOR PROFESSIONALS         │
│  POPULAR TOPICS               ─────────────────         │
│  ─────────────────            🏢 Commercial Accounts    │
│  Gut Health                   📄 SDS & Documentation    │
│  Darkling Beetles             🤝 Become a Distributor   │
│  Organic Certification                                  │
└─────────────────────────────────────────────────────────┘
```

### URL Structure

```
/                                   Homepage (Decision Engine)
│
├── /shop/                          All products
│   ├── /shop/poultry/              Poultry collection
│   ├── /shop/lawn/                 Lawn collection
│   └── /shop/bundles/              Bundle products
│
├── /products/[handle]/             Individual PDPs (Shopify)
│
├── /poultry/                       Poultry content hub (Astro)
│   ├── /poultry/backyard/          Backyard Betty landing
│   ├── /poultry/commercial/        Broiler Bill landing
│   ├── /poultry/guides/            Educational content
│   └── /poultry/calculator/        FCR Calculator tool
│
├── /lawn/                          Lawn content hub
│   ├── /lawn/fire-ants/            Fire ant content
│   └── /lawn/dog-spots/            Lawn repair content
│
├── /podcast/                       Podcast hub
│   └── /podcast/[slug]/            Episodes
│
├── /blog/                          Blog index
│   └── /blog/[slug]/               Posts
│
├── /resources/                     Guides, downloads
│   ├── /resources/data-sheets/     Product specs (Broiler Bill)
│   ├── /resources/faqs/            FAQs
│   └── /resources/guides/          How-to guides
│
├── /about/                         Company pages
│   ├── /about/team/                Team bios
│   └── /about/story/               Company story
│
└── /account/                       Customer account
    └── /account/results/           Outcome tracking
```

### Homepage: Decision Engine

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│              "Natural Supplements for Healthier Chickens"           │
│                                                                     │
│                    What describes you best?                         │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │                 │  │                 │  │                 │     │
│  │  🐔 BACKYARD    │  │  🏭 COMMERCIAL  │  │  🌱 LAWN &      │     │
│  │     FLOCK       │  │     OPERATION   │  │     GARDEN      │     │
│  │                 │  │                 │  │                 │     │
│  │  Under 100      │  │  500+ birds     │  │  Turf & pest    │     │
│  │  birds          │  │  Integrators    │  │  control        │     │
│  │                 │  │                 │  │                 │     │
│  │  [Get Started]  │  │  [Talk to Sales]│  │  [Shop Now]     │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                     │
│           ─── or explore our best sellers below ───                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  BEST SELLERS (Product Grid)                                        │
│  Hen Helper | Big Ole Bird | Catalyst | Backyard Bundle             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  SOCIAL PROOF / TESTIMONIALS                                        │
│  (Rotate between backyard testimonials + commercial case studies)   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  LATEST FROM THE PODCAST                                            │
│  Episode cards (3)                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. CDP Technical Implementation

### Real-Time Persona Brain Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE WORKER                               │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  1. Receive pixel event                                     │   │
│  │  2. Look up visitor in KV (or create new)                   │   │
│  │  3. Update behavioral signals                               │   │
│  │  4. Compute persona score (vector similarity)               │   │
│  │  5. Detect journey stage (rule-based + signals)             │   │
│  │  6. Cache result in KV (24hr TTL)                           │   │
│  │  7. Forward event to BigQuery                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE KV                                   │
│                                                                     │
│  Key: visitor:{anonymous_id}                                        │
│  Value: {                                                           │
│    persona_scores: { broiler_bill: 0.82, backyard_betty: 0.34 },   │
│    current_stage: "zmot",                                           │
│    stage_confidence: 0.75,                                          │
│    explicit_choice: "commercial",  // if they clicked Decision Engine│
│    last_updated: "2026-02-01T12:00:00Z"                            │
│  }                                                                  │
│  TTL: 86400 (24 hours)                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Persona Scoring Algorithm

```typescript
async function computePersonaScore(
  visitorEmbedding: number[],
  personaEmbeddings: Record<string, number[]>
): Promise<PersonaScores> {
  const scores: PersonaScores = {};

  for (const [persona, embedding] of Object.entries(personaEmbeddings)) {
    // Cosine similarity
    scores[persona] = cosineSimilarity(visitorEmbedding, embedding);
  }

  return scores;
}

function createVisitorEmbedding(signals: VisitorSignals): number[] {
  // Combine signals into text for embedding
  const signalText = [
    ...signals.searchQueries,
    ...signals.pagesTitles,
    ...signals.productsViewed.map(p => p.title),
    signals.cartContents?.map(i => i.title) || []
  ].join(' ');

  // Call OpenAI to embed (cached)
  return embedText(signalText);
}
```

### Supabase Vector Functions (Already Built)

```sql
-- Find content matching a persona
SELECT * FROM find_content_for_persona(
  persona_embedding := <vector>,
  target_site_id := <uuid>,
  match_threshold := 0.7,
  match_count := 20
);

-- Search all website content semantically
SELECT * FROM search_website_content(
  query_embedding := <vector>,
  target_site_id := <uuid>,
  page_types := ARRAY['blog', 'page'],
  match_threshold := 0.7,
  match_count := 20
);

-- Find products related to content
SELECT * FROM find_products_for_content(
  content_embedding := <vector>,
  target_site_id := <uuid>,
  match_threshold := 0.75,
  match_count := 5
);
```

---

## 7. The Five CDP-Powered Features

### Feature 1: Decision Engine Homepage

**Purpose:** Route visitors to the right persona path from their first interaction.

**Implementation:**
- 3-way branch on homepage
- Explicit choice stored in cookie + sent to CDP
- All downstream pages respect the choice
- Analytics track which path converts better

**User Flow:**
```
Homepage loads
     │
     ├─→ Check KV for existing persona choice
     │        │
     │        ├─→ Has choice → Show persona-specific homepage
     │        └─→ No choice → Show Decision Engine
     │
     └─→ User clicks choice
              │
              ├─→ Store in cookie (first-party)
              ├─→ Fire event: persona_path_selected
              ├─→ Update KV cache
              └─→ Redirect to persona landing page
```

**Events:**
```typescript
{
  event: 'persona_path_selected',
  properties: {
    path: 'backyard' | 'commercial' | 'lawn',
    source: 'homepage_decision_engine',
    timestamp: ISO8601
  }
}
```

---

### Feature 2: Poultry Guide (Conversational Product Finder)

**Purpose:** Capture explicit signals about persona AND stage, then recommend products + content.

**Implementation:**
- 3-5 question guided flow
- Questions determine persona + stage + product fit
- Ends with personalized recommendations
- All responses logged to CDP

**Question Flow:**

```
Q1: "What brings you here today?"
├── "Just learning about chicken care" → unaware
├── "My flock has a specific problem" → aware
├── "Looking for supplement options" → receptive/zmot
├── "Comparing before I buy" → zmot/objections
└── "Already a customer, need help" → challenge+

Q2: "How many birds do you have?"
├── "Under 50" → backyard_betty
├── "50-500" → small_farm (backyard leaning)
├── "500+" → broiler_bill
└── "I don't have chickens yet" → backyard_betty (new)

Q3: (If problem/solution selected) "What's your main concern?"
├── "Gut health / digestion" → Hen Helper, Big Ole Bird
├── "Egg production" → Catalyst, Hen Helper
├── "Overall flock health" → Starter Bundle
├── "Ammonia / litter" → Litter Life
└── "Pests / beetles" → Desecticide

Q4: (Commercial only) "Would you like to speak with our commercial team?"
├── "Yes, I need bulk pricing" → Sales form + phone
└── "No, I'll browse products" → Product recommendations
```

**Output:**
- Product recommendations (1-3 products)
- Relevant content (guides, articles)
- Appropriate CTA based on stage
- All data captured for CDP

**Events:**
```typescript
{
  event: 'guide_started',
  properties: { entry_point: 'homepage' | 'nav' | 'pdp' }
}

{
  event: 'guide_question_answered',
  properties: {
    question_id: 'flock_size',
    question_text: 'How many birds do you have?',
    answer: '500+',
    persona_implied: 'broiler_bill',
    stage_implied: null
  }
}

{
  event: 'guide_completed',
  properties: {
    persona_detected: 'broiler_bill',
    stage_detected: 'zmot',
    recommended_products: ['hen-helper-1gal', 'big-ole-bird-1gal'],
    recommended_content: ['/poultry/commercial/', '/resources/data-sheets/'],
    routed_to_sales: false
  }
}
```

---

### Feature 3: Semantic Search

**Purpose:** Vector-powered search that understands intent, not just keywords.

**Implementation:**
- Embed search query
- Search `website_content` + `products` tables
- Return blended results
- Feedback loop ("Did this help?")

**User Flow:**
```
User searches: "runny poop"
     │
     ├─→ Embed query using OpenAI
     │
     ├─→ search_website_content(embedding, ['blog', 'faq', 'guide'])
     │        │
     │        └─→ Results:
     │             - "Gut Health 101" (0.89 similarity)
     │             - "Digestive Issues FAQ" (0.85 similarity)
     │
     ├─→ find_products_for_content(embedding)
     │        │
     │        └─→ Results:
     │             - Hen Helper (0.82 similarity)
     │             - Big Ole Bird (0.78 similarity)
     │
     └─→ Display blended results with context
              │
              └─→ "It sounds like a gut health issue. Here's our guide,
                   and Hen Helper is our most popular solution."
```

**Events:**
```typescript
{
  event: 'search_performed',
  properties: {
    query: 'runny poop',
    results_count: 5,
    result_types: { blog: 2, product: 2, faq: 1 }
  }
}

{
  event: 'search_result_clicked',
  properties: {
    query: 'runny poop',
    result_url: '/blog/gut-health-101',
    result_type: 'blog',
    position: 1
  }
}

{
  event: 'search_feedback',
  properties: {
    query: 'runny poop',
    helpful: true
  }
}
```

---

### Feature 4: Persona Scoring Worker

**Purpose:** Real-time persona + stage detection for every visitor.

**Implementation:**
- Cloudflare Worker receives all pixel events
- Computes persona score from behavioral signals
- Detects journey stage from rules + signals
- Caches in KV for edge access
- Forwards to BigQuery for analysis

**Worker Logic:**
```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const event = await request.json();
    const visitorId = event.anonymous_id;

    // Get existing visitor data from KV
    let visitor = await env.VISITOR_KV.get(visitorId, 'json') || createNewVisitor();

    // Update signals based on event
    visitor = updateSignals(visitor, event);

    // Compute persona score (if enough signals)
    if (visitor.signals.length >= 3) {
      visitor.persona_scores = await computePersonaScores(visitor, env);
    }

    // Detect journey stage
    visitor.current_stage = detectJourneyStage(visitor);
    visitor.last_updated = new Date().toISOString();

    // Cache in KV
    await env.VISITOR_KV.put(visitorId, JSON.stringify(visitor), {
      expirationTtl: 86400 // 24 hours
    });

    // Forward to BigQuery
    await forwardToBigQuery(event, visitor, env);

    return new Response('OK');
  }
};
```

---

### Feature 5: Reality Tunnels

**Purpose:** Serve persona × stage specific content dynamically.

**Implementation:**
- Read persona + stage from KV at edge
- Swap content blocks based on detected persona
- Different hero, testimonials, CTAs, featured products
- A/B test tunnel effectiveness

**Component Architecture:**
```astro
---
// RealityTunnel.astro
const visitorData = await getVisitorFromKV(Astro.cookies.get('visitor_id'));
const { persona, stage, explicit_choice } = visitorData;

// Explicit choice always wins
const effectivePersona = explicit_choice || persona;
---

{effectivePersona === 'broiler_bill' ? (
  <BroilerBillHero stage={stage} />
) : effectivePersona === 'backyard_betty' ? (
  <BackyardBettyHero stage={stage} />
) : (
  <DefaultHeroWithDecisionEngine />
)}
```

**What Changes Per Persona:**

| Element | Backyard Betty | Broiler Bill |
|---------|----------------|--------------|
| Hero headline | "Happy, Healthy Hens" | "Proven Results at Scale" |
| Hero CTA | "Shop Starter Bundles" | "Get Commercial Pricing" |
| Featured products | Bundles, Hen Helper 16oz | Hen Helper 1gal, Bulk |
| Testimonials | "My girls are thriving!" | "Reduced mortality 12%" |
| Resources | Beginner guides, FAQs | Data sheets, case studies |
| Contact | Chat, email | Phone number prominent |
| Pricing display | Per-unit | Per-bird calculator |

**What Changes Per Stage:**

| Element | Aware | ZMOT | Objections |
|---------|-------|------|------------|
| Primary CTA | "Learn more" | "Compare options" | "Get answers" |
| Content focus | Problem education | Solution comparison | FAQ, guarantees |
| Social proof | Problem validation | Success stories | Trust signals |
| Urgency | Low | Medium | Address concerns |

---

## 8. Event Schema & Data Model

### Core Event Schema

```typescript
// Base event structure
interface BaseEvent {
  event: string;
  anonymous_id: string;        // First-party cookie
  customer_id?: string;        // If logged in
  session_id: string;
  timestamp: string;           // ISO8601

  // Context
  page_url: string;
  page_title: string;
  referrer: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;

  // Device
  device_type: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
}

// Page view event
interface PageViewEvent extends BaseEvent {
  event: 'page_viewed';
  properties: {
    page_type: 'homepage' | 'product' | 'collection' | 'blog' | 'landing' | 'guide';
    content_segment: 'poultry' | 'lawn' | 'general';
    persona_target?: 'broiler_bill' | 'backyard_betty' | 'turf_taylor';
    stage_target?: JourneyStage;
  };
}

// Product interaction event
interface ProductEvent extends BaseEvent {
  event: 'product_viewed' | 'product_added' | 'product_removed';
  properties: {
    product_id: string;
    product_handle: string;
    product_title: string;
    variant_id?: string;
    price: number;
    quantity?: number;
    persona_fit: 'broiler_bill' | 'backyard_betty' | 'both';
  };
}

// Guide interaction event
interface GuideEvent extends BaseEvent {
  event: 'guide_started' | 'guide_question_answered' | 'guide_completed' | 'guide_abandoned';
  properties: {
    guide_id: string;
    step?: number;
    question_id?: string;
    answer?: string;
    persona_detected?: string;
    stage_detected?: string;
    recommended_products?: string[];
    routed_to_sales?: boolean;
  };
}

// Search event
interface SearchEvent extends BaseEvent {
  event: 'search_performed' | 'search_result_clicked' | 'search_feedback';
  properties: {
    query: string;
    results_count?: number;
    result_url?: string;
    result_type?: string;
    position?: number;
    helpful?: boolean;
  };
}

// Persona path event
interface PersonaPathEvent extends BaseEvent {
  event: 'persona_path_selected';
  properties: {
    path: 'backyard' | 'commercial' | 'lawn';
    source: 'homepage_decision_engine' | 'guide' | 'nav';
  };
}

// Purchase event
interface PurchaseEvent extends BaseEvent {
  event: 'order_completed';
  properties: {
    order_id: string;
    order_total: number;
    products: Array<{
      product_id: string;
      product_handle: string;
      quantity: number;
      price: number;
    }>;
    is_first_order: boolean;
    persona_at_purchase: string;
    stage_at_purchase: string;
  };
}

// Outcome event
interface OutcomeEvent extends BaseEvent {
  event: 'outcome_reported';
  properties: {
    order_id: string;
    products: string[];
    days_since_purchase: number;
    outcome_type: 'fcr_improvement' | 'mortality_reduction' | 'problem_solved' | 'general_satisfaction';
    baseline_value?: number;
    current_value?: number;
    improvement_pct?: number;
    problem_solved?: string;
    would_recommend: boolean;
    testimonial_text?: string;
    testimonial_approved?: boolean;
  };
}
```

### BigQuery Tables

```sql
-- Core events table
CREATE TABLE cdp.events (
  event_id STRING NOT NULL,
  event STRING NOT NULL,
  anonymous_id STRING NOT NULL,
  customer_id STRING,
  session_id STRING NOT NULL,
  timestamp TIMESTAMP NOT NULL,

  -- Page context
  page_url STRING,
  page_title STRING,
  referrer STRING,

  -- UTM
  utm_source STRING,
  utm_medium STRING,
  utm_campaign STRING,

  -- Device
  device_type STRING,
  browser STRING,
  os STRING,

  -- Event properties (JSON)
  properties JSON,

  -- Computed at ingest
  persona_score_broiler_bill FLOAT64,
  persona_score_backyard_betty FLOAT64,
  persona_score_turf_taylor FLOAT64,
  detected_stage STRING,

  -- Partitioning
  event_date DATE NOT NULL
)
PARTITION BY event_date
CLUSTER BY anonymous_id, event;

-- Customer journey stage table
CREATE TABLE cdp.customer_journey_stage (
  customer_id STRING,
  anonymous_id STRING,
  persona STRING,

  current_stage STRING,
  stage_confidence FLOAT64,
  stage_entered_at TIMESTAMP,

  stage_history ARRAY<STRUCT<
    stage STRING,
    entered_at TIMESTAMP,
    exited_at TIMESTAMP,
    duration_days INT64
  >>,

  explicit_persona_choice STRING,

  success_defined BOOL,
  success_metric STRING,
  success_achieved BOOL,
  success_achieved_at TIMESTAMP,

  updated_at TIMESTAMP
);

-- Visitor persona scores (current state)
CREATE TABLE cdp.visitor_persona_scores (
  anonymous_id STRING NOT NULL,

  broiler_bill_score FLOAT64,
  backyard_betty_score FLOAT64,
  turf_taylor_score FLOAT64,

  primary_persona STRING,
  persona_confidence FLOAT64,

  explicit_choice STRING,

  current_stage STRING,
  stage_confidence FLOAT64,

  first_seen_at TIMESTAMP,
  last_seen_at TIMESTAMP,
  total_sessions INT64,
  total_pageviews INT64,

  updated_at TIMESTAMP
);

-- Stage transitions (for funnel analysis)
CREATE TABLE cdp.stage_transitions (
  transition_id STRING NOT NULL,
  anonymous_id STRING NOT NULL,
  customer_id STRING,
  persona STRING,

  from_stage STRING NOT NULL,
  to_stage STRING NOT NULL,
  transition_date DATE NOT NULL,

  days_in_from_stage INT64,

  trigger_event STRING,
  trigger_event_id STRING,

  created_at TIMESTAMP
)
PARTITION BY transition_date;
```

---

## 9. Outcome Tracking System

### The "GAD-7" for Poultry

Just as Banyan Tree tracks GAD-7 anxiety scores to prove therapy effectiveness, Southland tracks FCR, mortality, and problem-solved metrics to prove product effectiveness.

### Outcome Schema

```sql
CREATE TABLE cdp.product_outcomes (
  outcome_id STRING NOT NULL,
  customer_id STRING NOT NULL,
  anonymous_id STRING,
  persona STRING,

  -- What they bought
  order_id STRING NOT NULL,
  product_handles ARRAY<STRING>,
  purchase_date DATE,
  days_on_product INT64,

  -- What we promised (from converting content)
  promise_source STRING,           -- URL of page that converted them
  promise_message STRING,          -- "Reduce mortality naturally"

  -- Structured outcomes (Broiler Bill)
  fcr_baseline FLOAT64,           -- e.g., 1.85
  fcr_current FLOAT64,            -- e.g., 1.72
  fcr_improvement_pct FLOAT64,    -- calculated: 7%

  mortality_baseline_pct FLOAT64,  -- e.g., 5.2%
  mortality_current_pct FLOAT64,   -- e.g., 3.1%
  mortality_reduction_pct FLOAT64, -- calculated: 40%

  -- Structured outcomes (Backyard Betty)
  problem_solved STRING,           -- "soft shells", "runny poop", "mites"
  time_to_improvement STRING,      -- "within 2 weeks", "1 month"
  flock_health_rating INT64,       -- 1-5 scale

  -- Universal outcomes
  would_recommend BOOL,
  recommendation_score INT64,      -- 1-10 NPS-style

  -- Testimonial capture
  testimonial_text STRING,
  testimonial_approved BOOL,
  testimonial_used_in ARRAY<STRING>, -- URLs where used

  -- Metadata
  collected_via STRING,            -- typeform, email, sales_call, review
  collected_at TIMESTAMP,

  created_at TIMESTAMP
);
```

### Outcome Collection Methods

#### 1. Post-Purchase Survey (Typeform → BigQuery)

**Backyard Betty Survey (Day 30):**
```
Q1: What problem were you trying to solve?
    [ ] Soft shells  [ ] Runny poop  [ ] Low energy
    [ ] Mites/pests  [ ] Egg production  [ ] General health
    [ ] Other: ___

Q2: Did [Product Name] help solve this problem?
    [ ] Yes, completely  [ ] Yes, partially  [ ] No  [ ] Too early to tell

Q3: How quickly did you see improvement?
    [ ] Within a week  [ ] 2-3 weeks  [ ] About a month  [ ] Still waiting

Q4: Would you recommend this product to other chicken owners?
    [ ] Definitely  [ ] Probably  [ ] Not sure  [ ] No

Q5: Can we share your experience? (Optional testimonial)
    [Text field]
```

**Broiler Bill Survey (Day 60):**
```
Q1: What was your primary goal for using [Product]?
    [ ] Improve FCR  [ ] Reduce mortality  [ ] Control ammonia
    [ ] Antibiotic alternative  [ ] General flock health

Q2: What was your baseline FCR before starting?
    [Number field]

Q3: What is your current FCR after 60 days?
    [Number field]

Q4: What was your baseline mortality rate?
    [Number field]

Q5: What is your current mortality rate?
    [Number field]

Q6: Would you recommend Southland products to other growers?
    [1-10 scale]

Q7: Can we use your results in a case study? (We'll contact you for details)
    [ ] Yes  [ ] No
```

#### 2. Sales Team Outcome Logging

For commercial accounts, sales team logs outcomes during calls:

```typescript
interface SalesOutcomeLog {
  customer_id: string;
  products: string[];
  call_date: string;

  reported_outcomes: {
    fcr_improvement?: number;
    mortality_reduction?: number;
    other_improvements?: string;
  };

  testimonial_potential: 'high' | 'medium' | 'low';
  follow_up_needed: boolean;
}
```

#### 3. Review Mining

Parse product reviews for outcome signals:

```typescript
// Keywords that indicate outcomes
const outcomeKeywords = {
  fcr: ['fcr', 'feed conversion', 'feed efficiency'],
  mortality: ['mortality', 'death loss', 'survival', 'lived'],
  problem_solved: ['fixed', 'solved', 'no more', 'cleared up', 'better now'],
  time_to_result: ['within days', 'week later', 'after a month']
};
```

### Outcome-Powered Content

Once outcomes are in BigQuery, use them to:

#### 1. Dynamic Proof Points

```astro
---
const outcomes = await getOutcomeStats('hen-helper', 'broiler_bill');
// { avg_fcr_improvement: 7.2, avg_mortality_reduction: 12.1, sample_size: 47 }
---

<div class="proof-point">
  <strong>{outcomes.avg_fcr_improvement}%</strong> average FCR improvement
  <span class="sample">Based on {outcomes.sample_size} commercial flocks</span>
</div>
```

#### 2. Persona-Matched Testimonials

```sql
-- Get testimonials matching visitor's persona and stage
SELECT
  testimonial_text,
  problem_solved,
  time_to_improvement,
  product_handles
FROM cdp.product_outcomes
WHERE persona = @visitor_persona
  AND would_recommend = true
  AND testimonial_approved = true
  AND problem_solved = @visitor_indicated_problem
ORDER BY collected_at DESC
LIMIT 3;
```

#### 3. Marketing Claims

```
-- Query to support marketing claims
SELECT
  product_handles,
  COUNT(*) as total_responses,
  AVG(fcr_improvement_pct) as avg_fcr_improvement,
  COUNTIF(would_recommend) / COUNT(*) as recommend_rate,
  APPROX_QUANTILES(fcr_improvement_pct, 100)[OFFSET(50)] as median_fcr_improvement
FROM cdp.product_outcomes
WHERE days_on_product >= 60
  AND persona = 'broiler_bill'
GROUP BY 1;

-- Result: "Hen Helper users report 12% average FCR improvement after 60 days"
```

---

## 10. Content Gap Analysis

### Monthly Gap Analysis Job

Run monthly to identify:
1. High-traffic pages with low persona alignment
2. Products without supporting content
3. Persona needs without content
4. Stage gaps (no content for specific persona × stage)

### Gap Analysis Queries

#### 1. Orphan Content (Low Persona Alignment)

```sql
-- Pages that don't strongly match ANY persona
WITH persona_content AS (
  SELECT
    wc.url,
    wc.title,
    wc.page_type,
    1 - (wc.embedding <=> bb.embedding) as broiler_bill_score,
    1 - (wc.embedding <=> betty.embedding) as backyard_betty_score,
    1 - (wc.embedding <=> tt.embedding) as turf_taylor_score
  FROM website_content wc
  CROSS JOIN (SELECT embedding FROM personas WHERE name = 'Broiler Bill') bb
  CROSS JOIN (SELECT embedding FROM personas WHERE name = 'Backyard Betty') betty
  CROSS JOIN (SELECT embedding FROM personas WHERE name = 'Turf Pro Taylor') tt
  WHERE wc.site_id = 'southland-organics'
),
traffic AS (
  SELECT
    page_path,
    SUM(pageviews) as views
  FROM analytics.pages
  WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY 1
)
SELECT
  pc.url,
  pc.title,
  pc.page_type,
  t.views as monthly_views,
  ROUND(pc.broiler_bill_score, 2) as bb_score,
  ROUND(pc.backyard_betty_score, 2) as betty_score,
  ROUND(pc.turf_taylor_score, 2) as tt_score,
  GREATEST(pc.broiler_bill_score, pc.backyard_betty_score, pc.turf_taylor_score) as max_score,
  CASE
    WHEN GREATEST(bb_score, betty_score, tt_score) < 0.5 THEN 'ORPHAN - rewrite or remove'
    WHEN GREATEST(bb_score, betty_score, tt_score) < 0.6 THEN 'WEAK - needs improvement'
    WHEN bb_score > 0.6 AND betty_score > 0.6 THEN 'CONFUSED - too broad'
    ELSE 'OK'
  END as gap_status
FROM persona_content pc
LEFT JOIN traffic t ON pc.url = t.page_path
WHERE GREATEST(bb_score, betty_score, tt_score) < 0.7
ORDER BY t.views DESC NULLS LAST
LIMIT 30;
```

#### 2. Products Without Supporting Content

```sql
-- Products with no blog/guide content linked
WITH product_content AS (
  SELECT
    p.handle,
    p.title,
    COUNT(DISTINCT wc.url) as supporting_content_count,
    ARRAY_AGG(DISTINCT wc.page_type) as content_types
  FROM products p
  LEFT JOIN website_content wc
    ON ARRAY_CONTAINS(wc.product_handles, p.handle)
    OR 1 - (p.embedding <=> wc.embedding) > 0.75
  WHERE p.site_id = 'southland-organics'
  GROUP BY 1, 2
)
SELECT
  handle,
  title,
  supporting_content_count,
  content_types,
  CASE
    WHEN supporting_content_count = 0 THEN 'CRITICAL - no content'
    WHEN supporting_content_count < 3 THEN 'WEAK - needs more content'
    WHEN NOT 'blog' IN UNNEST(content_types) THEN 'MISSING - no blog content'
    ELSE 'OK'
  END as gap_status
FROM product_content
WHERE supporting_content_count < 3
ORDER BY supporting_content_count ASC;
```

#### 3. Persona × Stage Content Gaps

```sql
-- Matrix of content coverage by persona and stage
WITH content_tagged AS (
  SELECT
    url,
    title,
    -- Determine primary persona
    CASE
      WHEN broiler_bill_score > backyard_betty_score AND broiler_bill_score > 0.6 THEN 'broiler_bill'
      WHEN backyard_betty_score > broiler_bill_score AND backyard_betty_score > 0.6 THEN 'backyard_betty'
      ELSE 'general'
    END as primary_persona,
    -- Determine stage target (from content analysis)
    CASE
      WHEN REGEXP_CONTAINS(LOWER(title), r'(hidden|did you know|signs of)') THEN 'unaware'
      WHEN REGEXP_CONTAINS(LOWER(title), r'(why|causes|problem)') THEN 'aware'
      WHEN REGEXP_CONTAINS(LOWER(title), r'(what happens|cost of|ignore)') THEN 'receptive'
      WHEN REGEXP_CONTAINS(LOWER(title), r'(vs|compare|best|guide)') THEN 'zmot'
      WHEN REGEXP_CONTAINS(LOWER(title), r'(faq|safe|how to use)') THEN 'objections'
      WHEN REGEXP_CONTAINS(LOWER(title), r'(getting started|what to expect)') THEN 'test_prep'
      WHEN REGEXP_CONTAINS(LOWER(title), r'(week \d|day \d|troubleshoot)') THEN 'challenge'
      ELSE 'general'
    END as stage_target
  FROM website_content
  WHERE site_id = 'southland-organics'
)
SELECT
  primary_persona,
  stage_target,
  COUNT(*) as content_count
FROM content_tagged
GROUP BY 1, 2
ORDER BY 1,
  CASE stage_target
    WHEN 'unaware' THEN 1
    WHEN 'aware' THEN 2
    WHEN 'receptive' THEN 3
    WHEN 'zmot' THEN 4
    WHEN 'objections' THEN 5
    WHEN 'test_prep' THEN 6
    WHEN 'challenge' THEN 7
    ELSE 8
  END;

-- Expected output shows gaps like:
-- broiler_bill | receptive | 0  ← NEED pain amplification content
-- backyard_betty | zmot | 1     ← NEED more comparison content
```

### Gap Analysis → Action Board

Output goes to Notion/Linear as actionable cards:

```markdown
## Content Gap: Broiler Bill × Receptive Stage

**Gap Type:** Missing stage content
**Persona:** Broiler Bill (commercial)
**Stage:** Receptive (knows solution, not convinced)
**Current Content Count:** 0

**Recommended Action:**
Create 2-3 pieces of pain amplification content:
- "The True Cost of Poor FCR: A Calculator for Commercial Growers"
- "Why Waiting to Address Gut Health Costs More Than Acting Now"
- "Case Study: What Happened When Farm X Delayed Probiotic Adoption"

**Success Metric:** Increase Receptive → ZMOT transition rate by 15%

**Assigned To:** Content Team
**Due Date:** [2 weeks from gap analysis]
```

---

## 11. Access Ladder & Funnel Metrics

### The Access Ladder

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ACCESS LADDER                               │
│                                                                     │
│  EVANGELIST ─────────────────────────────────────────────── $2,500+ │
│       ▲  (Referral program, UGC, ambassador)                        │
│       │                                                             │
│  COMMITMENT ─────────────────────────────────────────────── $400+   │
│       ▲  (Repeat buyer, subscription, bulk account)                 │
│       │                                                             │
│  SUCCESS ────────────────────────────────────────────────── $100+   │
│       ▲  (Achieved outcome, left review)                            │
│       │                                                             │
│  CHALLENGE ──────────────────────────────────────────────── $50+    │
│       ▲  (Using product, attacking problem)                         │
│       │                                                             │
│  TEST PREP ──────────────────────────────────────────────── $50     │
│       ▲  (First purchase, preparing to implement)                   │
│       │                                                             │
│  OBJECTIONS ─────────────────────────────────────────────── $0      │
│       ▲  (FAQ, pricing, cart abandonment)                           │
│       │                                                             │
│  ZMOT ───────────────────────────────────────────────────── $0      │
│       ▲  (Comparing, using tools, reading reviews)                  │
│       │                                                             │
│  RECEPTIVE ──────────────────────────────────────────────── $0      │
│       ▲  (Knows solution, not convinced)                            │
│       │                                                             │
│  AWARE ──────────────────────────────────────────────────── $0      │
│       ▲  (Knows problem, searching solutions)                       │
│       │                                                             │
│  UNAWARE ────────────────────────────────────────────────── $0      │
│       (Target demographic, no problem awareness)                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Ladder Entry Points (Tagged in CDP)

Every entry to the ladder is tagged:

| Entry Point | Event | Persona Likely | Stage Entered |
|-------------|-------|----------------|---------------|
| Broad social ad | `first_visit` + social referrer | Betty | unaware |
| Problem search | `first_visit` + problem query | Either | aware |
| Guide download | `guide_downloaded` | Either | aware/receptive |
| Email course signup | `email_course_started` | Betty | receptive |
| FCR Calculator | `calculator_used` | Bill | zmot |
| Poultry Guide completed | `guide_completed` | Either | zmot |
| Sales call scheduled | `sales_call_scheduled` | Bill | zmot/objections |
| First purchase | `order_completed` (first) | Either | test_prep |
| Repeat purchase | `order_completed` (repeat) | Either | commitment |

### Funnel Metrics Dashboard

```sql
-- Stage transition funnel
WITH stage_order AS (
  SELECT stage, order_num FROM UNNEST([
    STRUCT('unaware' AS stage, 1 AS order_num),
    ('aware', 2),
    ('receptive', 3),
    ('zmot', 4),
    ('objections', 5),
    ('test_prep', 6),
    ('challenge', 7),
    ('success', 8),
    ('commitment', 9),
    ('evangelist', 10)
  ])
),
transitions AS (
  SELECT
    t.persona,
    t.from_stage,
    t.to_stage,
    so_from.order_num as from_order,
    so_to.order_num as to_order,
    COUNT(*) as transition_count,
    AVG(t.days_in_from_stage) as avg_days_in_stage
  FROM cdp.stage_transitions t
  JOIN stage_order so_from ON t.from_stage = so_from.stage
  JOIN stage_order so_to ON t.to_stage = so_to.stage
  WHERE t.transition_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY 1, 2, 3, 4, 5
)
SELECT
  persona,
  from_stage,
  to_stage,
  transition_count,
  avg_days_in_stage,
  CASE
    WHEN to_order > from_order THEN 'PROGRESSION'
    WHEN to_order < from_order THEN 'REGRESSION'
    ELSE 'LATERAL'
  END as transition_type
FROM transitions
ORDER BY persona, from_order, to_order;
```

### Ladder P&L Tracking

Track revenue attribution by ladder rung:

```sql
-- Revenue by ladder entry point
SELECT
  first_touch_event,
  persona,
  COUNT(DISTINCT customer_id) as customers,
  SUM(total_revenue) as total_revenue,
  AVG(total_revenue) as avg_ltv,
  AVG(days_to_first_purchase) as avg_days_to_purchase,
  SUM(total_revenue) / COUNT(DISTINCT customer_id) as revenue_per_entry
FROM cdp.customer_attribution
WHERE first_touch_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY 1, 2
ORDER BY revenue_per_entry DESC;
```

**Expected insight:** "Customers who entered via FCR Calculator have 3x higher LTV than those who entered via social ads."

---

## 12. Implementation Roadmap

### Critical Insight: Two Parallel Tracks

The implementation runs as **two separate workstreams** with different owners and cadences:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DUAL-TRACK EXECUTION                            │
│                                                                     │
│  TRACK A: ADS CLEANUP                 TRACK B: CDP BUILD            │
│  ─────────────────────                ───────────────────           │
│  Owner: Marketing/Agency              Owner: Dev/Data               │
│  Cadence: Weekly checkpoint           Cadence: Sprint-based         │
│                                                                     │
│  • Consolidate 99 → 10-15 campaigns   • Decision Engine             │
│  • Budget reallocation                • Outcome tracking            │
│  • Audience refinement                • Poultry Guide               │
│  • Creative by persona                • Semantic search             │
│  • PMax URL cleanup                   • Persona scoring             │
│                                       • Reality Tunnels             │
│                                                                     │
│  Cash payback: Fast (weeks)           Value payback: Medium (months)│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Why two tracks?**
- Ads consolidation has faster cash payback and shouldn't block CDP infra
- CDP work requires dev focus without context-switching to ad operations
- Both can (and should) run in parallel with separate checkpoints

---

### The Broiler Bill Phone Gap (Critical Dependency)

**34% of revenue comes via phone.** This is the biggest blind spot.

Before over-optimizing Bill's on-site experience, we need:

1. **Sales CRM → BigQuery pipeline** for phone outcomes
2. **Minimum attribution**: tracking numbers or UTM passthrough by persona path
3. **Outcome logging flow** for sales team: "What did they buy? Baseline metric? What changed?"

**Rule:** Don't build Bill-focused Reality Tunnels until phone outcomes are flowing into BigQuery.

Betty's loop is fully online—we can move faster with her.

---

### Track B: CDP Build (Week-by-Week)

#### Week 1: Foundation + Proof Collection (PARALLEL START)

| Feature | Effort | Owner | Deliverable |
|---------|--------|-------|-------------|
| Decision Engine Homepage | Low | Dev | 3-way branch + cookie persistence |
| V1 Outcome Survey (Betty) | Low | Marketing | Typeform: problem, solved?, time, recommend |
| V1 Outcome Survey (Bill) | Low | Marketing | Typeform: FCR baseline/current, mortality |
| Survey → BigQuery pipeline | Low | Dev | Zapier/Make webhook to BigQuery |
| Sales outcome log form | Low | Sales | Simple form for phone call outcomes |

**Success Criteria:**
- Homepage shows Decision Engine with 3 paths
- Path selection tracked in BigQuery
- Outcome surveys deployed to post-purchase emails
- Sales has a simple way to log phone call outcomes
- `product_outcomes` table starts filling

**Why outcomes Week 1?** Outcomes are your moat. Every week without data is a week without proof points for Reality Tunnels.

---

#### Week 2: Intent Capture + Data Richness

| Feature | Effort | Owner | Deliverable |
|---------|--------|-------|-------------|
| Poultry Guide | Medium | Dev | 4-5 question flow capturing persona + stage |
| Guide event tracking | Low | Dev | All responses → BigQuery |
| Persona landing pages | Medium | Content | `/poultry/backyard/` and `/poultry/commercial/` |
| Phone attribution setup | Medium | Marketing | Tracking numbers by landing page/persona path |
| Sales CRM → BigQuery sync | Medium | Dev | Daily sync of Broiler Bill call outcomes |

**Success Criteria:**
- Guide captures explicit persona + stage
- Guide completion → product recommendations + relevant content
- All guide responses in BigQuery
- Phone calls attributable to persona path
- Sales outcomes flowing to same schema as online surveys

---

#### Week 3: Semantic Help (Not Full Tunnels)

| Feature | Effort | Owner | Deliverable |
|---------|--------|-------|-------------|
| Semantic search UI | Medium | Dev | Search bar + results page |
| Vector search API | Medium | Dev | Endpoint querying Supabase vectors |
| Search → BigQuery logging | Low | Dev | Query tracking + feedback capture |
| First outcome proof points | Low | Content | Display real outcome stats on site |

**Success Criteria:**
- "Runny poop" returns gut health content + Hen Helper
- Products + content blended in results
- "Was this helpful?" feedback captured
- At least one real outcome stat displayed (e.g., "X% of customers report improvement")

---

#### Week 4: Persona Scoring Worker

| Feature | Effort | Owner | Deliverable |
|---------|--------|-------|-------------|
| Cloudflare Worker | High | Dev | Real-time persona + stage scoring |
| KV caching layer | Medium | Dev | Edge-accessible persona/stage data |
| Worker → BigQuery forwarding | Medium | Dev | All events with computed scores |

**Success Criteria:**
- Visitor arrives → Worker scores → KV caches in <50ms
- Persona confidence computed from behavioral signals
- Stage detected from rules + signals
- Site can read persona/stage from KV at edge

---

#### Week 5-6: Reality Tunnels (Betty First)

| Feature | Effort | Owner | Deliverable |
|---------|--------|-------|-------------|
| Betty Reality Tunnel | High | Dev | Dynamic content for Backyard Betty |
| Betty-specific testimonials | Low | Content | Problem-solved stories surfaced dynamically |
| A/B test framework | Medium | Dev | Tunnel vs. generic comparison |

**Why Betty first?**
- Her loop is fully online (no phone gap)
- Faster to validate approach before Bill
- Can measure conversion impact cleanly

**Success Criteria:**
- Betty visitors see Betty-specific hero, products, testimonials
- Explicit choice still overrides behavioral inference
- A/B test running: tunnel vs. generic
- Conversion rate measurable by tunnel variant

---

#### Week 7-8: Reality Tunnels (Bill) — GATED

**Gate criteria (must pass before starting):**
- [ ] Phone outcomes flowing to BigQuery for 30+ days
- [ ] At least 10 quantified FCR/mortality outcomes in `product_outcomes`
- [ ] Phone attribution working (can say "X calls came from /poultry/commercial/")

| Feature | Effort | Owner | Deliverable |
|---------|--------|-------|-------------|
| Bill Reality Tunnel | High | Dev | Dynamic content for Broiler Bill |
| Bill-specific case studies | Medium | Content | FCR improvement stories with numbers |
| Commercial proof points | Low | Content | "12% average FCR improvement" from real data |
| Phone CTA optimization | Low | Marketing | Test prominent phone number placement |

**Success Criteria:**
- Bill visitors see data-driven hero, ROI calculator, case studies
- Proof points powered by real `product_outcomes` data
- Phone number prominent in Bill tunnel
- Can measure: Bill path → phone call → outcome

---

#### Weeks 9+: Optimization & Expansion

| Feature | Effort | Owner | Deliverable |
|---------|--------|-------|-------------|
| Gap analysis automation | Medium | Dev | Monthly job + Notion/Linear integration |
| Negative signal tracking | Medium | Analytics | Non-converter clustering |
| Stage transition alerts | Low | Analytics | Alert if any transition drops >20% |
| Off-site personalization | Medium | Marketing | Persona-based ad audiences from BigQuery |
| Turf Pro Taylor activation | Medium | All | Full persona buildout when volume justifies |

---

### Track A: Ads Cleanup (Parallel Workstream)

Runs independently with weekly checkpoints. Does NOT block CDP work.

#### Week 1-2: Audit & Consolidation Plan

| Task | Owner | Deliverable |
|------|-------|-------------|
| Campaign audit | Marketing | Map all 99 campaigns, identify redundancy |
| Consolidation plan | Marketing | Target structure: ~10-15 campaigns |
| Budget reallocation model | Marketing | Proposed budget by campaign |

#### Week 3-4: Execute Consolidation

| Task | Owner | Deliverable |
|------|-------|-------------|
| Pause/archive redundant campaigns | Marketing | 99 → 15 active campaigns |
| Budget reallocation | Marketing | Budgets moved to high-performers |
| URL cleanup | Marketing | PMax final URLs aligned with playbook |

#### Week 5-6: Persona Creative

| Task | Owner | Deliverable |
|------|-------|-------------|
| Betty ad creative | Marketing | "Happy, healthy hens" messaging |
| Bill ad creative | Marketing | "Cut mortality, improve FCR" messaging |
| Audience segmentation | Marketing | BigQuery persona audiences → Google Ads |

#### Ongoing: Weekly Performance Review

| Metric | Target |
|--------|--------|
| ROAS by persona | Track separately |
| Cost per acquisition by persona | Decrease 20% |
| URL expansion bleed | <5% homepage traffic from PMax |

---

### Visual Timeline

```
        Week 1    Week 2    Week 3    Week 4    Week 5    Week 6    Week 7    Week 8
        ──────    ──────    ──────    ──────    ──────    ──────    ──────    ──────

TRACK B  ┌──────────────────┐
(CDP)    │ Decision Engine  │
         │ + Outcome Surveys│
         └────────┬─────────┘
                  │
                  ▼
                  ┌──────────────────┐
                  │ Poultry Guide    │
                  │ + Phone Attrib   │
                  └────────┬─────────┘
                           │
                           ▼
                           ┌──────────────────┐
                           │ Semantic Search  │
                           │ + First Proofs   │
                           └────────┬─────────┘
                                    │
                                    ▼
                                    ┌──────────────────┐
                                    │ Persona Worker   │
                                    │ + KV Cache       │
                                    └────────┬─────────┘
                                             │
                                             ▼
                                             ┌──────────────────────────────┐
                                             │ Reality Tunnels (Betty)      │
                                             └────────┬─────────────────────┘
                                                      │
                                                      ▼ (GATED)
                                                      ┌──────────────────┐
                                                      │ Reality Tunnels  │
                                                      │ (Bill)           │
                                                      └──────────────────┘

TRACK A  ┌──────────────────────────────┐
(Ads)    │ Audit + Consolidation Plan   │
         └────────┬─────────────────────┘
                  │
                  ▼
                  ┌──────────────────────────────┐
                  │ Execute Consolidation        │
                  │ 99 → 15 campaigns            │
                  └────────┬─────────────────────┘
                           │
                           ▼
                           ┌──────────────────────────────┐
                           │ Persona Creative + Audiences │
                           └────────┬─────────────────────┘
                                    │
                                    ▼
                                    ┌──────────────────┐
                                    │ Weekly Perf      │
                                    │ Reviews (ongoing)│
                                    └──────────────────┘
```

---

### Success Metrics by Phase

| Phase | Metric | Target |
|-------|--------|--------|
| Week 1 | Decision Engine live | 100% of homepage traffic sees it |
| Week 1 | Outcome surveys deployed | Both personas, post-purchase |
| Week 2 | Guide completion rate | 40%+ of starters complete |
| Week 2 | Phone attribution | Can attribute calls to persona path |
| Week 3 | Search satisfaction | 70%+ "helpful" rating |
| Week 4 | Persona detection accuracy | 75%+ confidence on returning visitors |
| Week 6 | Betty tunnel conversion lift | +15% vs. generic |
| Week 8 | Bill tunnel with proof points | Real FCR/mortality stats displayed |

---

### Key Dependencies

```
┌─────────────────────────────────────────────────────────────────────┐
│                      DEPENDENCY MAP                                 │
│                                                                     │
│  Decision Engine ──────────────────────────────────────────────┐    │
│       │                                                        │    │
│       ▼                                                        │    │
│  Poultry Guide ───────────────────────────────┐                │    │
│       │                                       │                │    │
│       ▼                                       ▼                │    │
│  Persona Worker ◄─────────────────── Outcome Surveys           │    │
│       │                                       │                │    │
│       ▼                                       ▼                │    │
│  Betty Tunnel ◄────────────────────── Betty Outcomes          │    │
│       │                                       │                │    │
│       │                                       │                │    │
│       │   ┌───────────────────────────────────┘                │    │
│       │   │                                                    │    │
│       │   ▼                                                    │    │
│       │  Phone Attribution ─────────┐                          │    │
│       │       │                     │                          │    │
│       │       ▼                     ▼                          │    │
│       └─► Bill Tunnel ◄────── Bill Phone Outcomes              │    │
│              │                      │                          │    │
│              │                      │                          │    │
│              ▼                      ▼                          │    │
│         Proof Points ◄────── product_outcomes table            │    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

GATE: Bill Tunnel requires:
  ✓ 30+ days of phone outcomes
  ✓ 10+ quantified FCR/mortality results
  ✓ Phone attribution working
```

---

## 13. Guardrails & Constraints

### Technical Guardrails

| Guardrail | Implementation |
|-----------|----------------|
| **Explicit intent wins** | If user clicks a persona path, that overrides behavioral inference |
| **Confidence thresholds** | Don't personalize unless persona confidence > 0.7 |
| **Escape hatch** | Always show "Switch view" or "Not you?" option |
| **Explainable** | Every personalized block has `data-reason` attribute |
| **Privacy first** | All data is first-party; no third-party tracking |

### Strategic Guardrails

| Guardrail | Rationale |
|-----------|-----------|
| **4 personas max** | Don't create micro-personas unless data demands it |
| **10 stages max** | Hero Journey is complete; don't add complexity |
| **Persona + stage required** | Every new content piece must map to both |
| **Outcomes over opinions** | Prioritize content that supports measurable claims |
| **Kill unclear content** | If content doesn't serve a persona × stage, remove it |

### Operational Guardrails

| Guardrail | Implementation |
|-----------|----------------|
| **Monthly gap review** | Run gap analysis, create action items |
| **Quarterly persona review** | Validate personas still match customer data |
| **Outcome collection cadence** | Survey at Day 30 (Betty) and Day 60 (Bill) |
| **Stage transition monitoring** | Alert if any transition rate drops >20% |

---

## 14. Appendix: SQL Queries

### A. Visitor Persona Assignment

```sql
-- Assign persona to visitor based on behavioral signals
CREATE OR REPLACE FUNCTION assign_visitor_persona(
  visitor_signals ARRAY<STRUCT<signal_type STRING, signal_value STRING>>
) RETURNS STRUCT<persona STRING, confidence FLOAT64>
AS (
  -- Simplified scoring based on signals
  STRUCT(
    CASE
      WHEN EXISTS(SELECT 1 FROM UNNEST(visitor_signals) WHERE signal_value LIKE '%commercial%' OR signal_value LIKE '%bulk%' OR signal_value LIKE '%FCR%')
        THEN 'broiler_bill'
      WHEN EXISTS(SELECT 1 FROM UNNEST(visitor_signals) WHERE signal_value LIKE '%backyard%' OR signal_value LIKE '%hobby%' OR signal_value LIKE '%small flock%')
        THEN 'backyard_betty'
      WHEN EXISTS(SELECT 1 FROM UNNEST(visitor_signals) WHERE signal_value LIKE '%lawn%' OR signal_value LIKE '%fire ant%' OR signal_value LIKE '%turf%')
        THEN 'turf_taylor'
      ELSE 'unknown'
    END as persona,
    -- Confidence based on signal count
    LEAST(ARRAY_LENGTH(visitor_signals) * 0.15, 1.0) as confidence
  )
);
```

### B. Stage Transition Analysis

```sql
-- Analyze stage transitions by persona
SELECT
  persona,
  from_stage,
  to_stage,
  COUNT(*) as transitions,
  AVG(days_in_from_stage) as avg_days,
  COUNTIF(
    CASE to_stage
      WHEN 'aware' THEN 2
      WHEN 'receptive' THEN 3
      WHEN 'zmot' THEN 4
      WHEN 'objections' THEN 5
      WHEN 'test_prep' THEN 6
      WHEN 'challenge' THEN 7
      WHEN 'success' THEN 8
      WHEN 'commitment' THEN 9
      WHEN 'evangelist' THEN 10
      ELSE 1
    END >
    CASE from_stage
      WHEN 'unaware' THEN 1
      WHEN 'aware' THEN 2
      WHEN 'receptive' THEN 3
      WHEN 'zmot' THEN 4
      WHEN 'objections' THEN 5
      WHEN 'test_prep' THEN 6
      WHEN 'challenge' THEN 7
      WHEN 'success' THEN 8
      WHEN 'commitment' THEN 9
      ELSE 10
    END
  ) / COUNT(*) as progression_rate
FROM cdp.stage_transitions
WHERE transition_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY 1, 2, 3
ORDER BY persona, transitions DESC;
```

### C. Outcome Summary by Product

```sql
-- Product outcome summary for marketing claims
SELECT
  ARRAY_TO_STRING(product_handles, ', ') as products,
  persona,
  COUNT(*) as total_responses,

  -- FCR metrics (Broiler Bill)
  AVG(fcr_improvement_pct) as avg_fcr_improvement,
  APPROX_QUANTILES(fcr_improvement_pct, 100)[OFFSET(50)] as median_fcr_improvement,

  -- Mortality metrics (Broiler Bill)
  AVG(mortality_reduction_pct) as avg_mortality_reduction,

  -- Problem solved (Backyard Betty)
  COUNTIF(problem_solved IS NOT NULL) / COUNT(*) as problem_solved_rate,

  -- Universal
  COUNTIF(would_recommend) / COUNT(*) as recommend_rate,
  AVG(recommendation_score) as avg_nps

FROM cdp.product_outcomes
WHERE days_on_product >= 60
  AND collected_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 180 DAY)
GROUP BY 1, 2
HAVING total_responses >= 10
ORDER BY avg_fcr_improvement DESC NULLS LAST;
```

### D. Content Gap Matrix

```sql
-- Full persona × stage content coverage matrix
WITH content_scored AS (
  SELECT
    url,
    title,
    page_type,
    -- Persona scores from vector similarity (would come from Supabase)
    0.75 as broiler_bill_score,  -- Placeholder
    0.60 as backyard_betty_score, -- Placeholder
    -- Stage inference from content
    CASE
      WHEN REGEXP_CONTAINS(LOWER(title || ' ' || COALESCE(meta_description, '')),
           r'(hidden cost|did you know|signs of|warning)') THEN 'unaware'
      WHEN REGEXP_CONTAINS(LOWER(title || ' ' || COALESCE(meta_description, '')),
           r'(why does|what causes|problem|issue)') THEN 'aware'
      WHEN REGEXP_CONTAINS(LOWER(title || ' ' || COALESCE(meta_description, '')),
           r'(cost of waiting|what happens if|ignore|worse)') THEN 'receptive'
      WHEN REGEXP_CONTAINS(LOWER(title || ' ' || COALESCE(meta_description, '')),
           r'(vs|compare|best|review|guide 202)') THEN 'zmot'
      WHEN REGEXP_CONTAINS(LOWER(title || ' ' || COALESCE(meta_description, '')),
           r'(faq|safe|how to use|application|dosage)') THEN 'objections'
      WHEN REGEXP_CONTAINS(LOWER(title || ' ' || COALESCE(meta_description, '')),
           r'(getting started|what to expect|welcome|your order)') THEN 'test_prep'
      WHEN REGEXP_CONTAINS(LOWER(title || ' ' || COALESCE(meta_description, '')),
           r'(week \d|day \d|troubleshoot|not working)') THEN 'challenge'
      WHEN REGEXP_CONTAINS(LOWER(title || ' ' || COALESCE(meta_description, '')),
           r'(success|results|case study|testimonial)') THEN 'success'
      ELSE 'general'
    END as inferred_stage
  FROM website_content
  WHERE site_id = 'southland-organics'
),
matrix AS (
  SELECT
    CASE
      WHEN broiler_bill_score > backyard_betty_score AND broiler_bill_score > 0.6 THEN 'broiler_bill'
      WHEN backyard_betty_score > 0.6 THEN 'backyard_betty'
      ELSE 'general'
    END as persona,
    inferred_stage as stage,
    COUNT(*) as content_count
  FROM content_scored
  GROUP BY 1, 2
)
SELECT
  persona,
  MAX(IF(stage = 'unaware', content_count, 0)) as unaware,
  MAX(IF(stage = 'aware', content_count, 0)) as aware,
  MAX(IF(stage = 'receptive', content_count, 0)) as receptive,
  MAX(IF(stage = 'zmot', content_count, 0)) as zmot,
  MAX(IF(stage = 'objections', content_count, 0)) as objections,
  MAX(IF(stage = 'test_prep', content_count, 0)) as test_prep,
  MAX(IF(stage = 'challenge', content_count, 0)) as challenge,
  MAX(IF(stage = 'success', content_count, 0)) as success,
  MAX(IF(stage = 'general', content_count, 0)) as general
FROM matrix
GROUP BY 1
ORDER BY 1;
```

### E. Non-Converter Analysis

```sql
-- Engaged visitors who didn't convert - find patterns
WITH engaged_non_converters AS (
  SELECT
    e.anonymous_id,
    ARRAY_AGG(DISTINCT e.page_url ORDER BY e.timestamp) as pages_viewed,
    ARRAY_AGG(DISTINCT COALESCE(s.query, '')) as searches,
    COUNT(DISTINCT e.session_id) as sessions,
    MAX(e.persona_score_broiler_bill) as bb_score,
    MAX(e.persona_score_backyard_betty) as betty_score,
    MAX(e.detected_stage) as last_stage
  FROM cdp.events e
  LEFT JOIN cdp.events s ON e.anonymous_id = s.anonymous_id AND s.event = 'search_performed'
  WHERE e.event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    AND e.anonymous_id NOT IN (
      SELECT DISTINCT anonymous_id
      FROM cdp.events
      WHERE event = 'order_completed'
    )
  GROUP BY 1
  HAVING sessions >= 2  -- Engaged = multiple sessions
    AND (bb_score > 0.6 OR betty_score > 0.6)  -- Matched a persona
)
SELECT
  CASE WHEN bb_score > betty_score THEN 'broiler_bill' ELSE 'backyard_betty' END as persona,
  last_stage,
  COUNT(*) as non_converters,
  -- Most common last page before leaving
  APPROX_TOP_COUNT(pages_viewed[SAFE_OFFSET(ARRAY_LENGTH(pages_viewed)-1)], 5) as common_exit_pages,
  -- Common searches
  APPROX_TOP_COUNT(searches[SAFE_OFFSET(0)], 5) as common_searches
FROM engaged_non_converters
GROUP BY 1, 2
ORDER BY non_converters DESC;
```

---

## Summary

This playbook provides a comprehensive framework for transforming Southland Organics from a generic e-commerce site into a **persona-aware, journey-stage-intelligent platform**.

### Key Components

1. **4 Personas** - Broiler Bill, Backyard Betty, Turf Pro Taylor, Mold Molly
2. **10 Journey Stages** - unAware through Evangelist
3. **5 CDP Features** - Decision Engine, Poultry Guide, Semantic Search, Persona Scoring, Reality Tunnels
4. **Outcome Tracking** - FCR, mortality, problem-solved as proof points
5. **Gap Analysis** - Monthly identification of content needs

### Success Metrics

| Metric | Current | Target (6mo) |
|--------|---------|--------------|
| Homepage → Persona path selection | N/A | 60% |
| Guide completion rate | N/A | 40% |
| Aware → ZMOT conversion | Unknown | 25% |
| ZMOT → Purchase conversion | Unknown | 15% |
| Outcome survey response rate | 0% | 20% |
| Repeat purchase rate | Unknown | +20% |

### Next Steps

1. **Week 1:** Implement Decision Engine homepage
2. **Week 2:** Build Poultry Guide
3. **Week 3:** Deploy outcome surveys
4. **Week 4:** Launch semantic search
5. **Weeks 5-8:** Build persona scoring + Reality Tunnels

---

*Document created: February 2026*
*Last updated: February 2026*
*Owner: Southland Platform Team*
