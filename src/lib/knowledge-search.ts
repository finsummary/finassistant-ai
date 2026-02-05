/**
 * Utility for searching financial and user knowledge using vector similarity
 */

import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from './embeddings'

export interface FinancialKnowledgeResult {
  id: string
  content: string
  category: string | null
  tags: string[] | null
  source: string | null
  similarity: number
}

export interface UserKnowledgeResult {
  id: string
  content: string
  type: string
  metadata: any
  similarity: number
}

/**
 * Search financial knowledge base for relevant information
 * @param query - Search query text
 * @param category - Optional category filter (cash_flow, runway, expenses, etc.)
 * @param limit - Maximum number of results (default: 5)
 * @param threshold - Minimum similarity threshold (default: 0.7)
 * @returns Array of matching knowledge items with similarity scores
 */
export async function searchFinancialKnowledge(
  query: string,
  category?: string,
  limit: number = 5,
  threshold: number = 0.7
): Promise<FinancialKnowledgeResult[]> {
  try {
    const supabase = await createClient()
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query)

    // Call the SQL function for vector search
    const { data, error } = await supabase.rpc('match_financial_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      filter_category: category || null,
    })

    if (error) {
      console.error('[Knowledge Search] Error searching financial knowledge:', error)
      throw new Error(`Failed to search financial knowledge: ${error.message}`)
    }

    return (data || []) as FinancialKnowledgeResult[]
  } catch (error: any) {
    console.error('[Knowledge Search] Exception in searchFinancialKnowledge:', error)
    throw error
  }
}

/**
 * Search user-specific knowledge base
 * @param userId - User ID to search knowledge for
 * @param query - Search query text
 * @param type - Optional type filter (preference, decision_history, business_context, note)
 * @param limit - Maximum number of results (default: 5)
 * @param threshold - Minimum similarity threshold (default: 0.7)
 * @returns Array of matching knowledge items with similarity scores
 */
export async function searchUserKnowledge(
  userId: string,
  query: string,
  type?: string,
  limit: number = 5,
  threshold: number = 0.7
): Promise<UserKnowledgeResult[]> {
  try {
    const supabase = await createClient()
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query)

    // Call the SQL function for vector search
    const { data, error } = await supabase.rpc('match_user_knowledge', {
      p_user_id: userId,
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      filter_type: type || null,
    })

    if (error) {
      console.error('[Knowledge Search] Error searching user knowledge:', error)
      throw new Error(`Failed to search user knowledge: ${error.message}`)
    }

    return (data || []) as UserKnowledgeResult[]
  } catch (error: any) {
    console.error('[Knowledge Search] Exception in searchUserKnowledge:', error)
    throw error
  }
}

/**
 * Save user knowledge to the database
 * @param userId - User ID
 * @param content - Knowledge content text
 * @param type - Knowledge type (preference, decision_history, business_context, note)
 * @param metadata - Optional metadata object
 */
export async function saveUserKnowledge(
  userId: string,
  content: string,
  type: 'preference' | 'decision_history' | 'business_context' | 'note',
  metadata?: any
): Promise<void> {
  try {
    const supabase = await createClient()
    
    // Generate embedding for the content
    const embedding = await generateEmbedding(content)

    // Insert into database
    const { error } = await supabase
      .from('user_knowledge')
      .insert({
        user_id: userId,
        content,
        embedding,
        type,
        metadata: metadata || null,
      })

    if (error) {
      console.error('[Knowledge Search] Error saving user knowledge:', error)
      throw new Error(`Failed to save user knowledge: ${error.message}`)
    }
  } catch (error: any) {
    console.error('[Knowledge Search] Exception in saveUserKnowledge:', error)
    throw error
  }
}
