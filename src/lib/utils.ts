import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Default currency mappings for common currencies
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
  RUB: '₽',
  CNY: '¥',
  KRW: '₩',
  THB: '฿',
  INR: '₹',
  SGD: 'S$',
  MYR: 'RM',
  PHP: '₱',
  IDR: 'Rp',
  BRL: 'R$',
  MXN: '$',
  ARS: '$',
  CLP: '$',
  COP: '$',
  PEN: 'S/',
  UYU: '$',
  EGP: 'EGP',
}

// Format price with proper currency symbol and locale formatting
export function formatCurrency(price: string | number, currency?: string, overrideCurrency?: string): string {
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price
  
  if (isNaN(numericPrice)) {
    return 'N/A'
  }

  // Use override currency if provided, otherwise use provided currency or USD as fallback
  const currencyCode = overrideCurrency || currency || 'USD'
  
  // Get currency symbol
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode

  // For JPY, KRW, and EGP, don't show decimal places
  const decimals = ['JPY', 'KRW', 'EGP'].includes(currencyCode) ? 0 : 2
  
  const formattedPrice = numericPrice.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  // Return formatted price with symbol
  return `${symbol}${formattedPrice}`
}
