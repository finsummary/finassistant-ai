# Testing Guide

This document outlines the testing plan and checklist for FinAssistant.ai MVP.

## Pre-Testing Setup

1. **Environment Setup**
   ```bash
   cd finassistant-ai
   npm install
   cp .env.example .env.local
   # Fill in your Supabase credentials
   ```

2. **Database Setup**
   - Ensure all migrations are applied
   - Verify RLS policies are enabled
   - Test with a fresh Supabase project or local instance

3. **Start Development Server**
   ```bash
   npm run dev
   ```

## Test Checklist

### Authentication & User Setup

- [ ] **User Registration**
  - Navigate to `/login`
  - Register a new account
  - Verify email confirmation (if enabled)
  - Login with credentials

- [ ] **Organization Setup**
  - After first login, verify organization setup prompt appears
  - Navigate to `/settings/organization`
  - Create organization with business name and country
  - Verify organization is saved and displayed in dashboard

### CSV Import & Transactions

- [ ] **Bank Account Creation**
  - Navigate to Dashboard
  - Create a manual bank account
  - Verify account appears in the list
  - Test with different currencies (GBP, USD, EUR)

- [ ] **CSV Import**
  - Use example CSV from `public/example-transactions.csv`
  - Upload CSV file
  - Select account and currency
  - Verify transactions are imported
  - Check transaction count matches CSV rows
  - Test with "Invert sign" option

- [ ] **CSV Format Variations**
  - Test with comma-separated values
  - Test with different date formats (YYYY-MM-DD, DD/MM/YYYY)
  - Test with European number format (comma as decimal)
  - Test with missing optional columns
  - Verify error handling for invalid formats

- [ ] **Transaction Display**
  - Verify transactions appear in dashboard
  - Test period filters (All, Year, Quarter)
  - Test search functionality
  - Verify transaction details (amount, date, description)

### Categorization

- [ ] **Manual Categorization**
  - Select a transaction
  - Assign a category
  - Verify category is saved
  - Test category editing

- [ ] **AI Categorization**
  - Click "AI Categorize" button
  - Verify loading state appears
  - Check transactions are categorized
  - Verify toast notification appears
  - Test with AI API key configured

- [ ] **Auto-Categorization (Rules)**
  - Click "Auto-categorize (Rules)" button
  - Verify rules-based categorization works
  - Check loading state
  - Verify results

### Planned Items

- [ ] **Planned Income**
  - Navigate to `/settings/planned-items`
  - Add a planned income item
  - Test with one-off and monthly recurrence
  - Verify item appears in list
  - Test inline editing (description, amount, date, recurrence)
  - Test deletion

- [ ] **Planned Expenses**
  - Add a planned expense item
  - Test all fields and recurrence options
  - Verify 6-month totals calculation
  - Test editing and deletion

- [ ] **Validation**
  - Test with empty description (should fail)
  - Test with negative amount (should fail)
  - Test with invalid date (should fail)
  - Verify error messages are clear

### Financial Framework

- [ ] **Framework Page Access**
  - Navigate to `/framework`
  - Verify all 5 steps load
  - Check loading states

- [ ] **STATE Step**
  - Verify current balance is displayed
  - Check last month and this month totals
  - Verify category breakdown appears
  - Test with no data (empty state)

- [ ] **DELTA Step**
  - Verify month-over-month comparison
  - Check top increases and decreases
  - Verify percentage changes
  - Test with insufficient data

- [ ] **TRAJECTORY Step**
  - Verify 6-month forecast is displayed
  - Check current balance and avg monthly change
  - Verify forecast months are correct
  - Check low points identification
  - Test with no transactions

- [ ] **EXPOSURE Step**
  - Verify cash runway calculation
  - Check risk flags appear correctly
  - Verify upcoming expenses list
  - Test downside scenario
  - Check with positive/negative trajectories

- [ ] **CHOICE Step**
  - Verify decision cards are generated
  - Check cash impact, risk, reversibility, timeframe
  - Verify decisions are contextually relevant
  - Test with different financial states

### AI Assistant

- [ ] **AI Assistant Integration**
  - Open framework page
  - Verify AI assistant sidebar appears
  - Test suggested questions
  - Submit a custom question
  - Verify AI response appears
  - Check loading states

- [ ] **Context-Aware Responses**
  - Test questions for each framework step
  - Verify AI uses current data
  - Check framework-specific responses
  - Test with no AI key (error handling)

### Executive Summary

- [ ] **Summary Generation**
  - Navigate to `/executive-summary`
  - Verify all framework data is included
  - Check organization details
  - Verify generated timestamp

- [ ] **Export Functionality**
  - Click "Print/Export PDF" button
  - Verify print dialog opens
  - Check print CSS formatting
  - Test PDF export (browser print to PDF)

### Error Handling

- [ ] **Network Errors**
  - Disconnect internet
  - Test API calls
  - Verify error messages appear
  - Check toast notifications

- [ ] **Authentication Errors**
  - Logout
  - Try to access protected routes
  - Verify redirect to login
  - Test session expiration

- [ ] **Validation Errors**
  - Submit invalid data
  - Verify client-side validation
  - Check server-side validation
  - Verify error messages

### Edge Cases

- [ ] **Empty States**
  - Test with no bank accounts
  - Test with no transactions
  - Test with no planned items
  - Verify helpful messages appear

- [ ] **Large Data Sets**
  - Import 1000+ transactions
  - Verify performance
  - Check pagination/loading
  - Test search functionality

- [ ] **Date Edge Cases**
  - Test with future dates
  - Test with very old dates
  - Test with leap year dates
  - Verify date calculations

- [ ] **Currency Handling**
  - Test with different currencies
  - Verify currency symbols
  - Test currency conversion (if applicable)

### Performance

- [ ] **Page Load Times**
  - Dashboard loads in < 2 seconds
  - Framework page loads in < 3 seconds
  - CSV import processes in reasonable time

- [ ] **API Response Times**
  - Framework endpoints respond quickly
  - AI responses within acceptable time
  - Database queries optimized

### Security

- [ ] **Data Isolation**
  - Create two test accounts
  - Verify users can't see each other's data
  - Test RLS policies
  - Verify user_id is always set

- [ ] **Input Validation**
  - Test SQL injection attempts
  - Test XSS attempts
  - Verify sanitization
  - Check file upload limits

## Automated Testing (Future)

Consider adding:
- Unit tests for utility functions
- Integration tests for API routes
- E2E tests with Playwright/Cypress
- Performance tests

## Test Data

Use `public/example-transactions.csv` for testing CSV import functionality.

## Reporting Issues

When reporting bugs, include:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser/OS information
5. Console errors (if any)

## Test Environment

- **Local**: `http://localhost:3000`
- **Staging**: [Add staging URL]
- **Production**: [Add production URL]
