/**
 * Indian Rupee (INR) currency formatting and decimal-safe arithmetic.
 * Ensures clean numbers formatted in Indian numbering system:
 * e.g., ₹1,299, ₹18,420, ₹1,25,000
 */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrDecimalFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a number as Indian Rupee (e.g. ₹18,420).
 * Omit decimals if zero, or show decimals if decimal flag is set.
 */
export function formatCurrency(amount: number | string, showDecimals: boolean = false): string {
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
  if (showDecimals || num % 1 !== 0) {
    return inrDecimalFormatter.format(num);
  }
  return inrFormatter.format(num);
}

export const formatINR = formatCurrency;

/**
 * Rounds a number to two decimal places safely.
 */
export function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Computes item profit = (selling_price - purchase_price) * quantity
 */
export function calculateItemProfit(sellingPrice: number, purchasePrice: number, quantity: number): number {
  return roundToTwo((sellingPrice - purchasePrice) * quantity);
}

/**
 * Computes receipt net profit = (Total - Total Cost)
 */
export function calculateNetProfit(total: number, totalCost: number): number {
  return roundToTwo(total - totalCost);
}

/**
 * Computes gross profit = Subtotal - Total Cost
 */
export function calculateGrossProfit(subtotal: number, totalCost: number): number {
  return roundToTwo(subtotal - totalCost);
}
