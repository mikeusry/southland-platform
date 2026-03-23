# Persona Lifecycle Checklist

Used whenever adding, modifying, or retiring a persona.

## Adding a New Persona

1. **Define business need:** Who is this person? What do they buy? How are they different from existing personas? What's the revenue opportunity?
2. **Add to `persona-profiles.ts`:** Full profile (demographics, JTBD, products, plays, language rules)
3. **Add to `PersonaId` union** in `apps/astro-content/src/lib/persona.ts` (1 line)
4. **Add to `PERSONA_CONFIG`** in `persona.ts` (label, color, CTA, landing page)
5. **Add to `PERSONA_TO_SEGMENT`** in `persona.ts` (1 line)
6. **Add keywords** to worker `PERSONA_KEYWORDS` in `apps/persona-worker/src/signals.ts`
7. **Add URL pattern** to worker `URL_PERSONA_PATTERNS` in `signals.ts`
8. **Add to worker types** — `PersonaId` union and `ALL_PERSONA_IDS` in `apps/persona-worker/src/types.ts`
9. **Add BigQuery rule** to `PERSONA_RULES` in `mothership/scripts/cdp/rebuild-customer-personas.js`
10. **Add tag mapping** to `persona-inference.ts` TAG_PRECEDENCE
11. **Add to PERSONA_MAP** in `mothership/scripts/cdp/persona-metrics.js`
12. **Run shadow table** + QA verification query — validate distribution
13. **Build and deploy** — `pnpm build` must pass
14. **Update dashboards** — add to reclaimed revenue dashboard
15. **Announce** to marketing/sales with 1-page playbook (top 3 pains, top 3 offers, top 3 proof points)

## Retiring a Persona

1. Remove from BigQuery rules (customers fall through to next matching persona or General)
2. Keep the `PersonaId` value valid for 90 days (backward compat with cookies/KV)
3. Add to `LEGACY_PERSONA_MAP` in `persona.ts` pointing to the successor persona
4. After 90 days: remove from union type, config, keywords

## Quarterly Review Cadence

Every quarter, review:

- **Persona performance:** CVR, AOV, revenue per session by persona
- **Low-confidence cohort:** % of customers with `persona_confidence < 0.6`
- **"General" share:** % of traffic/customers with no persona — should shrink over time
- **Collision rate:** how many customers matched multiple persona rules before priority ordering resolved them
- **Manual override count:** if >20/month, rules may need updating instead

Use this to decide: promote an emerging pattern into a new persona, merge underperformers, or adjust classification rules.

## Manual Override Governance

- Use sparingly: high-LTV misclassifications only (>$500 LTV or sales-flagged accounts)
- Document reason in `manual_override_reason` column
- If >20 overrides/month for the same persona, the heuristic rule needs fixing — don't let overrides become a parallel system
- Rebuild script preserves overrides: `WHERE manual_persona_id IS NULL` filter on all CTEs
