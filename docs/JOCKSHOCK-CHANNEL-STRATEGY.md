# JockShock Channel Strategy — Canonical, SEO & PMax

**Task:** T-904 · **Owner:** Mike · **Status:** decision memo (workstream 2 keystone) · **Date:** 2026-06-08

> Grounded in: `mothership/docs/brands/southland-organics/jockshock/brand-brief.md`, `mothership/scripts/jockshock-kw-round2.mjs` (keyword findings), `mothership/scripts/lib/dataforseo.js` (registry), `apps/astro-content/src/pages/products/[handle].astro` (current canonical), T-904 description (provenance of the feed leak).

---

## TL;DR

We have **two live storefronts selling the same product**: `southlandorganics.com/products/jockshock/` (Southland PDP) and `jockshockspray.com` (the intended brand home). They split Google's signals. The constraint from Mike (2026-06-07) is firm: **own the channel properly, but do NOT de-feature the Southland PDP — sales are sales.**

**Recommendation: jockshockspray.com is the SEO canonical; the Southland PDP stays live, featured, and selling, but cross-domain `rel=canonical`s to the brand domain.** This consolidates organic equity on the brand without touching the working Southland buy-path or its conversion. Detail + the two rejected alternatives below.

---

## Current state (verified)

| Fact | Source | Implication |
|------|--------|-------------|
| Southland PDP canonicalizes to **itself** (`${siteUrl}/products/${handle}/`) | `[handle].astro:209` | Today both domains claim their own equity → split signals |
| Southland PDP organic footprint ≈ **zero** (1 junk impression @ pos 66, May–Jun GSC) | T-904 | We are NOT giving up meaningful Southland organic by pointing canonical away |
| jockshockspray.com **not verified in GSC** (`gsc_ready:false`) | `dataforseo.js:99` | Flying blind on the domain we want to win — fix in workstream 1 |
| Tier-1 commercial head terms are **ghosts** (no DFS volume) | `jockshock-kw-round2.mjs:6` | Don't anchor SEO to "athletic gear deodorizer" — no one searches it |
| Real wedges: **mouthguard cleaner ~8,100/mo**, **shoe deodorizer ~9,900/mo** | `jockshock-kw-round2.mjs:7-8` | These are where organic equity should compound — on the brand domain |
| JockShock is a **closed brand** — no cross-sell to Southland core, different audience/voice | brand-brief.md:52,339 | Strong strategic argument the brand domain, not Southland, is the true home |
| The "PMax" sale (order 22810) was a **free Surfaces-Across-Google crawl listing**, not a paid campaign; `utm_campaign=pmax` was the Astro `srsltid` fallback | T-904 | There is no real paid JockShock campaign yet (workstream 3) |

---

## The decision: three canonical options

### Option A — Southland PDP canonical (status quo-ish)
Keep equity on `southlandorganics.com/products/jockshock/`.
- ➖ Fights the closed-brand strategy (brand-brief says JockShock is its own world).
- ➖ Anchors the product's organic future to a domain with zero JockShock footprint and a poultry/turf reputation Aaron doesn't trust.
- ➖ The mouthguard/shoe-deodorizer wedges would build equity under the wrong roof.
- ➕ Zero work.

### Option B — jockshockspray.com canonical, Southland PDP `noindex`
Point equity to the brand domain AND remove the Southland PDP from the index.
- ➖ **Violates Mike's constraint** — `noindex` de-features/hides the Southland buy-path. The free Surfaces-Across-Google listing that produced order 22810 depends on the PDP being crawlable/indexable. `noindex` kills that revenue path.
- ➕ Cleanest possible signal consolidation.

### Option C — jockshockspray.com canonical, Southland PDP stays indexed + cross-domain `rel=canonical` ✅ RECOMMENDED
Southland PDP keeps selling, stays in the feed, stays crawlable — but its `<link rel=canonical>` points to the brand domain's product URL. Google consolidates ranking signals onto jockshockspray.com while the Southland PDP continues to convert and stays eligible for the free Merchant Center surface.
- ➕ Honors "don't de-feature the PDP" — page stays live, featured, indexed, selling.
- ➕ Consolidates organic equity on the brand domain where the mouthguard/shoe wedges should compound.
- ➕ Reversible — it's one frontmatter field.
- ⚠️ Cross-domain canonicals are a *hint*, not a directive — Google may occasionally still surface the Southland URL. That's fine here: a Southland surfacing still converts (sales are sales). We lose nothing; we just stop the two domains from actively diluting each other.
- ⚠️ Requires the brand-domain product URL to exist and be stable to point at. Confirm the jockshockspray.com product URL before flipping.

---

## Implementation (Option C) — when approved

The PDP template already supports a `canonicalUrl` override end-to-end: `BaseLayout.astro:39` (`fullCanonicalUrl = canonicalUrl || …`) is fed by `[handle].astro:209`. Two-line change, no new infra:

1. Add `canonicalUrl` to `jockshock.mdx` frontmatter (or a per-handle override map in `[handle].astro`) → set to the canonical jockshockspray.com product URL.
2. In `[handle].astro`, prefer the MDX `canonicalUrl` when present:
   ```ts
   const canonicalUrl = entry.data.canonicalUrl || `${siteUrl}/products/${handle}/`
   ```
3. Leave everything else (feed eligibility, Add-to-Cart, indexing) untouched.

**Do NOT implement until Mike confirms the canonical direction AND the exact jockshockspray.com product URL to point at.** This memo is the decision artifact; the code change is gated on sign-off.

---

## Sequencing across the three workstreams

1. **Workstream 1 (GSC)** can proceed immediately and independently — verify the domain, flip `gsc_ready:true`, start collecting brand-domain search data. (Done/ready — see T-904 comment.)
2. **Workstream 2 (this memo)** → Mike picks A/B/C. Recommended: C.
3. **Workstream 3 (PMax)** landing-page target = output of #2. If C, PMax can still land on the Southland PDP buy-path (it converts) while organic equity accrues to the brand domain — or land on jockshockspray.com once that buy-path is confirmed solid. Draft spec in `JOCKSHOCK-PMAX-SPEC.md`.
