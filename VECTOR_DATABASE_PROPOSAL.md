# Vector Database Integration Proposal

## Overview
Добавление векторной базы данных для улучшения AI-анализа через:
1. **Финансовые знания** - общие best practices, стратегии, примеры
2. **Пользовательские знания** - история решений, предпочтения, контекст бизнеса

## Recommended Solution: Supabase pgvector

**Почему pgvector:**
- ✅ Уже используем Supabase (PostgreSQL)
- ✅ Нет дополнительных сервисов/зависимостей
- ✅ RLS (Row Level Security) для изоляции данных пользователей
- ✅ Бесплатно на Supabase
- ✅ Простая интеграция

**Альтернативы:**
- Pinecone (managed, платный после free tier)
- Weaviate (self-hosted или cloud)
- Chroma (легковесный, для небольших проектов)

## Use Cases

### 1. Financial Knowledge Base (Общие знания)

**Что хранить:**
- Best practices финансового управления
- Примеры успешных стратегий для малого бизнеса
- Интерпретация финансовых метрик
- Типичные проблемы и решения
- Отраслевые инсайты (если известна отрасль)

**Примеры документов:**
```
"Для бизнеса с runway < 3 месяцев критично сократить fixed costs. 
Примеры: пересмотр офисных договоров, переговоры с поставщиками, 
отсрочка несущественных расходов."

"Если доходы растут на 20%+ месяц к месяцу, но расходы растут на 30%+, 
это сигнал о неконтролируемом росте. Нужно заморозить найм и оптимизировать процессы."
```

**Структура:**
- `content` (text) - сам текст знания
- `embedding` (vector) - векторное представление
- `category` (text) - категория (cash_flow, runway, expenses, revenue, etc.)
- `tags` (text[]) - теги для фильтрации
- `source` (text) - источник (optional)

### 2. User-Specific Knowledge (Пользовательские знания)

**Что хранить:**
- История принятых решений и их результаты
- Предпочтения пользователя (какие категории важны, tolerance к риску)
- Контекст бизнеса (отрасль, размер, стадия, страна)
- Прошлые вопросы пользователя и ответы AI
- Заметки пользователя о финансовых решениях

**Примеры:**
```
"Пользователь предпочитает консервативные решения с низким риском. 
В прошлом месяце отклонил рекомендацию по инвестированию в маркетинг 
из-за короткого runway."

"Бизнес в сфере SaaS, стадия: product-market fit. Основной доход от 
рекуррентных подписок. Критично поддерживать MRR growth > 10%."
```

**Структура:**
- `user_id` (uuid) - владелец знания
- `content` (text) - текст
- `embedding` (vector) - вектор
- `type` (text) - тип: 'preference', 'decision_history', 'business_context', 'note'
- `metadata` (jsonb) - дополнительные данные
- `created_at` (timestamp)

## Implementation Plan

### Phase 1: Setup pgvector

1. **Миграция для включения pgvector:**
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Financial Knowledge Base table
CREATE TABLE financial_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 dimension
  category TEXT, -- cash_flow, runway, expenses, revenue, etc.
  tags TEXT[],
  source TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User Knowledge Base table
CREATE TABLE user_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  type TEXT NOT NULL, -- preference, decision_history, business_context, note
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for vector search
CREATE INDEX ON financial_knowledge USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON user_knowledge USING ivfflat (embedding vector_cosine_ops);

-- RLS for user_knowledge
ALTER TABLE user_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own knowledge" 
  ON user_knowledge FOR ALL 
  USING (auth.uid() = user_id);
```

### Phase 2: Embedding Generation

**Создать утилиту для генерации embeddings:**

```typescript
// src/lib/embeddings.ts
import { getAvailableProviders } from './ai-provider'

export async function generateEmbedding(text: string): Promise<number[]> {
  // Use OpenAI for embeddings (most reliable)
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY not set')
  }

  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small', // или text-embedding-ada-002
      input: text,
    }),
  })

  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error?.message || 'Embedding failed')
  return data.data[0].embedding
}
```

### Phase 3: Knowledge Retrieval

**Создать функцию для поиска релевантных знаний:**

```typescript
// src/lib/knowledge-search.ts
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from './embeddings'

export async function searchFinancialKnowledge(
  query: string,
  category?: string,
  limit: number = 5
): Promise<Array<{ content: string; category: string; similarity: number }>> {
  const supabase = await createClient()
  const queryEmbedding = await generateEmbedding(query)

  let queryBuilder = supabase.rpc('match_financial_knowledge', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: limit,
  })

  if (category) {
    queryBuilder = queryBuilder.eq('category', category)
  }

  const { data, error } = await queryBuilder

  if (error) throw error
  return data || []
}

export async function searchUserKnowledge(
  userId: string,
  query: string,
  type?: string,
  limit: number = 5
): Promise<Array<{ content: string; type: string; similarity: number }>> {
  const supabase = await createClient()
  const queryEmbedding = await generateEmbedding(query)

  let queryBuilder = supabase.rpc('match_user_knowledge', {
    user_id: userId,
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: limit,
  })

  if (type) {
    queryBuilder = queryBuilder.eq('type', type)
  }

  const { data, error } = await queryBuilder

  if (error) throw error
  return data || []
}
```

**SQL функции для поиска:**

```sql
-- Function for financial knowledge search
CREATE OR REPLACE FUNCTION match_financial_knowledge(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  category text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    financial_knowledge.id,
    financial_knowledge.content,
    financial_knowledge.category,
    1 - (financial_knowledge.embedding <=> query_embedding) as similarity
  FROM financial_knowledge
  WHERE 1 - (financial_knowledge.embedding <=> query_embedding) > match_threshold
  ORDER BY financial_knowledge.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function for user knowledge search
CREATE OR REPLACE FUNCTION match_user_knowledge(
  user_id uuid,
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  type text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    user_knowledge.id,
    user_knowledge.content,
    user_knowledge.type,
    1 - (user_knowledge.embedding <=> query_embedding) as similarity
  FROM user_knowledge
  WHERE user_knowledge.user_id = user_id
    AND 1 - (user_knowledge.embedding <=> query_embedding) > match_threshold
  ORDER BY user_knowledge.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### Phase 4: Integration with AI Analysis

**Обновить AI prompts для использования знаний:**

```typescript
// Example: src/app/api/framework/choice/analyze/route.ts

// Before AI call, retrieve relevant knowledge
const financialKnowledge = await searchFinancialKnowledge(
  `Business has ${currentBalance} cash, ${cashRunway} months runway. 
   Main risks: ${risks.join(', ')}. What should be done?`,
  'cash_flow'
)

const userKnowledge = await searchUserKnowledge(
  userId,
  `User's business context and preferences for financial decisions`,
  'preference'
)

// Add to context
const enhancedContext = {
  ...context,
  relevantKnowledge: {
    financial: financialKnowledge.map(k => k.content),
    user: userKnowledge.map(k => k.content),
  }
}

// Update system prompt
const systemPrompt = `You are a financial advisor...

RELEVANT FINANCIAL KNOWLEDGE:
${financialKnowledge.map(k => `- ${k.content}`).join('\n')}

USER-SPECIFIC CONTEXT:
${userKnowledge.map(k => `- ${k.content}`).join('\n')}

...rest of prompt`
```

### Phase 5: Knowledge Population

#### 1. Initial Financial Knowledge - Sources & Methods

**A. AI-Generated Knowledge (Recommended for Start)**
Использовать AI для генерации знаний на основе проверенных источников:

```typescript
// scripts/populate-financial-knowledge.ts
const knowledgeTopics = [
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

// Use AI to generate detailed knowledge from these topics
async function generateKnowledgeFromTopic(topic: string, category: string) {
  const prompt = `Based on established financial management best practices, 
  provide a comprehensive, actionable piece of advice about: ${topic}
  
  Format:
  - Be specific and actionable
  - Include concrete examples where relevant
  - Reference common scenarios
  - Keep it practical for small business owners/solopreneurs
  
  Length: 2-4 sentences, focused and clear.`
  
  // Call AI to generate content
  // Then create embedding and store
}
```

**B. Curated Content from Trusted Sources**
Создать скрипт для импорта из структурированных источников:

**Источники:**
1. **Financial Management Books** (извлечение ключевых концепций)
   - "Profit First" by Mike Michalowicz
   - "The Lean Startup" by Eric Ries (финансовые аспекты)
   - "Financial Intelligence" by Karen Berman

2. **Business Finance Websites** (scraping/API)
   - Investopedia articles (financial terms, concepts)
   - SCORE.org resources (small business finance)
   - SBA.gov guides (US Small Business Administration)

3. **Industry Reports & Benchmarks**
   - Industry-specific financial benchmarks
   - SaaS metrics (MRR, churn, CAC) если применимо
   - Retail/Service industry standards

4. **Case Studies**
   - Реальные кейсы успешных финансовых решений
   - Примеры того, что НЕ делать (lessons learned)

**C. Manual Curation (Initial Seed)**
Создать начальный набор вручную. **Пример файла:** `data/initial-financial-knowledge-example.json`

Этот файл содержит 15+ готовых знаний по категориям:
- cash_flow
- expenses
- runway
- revenue
- budgeting
- risk

**Использование:**
```bash
# Заполнить из JSON файла
npx tsx scripts/populate-knowledge-base.ts file

# Или указать свой файл
npx tsx scripts/populate-knowledge-base.ts file data/my-knowledge.json
```

**D. Community-Generated Knowledge (Future)**
- Позволить пользователям добавлять свои инсайты (с модерацией)
- Анонимизированные успешные стратегии от других пользователей
- Crowdsourced best practices

#### 2. User Knowledge - Auto-Population

**A. Automatic Context Capture:**
```typescript
// After each AI analysis, save context
async function saveUserKnowledgeFromAnalysis(
  userId: string,
  frameworkSection: string,
  context: any,
  aiRecommendations: any
) {
  const knowledge = {
    type: 'decision_history',
    content: `In ${frameworkSection} analysis: User had ${context.currentBalance} cash, 
    ${context.runway} months runway. AI recommended: ${aiRecommendations.summary}. 
    Context: ${JSON.stringify(context)}`,
    metadata: {
      framework_section: frameworkSection,
      timestamp: new Date().toISOString(),
      recommendations: aiRecommendations,
    }
  }
  
  // Generate embedding and save
}
```

**B. User Preferences:**
```typescript
// When user interacts with recommendations
async function saveUserPreference(
  userId: string,
  action: 'accepted' | 'rejected' | 'modified',
  recommendation: any
) {
  const knowledge = {
    type: 'preference',
    content: `User ${action} recommendation: "${recommendation.description}". 
    This indicates preference for ${action === 'accepted' ? 'aggressive' : 'conservative'} 
    financial strategies.`,
    metadata: { action, recommendation }
  }
}
```

**C. Business Context:**
```typescript
// Extract from organization data and transactions
async function extractBusinessContext(userId: string) {
  // Analyze transaction patterns to infer:
  // - Business type (SaaS, retail, service, etc.)
  // - Revenue model (recurring, one-time, project-based)
  // - Seasonality patterns
  // - Typical expense categories
  
  const context = {
    type: 'business_context',
    content: `Business appears to be ${inferredType} with ${revenueModel} revenue model. 
    Shows ${seasonality} seasonality. Main expense categories: ${topCategories}.`,
    metadata: { inferredType, revenueModel, seasonality, topCategories }
  }
}
```

#### 3. Implementation Script

**Готовый скрипт:** `scripts/populate-knowledge-base.ts`

**Два режима работы:**

**A. Из JSON файла (быстро, готовые знания):**
```bash
npx tsx scripts/populate-knowledge-base.ts file
```

**B. Генерация через AI (динамически, больше знаний):**
```bash
npx tsx scripts/populate-knowledge-base.ts generate
```

Скрипт автоматически:
- Генерирует embeddings через OpenAI
- Вставляет в базу данных
- Обрабатывает дубликаты
- Показывает прогресс

**Требования:**
- `NEXT_PUBLIC_SUPABASE_URL` или `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (для обхода RLS)
- `OPENAI_API_KEY` (для embeddings и генерации)

#### 4. Continuous Improvement

**A. Feedback Loop:**
- Отслеживать, какие знания используются чаще всего
- Улучшать релевантность через user feedback
- Удалять устаревшие или нерелевантные знания

**B. A/B Testing:**
- Тестировать разные формулировки знаний
- Измерять impact на качество рекомендаций

**C. Regular Updates:**
- Еженедельно/ежемесячно добавлять новые знания
- Обновлять на основе изменений в финансовых практиках

## Benefits

1. **Более релевантные рекомендации** - AI использует проверенные знания
2. **Персонализация** - учитываются предпочтения и история пользователя
3. **Консистентность** - одинаковые ситуации получают похожие советы
4. **Обучение системы** - чем больше данных, тем лучше рекомендации
5. **Меньше токенов** - релевантные знания вместо длинных промптов

## Next Steps

1. ✅ Создать миграцию для pgvector
2. ✅ Реализовать embedding generation
3. ✅ Создать функции поиска
4. ✅ Интегрировать в AI анализ
5. ⏳ Заполнить начальную базу знаний
6. ⏳ Добавить UI для управления пользовательскими знаниями

## Example: How It Works

**Scenario:** Пользователь имеет runway 2 месяца, высокие fixed costs

**Without Vector DB:**
- AI получает только текущие данные
- Генерирует общие рекомендации

**With Vector DB:**
1. Система ищет релевантные знания: "runway < 3 months", "fixed costs reduction"
2. Находит: "Для бизнеса с runway < 3 месяцев критично сократить fixed costs..."
3. Ищет пользовательские знания: предпочтения, прошлые решения
4. AI получает контекст + знания → более точные рекомендации

## Cost Considerations

- **OpenAI Embeddings:** ~$0.02 per 1M tokens (text-embedding-3-small)
- **Storage:** Минимальный (векторы ~6KB каждый)
- **Supabase:** Включено в план (pgvector бесплатен)

**Estimated monthly cost:** $5-20 для среднего использования
