# JockShock PMax — Campaign Spec (DRAFT, NOT LAUNCHED)

**Task:** T-904 workstream 3 · **Owner:** Mike · **Status:** draft for review — **do not launch without Mike's explicit go (money-affecting)** · **Date:** 2026-06-08

> Follows `mothership/docs/advertising/SOUTHLAND-AD-OPERATING-SYSTEM.md` doctrine. Account: Southland Google Ads customer `2306196805`, merchant `10041762`. Persona + claims pulled from `mothership/docs/brands/southland-organics/jockshock/brand-brief.md`. Keyword reality from `jockshock-kw-round2.mjs`.

---

## ⚠️ Gating

There is **no paid JockShock campaign today** — only the accidental free Surfaces-Across-Google crawl listing (T-904 provenance). This is a *net-new* campaign that spends money. **I draft; Mike launches.** Per doctrine: build **paused**, re-verify after build, then Mike enables.

## ⚠️ Landing page is gated on the canonical decision

Workstream 3's landing target = output of `JOCKSHOCK-CHANNEL-STRATEGY.md`. Two valid options once Mike decides:
- If **Option C** (recommended): land PMax on the Southland PDP buy-path (`/products/jockshock/` — it converts and stays featured) OR on jockshockspray.com once that buy-path is confirmed solid. Both are consistent with "don't de-feature the PDP."
- Either way, **do not point the campaign at a page that's mid-canonical-change.** Confirm the landing URL is final before enabling.

---

## Campaign structure

| Element | Spec |
|---------|------|
| **Type** | Performance Max |
| **Goal** | Sales (online conversions) |
| **Account** | customer `2306196805` |
| **Merchant** | `10041762` |
| **Language** | `1000` (English) — per doctrine, tight |
| **Listing group** | **item_id-scoped to JockShock SKUs only** (single 32oz, 3-pack, 6-pack). NOT category/brand-level — keeps the feed-driven side of PMax from bleeding into Southland core products. |
| **State at build** | **PAUSED.** Re-verify listing tree + landing URL, then Mike enables. |

## Audience signals (creative IS the signal — doctrine)

PMax can't strictly target a persona; we *signal* Aaron-the-Athlete:
1. **Customer Match list** — JockShock buyers / `/teams` intake submissions (closed brand — do NOT seed with Southland core lists; would pollute the signal and violate brand-brief.md:339).
2. **Custom audience** — search/intent signals around the *real* wedges (below), plus competitor-brand and sport-gear in-market.
3. **Custom variable** `persona_slug` on offline conversions for reporting slice (per doctrine #3).

## Creative angle (situation-first, from persona pain — doctrine #5)

Anchor to the validated search wedges, **not** the ghost head terms:
- **Mouthguard cleaner (~8,100/mo)** — situation-first: smell/hygiene of the thing in your mouth.
- **Shoe deodorizer (~9,900/mo)** — Mike-confirmed Southland has "great results"; biggest single volume.
- **Gear/bag odor** — the core JockShock story (helmet liners, pads, gear bag).

Voice = Aaron. Pull pain points from the brand brief personas. Headlines synthesize situation → solution.

## 🔒 Claims register — HARD compliance filter

JockShock copy/headlines MUST pass the same filter as `jockshock-kw-round2.mjs` FORBIDDEN_PATTERNS. **Never** use in any asset: `kill`, `sanitize/sanitizer`, `disinfect`, `antimicrobial`, `antibacterial`, `EPA-registered/approved`, `hospital-grade`, `FDA-approved`, `24-hour`, `HOCl` / `hypochlorous acid`, `staph`, `MRSA`. Frame as **deodorizer / odor elimination / gear care** — never a sanitizing or kill claim. (This is also why "athletic gear sanitizer" head terms are off-limits even where they have volume.)

## Pre-launch checklist (Mike runs)

- [ ] Canonical decision made (workstream 2) → landing URL final
- [ ] Listing group verified item_id-scoped to JockShock SKUs only (re-check after build — PMax can silently widen)
- [ ] All assets pass the claims filter
- [ ] Customer Match list seeded from JockShock buyers ONLY (no Southland core)
- [ ] Campaign built PAUSED, re-verified, then enabled by Mike
- [ ] `persona_slug` custom variable wired on conversions

> Reusable diagnosis scripts already exist in mothership: `find-jockshock-pmax.py`, `inspect-pmax-listing-trees.py`, `check-jockshock-in-feed.py`. Use `inspect-pmax-listing-trees.py` to verify the listing group post-build.
