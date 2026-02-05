/**
 * Embeddings Utilities
 *
 * Generate text embeddings using OpenAI for semantic search.
 * Used by the search API to embed user queries before vector search.
 */

import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
})

/**
 * Generate an embedding for a text string
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!openai.apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.trim(),
    dimensions: 1536,
  })

  return response.data[0].embedding
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!openai.apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts.map((t) => t.trim()),
    dimensions: 1536,
  })

  return response.data.map((d) => d.embedding)
}
