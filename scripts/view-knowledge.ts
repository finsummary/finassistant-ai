/**
 * Script to view contents of financial_knowledge and user_knowledge tables
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables from .env.local
function loadEnvFile() {
  const envPaths = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '..', '.env.local'),
    path.join(__dirname, '..', '.env.local'),
  ]

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      console.log(`📄 Loading env from: ${envPath}`)
      const envContent = fs.readFileSync(envPath, 'utf-8')
      envContent.split('\n').forEach((line) => {
        const trimmedLine = line.trim()
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=')
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, '')
            process.env[key.trim()] = value.trim()
          }
        }
      })
      return
    }
  }
  console.warn('⚠️  No .env.local file found')
}

loadEnvFile()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function viewKnowledge() {
  console.log('\n🔍 Viewing Knowledge Base Contents...\n')

  try {
    // Get financial knowledge
    console.log('📚 FINANCIAL KNOWLEDGE:')
    console.log('=' .repeat(80))
    
    const { data: financialKnowledge, error: fkError } = await supabase
      .from('financial_knowledge')
      .select('id, content, category, tags, source, created_at')
      .order('created_at', { ascending: true })

    if (fkError) {
      console.error('❌ Error fetching financial knowledge:', fkError)
    } else {
      console.log(`\nTotal items: ${financialKnowledge?.length || 0}\n`)
      
      if (financialKnowledge && financialKnowledge.length > 0) {
        financialKnowledge.forEach((item, index) => {
          console.log(`\n[${index + 1}] ID: ${item.id}`)
          console.log(`    Category: ${item.category || 'N/A'}`)
          console.log(`    Tags: ${item.tags ? JSON.stringify(item.tags) : 'N/A'}`)
          console.log(`    Source: ${item.source || 'N/A'}`)
          console.log(`    Created: ${item.created_at}`)
          console.log(`    Content: ${item.content.substring(0, 200)}${item.content.length > 200 ? '...' : ''}`)
          console.log('')
        })
      } else {
        console.log('   No financial knowledge items found.')
      }
    }

    // Get user knowledge
    console.log('\n\n👤 USER KNOWLEDGE:')
    console.log('=' .repeat(80))
    
    const { data: userKnowledge, error: ukError } = await supabase
      .from('user_knowledge')
      .select('id, user_id, content, type, metadata, created_at')
      .order('created_at', { ascending: true })

    if (ukError) {
      console.error('❌ Error fetching user knowledge:', ukError)
    } else {
      console.log(`\nTotal items: ${userKnowledge?.length || 0}\n`)
      
      if (userKnowledge && userKnowledge.length > 0) {
        // Group by user_id
        const byUser: Record<string, typeof userKnowledge> = {}
        userKnowledge.forEach((item) => {
          if (!byUser[item.user_id]) {
            byUser[item.user_id] = []
          }
          byUser[item.user_id].push(item)
        })

        Object.entries(byUser).forEach(([userId, items]) => {
          console.log(`\n📋 User ID: ${userId} (${items.length} items)`)
          items.forEach((item, index) => {
            console.log(`\n   [${index + 1}] ID: ${item.id}`)
            console.log(`       Type: ${item.type}`)
            console.log(`       Metadata: ${item.metadata ? JSON.stringify(item.metadata) : 'N/A'}`)
            console.log(`       Created: ${item.created_at}`)
            console.log(`       Content: ${item.content.substring(0, 200)}${item.content.length > 200 ? '...' : ''}`)
          })
        })
      } else {
        console.log('   No user knowledge items found.')
      }
    }

    // Summary
    console.log('\n\n📊 SUMMARY:')
    console.log('=' .repeat(80))
    console.log(`Financial Knowledge: ${financialKnowledge?.length || 0} items`)
    console.log(`User Knowledge: ${userKnowledge?.length || 0} items`)
    console.log('')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

viewKnowledge()
