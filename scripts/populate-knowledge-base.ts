/**
 * Script to populate financial knowledge base
 * 
 * Usage:
 *   npx tsx scripts/populate-knowledge-base.ts
 * 
 * Or with environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=... npx tsx scripts/populate-knowledge-base.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables from .env.local
// Try multiple possible paths
const possiblePaths = [
  path.join(process.cwd(), '.env.local'),
  path.join(__dirname, '..', '.env.local'),
  path.join(__dirname, '../../', '.env.local'),
]

let envLoaded = false
for (const envPath of possiblePaths) {
  try {
    if (fs.existsSync(envPath)) {
      const envFile = fs.readFileSync(envPath, 'utf-8')
      let loadedCount = 0
      envFile.split('\n').forEach(line => {
        const trimmedLine = line.trim()
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=')
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
            if (!process.env[key.trim()]) {
              process.env[key.trim()] = value
              loadedCount++
            }
          }
        }
      })
      console.log(`✅ Loaded ${loadedCount} environment variables from .env.local (${envPath})\n`)
      envLoaded = true
      break
    }
  } catch (error: any) {
    // Continue to next path
  }
}

if (!envLoaded) {
  console.warn(`⚠️  .env.local not found. Tried paths:\n${possiblePaths.map(p => `  - ${p}`).join('\n')}\n`)
  console.warn('⚠️  Will use environment variables from system if available.\n')
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

// Debug: show what we found
console.log('Environment variables check:')
console.log(`  NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✓ Set' : '✗ Missing'}`)
console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${supabaseKey ? '✓ Set' : '✗ Missing'}`)
console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Missing'}\n`)

if (!supabaseUrl || !supabaseKey) {
  console.error('\n❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  console.error('\nPlease ensure .env.local contains:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url')
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key')
  console.error('  OPENAI_API_KEY=your_openai_key')
  console.error('\nOr set them as environment variables before running the script.')
  console.error(`\nCurrent working directory: ${process.cwd()}`)
  console.error(`Expected .env.local location: ${path.join(process.cwd(), '.env.local')}\n`)
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

/**
 * Populate from JSON file
 */
async function populateFromFile(filePath: string) {
  console.log(`\n📖 Reading knowledge from: ${filePath}`)
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`)
    process.exit(1)
  }
  
  const fileContent = fs.readFileSync(filePath, 'utf-8')
  const knowledgeItems = JSON.parse(fileContent)

  console.log(`Found ${knowledgeItems.length} knowledge items`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < knowledgeItems.length; i++) {
    const item = knowledgeItems[i]
    
    try {
      console.log(`\n[${i + 1}/${knowledgeItems.length}] Processing: ${item.category} - ${item.content.substring(0, 50)}...`)
      
      // Generate embedding
      let embedding: number[] | null = null
      try {
        console.log('  → Generating embedding...')
        embedding = await generateEmbedding(item.content)
      } catch (embedError: any) {
        // If embedding fails (e.g., quota exceeded), ask user if they want to continue without embeddings
        if (embedError.message.includes('quota') || embedError.message.includes('exceeded')) {
          console.warn(`  ⚠️  Embedding generation failed (quota exceeded).`)
          console.warn(`  ⚠️  Knowledge will be inserted WITHOUT embedding (vector search won't work).`)
          console.warn(`  ⚠️  You can re-run this script later to add embeddings when quota resets.`)
          // Continue without embedding
        } else {
          throw embedError
        }
      }
      
      // Insert into database
      console.log('  → Inserting into database...')
      const { error } = await supabase
        .from('financial_knowledge')
        .insert({
          content: item.content,
          embedding: embedding || null, // Allow null embeddings
          category: item.category,
          tags: item.tags || [],
          source: item.source || 'manual_curation',
        })

      if (error) {
        // Check if it's a duplicate (content already exists)
        if (error.code === '23505') { // Unique violation
          console.log('  ⚠️  Skipped (duplicate)')
        } else {
          throw error
        }
      } else {
        if (embedding) {
          console.log('  ✅ Success (with embedding)')
        } else {
          console.log('  ✅ Success (without embedding - will need to re-run later)')
        }
        successCount++
      }

      // Rate limiting: wait 100ms between requests (or longer if quota exceeded)
      const delay = embedding ? 100 : 500 // Longer delay if no embedding to avoid hammering
      await new Promise(resolve => setTimeout(resolve, delay))
      
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`)
      errorCount++
    }
  }

  console.log(`\n✅ Completed: ${successCount} inserted, ${errorCount} errors`)
}

/**
 * Generate knowledge using AI from topics
 */
async function generateKnowledgeFromTopic(topic: string, category: string): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY not set')
  }

  const prompt = `Based on established financial management best practices, provide a comprehensive, actionable piece of advice about: ${topic}

Requirements:
- Be specific and actionable
- Include concrete examples where relevant
- Reference common scenarios
- Keep it practical for small business owners/solopreneurs
- Length: 2-4 sentences, focused and clear
- Write in a direct, helpful tone

Return ONLY the advice text, no explanations or meta-commentary.`

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a financial advisor with expertise in small business cash flow management.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    }),
  })

  const data = await resp.json()
  if (!resp.ok) {
    throw new Error(data.error?.message || 'AI generation failed')
  }
  
  return data.choices[0].message.content.trim()
}

/**
 * Generate and populate from topics
 */
async function generateAndPopulate() {
  const topics = [
    {
      category: 'cash_flow',
      topics: [
        'Managing cash flow for small businesses with less than 3 months runway',
        'Strategies to improve cash flow when expenses exceed income',
        'How to negotiate payment terms with suppliers to improve cash flow',
        'Emergency cash flow management techniques',
      ]
    },
    {
      category: 'runway',
      topics: [
        'Calculating and interpreting cash runway for startups',
        'Actions to extend runway when it drops below 3 months',
        'Runway vs burn rate: understanding the relationship',
        'When to raise capital based on runway calculations',
      ]
    },
    {
      category: 'expenses',
      topics: [
        'Fixed vs variable costs: which to cut first in cash crisis',
        'How to reduce fixed costs without impacting operations',
        'Expense optimization strategies for solopreneurs',
        'Identifying and eliminating unnecessary recurring expenses',
      ]
    },
    {
      category: 'revenue',
      topics: [
        'Revenue diversification strategies for small businesses',
        'How to accelerate revenue recognition without compromising quality',
        'Pricing strategies to improve cash flow',
        'Managing revenue concentration risk',
      ]
    },
    {
      category: 'budgeting',
      topics: [
        'Creating realistic budgets based on historical trends',
        'Budget variance analysis: what to do when actuals differ',
        'Zero-based budgeting for cash-constrained businesses',
        'Rolling forecast best practices',
      ]
    },
    {
      category: 'risk',
      topics: [
        'Identifying financial risks before they become critical',
        'Dependency risk: over-reliance on single clients or revenue streams',
        'Timing risks: managing large payments and seasonal patterns',
        'Operational risks that impact cash flow',
      ]
    }
  ]

  console.log('\n🤖 Generating knowledge using AI...\n')

  let totalGenerated = 0
  let totalInserted = 0

  for (const categoryGroup of topics) {
    console.log(`\n📁 Category: ${categoryGroup.category}`)
    
    for (const topic of categoryGroup.topics) {
      try {
        console.log(`  → Generating: ${topic.substring(0, 60)}...`)
        const content = await generateKnowledgeFromTopic(topic, categoryGroup.category)
        
        console.log(`  → Generated: ${content.substring(0, 60)}...`)
        
        // Generate embedding
        const embedding = await generateEmbedding(content)
        
        // Insert
        const { error } = await supabase
          .from('financial_knowledge')
          .insert({
            content,
            embedding,
            category: categoryGroup.category,
            tags: [],
            source: 'ai_generated',
          })

        if (error) {
          if (error.code === '23505') {
            console.log('  ⚠️  Skipped (duplicate)')
          } else {
            throw error
          }
        } else {
          console.log('  ✅ Inserted')
          totalInserted++
        }

        totalGenerated++
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))
        
      } catch (error: any) {
        console.error(`  ❌ Error: ${error.message}`)
      }
    }
  }

  console.log(`\n✅ Generated ${totalGenerated} items, inserted ${totalInserted}`)
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)
  const mode = args[0] || 'file'

  console.log('🚀 Starting knowledge base population...\n')

  try {
    if (mode === 'file') {
      // Populate from JSON file
      // Try enhanced file first, then fallback to initial file
      const enhancedPath = path.join(__dirname, '../data/enhanced-financial-knowledge.json')
      const initialPath = path.join(__dirname, '../data/initial-financial-knowledge-example.json')
      const filePath = args[1] || (fs.existsSync(enhancedPath) ? enhancedPath : initialPath)
      await populateFromFile(filePath)
    } else if (mode === 'generate') {
      // Generate using AI
      await generateAndPopulate()
    } else {
      console.error('Usage:')
      console.error('  npx tsx scripts/populate-knowledge-base.ts [file|generate] [file-path]')
      console.error('\nExamples:')
      console.error('  npx tsx scripts/populate-knowledge-base.ts file')
      console.error('  npx tsx scripts/populate-knowledge-base.ts file data/my-knowledge.json')
      console.error('  npx tsx scripts/populate-knowledge-base.ts generate')
      process.exit(1)
    }

    console.log('\n✨ Done!')
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { populateFromFile, generateAndPopulate, generateEmbedding }
