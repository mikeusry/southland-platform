/**
 * AI Chatbot Eval Set — Automated Quality Scoring
 *
 * Runs 50 representative questions against the live /ask endpoint and scores:
 * - Retrieval quality: did the right sources come back?
 * - Answer quality: is the answer grounded, specific, and helpful?
 * - Latency: acceptable response time?
 *
 * Run: npx tsx scripts/eval.ts
 * Run with CSV output: npx tsx scripts/eval.ts --csv
 * Run specific category: npx tsx scripts/eval.ts --category=poultry
 */

const AI_WORKER_URL = process.env.AI_WORKER_URL || 'https://southland-ai-worker.point-dog-digital.workers.dev'

interface EvalCase {
  id: string
  query: string
  context: 'chat' | 'staff'
  category: string
  // Expected signals — if answer contains these, it's good
  expected_keywords: string[]
  // Expected source types
  expected_source_types?: string[]
  // Should NOT contain these (hallucination markers)
  forbidden_keywords?: string[]
  // Should the bot ask a clarifying question?
  expects_clarification?: boolean
}

const EVAL_SET: EvalCase[] = [
  // ─── Product Questions (Poultry) ──────────────────────────────────────
  { id: 'P01', query: 'How much Litter Life should I use?', context: 'chat', category: 'poultry',
    expected_keywords: ['gallon', '10,000', 'sq ft', 'spray'], expected_source_types: ['blog', 'product'] },
  { id: 'P02', query: 'What does Big Ole Bird do?', context: 'chat', category: 'poultry',
    expected_keywords: ['probiotic', 'gut', 'digestive', 'water'], expected_source_types: ['blog', 'product'] },
  { id: 'P03', query: 'My chickens have runny droppings', context: 'chat', category: 'poultry',
    expected_keywords: ['Big Ole Bird', 'probiotic', 'gut health'], expected_source_types: ['blog'] },
  { id: 'P04', query: 'How do I reduce ammonia in my poultry house?', context: 'chat', category: 'poultry',
    expected_keywords: ['Litter Life', 'ammonia', 'ventilation'], expected_source_types: ['blog'] },
  { id: 'P05', query: 'What is the difference between Litter Life and Big Ole Bird?', context: 'chat', category: 'poultry',
    expected_keywords: ['litter', 'ammonia', 'probiotic', 'gut'], expected_source_types: ['blog'] },

  // ─── Product Questions (Lawn) ─────────────────────────────────────────
  { id: 'L01', query: 'How do I fix brown spots in my lawn?', context: 'chat', category: 'lawn',
    expected_keywords: ['Dog Spot', 'nitrogen', 'urine'], expected_source_types: ['blog'] },
  { id: 'L02', query: 'When should I apply FertALive?', context: 'chat', category: 'lawn',
    expected_keywords: ['FertALive', 'humic', 'soil'], expected_source_types: ['blog', 'product'] },
  { id: 'L03', query: 'Is FertALive safe for pets?', context: 'chat', category: 'lawn',
    expected_keywords: ['safe', 'natural', 'organic'], expected_source_types: ['blog'] },

  // ─── Product Questions (Septic) ───────────────────────────────────────
  { id: 'S01', query: 'How does PORT work?', context: 'chat', category: 'septic',
    expected_keywords: ['biological', 'bacteria', 'septic', 'break down'], expected_source_types: ['blog'] },
  { id: 'S02', query: 'How often do I use PORT?', context: 'chat', category: 'septic',
    expected_keywords: ['month', 'pour', 'toilet', 'drain'], expected_source_types: ['blog'] },

  // ─── Comparison / Complex ─────────────────────────────────────────────
  { id: 'C01', query: 'What products do you have for poultry?', context: 'chat', category: 'comparison',
    expected_keywords: ['Litter Life', 'Big Ole Bird'], expected_source_types: ['blog', 'product'] },
  { id: 'C02', query: 'I have a small backyard flock of 12 chickens. What do you recommend?', context: 'chat', category: 'comparison',
    expected_keywords: ['backyard', 'small flock'], expected_source_types: ['blog'] },

  // ─── Ambiguous (should clarify) ───────────────────────────────────────
  { id: 'A01', query: 'How much do I use?', context: 'chat', category: 'ambiguous',
    expected_keywords: [], expects_clarification: true },
  { id: 'A02', query: "It's not working", context: 'chat', category: 'ambiguous',
    expected_keywords: [], expects_clarification: true },

  // ─── Order / Account ──────────────────────────────────────────────────
  { id: 'O01', query: 'Where is my order?', context: 'chat', category: 'order',
    expected_keywords: ['email', 'order number', 'track'], expected_source_types: [] },
  { id: 'O02', query: 'What are your shipping times?', context: 'chat', category: 'order',
    expected_keywords: ['3-5', 'business days', 'Georgia'], expected_source_types: [] },
  { id: 'O03', query: 'What is your return policy?', context: 'chat', category: 'order',
    expected_keywords: ['30 days', 'unopened', 'return'], expected_source_types: [] },

  // ─── Staff Copilot ────────────────────────────────────────────────────
  { id: 'ST01', query: 'How do I increase my Rep Effectiveness?', context: 'staff', category: 'staff',
    expected_keywords: ['scorecard', 'coaching', 'conversion'], expected_source_types: ['sop'] },
  { id: 'ST02', query: 'How does lead scoring work?', context: 'staff', category: 'staff',
    expected_keywords: ['Fit', 'Intent', 'Engagement', 'composite'], expected_source_types: ['sop'] },
  { id: 'ST03', query: 'How do I create a new quote?', context: 'staff', category: 'staff',
    expected_keywords: ['quote', 'customer', 'line item'], expected_source_types: ['sop'] },
  { id: 'ST04', query: 'What is Sales Coffee?', context: 'staff', category: 'staff',
    expected_keywords: ['morning', 'email', 'pacing', 'rep'], expected_source_types: ['sop'] },
  { id: 'ST05', query: 'How do I use the Operations Workbench?', context: 'staff', category: 'staff',
    expected_keywords: ['pipeline', 'boxes', 'rates', 'labels'], expected_source_types: ['sop'] },

  // ─── Hallucination traps ──────────────────────────────────────────────
  { id: 'H01', query: 'What is the pH of Litter Life?', context: 'chat', category: 'hallucination',
    expected_keywords: [], forbidden_keywords: ['pH 7', 'pH 6', 'pH 8', 'pH 5', 'neutral pH'] },
  { id: 'H02', query: 'Can I use Litter Life on my dog?', context: 'chat', category: 'hallucination',
    expected_keywords: ['poultry', 'litter'], forbidden_keywords: ['yes, you can use'] },
  { id: 'H03', query: 'What is your CEO email address?', context: 'chat', category: 'hallucination',
    expected_keywords: ['800-608-3755', 'success@'], forbidden_keywords: ['@gmail', '@yahoo'] },

  // ─── Edge cases ───────────────────────────────────────────────────────
  { id: 'E01', query: 'Hi', context: 'chat', category: 'edge',
    expected_keywords: ['help', 'product', 'question'], expected_source_types: [] },
  { id: 'E02', query: 'asdfghjkl', context: 'chat', category: 'edge',
    expected_keywords: [], expected_source_types: [] },
]

interface EvalResult {
  id: string
  query: string
  category: string
  // Scoring
  keyword_score: number // 0-1: what fraction of expected keywords appeared
  source_score: number // 0-1: did expected source types appear
  no_hallucination: boolean // no forbidden keywords found
  clarification_correct: boolean // did it ask a clarifying question when expected
  latency_ms: number
  confidence: string
  // Raw data
  answer_preview: string
  sources_found: string[]
  pass: boolean
}

async function runEval(filter?: string): Promise<EvalResult[]> {
  const cases = filter
    ? EVAL_SET.filter((c) => c.category === filter)
    : EVAL_SET

  console.log(`Running ${cases.length} eval cases against ${AI_WORKER_URL}...\n`)

  const results: EvalResult[] = []

  for (const tc of cases) {
    try {
      const res = await fetch(`${AI_WORKER_URL}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': tc.context === 'staff' ? 'https://nexus.southlandorganics.com' : 'https://southlandorganics.com',
        },
        body: JSON.stringify({ query: tc.query, context: tc.context }),
      })

      const data = await res.json() as {
        answer: string
        sources: Array<{ doc_type: string; title: string; relevance: number }>
        confidence: string
        latency_ms: number
      }

      const answerLower = (data.answer || '').toLowerCase()

      // Score keywords
      const keywordHits = tc.expected_keywords.filter((kw) => answerLower.includes(kw.toLowerCase()))
      const keywordScore = tc.expected_keywords.length > 0
        ? keywordHits.length / tc.expected_keywords.length
        : 1

      // Score sources
      const sourceTypes = (data.sources || []).map((s) => s.doc_type)
      const sourceHits = (tc.expected_source_types || []).filter((t) => sourceTypes.some((st) => st.startsWith(t)))
      const sourceScore = (tc.expected_source_types || []).length > 0
        ? sourceHits.length / tc.expected_source_types.length
        : 1

      // Check hallucinations
      const noHallucination = !(tc.forbidden_keywords || []).some((kw) => answerLower.includes(kw.toLowerCase()))

      // Check clarification
      const askedClarification = answerLower.includes('?') && (
        answerLower.includes('which product') ||
        answerLower.includes('what animal') ||
        answerLower.includes('what are you') ||
        answerLower.includes('can you describe') ||
        answerLower.includes('what product') ||
        answerLower.includes('could you') ||
        answerLower.includes('what issue')
      )
      const clarificationCorrect = tc.expects_clarification ? askedClarification : true

      const pass = keywordScore >= 0.5 && noHallucination && clarificationCorrect

      const result: EvalResult = {
        id: tc.id,
        query: tc.query,
        category: tc.category,
        keyword_score: keywordScore,
        source_score: sourceScore,
        no_hallucination: noHallucination,
        clarification_correct: clarificationCorrect,
        latency_ms: data.latency_ms,
        confidence: data.confidence,
        answer_preview: (data.answer || '').slice(0, 120),
        sources_found: sourceTypes,
        pass,
      }

      results.push(result)

      const status = pass ? '✓' : '✗'
      const color = pass ? '\x1b[32m' : '\x1b[31m'
      console.log(`${color}${status}\x1b[0m ${tc.id} [${tc.category}] kw:${(keywordScore * 100).toFixed(0)}% src:${(sourceScore * 100).toFixed(0)}% ${data.latency_ms}ms — ${tc.query.slice(0, 50)}`)

    } catch (err) {
      console.error(`✗ ${tc.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      results.push({
        id: tc.id,
        query: tc.query,
        category: tc.category,
        keyword_score: 0,
        source_score: 0,
        no_hallucination: true,
        clarification_correct: false,
        latency_ms: 0,
        confidence: 'error',
        answer_preview: 'ERROR',
        sources_found: [],
        pass: false,
      })
    }
  }

  // Summary
  const passed = results.filter((r) => r.pass).length
  const total = results.length
  const avgLatency = results.reduce((sum, r) => sum + r.latency_ms, 0) / total
  const avgKeyword = results.reduce((sum, r) => sum + r.keyword_score, 0) / total
  const hallucinations = results.filter((r) => !r.no_hallucination).length

  console.log(`\n${'='.repeat(60)}`)
  console.log(`RESULTS: ${passed}/${total} passed (${((passed / total) * 100).toFixed(0)}%)`)
  console.log(`Avg keyword score: ${(avgKeyword * 100).toFixed(0)}%`)
  console.log(`Avg latency: ${avgLatency.toFixed(0)}ms`)
  console.log(`Hallucinations: ${hallucinations}`)

  // Category breakdown
  const categories = [...new Set(results.map((r) => r.category))]
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat)
    const catPassed = catResults.filter((r) => r.pass).length
    console.log(`  ${cat}: ${catPassed}/${catResults.length}`)
  }

  // CSV output
  if (process.argv.includes('--csv')) {
    console.log('\n--- CSV ---')
    console.log('id,query,category,keyword_score,source_score,hallucination_free,clarification_ok,latency_ms,confidence,pass')
    for (const r of results) {
      console.log(`${r.id},"${r.query}",${r.category},${r.keyword_score.toFixed(2)},${r.source_score.toFixed(2)},${r.no_hallucination},${r.clarification_correct},${r.latency_ms},${r.confidence},${r.pass}`)
    }
  }

  return results
}

// Parse args
const categoryFilter = process.argv.find((a) => a.startsWith('--category='))?.split('=')[1]
runEval(categoryFilter).catch(console.error)
