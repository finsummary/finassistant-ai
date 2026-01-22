/**
 * Currency utilities for formatting and symbol mapping
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  NZD: 'NZ$',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  HUF: 'Ft',
  CZK: 'Kč',
  RUB: '₽',
  TRY: '₺',
  BRL: 'R$',
  MXN: '$',
  ZAR: 'R',
  SGD: 'S$',
  HKD: 'HK$',
  KRW: '₩',
}

/**
 * Get currency symbol from currency code
 */
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || currencyCode.toUpperCase()
}

/**
 * Format number with currency symbol
 */
export function formatCurrency(value: number, currencyCode: string = 'GBP', showCents: boolean = true): string {
  const symbol = getCurrencySymbol(currencyCode)
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(value || 0)
  
  // Place symbol before number for most currencies
  if (['GBP', 'USD', 'EUR', 'JPY', 'CNY', 'INR', 'AUD', 'CAD', 'NZD', 'SGD', 'HKD', 'MXN', 'BRL', 'ZAR'].includes(currencyCode.toUpperCase())) {
    return `${symbol}${formatted}`
  }
  
  // Some currencies have symbol after
  return `${formatted} ${symbol}`
}
