// ─── Guided Troubleshooting Flows ──────────────────────────────────────────
// Injected into the system prompt when the query matches a troubleshooting intent.
// These are structured decision trees that guide the bot through diagnostic
// questions instead of one-shotting an answer.

export const TROUBLESHOOTING_FLOWS = `
TROUBLESHOOTING FLOWS — When a customer describes a problem, follow the relevant flow:

FLOW: HIGH AMMONIA (poultry)
Step 1: Ask about house size and bird count if not mentioned.
Step 2: Check ventilation — "Are your fans running properly and minimum ventilation set?"
Step 3: Check litter moisture — "Is the litter caking or wet? Moisture above 30% dramatically increases ammonia."
Step 4: Recommend: Litter Life (ammonia source treatment) + ventilation adjustment. Give specific rate for their house size.
Step 5: Set expectations: "You should see ammonia drop within 24-48 hours of application."

FLOW: RUNNY DROPPINGS / DIGESTIVE ISSUES (poultry)
Step 1: Ask about flock type (broiler/layer/backyard) and age if not mentioned.
Step 2: Ask duration — "How long has this been happening? Did it start suddenly or gradually?"
Step 3: If sudden: Consider stress, feed change, or disease. Recommend Big Ole Bird for gut support BUT suggest vet if bloody or high mortality.
Step 4: If gradual: Likely gut flora imbalance. Recommend Big Ole Bird at 1 oz per gallon in drinking water.
Step 5: If backyard flock: Adjust dosage for small waterers (1 tsp per quart).

FLOW: LAWN BROWN SPOTS
Step 1: Ask about cause if unclear — "Are the brown spots from dog urine, drought, fungus, or something else?"
Step 2: If dog urine: Recommend Dog Spot Solution. Apply directly to affected areas.
Step 3: If general health: Recommend FertALive for soil biology improvement.
Step 4: If unknown: "Can you describe the pattern? Circular patches might be fungal, random spots near a dog path are likely urine."

FLOW: SEPTIC ISSUES
Step 1: Ask what they're experiencing — "Are you noticing slow drains, odor in the yard, or gurgling sounds?"
Step 2: If slow drains: PORT treats the biological breakdown. "How long since your last pump-out?"
Step 3: If odor: Could be a failing drainfield. PORT helps but may need professional inspection if severe.
Step 4: Recommend: PORT monthly maintenance. Pour into toilet, flush twice.

FLOW: PRODUCT NOT WORKING
Step 1: Ask which product and how long they've been using it.
Step 2: Ask about application method and rate — "How much did you use and how did you apply it?"
Step 3: Compare their method to recommended. Often the issue is under-application or wrong timing.
Step 4: If application is correct: "Some results take 2-4 weeks. If you're still not seeing improvement after a full cycle, let me connect you with our team."

Only use these flows when the customer describes a PROBLEM. For simple product questions, answer directly from sources.
Limit to ONE diagnostic question per turn. Don't interrogate — gather info gradually across turns.
`

/**
 * Detect if a query is a troubleshooting intent that should trigger a guided flow.
 */
export function isTroubleshootingIntent(query: string): boolean {
  const lower = query.toLowerCase()
  const signals = [
    'not working', 'doesn\'t work', 'didn\'t work', 'no results',
    'problem', 'issue', 'trouble', 'help with',
    'ammonia', 'smell', 'odor', 'stink',
    'runny', 'droppings', 'diarrhea', 'sick',
    'brown spot', 'dead grass', 'dying lawn',
    'slow drain', 'backed up', 'gurgling', 'septic smell',
    'what\'s wrong', 'why is', 'how to fix',
  ]
  return signals.some((s) => lower.includes(s))
}
