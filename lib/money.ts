/**
 * Westeel Money Utilities
 * Strict integer-paise representation for financial amounts in Indian Rupees (INR).
 * Rules (PROJECT_BRIEF.md Section 1.4 & 4):
 * - Never use floating-point arithmetic on rupee amounts.
 * - Store/compute in integer paise in TypeScript.
 * - Format using en-IN standards for display.
 */

/**
 * Converts a rupee value (string or number) to exact integer paise.
 * Uses exact decimal splitting to avoid IEEE-754 floating point precision issues
 * (e.g., 0.1 + 0.2 = 0.30000000000000004 or 19.99 * 100 = 1998.9999999999998).
 */
export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === "number") {
    if (!Number.isFinite(rupees)) {
      throw new Error(`Invalid rupee amount: ${rupees}`);
    }
    // Convert to fixed string to eliminate immediate float noise
    rupees = rupees.toFixed(2);
  }

  const trimmed = rupees.trim().replace(/,/g, "");
  if (!trimmed) {
    return 0;
  }

  const isNegative = trimmed.startsWith("-");
  const clean = isNegative ? trimmed.slice(1) : trimmed;

  const parts = clean.split(".");
  if (parts.length > 2) {
    throw new Error(`Invalid currency format: ${rupees}`);
  }

  const wholeStr = parts[0] || "0";
  let fractionStr = parts[1] || "";

  if (fractionStr.length > 2) {
    // Round third digit if present
    const roundDigit = parseInt(fractionStr[2], 10);
    let cents = parseInt(fractionStr.slice(0, 2), 10);
    if (roundDigit >= 5) {
      cents += 1;
    }
    fractionStr = cents.toString().padStart(2, "0");
  } else {
    fractionStr = fractionStr.padEnd(2, "0");
  }

  const whole = parseInt(wholeStr, 10);
  const fraction = parseInt(fractionStr, 10);

  if (Number.isNaN(whole) || Number.isNaN(fraction)) {
    throw new Error(`Invalid currency number: ${rupees}`);
  }

  const paise = whole * 100 + fraction;
  return isNegative ? -paise : paise;
}

/**
 * Converts integer paise back to standard rupee number for display or API boundaries.
 */
export function paiseToRupees(paise: number): number {
  assertIntegerPaise(paise);
  return paise / 100;
}

/**
 * Converts integer paise to an exact decimal string (e.g., 10050 -> "100.50").
 */
export function paiseToRupeeString(paise: number): string {
  assertIntegerPaise(paise);
  const isNegative = paise < 0;
  const abs = Math.abs(paise);
  const whole = Math.floor(abs / 100);
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `${isNegative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Formats integer paise into Indian Rupee currency format (en-IN).
 * Example: 10000000 paise -> "₹1,00,000.00"
 */
export function formatPaise(
  paise: number,
  options?: {
    showCurrencySymbol?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string {
  assertIntegerPaise(paise);
  const rupees = paiseToRupees(paise);
  const showSymbol = options?.showCurrencySymbol ?? true;
  const minDigits = options?.minimumFractionDigits ?? 2;
  const maxDigits = options?.maximumFractionDigits ?? 2;

  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  }).format(rupees);

  return showSymbol ? `₹${formatted}` : formatted;
}

/**
 * Pure integer addition of paise amounts.
 */
export function addPaise(...amounts: number[]): number {
  return amounts.reduce((acc, curr) => {
    assertIntegerPaise(curr);
    return acc + curr;
  }, 0);
}

/**
 * Pure integer subtraction of paise amounts.
 */
export function subtractPaise(a: number, b: number): number {
  assertIntegerPaise(a);
  assertIntegerPaise(b);
  return a - b;
}

/**
 * Multiplies an integer paise amount by a factor (e.g. quantity or percentage),
 * rounding to the nearest integer paise.
 */
export function multiplyPaise(paise: number, factor: number): number {
  assertIntegerPaise(paise);
  return Math.round(paise * factor);
}

function assertIntegerPaise(val: number): void {
  if (!Number.isInteger(val)) {
    throw new Error(
      `Floating-point amount detected (${val})! All calculations must use integer paise.`
    );
  }
}
