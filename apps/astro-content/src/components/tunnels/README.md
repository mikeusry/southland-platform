# Reality Tunnels

Persona-specific content paths that dynamically adapt based on visitor identity and journey stage.

## Overview

Reality Tunnels serve different content to different personas. A visitor identified as "Backyard Betty" sees backyard-focused heroes, products, and testimonials, while "Broiler Bill" sees commercial-scale messaging.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     RealityTunnel.astro                     │
│                   (Orchestrator Component)                  │
├─────────────────────────────────────────────────────────────┤
│  Reads: sl_persona cookie, sl_stage cookie                  │
│  Selects: Persona-specific components                       │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  betty/       │     │  bill/        │     │  taylor/      │
│  - BettyHero  │     │  - BillHero   │     │  - TaylorHero │
│  - BettyProds │     │  - BillProds  │     │  - TaylorProds│
│  - BettyTest  │     │  - BillTest   │     │  - TaylorTest │
└───────────────┘     └───────────────┘     └───────────────┘
```

## Personas

| Persona | Directory | Target Audience | Color Theme |
|---------|-----------|-----------------|-------------|
| Backyard Betty | `betty/` | Backyard chicken keepers | Amber/Orange |
| Broiler Bill | `bill/` | Commercial poultry growers | Emerald/Green |
| Turf Pro Taylor | `taylor/` | Lawn care professionals | Cyan/Teal |

## Journey Stages

Each Hero component has 10 stage-specific variations:

| Stage | Description | Content Focus |
|-------|-------------|---------------|
| `unaware` | First visit | Problem awareness |
| `aware` | Knows category | Solution introduction |
| `receptive` | Engaged with content | Education, trust-building |
| `zmot` | Research mode | Comparisons, deep-dive |
| `objections` | Has concerns | FAQ, guarantees, proof |
| `test_prep` | Ready to try | Risk reversal, starter offers |
| `challenge` | First purchase | Onboarding, quick wins |
| `success` | Seeing results | Expand usage, cross-sell |
| `commitment` | Repeat buyer | Loyalty, bulk options |
| `evangelist` | Advocate | Referral program, community |

## Component Structure

### Hero Components

Each persona has a Hero component with stage-specific messaging:

```astro
---
// BettyHero.astro
interface Props {
  stage?: string;
}
const { stage = 'unaware' } = Astro.props;

const heroContent: Record<string, { headline: string; subhead: string; cta: string }> = {
  unaware: { ... },
  aware: { ... },
  // ... 10 stages total
};
---
```

### Product Components

Curated product selections for each persona:

- **Betty**: Chicken E-lixir, Big Ole Bird, Coop Recuperate
- **Bill**: Big Ole Bird Gallon, Litter Life 5gal, Commercial Starter Kit
- **Taylor**: Genesis, Humic Acid Gallon, Lawn Pro Kit

### Testimonial Components

Social proof matching each persona's context:

- **Betty**: Backyard flock success stories
- **Bill**: ROI metrics, mortality reduction, FCR improvements
- **Taylor**: Before/after results, professional endorsements

## Usage

```astro
---
import RealityTunnel from '../components/tunnels/RealityTunnel.astro';
---

<RealityTunnel persona="betty" stage="aware" />
```

Or let RealityTunnel auto-detect from cookies:

```astro
<RealityTunnel />
```

## Cookie Integration

| Cookie | Purpose | Set By |
|--------|---------|--------|
| `sl_persona` | Current persona (betty/bill/taylor/general) | Persona Worker |
| `sl_stage` | Journey stage | Persona Worker |
| `sl_confidence` | Persona confidence score (0-1) | Persona Worker |

## Adding a New Persona

1. Create directory: `tunnels/newpersona/`
2. Create components:
   - `NewPersonaHero.astro` (with 10 stage variations)
   - `NewPersonaProducts.astro`
   - `NewPersonaTestimonials.astro`
3. Update `RealityTunnel.astro` to include new persona
4. Add persona to scoring in `apps/persona-worker/`

## Related Files

- `RealityTunnel.astro` - Main orchestrator
- `apps/persona-worker/` - Persona scoring backend
- `src/lib/persona.ts` - Client-side persona utilities
- `docs/SOUTHLAND-CDP-PLAYBOOK.md` - Full CDP strategy
