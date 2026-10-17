import { describe, it, expect } from "vitest";
import {
  rupeesToPaise,
  paiseToRupees,
  paiseToRupeeString,
  formatPaise,
  addPaise,
  subtractPaise,
  multiplyPaise,
} from "./money";

describe("lib/money.ts - Indian Rupee & Integer Paise Arithmetic", () => {
  it("proves 0.1 + 0.2 style floating-point errors cannot occur in money helpers", () => {
    // In IEEE 754 float math: 0.1 + 0.2 = 0.30000000000000004
    const floatSum = 0.1 + 0.2;
    expect(floatSum).not.toBe(0.3); // Proves float problem exists in native JS

    // With our integer paise helpers:
    const paise1 = rupeesToPaise(0.1); // 10 paise
    const paise2 = rupeesToPaise(0.2); // 20 paise
    const totalPaise = addPaise(paise1, paise2); // 30 paise

    expect(totalPaise).toBe(30);
    expect(paiseToRupees(totalPaise)).toBe(0.3);
    expect(paiseToRupeeString(totalPaise)).toBe("0.30");
    expect(formatPaise(totalPaise)).toBe("₹0.30");
  });

  it("proves 19.99 precision edge case works without truncation loss", () => {
    // In native JS: 19.99 * 100 = 1998.9999999999998
    expect(19.99 * 100).not.toBe(1999);

    // With rupeesToPaise:
    const paise = rupeesToPaise(19.99);
    expect(paise).toBe(1999);
    expect(paiseToRupees(paise)).toBe(19.99);
    expect(paiseToRupeeString(paise)).toBe("19.99");
  });

  it("handles string and formatted rupee inputs correctly", () => {
    expect(rupeesToPaise("1,50,000.50")).toBe(15000050);
    expect(rupeesToPaise("0.05")).toBe(5);
    expect(rupeesToPaise("100")).toBe(10000);
    expect(rupeesToPaise("-250.75")).toBe(-25075);
    expect(rupeesToPaise("")).toBe(0);
  });

  it("formats paise into en-IN currency style", () => {
    // 1 Lakh = 1,00,000 INR = 10,000,000 paise
    expect(formatPaise(10000000)).toBe("₹1,00,000.00");
    // 1 Crore = 1,00,00,000 INR = 1,000,000,000 paise
    expect(formatPaise(1000000000)).toBe("₹1,00,00,000.00");
    // Small amount
    expect(formatPaise(50)).toBe("₹0.50");
  });

  it("enforces integer paise assertions on arithmetic operations", () => {
    expect(() => addPaise(100, 20.5)).toThrow(/Floating-point amount detected/);
    expect(() => subtractPaise(100.2, 50)).toThrow(/Floating-point amount detected/);
    expect(() => paiseToRupees(100.5)).toThrow(/Floating-point amount detected/);

    expect(subtractPaise(10000, 2500)).toBe(7500);
    expect(multiplyPaise(10000, 1.18)).toBe(11800); // GST 18% calculation
  });
});
