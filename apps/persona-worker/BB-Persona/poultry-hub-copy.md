# Poultry Hub — `/poultry/` Copy Doc

**Page:** `/poultry/`
**Persona:** General (routes to Bill or Betty)
**Page Type:** Hub (routing page, NOT a full StoryBrand lander)
**Generated:** 2026-03-05
**Status:** Ready for page build

---

## Data Brief

### Page Purpose

This is a **routing page** that sits between awareness traffic and the two persona landers (`/poultry/commercial/` and `/poultry/backyard/`). Visitors arrive from:

- Organic search ("poultry probiotics", "chicken health products")
- Direct nav (Shopify menu, header links)
- Internal links (blog posts, podcast episodes)

The page must answer three questions in under 5 seconds:
1. What does Southland do for poultry? (Authority)
2. Am I in the right place? (Self-selection)
3. Where do I go next? (Routing)

### Design Principle

**Short and decisive.** This page should be 3-4 sections max. It is not competing with the persona landers — it's feeding them. Every element either builds trust or routes traffic. Nothing else.

### Keywords (SEO)

1. organic poultry solutions
2. poultry probiotics
3. chicken health products
4. backyard chicken supplements
5. commercial poultry gut health
6. natural poultry care
7. organic chicken probiotic
8. poultry litter treatment
9. broiler supplements organic
10. backyard flock health

---

## Section 1: Hero

**Background:** `CloudinaryHero` with poultry image. Use `Southland Website/poultry/` folder — a bright, clean exterior shot (NOT dark interior). Overlay `gradient`, opacity 85%, `priority={true}`.

**Badge:**
```
Organic Poultry Solutions Since 2009
```

**H1:**
```
HEALTHIER BIRDS START WITH BETTER BIOLOGY.
```

Framework: AIDA (Attention). Passes 3-second test: what (bird health), how (biology, not chemicals), credibility (implies science). Works for both Bill and Betty.

**Lead-in:**
```
Probiotics, litter treatments, and gut health products used on millions of commercial birds
and thousands of backyard flocks. USDA Organic certified. Zero withdrawal. Results you can measure.
```

**Trust bar (below lead-in):**
```
USDA Organic  |  OMRI Listed  |  Zero Withdrawal  |  Family-Owned Since 2009
```

---

## Section 2: Two Paths (The Fork)

**Background:** `bg-white`
**Max width:** `max-w-5xl`

**Section heading:**
```
WHICH BEST DESCRIBES YOUR OPERATION?
```

**Subhead:**
```
We make the same biology for both — but the products, dosing, and support are built
for how you actually raise birds.
```

### Card A: Commercial Poultry

**Card style:** `bg-[#F8FAF8]` with `border-[#2C5234]/20` border. Brand green accent, not amber.

**Heading:**
```
I Grow for an Integrator
```

**Body:**
```
Contract broiler growers running 2-8 houses. You're measured on mortality, FCR,
and settlement ranking — and every tenth of a point matters.
```

**Proof chip:**
```
6.2% mortality reduction — UGA validated
```

**CTA:**
```
See Commercial Solutions ->
```
Link: `/poultry/commercial/`

**Microcopy:**
```
Talk to Allen Reynolds, our poultry specialist with 10+ years in the houses.
```

### Card B: Backyard Flock

**Card style:** `bg-[#FFFBEB]` with `border-amber-200` border. Warm amber accent.

**Heading:**
```
I Keep a Backyard Flock
```

**Body:**
```
Hobby keepers with 5-50 birds. You want healthy, happy chickens and consistent eggs —
without a chemistry degree or a cabinet full of supplements.
```

**Proof chip:**
```
Same biology used on millions of commercial birds — sized for your flock
```

**CTA:**
```
Shop Backyard Products ->
```
Link: `/poultry/backyard/`

**Microcopy:**
```
Free shipping on orders over $50. Most keepers start with the Roost Bundle.
```

---

## Section 3: Authority Band

**Background:** `bg-[#2C5234]` (dark green)
**Max width:** `max-w-6xl`

**Heading (white):**
```
WHY POULTRY PEOPLE TRUST US
```

**4-stat grid:**

| Number | Label | Source |
|--------|-------|--------|
| 2009 | Formulating organic poultry products | Company founding |
| 6.2% | Mortality reduction in UGA-validated study | UGA / C. Stephen Roney DVM |
| 0 | Withdrawal period on every product we sell | USDA Organic certification |
| 500+ | Farms using Southland products | Internal customer data |

**Source line (bottom, muted):**
```
UGA Study, C. Stephen Roney DVM | USDA Organic Certified | OMRI Listed
```

---

## Section 4: Final CTA

**Background:** `CloudinaryHero` with different poultry image (exterior, warm tone). Overlay `dark`, opacity 88%.
**Max width:** `max-w-4xl`, centered.

**Heading (white):**
```
NOT SURE WHERE TO START?
```

**Body:**
```
Call us. We'll figure out which products make sense for your operation —
whether that's 4 houses or 4 hens.
```

**Primary CTA:**
```
Call 800-608-3755
```
(Phone icon, white button on dark background)

**Secondary link:**
```
Or browse all poultry products ->
```
Link: `/collections/poultry/` (or best-fit collection)

**Trust line:**
```
Family-owned in Georgia since 2009. Real people answer the phone.
```

---

## Validation Checklist

- [x] Routes to both persona landers clearly (two distinct cards)
- [x] 3-second test passes: "Organic poultry biology for commercial growers and backyard keepers"
- [x] Proof stats have real sources (UGA study cited, USDA certification)
- [x] CTA is persona-neutral (phone call works for both Bill and Betty)
- [x] No orphan page: clear next steps to both persona landers + phone fallback
- [x] Numbers lead: 6.2%, 2009, 500+ farms, 0 withdrawal
- [x] Anti-gimmick: no metaphors, no movie-script language, concrete operational words
- [x] Brand design: uses CloudinaryHero, dark green proof band, cream/white alternation
- [ ] Cloudinary images: need to confirm specific public IDs from `Southland Website/poultry/` folder
- [ ] Collection link: verify `/collections/poultry/` handle exists

### Section Rhythm

```
DARK (photo hero) -> WHITE (two paths) -> DARK (#2C5234 proof band) -> DARK (photo CTA)
```

This is shorter than a full StoryBrand lander (4 sections vs 8) because it's a routing page. The proof band prevents back-to-back white sections and establishes authority between the fork and the CTA.

### What This Page Does NOT Do

- No JTBD product cards (those live on persona landers)
- No objections/FAQ (those live on persona landers)
- No guide section (Allen is Bill's guide; company is Betty's guide — hub is neutral)
- No plan steps (each persona has their own plan)

This page exists to build trust and route fast. Nothing else.
