/**
 * Script to update embeddings for existing knowledge items that don't have them
 * 
 * Usage:
 *   npx tsx scripts/update-embeddings.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'

// Load environment variables from .env.local
const possiblePaths = [
  path.join(process.cwd(), '.env.local'),
  path.join(__dirname, '..', '.env.local'),
]

for (const envPath of possiblePaths) {
  try {
    if (fs.existsSync(envPath)) {
      const envFile = fs.readFileSync(envPath, 'utf-8')
      envFile.split('\n').forEach(line => {
        const trimmedLine = line.trim()
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=')
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
            if (!process.env[key.trim()]) {
              process.env[key.trim()] = value
            }
          }
        }
      })
      break
    }
  } catch (error: any) {
    // Continue to next path
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Generate embedding using the universal embeddings utility
 * This will try Cohere, Hugging Face, or OpenAI automatically
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // Import the universal embedding function
  const { generateEmbedding: generateEmbeddingUniversal } = await import('../src/lib/embeddings')
  return generateEmbeddingUniversal(text)
}

async function main() {
  console.log('🔄 Updating embeddings for knowledge items without them...\n')

  // Find all knowledge items without embeddings
  const { data: items, error: fetchError } = await supabase
    .from('financial_knowledge')
    .select('id, content')
    .is('embedding', null)

  if (fetchError) {
    console.error('Error fetching items:', fetchError.message)
    process.exit(1)
  }

  if (!items || items.length === 0) {
    console.log('✅ All knowledge items already have embeddings!')
    return
  }

  console.log(`Found ${items.length} items without embeddings\n`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    try {
      console.log(`[${i + 1}/${items.length}] Processing: ${item.content.substring(0, 50)}...`)
      
      const embedding = await generateEmbedding(item.content)
      
      const { error } = await supabase
        .from('financial_knowledge')
        .update({ embedding })
        .eq('id', item.id)

      if (error) {
        throw error
      }

      console.log('  ✅ Updated')
      successCount++

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`)
      errorCount++
    }
  }

  console.log(`\n✅ Completed: ${successCount} updated, ${errorCount} errors`)
}

main().catch(console.error)
