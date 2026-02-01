import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = import.meta.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Types for database responses
export interface WebsiteContent {
  id: string;
  brand_id: string;
  url: string;
  title: string;
  description: string;
  content_text: string;
  page_type: string;
  segment: string | null;
  embedding: number[] | null;
}

export interface Product {
  id: string;
  brand_id: string;
  name: string;
  description: string;
  url: string;
  image_url: string | null;
  segment: string;
  embedding: number[] | null;
}

export interface Persona {
  id: string;
  brand_id: string;
  name: string;
  segment: string;
  pain_points: string[];
  buying_triggers: string[];
}

/**
 * Find blog posts related to episode transcript using semantic search
 */
export async function findRelatedContent(
  episodeEmbedding: number[],
  options: {
    pageTypes?: string[];
    matchThreshold?: number;
    matchCount?: number;
  } = {}
): Promise<WebsiteContent[]> {
  if (!supabase) {
    console.warn('Supabase not configured - skipping related content search');
    return [];
  }

  const {
    pageTypes = ['blog', 'page'],
    matchThreshold = 0.75,
    matchCount = 5
  } = options;

  try {
    const { data, error } = await supabase.rpc('search_website_content', {
      query_embedding: episodeEmbedding,
      page_types: pageTypes,
      match_threshold: matchThreshold,
      match_count: matchCount
    });

    if (error) {
      console.error('Error finding related content:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Failed to find related content:', err);
    return [];
  }
}

/**
 * Find products related to episode using semantic search
 */
export async function findRelatedProducts(
  episodeEmbedding: number[],
  options: {
    matchThreshold?: number;
    matchCount?: number;
  } = {}
): Promise<Product[]> {
  if (!supabase) {
    console.warn('Supabase not configured - skipping related products search');
    return [];
  }

  const {
    matchThreshold = 0.7,
    matchCount = 3
  } = options;

  try {
    const { data, error } = await supabase.rpc('find_products_for_content', {
      content_embedding: episodeEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount
    });

    if (error) {
      console.error('Error finding related products:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Failed to find related products:', err);
    return [];
  }
}

/**
 * Find the best persona match for episode content
 */
export async function findTargetPersona(
  episodeEmbedding: number[]
): Promise<Persona | null> {
  if (!supabase) {
    console.warn('Supabase not configured - skipping persona search');
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('search_brand_knowledge', {
      query_embedding: episodeEmbedding,
      match_threshold: 0.6,
      match_count: 1
    });

    if (error) {
      console.error('Error finding target persona:', error);
      return null;
    }

    return data?.[0] || null;
  } catch (err) {
    console.error('Failed to find target persona:', err);
    return null;
  }
}

/**
 * Get all products for a segment (direct query, no embedding needed)
 */
export async function getProductsBySegment(segment: string): Promise<Product[]> {
  if (!supabase) {
    console.warn('Supabase not configured - cannot fetch products');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('brand_id', 'southland')
      .eq('segment', segment);

    if (error) {
      console.error('Error fetching products:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Failed to fetch products:', err);
    return [];
  }
}

/**
 * Get all personas for Southland
 */
export async function getPersonas(): Promise<Persona[]> {
  if (!supabase) {
    console.warn('Supabase not configured - cannot fetch personas');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .eq('brand_id', 'southland');

    if (error) {
      console.error('Error fetching personas:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Failed to fetch personas:', err);
    return [];
  }
}
