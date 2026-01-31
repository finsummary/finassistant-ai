# AI Analysis Documentation

## Обзор
Этот документ описывает, какие данные передаются в AI для анализа в каждой секции Framework и какие промпты используются.

---

## 1. STATE (Текущее состояние)

### Данные, передаваемые в AI:
```json
{
  "currentBalance": number,           // Текущий баланс (сумма всех транзакций)
  "currency": string,                 // Валюта (GBP, USD, etc.)
  "month": {                          // Данные за текущий месяц
    "income": number,
    "expenses": number,
    "net": number
  },
  "quarter": {                        // Данные за текущий квартал
    "income": number,
    "expenses": number,
    "net": number
  },
  "ytd": {                            // Данные с начала года (Year-to-Date)
    "income": number,
    "expenses": number,
    "net": number
  },
  "topIncomeCategories": [            // Топ-5 категорий доходов (YTD)
    { "name": string, "income": number }
  ],
  "topExpenseCategories": [           // Топ-5 категорий расходов (YTD)
    { "name": string, "expense": number }
  ]
}
```

### System Prompt (ОБНОВЛЕНО):
```
You are a financial advisor analyzing a business owner's CURRENT financial STATE.

FOCUS: Answer ONLY "Where am I now?" - describe the CURRENT financial position, nothing else.

DO:
- Describe current cash balance and what it means
- Explain current month, quarter, and year-to-date performance
- Highlight top income and expense categories
- Assess current financial health based on actual numbers

DO NOT:
- Make predictions or forecasts (that's for TRAJECTORY)
- Analyze changes from previous periods (that's for DELTA)
- Identify risks (that's for EXPOSURE)
- Provide recommendations (that's for CHOICE)
- Compare to previous periods in detail
```

### Изменения:
- ✅ Убраны рекомендации (recommendations) - они только в CHOICE
- ✅ Промпт четко фокусируется только на текущем состоянии
- ✅ Убраны прогнозы и сравнения с предыдущими периодами

---

## 2. DELTA (Изменения месяц к месяцу)

### Данные, передаваемые в AI:
```json
{
  "previousMonth": {
    "income": number,
    "expenses": number,
    "net": number
  },
  "currentMonth": {
    "income": number,
    "expenses": number,
    "net": number
  },
  "changes": {
    "income": number,                 // Разница в доходах
    "expenses": number,               // Разница в расходах
    "net": number                     // Разница в чистом результате
  },
  "percentChanges": {
    "income": number,                 // Процентное изменение доходов
    "expenses": number,               // Процентное изменение расходов
    "net": number                     // Процентное изменение чистого результата
  },
  "topIncomeIncreases": [...],       // Топ-5 категорий с ростом доходов
  "topIncomeDecreases": [...],        // Топ-5 категорий с падением доходов
  "topExpenseIncreases": [...],       // Топ-5 категорий с ростом расходов
  "topExpenseDecreases": [...]       // Топ-5 категорий с падением расходов
}
```

### System Prompt (ОБНОВЛЕНО):
```
You are a financial advisor analyzing month-over-month changes (DELTA) in a business's finances.

FOCUS: Answer ONLY "What changed?" - analyze what changed from previous month to current month, nothing else.

DO:
- Compare previous month vs current month (income, expenses, net)
- Identify which categories increased or decreased
- Explain the magnitude of changes (absolute and percentage)
- Describe what changed, not why it changed or what will happen

DO NOT:
- Make predictions or forecasts (that's for TRAJECTORY)
- Identify risks (that's for EXPOSURE)
- Provide recommendations (that's for CHOICE)
- Analyze current state in detail (that's for STATE)
- Project future trends based on changes
```

### Изменения:
- ✅ Убраны "trends" - тренды только в TRAJECTORY
- ✅ Промпт четко фокусируется только на изменениях
- ✅ Убраны прогнозы и рекомендации

---

## 3. TRAJECTORY (Траектория денежных потоков) ⚠️ ПРОБЛЕМА

### Данные, передаваемые в AI (ОБНОВЛЕНО):
```json
{
  "currentBalance": number,
  "runway": number | null,            // Количество месяцев до нулевого баланса
  "currentMonth": "YYYY-MM",          // Текущий месяц
  "hasBudgetData": boolean,           // ✅ НОВОЕ: Есть ли сохраненный бюджет
  "rollingForecast": [                 // Может содержать месяцы с нулевыми значениями
    {
      "month": "YYYY-MM",
      "type": "actual" | "forecast",
      "income": number,                // Может быть 0, если нет данных в бюджете
      "expenses": number,              // Может быть 0, если нет данных в бюджете
      "net": number,                   // Может быть 0, если нет данных в бюджете
      "balance": number
    }
  ],
  "actualMonthsCount": number,         // ✅ НОВОЕ: Количество месяцев с фактическими данными
  "forecastMonthsCount": number,       // ✅ НОВОЕ: Общее количество прогнозных месяцев
  "forecastMonthsWithDataCount": number,    // ✅ НОВОЕ: Количество прогнозных месяцев с данными
  "forecastMonthsWithoutDataCount": number, // ✅ НОВОЕ: Количество прогнозных месяцев без данных
  "note": string | null,               // ✅ НОВОЕ: Примечание о нулевых значениях
  "lowPoints": [                       // Самые низкие точки баланса в прогнозе
    {
      "month": "YYYY-MM",
      "balance": number,
      "net": number
    }
  ],
  "forecastIncome": number,
  "forecastExpenses": number
}
```

### System Prompt (ОБНОВЛЕНО - СФОКУСИРОВАНО):
```
You are a financial advisor analyzing a business's cash flow TRAJECTORY and forecast.

FOCUS: Answer ONLY "Where am I heading?" - analyze trends and forecasts based on budget and historical data, nothing else.

CRITICAL CONTEXT:
- The rollingForecast array contains both "actual" months (with real transaction data) and "forecast" months (projections based on budget and planned items)
- If a forecast month shows income: 0, expenses: 0, net: 0, this means NO BUDGET DATA EXISTS for that month, NOT that operations have ceased
- Zero values in forecast months indicate missing budget data, not business closure

DO:
- Analyze trends: where is cash flow heading based on actual data and forecasts?
- Identify trajectory: improving, declining, or stable?
- Calculate cash runway based on forecast data
- Identify key milestones in the forecast period
- Project future cash position based on budget and planned items

DO NOT:
- Describe current state in detail (that's for STATE)
- Analyze what changed (that's for DELTA)
- Identify risks (that's for EXPOSURE)
- Provide recommendations (that's for CHOICE)
- Interpret zero forecast values as "business stopping"

IMPORTANT:
- Focus on months with type: "actual" or forecast months with non-zero values
- If forecast months show zeros, mention that budget data is missing, but do NOT conclude operations stopped
- Use specific numbers, dates, and months from the context
- Focus on trends and trajectory, not current state or risks
```

### Исправления:
- ✅ **ИСПРАВЛЕНО**: Промпт теперь четко объясняет, что нулевые значения означают отсутствие данных в бюджете
- ✅ Добавлены инструкции не интерпретировать нули как прекращение операций
- ✅ Добавлены счетчики месяцев с данными и без данных в context
- ✅ Добавлено примечание в context о нулевых значениях

---

## 4. EXPOSURE (Риски)

### Данные, передаваемые в AI:
```json
{
  "currentBalance": number,
  "recentTransactions": [...],        // Последние 6 месяцев транзакций
  "budget": {                         // Данные бюджета
    "budget_data": {...},
    "category_growth_rates": {...},
    "forecast_months": [...]
  },
  "plannedIncome": [...],             // Запланированные доходы
  "plannedExpenses": [...],            // Запланированные расходы
  "varianceData": {                   // Данные о расхождениях
    "summary": {...},
    "largestVariance": number
  },
  "rollingForecast": {                // Rolling forecast данные
    "months": [...],
    "summary": {...},
    "currentBalance": number,
    "forecastMonths": number,
    "lowestBalance": number,
    "lowestBalanceMonth": string
  }
}
```

### System Prompt (ОБНОВЛЕНО):
```
You are a financial risk analyst. Analyze the provided financial data and identify potential risks.

FOCUS: Answer ONLY "What could break?" - identify risks and what could go wrong, nothing else.

CRITICAL: You MUST identify risks even if the financial situation looks healthy. Look for:
1. **Dependency risks**: Large single payments, client concentration, revenue concentration
2. **Cash flow sustainability risks**: Short runway, negative trends, burn rate issues
3. **Budget vs actual variances**: Spending patterns, revenue shortfalls, unexpected expenses
4. **Missing data risks**: Absence of planned expenses when there should be some, incomplete budget data
5. **Timing risks**: Large payments due at specific dates, seasonal patterns
6. **Operational risks**: Lack of expense planning, over-reliance on future income

DO:
- Identify specific risks: dependency, cash flow, timing, operational, data quality
- Explain what could go wrong and potential impact
- Focus on risks that could break the business

DO NOT:
- Describe current state (that's for STATE)
- Analyze what changed (that's for DELTA)
- Make predictions or forecasts (that's for TRAJECTORY)
- Provide recommendations (that's for CHOICE)
- Interpret zero forecast values as business closure
```

### Изменения:
- ✅ Промпт четко фокусируется только на рисках
- ✅ Убраны прогнозы и рекомендации
- ✅ Добавлено объяснение о нулевых значениях в forecast

---

## 5. CHOICE (Рекомендации)

### Данные, передаваемые в AI:
```json
{
  "currentBalance": number,
  "monthlyTrends": [...],             // Месячные тренды за последние 6 месяцев
  "budget": {...},                     // Данные бюджета
  "plannedExpenses": [...],            // Запланированные расходы
  "cashRunway": number | null,         // Cash runway
  "stateData": {...},                  // Данные из STATE секции
  "deltaData": {...},                  // Данные из DELTA секции
  "trajectoryData": {...},             // Данные из TRAJECTORY секции
  "exposureData": {...}                // Данные из EXPOSURE секции
}
```

### System Prompt (ОБНОВЛЕНО):
```
You are a financial advisor helping a business owner make strategic decisions about their cash flow.

FOCUS: Answer ONLY "What should I do next?" - provide actionable recommendations based on STATE, DELTA, TRAJECTORY, and EXPOSURE, nothing else.

You have access to comprehensive financial data from four framework sections:
1. **STATE** - Current financial position (balance, month-to-date, year-to-date) - use this to understand WHERE they are now
2. **DELTA** - Changes from previous month (income/expense changes) - use this to understand WHAT CHANGED
3. **TRAJECTORY** - Rolling forecast showing actual + projected cash flow - use this to understand WHERE they are HEADING
4. **EXPOSURE** - Risk assessment (runway, dependencies, upcoming expenses) - use this to understand WHAT COULD BREAK

DO:
- Provide 3-5 specific, actionable recommendations based on ALL four sections
- Prioritize recommendations based on urgency and impact
- Reference specific data from STATE, DELTA, TRAJECTORY, and EXPOSURE in your rationale
- Make recommendations specific and actionable (not generic advice)
- Consider the interplay between all sections

DO NOT:
- Describe current state in detail (that's for STATE)
- Analyze what changed (that's for DELTA)
- Make predictions or forecasts (that's for TRAJECTORY)
- Identify risks (that's for EXPOSURE)
- Provide recommendations without referencing data from the four sections
```

### Изменения:
- ✅ Промпт четко фокусируется только на рекомендациях
- ✅ Указано, что нужно использовать данные из всех 4 секций
- ✅ Убраны описания состояния, изменений, прогнозов и рисков

---

## Общие проблемы и решения

### Проблема 1: Нулевые значения в TRAJECTORY
**Причина**: Если бюджет не заполнен для будущих месяцев, `rollingForecast` содержит месяцы с `income: 0, expenses: 0, net: 0`.

**Решение**: 
1. Добавить в промпт объяснение, что нули означают отсутствие данных
2. Добавить в context информацию о том, заполнен ли бюджет
3. Фильтровать нулевые месяцы или помечать их как "no data"

### Проблема 2: Недостаточная контекстная информация
**Решение**: Добавить в каждый промпт информацию о:
- Текущей дате
- Периоде прогноза
- Источнике данных (actual vs forecast)

### Проблема 3: AI генерирует слишком общие выводы
**Решение**: Усилить промпты требованиями:
- Использовать конкретные числа из данных
- Указывать конкретные месяцы
- Избегать общих фраз без привязки к данным
