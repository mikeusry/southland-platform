#!/usr/bin/env npx tsx
// Seed products into Vectorize by calling the local Nexus API
// then pushing to the deployed Worker's bulk-index endpoint.
//
// Usage:
//   cd apps/southland-ai-worker
//   NEXUS_URL=http://localhost:3200 npx tsx scripts/seed-products.ts

const NEXUS_URL = process.env.NEXUS_URL || 'http://localhost:3200'
const WORKER_URL = process.env.WORKER_URL || 'https://southland-ai-worker.point-dog-digital.workers.dev'

async function main() {
  console.log(`Fetching products from ${NEXUS_URL}/api/ai/products...`)

  const res = await fetch(`${NEXUS_URL}/api/ai/products`)
  if (!res.ok) {
    console.error(`Failed: ${res.status} ${await res.text()}`)
    process.exit(1)
  }

  const data = await res.json() as { products: unknown[]; count: number }
  console.log(`Got ${data.count} products`)

  console.log(`\nTriggering bulk index at ${WORKER_URL}/index/products...`)
  const indexRes = await fetch(`${WORKER_URL}/index/products`, { method: 'GET' })

  if (!indexRes.ok) {
    console.error(`Index failed: ${indexRes.status} ${await indexRes.text()}`)
    process.exit(1)
  }

  const result = await indexRes.json()
  console.log('\nIndex result:', JSON.stringify(result, null, 2))
}

main().catch(console.error)
