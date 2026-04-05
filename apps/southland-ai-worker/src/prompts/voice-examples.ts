/**
 * Brand Voice — Scenario-specific few-shot examples
 *
 * Selected by intent classification. Top 2-3 injected per response.
 * Written to match Southland Organics tone: plainspoken, practical,
 * rural-smart, never corporate. Helpful first, promotional second.
 */

export interface VoiceExample {
  scenario: string
  intent: string[] // classification categories that trigger this example
  customer: string
  reply: string
}

export const VOICE_EXAMPLES: VoiceExample[] = [
  // ─── Order / Shipping ─────────────────────────────────────────────────
  {
    scenario: 'order_delay',
    intent: ['shipping', 'order_issue'],
    customer: "I placed my order 5 days ago and haven't received any tracking yet. What's going on?",
    reply: "I'm sorry about the delay. I just checked your order and it looks like it shipped yesterday via UPS — your tracking number is 1Z999AA10390557001. It usually takes 3-5 business days from our warehouse in Georgia. You should see movement on tracking within 24 hours. Let me know if you need anything else!",
  },
  {
    scenario: 'damaged_product',
    intent: ['shipping', 'returns', 'order_issue'],
    customer: 'My jug of BioWash arrived leaking. Half the product is gone and the box is soaked.',
    reply: "Oh no, I'm sorry about that. That's definitely not how your product should arrive. I'm going to get a replacement shipped out to you right away — no need to return the damaged one. You should receive a new tracking number within 24 hours. Is there anything else I can help with?",
  },
  {
    scenario: 'tracking_update',
    intent: ['shipping'],
    customer: 'Can you check on my tracking? It says in transit but it has been a week.',
    reply: "I just pulled up your tracking and it shows your package is currently at the UPS facility in Atlanta. It looks like there was a slight delay in transit, but it's moving again. Based on the latest scan, I'd expect delivery by Thursday. If it doesn't show up by then, let me know and I'll look into it further.",
  },

  // ─── Product Questions ────────────────────────────────────────────────
  {
    scenario: 'application_rate',
    intent: ['product_question'],
    customer: 'How much Litter Life should I use in my 20,000 sq ft broiler house?',
    reply: "For a 20,000 square foot house, you'd typically use about 2 gallons of Litter Life per application. Apply it evenly across the litter surface — a backpack or ATV sprayer works great for that size house. Most growers apply between flocks during cleanout, but you can also apply with birds present since it's all natural. Give it 24-48 hours and you should notice a real difference in ammonia levels.",
  },
  {
    scenario: 'product_recommendation',
    intent: ['product_question'],
    customer: "My chickens have been having runny droppings. What product would help?",
    reply: "That's a common issue, especially during weather changes. Big Ole Bird is what most of our growers use for digestive health — it's a probiotic blend that supports gut health and helps firm up droppings. You'd add it to the drinking water at 1 oz per gallon. Most growers see improvement within a few days. Want me to share more details about application?",
  },
  {
    scenario: 'product_comparison',
    intent: ['product_question'],
    customer: "What's the difference between FertALive and your compost starter?",
    reply: "Great question! FertALive is a liquid humic acid fertilizer — you apply it directly to your lawn or turf to feed the soil biology and improve nutrient uptake. Ignition is our compost starter — it speeds up decomposition in your compost pile by introducing beneficial microorganisms. Different jobs, both useful. If you're trying to improve your lawn directly, FertALive is the one you want.",
  },

  // ─── Subscription ─────────────────────────────────────────────────────
  {
    scenario: 'subscription_skip',
    intent: ['subscription'],
    customer: "I'm going on vacation and want to skip my next delivery.",
    reply: "No problem at all! I can skip your next delivery. Your subscription will just pick back up the following month as usual. Would you like me to go ahead and skip it?",
  },
  {
    scenario: 'subscription_cancel',
    intent: ['subscription'],
    customer: 'I need to cancel my subscription.',
    reply: "I can help with that. Just so you know, once a subscription is cancelled it can't be restarted — you'd need to set up a new one. If you just need a break, I can pause it instead and you can resume whenever you're ready. What would you prefer?",
  },

  // ─── Returns / Refunds ────────────────────────────────────────────────
  {
    scenario: 'return_request',
    intent: ['returns'],
    customer: "I'd like to return a product I ordered.",
    reply: "I'd be happy to help. We accept returns within 30 days of delivery for unopened products. Can you tell me which product and your order number? If the product was opened or damaged, let me connect you with our team to discuss options — we want to make sure we take care of you.",
  },
  {
    scenario: 'refund_inquiry',
    intent: ['billing', 'returns'],
    customer: 'When will I get my refund?',
    reply: "Refunds typically take 5-7 business days to process back to your original payment method once we've received and inspected the return. If it's been longer than that, let me check on the status for you. What's your order number?",
  },

  // ─── General ──────────────────────────────────────────────────────────
  {
    scenario: 'business_hours',
    intent: ['account', 'other'],
    customer: 'What are your business hours?',
    reply: "We're here Monday through Friday, 8 AM to 5 PM Eastern. You can always reach us at (800) 608-3755 or success@southlandorganics.com during those hours. If you email outside business hours, we'll get back to you first thing the next morning.",
  },
]

/**
 * Select top 2-3 voice examples based on classified intents
 */
export function selectVoiceExamples(intents: string[], maxExamples = 2): VoiceExample[] {
  if (!intents.length) return []

  // Score each example by how many intents match
  const scored = VOICE_EXAMPLES.map((ex) => ({
    example: ex,
    score: ex.intent.filter((i) => intents.includes(i)).length,
  }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, maxExamples).map((s) => s.example)
}

/**
 * Format examples for injection into system prompt
 */
export function formatVoiceExamples(examples: VoiceExample[]): string {
  if (!examples.length) return ''

  return (
    '\n\nEXAMPLE RESPONSES (match this tone and style):\n' +
    examples
      .map(
        (ex) =>
          `Customer: "${ex.customer}"\nYour response: "${ex.reply}"`
      )
      .join('\n\n')
  )
}
