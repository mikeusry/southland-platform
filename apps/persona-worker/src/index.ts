/**
 * Southland persona scoring worker — thin brand wrapper.
 *
 * The real engine lives in @pointdog/measurement-worker (mothership repo).
 * This file is intentionally short: import the shared handler, pass the
 * Southland config, export. Don't add brand-specific logic here — if
 * something needs to change for Southland, it belongs in
 * `mothership/brands/southland/measurement-config.ts`, not in this file.
 *
 * Refactored 2026-05-21 from a 348-line copy of the engine into a wrapper.
 * Pre-refactor behavior is preserved exactly: same routes (/event, /batch,
 * /visitor/:id, /health), same persona/segment scoring algorithm, same KV
 * format with legacy 4-key→11-key migration via config.legacy_persona_map.
 *
 * Design notes:
 *   - collectEndpointPath is set to '/event' (not '/collect') because
 *     Southland's pd-pixel.js posts to /event historically. The shared
 *     handler accepts both /event and /collect.
 *   - All brand-specific values (personas, segments, archetypes, keywords,
 *     URL patterns, score priors, legacy migration map) come from
 *     SOUTHLAND_CONFIG in the mothership repo. Editing the config there
 *     changes this worker's behavior on next deploy.
 *
 * Spec & rationale: mothership/docs/measurement/ARCHITECTURE.md
 */

import { createHandler } from '@pointdog/measurement-worker'
import { SOUTHLAND_CONFIG } from '@pointdog/brand-southland'

export default createHandler(SOUTHLAND_CONFIG, {
  collectEndpointPath: '/event',
})
