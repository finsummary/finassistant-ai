# FinAssistant.ai User Guide

Welcome to FinAssistant.ai! This guide will help you get started with managing your business finances.

## Getting Started

### 1. Create an Account

1. Navigate to the login page
2. Click "Sign Up" or "Register"
3. Enter your email and create a password
4. Verify your email (if required)
5. Log in with your credentials

### 2. Set Up Your Organization

After logging in for the first time:

1. You'll see a prompt to set up your organization
2. Click "Settings" or navigate to `/settings/organization`
3. Enter your **Business Name**
4. Select your **Country** (this is for context only)
5. Click "Save"

This information helps personalize your financial insights.

## Managing Bank Accounts

### Creating a Bank Account

1. Go to the **Dashboard**
2. Scroll to "Bank Accounts" section
3. Enter an account name (e.g., "Main Business Account")
4. Select or enter a currency (e.g., GBP, USD, EUR)
5. Click "Add"

You can create multiple accounts for different banks or currencies.

## Importing Transactions

### CSV Import

1. **Prepare your CSV file** with the following columns:
   - **Date** (required): Format like `2025-01-15` or `15/01/2025`
   - **Amount** (required): Can be positive or negative
   - **Description** (optional): Transaction description
   - **Currency** (optional): If not provided, uses default currency

2. **Example CSV format:**
   ```csv
   date,description,amount,currency
   2025-01-15,Client Payment,5000.00,GBP
   2025-01-16,Office Rent,-1200.00,GBP
   ```

3. **Import the file:**
   - Go to Dashboard
   - Scroll to "Import CSV" section
   - Click "Choose File" and select your CSV
   - Select the account to import into
   - Set default currency if needed
   - Check "Invert sign" if your amounts need to be flipped
   - Click "Import"

4. **Verify import:**
   - Check the success message
   - Review transactions in the account list
   - Transactions are automatically deduplicated

### Supported Date Formats

- `YYYY-MM-DD` (e.g., 2025-01-15)
- `DD/MM/YYYY` (e.g., 15/01/2025)
- `MM/DD/YYYY` (e.g., 01/15/2025)

### Supported Number Formats

- US format: `1,234.56`
- European format: `1.234,56`
- Both formats are automatically detected

## Categorizing Transactions

### Manual Categorization

1. Find the transaction in your account list
2. Click on the transaction
3. Select or enter a category
4. The category is saved automatically

### AI Categorization

1. Click the **"AI Categorize"** button
2. Wait for processing (may take a moment)
3. Review the suggested categories
4. Adjust manually if needed

### Auto-Categorization (Rules)

1. Click **"Auto-categorize (Rules)"** button
2. Transactions are categorized based on description patterns
3. Review and adjust as needed

## Planned Income & Expenses

### Adding Planned Income

1. Navigate to **Settings > Planned Items**
2. In the "Planned Income" section:
   - Enter a description (e.g., "Monthly Retainer")
   - Enter the amount
   - Select the expected date
   - Choose recurrence: **One-off** or **Monthly**
   - Click "Add Income"

### Adding Planned Expenses

1. In the "Planned Expenses" section:
   - Enter description (e.g., "Office Rent")
   - Enter amount
   - Select expected date
   - Choose recurrence
   - Click "Add Expense"

### Editing Planned Items

- Click on any field in the planned items table
- Edit inline
- Changes are saved automatically

### Deleting Planned Items

- Click the delete button (trash icon) next to the item
- Confirm deletion

## Using the Financial Framework

The 5-step framework is the core of FinAssistant.ai. Navigate to **Framework** from the dashboard.

### STATE - Where am I now?

Shows your current financial position:
- **Current Cash Balance**: Total of all transactions
- **Last Month**: Inflow, outflow, and net result
- **This Month**: Current month's activity
- **Top Categories**: Breakdown by category

**What to look for:**
- Is your balance positive or negative?
- Which categories are driving your cash flow?

### DELTA - What changed?

Compares current month vs. previous month:
- **Total Change**: Overall difference
- **Top Increases**: Categories that grew
- **Top Decreases**: Categories that shrunk

**What to look for:**
- Are changes expected or surprising?
- Which categories are volatile?

### TRAJECTORY - Where am I heading?

6-month cash flow forecast:
- **Current Balance**: Starting point
- **Average Monthly Change**: Historical trend
- **Forecast**: Month-by-month projection
- **Low Points**: Months with lowest projected balance

**What to look for:**
- Will you run out of cash?
- When are the critical months?

### EXPOSURE - What could break?

Risk assessment:
- **Cash Runway**: Months until cash reaches zero
- **Risk Flags**: Warnings about potential issues
- **Upcoming Large Expenses**: Major expenses in next 3 months
- **Downside Scenario**: What if revenue drops 20%?

**What to look for:**
- How much buffer do you have?
- What are the biggest risks?

### CHOICE - What should I do next?

Decision recommendations:
- **Decision Cards**: Suggested actions
- **Cash Impact**: How each decision affects cash
- **Risk Level**: Low, medium, or high risk
- **Reversibility**: Can you undo this decision?
- **Timeframe**: Immediate, short-term, or long-term

**What to look for:**
- Which decisions align with your goals?
- What's the risk/reward trade-off?

## AI Assistant

### Asking Questions

1. Navigate to the Framework page
2. Find the AI Assistant sidebar
3. Use suggested questions or type your own
4. Ask questions like:
   - "Why did my cash balance decrease this month?"
   - "What should I do about my low runway?"
   - "Explain my forecast for the next 3 months"

### Framework-Specific Questions

The AI assistant is context-aware:
- When viewing STATE, it focuses on current position
- When viewing TRAJECTORY, it explains forecasts
- Questions are tailored to the current step

## Executive Summary

### Viewing the Summary

1. Navigate to **Framework**
2. Click **"Executive Summary"** button
3. Review the one-page summary

### Exporting

1. Click **"Print/Export PDF"** button
2. Use browser's print dialog
3. Select "Save as PDF" as destination
4. Save the file

The summary includes:
- Organization details
- STATE snapshot
- DELTA analysis
- TRAJECTORY forecast
- EXPOSURE risks
- CHOICE recommendations

## Tips & Best Practices

### Regular Updates

- Import transactions weekly or monthly
- Update planned items as plans change
- Review framework monthly

### Accurate Categorization

- Categorize transactions promptly
- Use consistent category names
- Review AI suggestions before accepting

### Planning Ahead

- Add all known upcoming expenses
- Include recurring income
- Update plans when circumstances change

### Understanding Forecasts

- Forecasts are based on historical averages
- Planned items override averages
- Review and adjust regularly

## Troubleshooting

### CSV Import Issues

**Problem**: Transactions not importing
- **Solution**: Check CSV format matches requirements
- Verify date format is recognized
- Ensure amount column is numeric

**Problem**: Wrong amounts
- **Solution**: Try "Invert sign" option
- Check if CSV uses positive/negative or separate columns

### Framework Not Loading

**Problem**: Framework shows "No data"
- **Solution**: Import transactions first
- Add at least one bank account
- Ensure transactions are categorized

### AI Assistant Not Working

**Problem**: AI responses not appearing
- **Solution**: Check API key is configured
- Verify internet connection
- Check browser console for errors

### Performance Issues

**Problem**: Slow loading
- **Solution**: Reduce number of transactions
- Clear browser cache
- Check internet connection

## Getting Help

- Check this guide first
- Review the FAQ section
- Contact support: [your-email]

## Privacy & Security

- Your data is encrypted in transit and at rest
- Only you can see your financial data
- Data is stored securely in Supabase
- We never share your data with third parties

## Frequently Asked Questions

### Q: Can I connect my bank directly?

**A**: Not in the MVP. Currently, you need to export CSV files from your bank and upload them.

### Q: How often should I update my data?

**A**: Weekly or monthly updates are recommended. More frequent updates provide more accurate forecasts.

### Q: Can I use multiple currencies?

**A**: Yes! Create separate accounts for each currency. Note: forecasts combine all currencies.

### Q: What if my forecast looks wrong?

**A**: Forecasts use historical averages. If you have planned items, they override averages. Review your planned income/expenses.

### Q: Can I export my data?

**A**: Currently, you can export the Executive Summary as PDF. Full data export may be added in future versions.

### Q: Is my data backed up?

**A**: Yes, Supabase provides automatic backups. Your data is safe.

---

**Last Updated**: January 2025
