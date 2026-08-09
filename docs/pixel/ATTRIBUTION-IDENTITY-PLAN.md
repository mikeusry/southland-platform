# Attribution identity — verified findings and execution plan

**Written 2026-08-09.** Supersedes the diagnosis in
`mothership/docs/pixel/HANDOFF-attribution-identity-gap-2026-08-09.md`.

**Nothing in this plan has been executed except PR #78 (open, unmerged).**

---

## How to read this document

Every claim below is tagged:

- **[VERIFIED]** — I ran a command or read a file on `origin/main` this session, and
  named it. Reproducible.
- **[INHERITED]** — from the prior handoff. **Not re-checked.** Treat as a hypothesis.
- **[OPEN]** — a decision or an unknown.

The prior handoff's own warning applies here too: **an aggregate cannot disprove a
targeted structure, and a grep is not a read.** Where I state absence, I name the
command that could have found the thing.

---

## 1. What is actually true

### 1.1 The storefront bug — VERIFIED, fix open as PR #78

Cart-level attributes (Shopify `note_attributes`) are the **only** channel the Shopify
Web Pixel can read: its sandbox runs on the checkout origin
(`southland-organics.myshopify.com`), where storefront `sessionStorage` and per-line
properties are unreachable.

**[VERIFIED]** — live `2026-01` Storefront API, real carts, 2026-08-09:

| Fact | Evidence |
|---|---|
| `cartAttributesUpdate` exists in `2026-01` | GraphQL introspection of `Mutation` fields |
| Signature is `(cartId: ID!, attributes: [AttributeInput!]!)` | introspection; `AttributeInput = {key: String!, value: String!}` |
| **`cartLinesAdd` PRESERVES cart attributes but cannot SET them** | created cart w/ attrs → `cartLinesAdd` → attrs intact; no mutation arg exists to set them |
| **`cartAttributesUpdate` is REPLACE, not merge** | cart w/ `{_pd_user_id,_pd_brand}` + update `{_pd_user_id,_pd_gclid}` → `_pd_brand` **gone**, no `userError`, no `warning` |
| Before the fix, `createCart` was the only attribute writer | `command grep -rn 'sfCreateCart'` → 2 call sites, both create paths |
| `Cart` type/fragment did not expose cart-level attributes | `CART_FRAGMENT` had line-level `attributes` only; `parseCart` never read them |

**The diagnosis this corrects.** The handoff calls this a *stale cart* problem. It is
not. Because `cartLinesAdd` preserves attributes, **a cart born WITH attribution keeps it
forever.** The failure population is carts **born empty** — a direct visit, or an ad click
that fell outside the 30-minute window in `getAttributionAttrs()`
(`cart.ts:107-109`). Those could never recover, and `CART_ID_KEY` has **no localStorage
expiry** (`cart.ts:47`; the 14-day cookie is decorative because `getCartId()` reads
localStorage first at `cart.ts:320`), so such a cart is reused indefinitely.

That distinction is why the fix is a **merge**, not an overwrite. A plain overwrite would
pass every obvious test and still erase a captured `gclid` for any shopper who returns
after 30 minutes.

**Cleared hypotheses** (checked, found false — do not re-chase):

- *"`cart.ts` reads `_pd_uid` from localStorage but the pixel only sets a cookie."*
  **False.** `pd-pixel.js` `setCookie()` mirrors to localStorage under the same key
  (lines ~181-187) and `getUserId()` always re-sets both.
- *"`pd_session` is sessionStorage-only so the read fails."* **False.** `cart.ts:235`
  falls back to `sessionStorage`.
- *Handoff cites `pd-pixel.js:45,209,1347` for the uid write.* Line 45 is a
  `const COOKIE_NAME` declaration. More importantly the storefront loads
  `cdn.point.dog/pixel/pd-pixel.min.js` (`BaseLayout.astro:198`), a **different
  artifact**. I fetched the live bundle (HTTP 200, 16,948 bytes) and confirmed the
  behaviour there. Conclusion survives; the cited evidence did not.

### 1.2 The Nexus bug — VERIFIED on `origin/main`

🛑 The `southland-inventory` working tree is on `fix/nexus-meeting-2026-08-07`, **20
commits ahead of `origin/main`.** All line numbers below are from
`git show origin/main:...`, not the working tree.

`src/lib/purchase-event.ts`, `emitPointDogPurchase()` → POSTs to
`https://pixel.southlandorganics.com/collect`.

| Defect | Evidence |
|---|---|
| **Line 179: `pd_user_id: data.nexusCheckoutId`** — a Nexus checkout ID in the pixel identity column. Both are UUIDs, so it looks valid and poisons silently. | read on `origin/main` |
| **No `source` field in the payload** — worker defaults it (`mothership/pixel/worker.js:356`, `source: event.source \|\| "storefront_pixel"`), so every Nexus order is mislabeled as browser traffic. | read the whole payload object literal, lines 172-206 |
| **No `session_id` sent** either | same read |

**The fix is available, and the handoff missed why.** Nexus **already extracts a real
`pd_user_id`** — `src/lib/shopify.ts:518`, `pd_user_id: getAttr('user_id')`, inside
`extractAttribution()`. And `data.attribution` is typed `OrderAttribution` and **is in
scope** at line 179 (`PurchaseEventData`, line ~49).

So this is a rewire, not a build.

**The two bugs are coupled.** `getAttr()` (`shopify.ts:~497-504`) reads line item
properties **first**, then `note_attributes`. Cart-level attributes land in
`note_attributes`. **PR #78 is what makes `attribution.pd_user_id` reliably non-null for
storefront orders** — so fixing Nexus first would rewire it to a field that is often
empty. Order matters.

### 1.3 The view — VERIFIED 2026-08-09 (Phase 0 executed)

**[VERIFIED]** `19a96f8` exists (`feat(bq): v_customer_touchpoints_v2 — recover paid
touchpoints via pd_user_id stitch`), the SQL file exists, and all three views are live in
BQ (`INFORMATION_SCHEMA.TABLES`: `v_channel_attribution`, `v_customer_touchpoints`,
`v_customer_touchpoints_v2`).

**[VERIFIED] The gate holds — `v_customer_touchpoints` is effectively email-only:**

| channel | touchpoints | first_seen | last_seen |
|---|---|---|---|
| Email | 4,029,046 | 2016-10-09 | 2026-08-09 |
| Referral | 70 | 2026-08-06 | 2026-08-08 |
| Direct | 6 | 2026-08-07 | 2026-08-08 |
| **Paid Search** | **1** | 2026-08-08 | 2026-08-08 |

The handoff said 0 paid; it is now **1** (a single row landed 2026-08-08). Immaterial —
1 in 4.03M over a decade. The finding stands.

**[VERIFIED] The regression baseline reproduces the handoff's table EXACTLY** (90d, run
2026-08-09):

| source | grp | n | no_uid | no_sess |
|---|---|---|---|---|
| shopify_web_pixel | COVERED | 695 | 9 | 10 |
| shopify_web_pixel | **GAP** | **224** | **222** | 213 |
| storefront_pixel | COVERED | 15 | 15 | 15 |
| storefront_pixel | GAP | 121 | 16 | 121 |

**[INHERITED, still unverified]** the 91,114 discarded-touchpoint figure, the 67.3%
coverage figure, and the 348 paid-touched orders. Not needed for Phases 1-3; verify before
any channel-share claim.

---

## 2. Correcting two framings

**There is no "BQ change" to measure.** `v_customer_touchpoints_v2` was created by the
**prior** session (`19a96f8` per the handoff — *I have not confirmed that commit exists*).
My work is four files of storefront cart code. Different owner, different risk.

**PR #78's correctness and PR #78's impact are separate claims.** The mechanism is proven
end-to-end against live Shopify. Whether it moves the 224-order gap is **unmeasured**,
because that 224 is itself inherited. The fix stands on its own merits either way.

---

## 3. Open decisions — Mike's call

### 3.1 Phone/manual orders — ✅ ANSWERED 2026-08-09, and the hypothesis was WRONG

The handoff proposed that the 136 `storefront_pixel` orders are phone/manual, and that
excluding them would shrink the problem. **It is answerable by query, and the answer is no.**

**[VERIFIED]** Prefix breakdown of all 136 `storefront_pixel` purchase rows (90d):

| prefix | n | meaning |
|---|---|---|
| `SH-` | 132 | Southland **Shopify** orders |
| `D2-` | 4 | **D2 Sanitizers** — a different brand |
| **`SO-` (manual)** | **0** | — |

**[VERIFIED]** Nexus `orders` uses `SO-` for manual orders (sampled
`order_source=eq.manual` → `SO-010370`…`SO-010377`) and `SH-shopify NNNNN` / `D2-NNNN`
for Shopify orders (`order_source='shopify'`).

**So zero manual orders reach the pixel at all.** Every one of the 136 is a real Shopify
ecommerce order that *should* be in the denominator. Nothing shrinks. Bug 2 is a genuine
attribution bug, not a labeling artifact.

**Two consequences:**

1. Do **not** plumb `order_source` as an exclusion filter — there is nothing to exclude.
2. **4 D2 orders are flowing into the Southland pixel path.** Not investigated. Worth a
   look: is `brand_id` correct on those rows?

**[VERIFIED]** `order_source` is not currently in `purchase-event.ts`
(`command grep -rn "order_source" src/lib/purchase-event.ts` → no hits). It should stay
that way.

**Method note:** the first query I ran here returned 0 rows and *looked* like a clean
answer. It was malformed — `order_number` is a **string** (`SH-shopify 23446`), not an int,
so a numeric range matched nothing. A 0-row result is not evidence until the query shape is
verified against a real row.

### 3.2 The 45-day attribution window

**[INHERITED]** Mike's call on 2026-08-08 from the poultry purchase cycle. **Never
measured.** It materially changes every channel split. Worth a sensitivity check (30/45/60)
before anyone treats v2 output as real.

---

## 4. Execution plan

Ordered by dependency. **Each phase ends with a check that can fail.**

### Phase 0 — Baseline — ✅ DONE 2026-08-09

Executed. Results in §1.3 (channel mix + regression baseline) and §3.1 (the phone-order
question, answered). **Gate passed:** paid touchpoints = 1 of 4.03M, so the premise holds.

The baseline table in §1.3 is the thing Phase 2 compares against. Do not re-run as a
prerequisite — re-run it *after* deploy, as the comparison.

**How to re-run** (from `~/CODING/mothership`):

```bash
export GOOGLE_APPLICATION_CREDENTIALS=$PWD/southland-warehouse-service-account.json
bq --project_id=southland-warehouse query --use_legacy_sql=false '<the query>'
```

The `bq` CLI is installed and the service-account key is present and working. There is no
MCP connector and none is needed. (`google-cloud-bigquery` Python lib is **not** installed
— use the CLI.)

### Phase 1 — Storefront (PR #78) — READY, awaiting review

Four files: `types.ts`, `index.ts`, `queries/cart.ts`, `apps/astro-content/src/lib/cart.ts`.

Verified: full monorepo `pnpm typecheck` **0 errors / 11 tasks**; `pnpm lint` 0 errors;
`pnpm format:check` clean; 7/7 merge-logic cases; end-to-end against live Shopify with the
compiled package (attribute-less cart → gains identity → survives further `cartLinesAdd` →
present on re-fetch).

**Not verified:** that a real browser session through the real checkout produces
`checkout.attributes` the Web Pixel reads. **That is the one hop no terminal can prove**
and it is what Phase 2 watches.

**Gate:** held at PR because it touches checkout. Mike merges.

### Phase 2 — Watch the storefront fix in production

After deploy, re-run the Phase 0 regression query on a rolling window.

**Expected:** `no_uid` for `source='shopify_web_pixel'` in the GAP bucket falls from 222/224.

**Gate:** if it does **not** move within a full purchase cycle, do **not** proceed to
Phase 3 — the model is wrong somewhere and Phase 3 would be built on it.

### Phase 3 — Nexus identity + labeling (`southland-inventory`)

Only after Phase 2 confirms. Three edits in `emitPointDogPurchase()`:

1. `pd_user_id: data.attribution.pd_user_id` (fall back to `nexusCheckoutId` **only** if a
   deliberate decision says so — a wrong-namespace UUID is worse than a null, because null
   is detectable and a UUID is not)
2. add `source: 'nexus_server'` (or agreed value) so these stop masquerading as browser traffic
3. add `session_id: data.attribution.pd_session_id`

Consider plumbing `order_source` per §3.1.

🛑 **Branch discipline:** that repo's working tree is 20 commits ahead of `origin/main` on
a feature branch. Branch from `origin/main`, not from the current tree.

**Gate:** `storefront_pixel` rows should stop appearing for browser-originated orders, and
`pixel_version` NULL-vs-stamped should cleanly separate the two paths.

### Phase 4 — The view (`mothership`)

Only after 1-3 produce clean identity. Fixing the view first would just stitch on the
poisoned ids from §1.2.

Decide: promote v2, or fix v1's `email_hash` filter. **Do not touch
`v_customer_touchpoints` / `v_channel_attribution` in place** — memory
`pulse_data_path_protection`, two $15k incidents. v2 was built alongside for this reason.

Answer §3.1 and §3.2 **before** anyone apportions revenue by channel. At 67.3% coverage v2
is directional only: it can say *"paid touched 348 orders last-click credits elsewhere"*;
it **cannot** say what share of revenue paid deserves.

### Phase 5 — Documentation debt

**[VERIFIED]** `cart.ts:193` (now ~line 196 after my edit) cites
`docs/pixel/southland-attribution-carryover-2026-05-31.md` as the rationale for the whole
cart-attributes design. **That file does not exist.** `mothership/docs/pixel/` contains
exactly three files (`ls -la`, 2026-08-09): the handoff, `SHOPIFY-PIXEL-SETUP.md`, and
`identity-capture-fixes-2026-05-12.md`. `shopify-web-pixel.js`'s header cites it too.

Either write it or repoint both references. A justification pointing at nothing is how the
next session ends up re-deriving all of this from scratch.

---

## 5. What nobody has checked

Stated plainly so it is not mistaken for covered ground:

**Closed 2026-08-09** (was 1, 2, 4 in the original list):

- ~~Whether `19a96f8` exists / v2 is live~~ → **both confirmed**, §1.3
- ~~The 224 / 136 baseline figures~~ → **reproduced exactly**, §1.3
- ~~Whether the 136 are phone orders~~ → **no; zero manual orders reach the pixel**, §3.1

**Still open:**

1. **Three BigQuery figures remain inherited:** 91,114 discarded touchpoints, 67.3%
   coverage, 348 paid-touched orders. Not needed for Phases 1-3. **Verify before any
   channel-share claim.**
2. **The 45-day window** (§3.2) — never measured, materially changes every split.
3. **Whether the deployed CF Pages Worker matches `origin/main`.** Verified source and the
   live CDN pixel — not the deployment.
4. **Any real browser session through real checkout.** The one hop that closes Phase 1 and
   the only thing a terminal cannot prove.
5. **Why 4 D2 orders are in the Southland pixel path** (§3.1). New, unexamined.
