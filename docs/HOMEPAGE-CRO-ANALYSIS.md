# Homepage CRO Analysis & Space Allocation Report

**Date:** 2026-03-23
**Period analyzed:** Last 90 days (Dec 23, 2025 — Mar 23, 2026)
**Data sources:** Nexus (Supabase), BigQuery CDP, persona-profiles.ts
**Persona model:** 10 personas, 3 segments (Poultry, Turf & Soil, Waste)

---

## Executive Summary

Bill is the revenue engine — 51% of Shopify and 72% of total. The homepage should route visitors into **3 segment lanes** (Poultry, Turf & Soil, Waste) that then fan out into 10 persona-specific experiences. The homepage itself must signal commercial credibility first (Bill), while giving Betty, Taylor, Hannah, and Sam clear on-ramps. Turf & Soil is the most under-invested segment relative to its 16% Shopify share — and it's spring.

---

## The Persona Model (10 personas, 3 segments)

### Poultry Segment (5 personas)

| Persona | Slug | Who | Weight | Customers | Avg LTV | Revenue Goal |
|---------|------|-----|--------|-----------|---------|-------------|
| **Broiler Bill** | bill | Contract grower, 3-6 houses, 150K-400K birds/yr | 44% | 574 | $903 | 55% |
| **Backyard Betty** | betty | Small flock, 5-25 birds, homesteader | 48% | 1,087 | $77 | 30% |
| **Breeder Bob** | bob | Breeder/pullet grower, hatchability focus | 0% | 0 | — | — |
| **Turkey Tom** | tom | Commercial turkey, 15-20 week grow-outs | 0% | 0 | — | — |
| **Game Bird Greg** | greg | Quail/pheasant/chukar, hunting preserves | 0% | 0 | — | — |

### Turf & Soil Segment (4 personas)

| Persona | Slug | Who | Weight | Customers | Revenue Goal |
|---------|------|-----|--------|-----------|-------------|
| **Turf Pro Taylor** | taylor | Lawn care pro, golf super, sports turf | 8% | 0 | 15% |
| **Golf Course Gary** | gary | Championship-level turf superintendent | 0% | 0 | — |
| **Homeowner Hannah** | hannah | Suburban homeowner, kids & pets safety | 0% | 0 | — |
| **Market Gardener Maggie** | maggie | Small-scale intensive, farmers market | 0% | 0 | — |

### Waste Segment (1 persona)

| Persona | Slug | Who | Weight | Customers | Revenue Goal |
|---------|------|-----|--------|-----------|-------------|
| **Septic Sam** | sam | Homeowner/facility manager, septic & odor | 0% | 0 | — |

**Note:** Only Bill (44%) and Betty (48%) have scored weights and customer counts. Taylor has 8% weight. The remaining 7 personas are greenfield with zero scored customers. Lander status: Bill (/poultry/commercial/) and Betty (/poultry/backyard/) live; Bob, Tom, Greg landers built; Taylor, Gary, Hannah, Maggie, Sam — no landers.

---

## 1. Revenue by Segment

### All Channels (90 days, $425K)

| Segment | Revenue | % Total |
|---------|---------|---------|
| **Poultry** | $353,027 | **83.0%** |
| **Turf & Soil** | $49,076 | **11.5%** |
| **Waste** | $18,261 | **4.3%** |
| Unclear | $5,055 | 1.2% |

### Shopify Only ($116K)

| Segment | Revenue | % Shopify |
|---------|---------|-----------|
| **Poultry** | $88,499 | **76.2%** |
| **Turf & Soil** | $18,684 | **16.1%** |
| **Waste** | $5,431 | **4.7%** |
| Unclear | $3,586 | 3.1% |

---

## 2. Revenue by Persona

### All Channels ($425K)

| Persona | Revenue | % Total | Shopify | B2B |
|---------|---------|---------|---------|-----|
| **Broiler Bill** | $304,741 | **71.6%** | $59,342 | $245,399 |
| **Backyard Betty** | $48,286 | **11.4%** | $29,157 | $19,129 |
| **Turf Pro Taylor** | $34,206 | **8.0%** | $14,286 | $19,920 |
| **Septic Sam** | $18,261 | **4.3%** | $5,431 | $12,830 |
| **Homeowner Hannah** | $14,360 | **3.4%** | $3,888 | $10,472 |
| Market Gardener Maggie | $510 | 0.1% | $510 | $0 |
| Breeder Bob | — | — | — | — |
| Turkey Tom | — | — | — | — |
| Game Bird Greg | — | — | — | — |
| Golf Course Gary | — | — | — | — |

*Bob, Tom, Greg, and Gary revenue is currently lumped into Bill (same products, can't distinguish buyer type from order data alone). Real revenue exists for all four — it's just invisible in the data.*

### Shopify Only ($116K) — what the homepage directly drives

| Persona | Revenue | % Shopify |
|---------|---------|-----------|
| **Broiler Bill** | $59,342 | **51.1%** |
| **Backyard Betty** | $29,157 | **25.1%** |
| **Turf Pro Taylor** | $14,286 | **12.3%** |
| **Septic Sam** | $5,431 | **4.7%** |
| **Homeowner Hannah** | $3,888 | **3.3%** |
| Market Gardener Maggie | $510 | 0.4% |

---

## 3. Revenue by Channel

| Channel | Orders | Revenue | % Rev | AOV |
|---------|--------|---------|-------|-----|
| B2B (manual/phone/PO) | 156 | $310,068 | 73% | $1,988 |
| Shopify (ecommerce) | 815 | $116,510 | 27% | $143 |
| **Total** | **971** | **$426,578** | **100%** | **$439** |

### Monthly Trend

| Month | Shopify | B2B | Total |
|-------|---------|-----|-------|
| 2026-01 | $47,791 (329 orders) | $72,998 (58) | $120,789 |
| 2026-02 | $37,297 (266) | $93,184 (44) | $130,481 |
| 2026-03 | $31,422 (220) | $143,885 (54) | $175,307 |

**B2B accelerating strongly.** Shopify declining (Jan $48K → Mar $31K). Shopify decline is the problem the homepage needs to solve.

---

## 4. Customer Patterns

### AOV Distribution (90 days)

| Bucket | Orders | % Orders | Revenue | % Revenue |
|--------|--------|----------|---------|-----------|
| $0–$50 | 310 | 31.9% | $9,414 | 2.2% |
| $50–$100 | 181 | 18.6% | $13,480 | 3.2% |
| $100–$200 | 211 | 21.7% | $32,183 | 7.5% |
| $200–$500 | 158 | 16.3% | $50,640 | 11.9% |
| $500–$1K | 47 | 4.8% | $33,343 | 7.8% |
| $1K–$5K | 44 | 4.5% | $111,246 | 26.1% |
| $5K+ | 17 | 1.8% | $176,480 | **41.4%** |

**6.3% of orders (>$1K) = 67.5% of revenue.** These are Bill.

### Repeat Purchase

| Segment | Customers | % | Revenue | % Rev |
|---------|-----------|---|---------|-------|
| One-time | 521 | 85.0% | $117,634 | 29.6% |
| Repeat (2+) | 92 | 15.0% | $279,829 | **70.4%** |

### Shopify Frequency (all time)

| Orders | Customers | % | Revenue |
|--------|-----------|---|---------|
| 1 order | 466 | 87.1% | $55,304 |
| 2 orders | 48 | 9.0% | $23,465 |
| 3–5 | 18 | 3.4% | $15,774 |
| 6+ | 3 | 0.6% | $6,139 |

**87% buy once and never return.** Repeat purchase is the #1 Shopify growth lever.

---

## 5. Top Products by Persona

### Broiler Bill (Shopify $59K)

| Product | Revenue | Notes |
|---------|---------|-------|
| Big Ole Bird 2x2.5G Case | $21,168 | 90% margin, #1 SKU |
| Big Ole Bird 4x1G Case | $8,143 | Case format = commercial signal |
| Litter Life 2x2.5G | $4,140 | Consumable, high reorder |
| Mother Load ACV 2x2.5G | $3,962 | Commercial ACV |
| Hen Helper 2x2.5G | $4,508 | Pro-size electrolyte |

### Backyard Betty (Shopify $29K)

| Product | Revenue | Notes |
|---------|---------|-------|
| Catalyst Vitamins 800g | ~$9K | Highest unit volume (316 units) |
| Catalyst Vitamins 400g | ~$4K | Smaller size = entry point |
| Big Ole Bird 2.5G | $4,938 | Single jug, not case |
| Big Ole Bird 1G | $1,847 | Starter size |
| Desecticide (small) | ~$2K | Mite control, backyard |
| Backyard Bundle | $1,197 | Low revenue, but gateway |

### Turf Pro Taylor (Shopify $14K)

| Product | Revenue | Notes |
|---------|---------|-------|
| Torched 2.5G | ~$5K | Professional size |
| Torched 2x2.5G Case | $7,658 | Case = pro buyer signal |
| Omega Soil Activator | ~$2K | Soil biology |

### Homeowner Hannah (Shopify $4K)

| Product | Revenue | Notes |
|---------|---------|-------|
| Torched 1 Gallon | ~$3.5K | Consumer size weed killer |
| FertAlive/Veridian | ~$400 | Small lawn products |

### Septic Sam (Shopify $5K)

| Product | Revenue | Notes |
|---------|---------|-------|
| PORT 2.5 Gallon | $2,538 | Entry size |
| PORT Subscription | $1,204 | **Recurring revenue** |
| PORT 4x1G Case | (mostly B2B) | Commercial/campground |

---

## 6. Homepage Space Allocation

### Architecture: 3 Segment Lanes → 10 Personas

The homepage should NOT try to address 10 personas. It should route into **3 segment lanes** that then fan out:

```
Homepage
├── Poultry tile → /poultry/ hub
│   ├── /poultry/commercial/     (Bill)
│   ├── /poultry/backyard/       (Betty)
│   ├── /poultry/breeders/       (Bob)
│   ├── /poultry/turkey/         (Tom)
│   └── /poultry/game-birds/     (Greg)
├── Turf & Soil tile → /lawn/ hub
│   ├── /lawn/                   (Taylor)
│   ├── /lawn/golf/              (Gary)
│   ├── /lawn/homeowner/         (Hannah)
│   └── /garden/                 (Maggie)
└── Waste tile → /waste/ hub
    └── /waste/                  (Sam)
```

### The 100-Point Attention Budget

| Section | Points | Rationale |
|---------|--------|-----------|
| **Hero / Primary CTA** | **25** | Bill-credible tone. Science + outcomes. Secondary CTA for B2B/wholesale. |
| **Segment Router Tiles** | **20** | 3 tiles: Poultry, Turf & Soil, Waste. Each routes to a segment hub page. |
| **Featured Products** | **20** | 8 products weighted by segment: 5 poultry, 2 turf, 1 waste. |
| **Science / Trust / Proof** | **15** | Microbial science, outcome data, certifications. Universal converter. |
| **Social Proof** | **10** | Reviews, Allen's YouTube, farm stories, Tuck Farms. |
| **Human / Team** | **5** | Allen + team. E-E-A-T. Brief. |
| **Secondary CTAs** | **5** | B2B/distributor, newsletter, wholesale inquiry. |

### Segment Tile Design

| Tile | Position | Shopify Share | All-Channel | Key Signal |
|------|----------|---------------|-------------|------------|
| **Poultry** | 1st | 76.2% ($88K) | 83.0% ($353K) | "Commercial & Backyard Poultry Solutions" — signals both Bill and Betty |
| **Turf & Soil** | 2nd | 16.1% ($19K) | 11.5% ($49K) | "Lawn, Turf & Soil Biology" — captures Taylor, Hannah, Gary, Maggie |
| **Waste** | 3rd | 4.7% ($5K) | 4.3% ($18K) | "Septic & Waste Treatment" — Sam's niche, 88% margin |

**Why 3 tiles, not 4 or 10:**

- 10 tiles = paralysis of choice. No one reads 10 options.
- 4 tiles (the old model) incorrectly splits poultry into "commercial" and "backyard" at the homepage level — Betty and Bill both need to see "Poultry" and self-sort on the hub page.
- 3 tiles maps cleanly to the 3 segments in persona-profiles.ts.
- Each segment hub page then does the persona routing (Bill vs Betty vs Bob vs Tom vs Greg on the poultry hub, etc.)

### Featured Products (8 slots)

Weighted by Shopify segment share: 76% poultry → 5 slots, 16% turf → 2 slots, 5% waste → 1 slot.

| Slot | Product | Shopify Rev | Persona | Why |
|------|---------|-------------|---------|-----|
| 1 | **Big Ole Bird 2x2.5G Case** | $21,168 | Bill | #1 product, 90% margin, 51% of Shopify is Bill |
| 2 | **Catalyst Vitamins** | $11,755 | Betty | #2 Shopify, highest unit volume |
| 3 | **Torched 2x2.5G Case** | $7,658 | Taylor | Spring seasonal, captures non-poultry traffic |
| 4 | **Big Ole Bird 4x1G Case** | $8,143 | Bill | Case format signals "we serve real operations" |
| 5 | **Hen Helper 2x2.5G** | $4,508 | Betty | Gateway product, 91% margin |
| 6 | **Torched 1 Gallon** | $3,448 | Hannah | Consumer entry point for Turf segment |
| 7 | **Litter Life 2x2.5G** | $4,140 | Bill | Commercial consumable, high reorder |
| 8 | **PORT 2.5 Gallon** | $2,538 | Sam | 88% margin, subscription funnel entry |

### Hero Strategy

**Bill-credible, segment-inclusive.** Bill is 51% of Shopify and decisive — if the hero reads "backyard hobbyist" or "homeowner lawn care," he bounces. Betty, Hannah, and Taylor are more exploratory.

- **Headline:** "Science-backed solutions for healthier flocks, greener turf, and cleaner systems."
- **Imagery:** Commercial farm + professional turf, not cute backyard chickens
- **Primary CTA:** Routes to segment tiles ("Find Your Program")
- **Secondary CTA:** "Talk to a Specialist" (captures B2B leads — $310K channel)

**Seasonal rotation:**

| Season | Hero Emphasis | Products |
|--------|--------------|----------|
| Spring (Mar–May) | Turf & weed season | Torched, Omega, lawn subscription |
| Summer (Jun–Aug) | Poultry heat stress | Big Ole Bird, Catalyst, Hen Helper |
| Fall (Sep–Nov) | Litter management + game bird season | Litter Life, pre-hunting prep |
| Winter (Dec–Feb) | Indoor poultry + septic maintenance | Big Ole Bird, PORT subscription |

---

## 7. Opportunities & Risks

### Quick Wins

| Opportunity | Data Signal | Impact |
|-------------|------------|--------|
| **Turf & Soil segment tile on homepage** | 16.1% of Shopify with ~0% homepage visibility. Spring NOW. | Even modest visibility = $3-5K/quarter lift |
| **B2B lead capture in hero** | 73% of revenue is B2B. Zero homepage lead capture. | Each distributor = $5-50K/yr recurring |
| **Separate Hannah from Taylor in routing** | Hannah is $4K Shopify buying 1G consumer sizes. Taylor language rules say AVOID "homeowner/lawn/yard." | Mismatched messaging loses both. Clear lane = higher conversion. |
| **Catalyst Vitamins visibility** | #2 Shopify product. Highest unit volume. | Repeat purchase driver — feature prominently |
| **PORT subscription funnel** | 88% margin + existing subscription product | Only persona with built-in recurring revenue model |

### Mismatches

| Mismatch | Current | Data Says |
|----------|---------|-----------|
| **4-persona homepage model** | Old tiles: Backyard / Commercial / Lawn / Septic | 10 personas in 3 segments. Homepage should route to segments, not personas. |
| **Taylor and Hannah share a lane** | Same products (Torched) but fundamentally different buyers | Taylor: "application rate, program, turf, accounts." Hannah: "lawn, yard, easy, safe for family." They need separate landers. |
| **Bob/Tom/Greg invisible** | Revenue lumped into Bill | Real customers exist. /poultry/ hub should showcase all 5 poultry personas. |
| **Shopify declining** | Jan $48K → Mar $31K | Homepage may be contributing. Monitor post-redesign. |

### Risks

| Risk | Mitigation |
|------|------------|
| Making hero too commercial alienates Betty/Hannah | Segment tiles immediately below let them self-select |
| 3 tiles feels too few vs current 4 | Each tile opens a rich hub page. Homepage simplicity = segment hub depth. |
| Over-investing in greenfield personas (0 revenue) | Keep homepage focused on proven revenue. Hub pages can experiment. |
| Margin data integrity | Catalyst and Biosecurity show impossible margins. Fix unit_cost in Nexus. |

---

## 8. Summary: Who Gets What

### Homepage Attention by Segment

| Segment | % of Homepage | Justification |
|---------|---------------|---------------|
| **Poultry** | **55%** | 76% of Shopify, 83% of total. Hero tone, 5 product slots, first tile. |
| **Turf & Soil** | **25%** | 16% of Shopify + biggest growth gap + spring. 2 product slots, second tile, seasonal hero. |
| **Waste** | **10%** | 5% of Shopify but 88% margin, subscription model. 1 product slot, third tile. |
| **Cross-segment** | **10%** | B2B CTA, trust/team/social proof. Serves all personas. |

### Within Poultry (on the /poultry/ hub, NOT homepage)

| Persona | Hub Weight | Rationale |
|---------|-----------|-----------|
| **Bill** | 40% | 51% of Shopify, revenue engine |
| **Betty** | 35% | 25% of Shopify, highest customer count, digital-native |
| **Bob** | 10% | Real customers, lander built, breeder-specific JTBD |
| **Tom** | 10% | Real customers, lander built, turkey-specific JTBD |
| **Greg** | 5% | Niche but Tuck Farms = world-class proof |

### Within Turf & Soil (on the /lawn/ hub, NOT homepage)

| Persona | Hub Weight | Rationale |
|---------|-----------|-----------|
| **Taylor** | 40% | Professional buyer, $34K all-channel, 8% weight |
| **Hannah** | 30% | $14K all-channel, consumer buyer, subscription product |
| **Gary** | 20% | High-value B2B ($2-5K/account), pillar page exists |
| **Maggie** | 10% | Greenfield, $510 Shopify, but aligned values with Betty |

---

## Appendix: Key Numbers

| Metric | Value |
|--------|-------|
| 90-day total revenue | $426,578 |
| 90-day Shopify | $116,510 |
| 90-day B2B | $310,068 |
| Shopify AOV | $143 |
| B2B AOV | $1,988 |
| Orders >$1K → % of revenue | 6.3% → 67.5% |
| Repeat customers → % of revenue | 15% → 70.4% |
| Shopify 1-time buyers | 87.1% |
| #1 product (BOB 2x2.5G) share | 32.9% |
| Top 5 products share | 62.6% |
| Bill share of Shopify | 51.1% |
| Betty share of Shopify | 25.1% |
| Taylor share of Shopify | 12.3% |
| Sam share of Shopify | 4.7% |
| Hannah share of Shopify | 3.3% |
| Total personas | 10 |
| Personas with scored customers | 2 (Bill, Betty) |
| Personas with landers built | 5 (Bill, Betty, Bob, Tom, Greg) |
| Personas with zero infrastructure | 5 (Taylor, Gary, Hannah, Maggie, Sam) |
