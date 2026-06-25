// BOGX Currency utility functions
// ═══════════════════════════════════════════════════════════════
// BOGX is our own currency: 0.01, 0.02, ... 1.00, 1.01, etc.
// ═══════════════════════════════════════════════════════════════

// Currency symbol - always BOGX
export function getCurrencySymbol(): string {
  return ''; // We show "BOGX" separately or use the logo
}

// Legacy exports for backwards compatibility
export const USE_EURO_MODE = false;
export const CURRENCY_SYMBOL = 'BOGX';

/**
 * Format BOGX value to display string
 * Always shows 2 decimal places: 1.50, 0.05, 25.00
 * Never shows negative values (shows 0.00 instead)
 * Auto-converts legacy points (>10) to BOGX for backwards compatibility
 */
export function formatCurrency(value: number): string {
  const displayValue = value < 0 ? 0 : value;
  return displayValue.toLocaleString('de-DE', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

/**
 * Format value with BOGX symbol
 * 1.50 -> "1,50 BOGX"
 */
export function formatCurrencyWithSymbol(value: number): string {
  return `${formatCurrency(value)} BOGX`;
}

/**
 * Format value with +/- sign
 * 1.50 -> "+1,50", -0.50 -> "-0,50"
 */
export function formatCurrencyChange(value: number): string {
  const formatted = formatCurrency(Math.abs(value));
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

/**
 * Format value with +/- sign and BOGX
 * 1.50 -> "+1,50 BOGX", -0.50 -> "-0,50 BOGX"
 */
export function formatCurrencyChangeWithSymbol(value: number): string {
  return `${formatCurrencyChange(value)} BOGX`;
}

/**
 * Convert legacy points to BOGX
 * 100 points = 1.00 BOGX
 */
export function pointsToBOGX(points: number): number {
  return points / 100;
}

/**
 * Convert BOGX to legacy points
 * 1.00 BOGX = 100 points
 */
export function bogxToPoints(bogx: number): number {
  return Math.round(bogx * 100);
}

// Legacy aliases for backwards compatibility
export const formatEuro = formatCurrency;
export const formatEuroWithSymbol = formatCurrencyWithSymbol;
export const formatEuroChange = formatCurrencyChange;

// Utility to check if value is in old points format
// DEPRECATED: Database has been migrated, no auto-conversion needed
export function isLegacyPoints(value: number): boolean {
  return false; // All data is now in BOGX format
}

// Auto-convert: DISABLED after migration
// All values are now stored correctly as BOGX
export function autoConvertToBOGX(value: number): number {
  return value; // No conversion needed - data is already BOGX
}
