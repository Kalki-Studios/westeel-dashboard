/**
 * CSV Export Helpers for Cash Flow Projection and Bank Balances
 * Prevents formula injection by sanitizing leading special characters (=, +, -, @).
 */

import { CashProjectionResult } from "../rules/cashflow";
import { BankBalance } from "./types";
export { downloadCsvInBrowser } from "../billing/csv";

function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);

  // Prevent formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape quotes
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

function paiseToRupeesString(paise: number): string {
  return (paise / 100).toFixed(2);
}

/**
 * Generates CSV string for the 5-bucket cash flow projection.
 */
export function exportProjectionCsv(projection: CashProjectionResult): string {
  const buckets = projection.bucket_list;

  const lines: string[] = [];

  lines.push(escapeCsvCell(`Westeel Cash Flow Projection (As of ${projection.as_of_date})`));
  lines.push(escapeCsvCell(projection.mandatory_label));
  lines.push("");

  // Starting Cash on Hand
  lines.push(
    [
      escapeCsvCell("Starting Cash on Hand"),
      escapeCsvCell(paiseToRupeesString(projection.cash_on_hand_paise)),
      escapeCsvCell(""),
      escapeCsvCell(""),
      escapeCsvCell(""),
      escapeCsvCell(""),
    ].join(",")
  );
  lines.push("");

  // Headers
  const headers = [
    "Metric",
    ...buckets.map((b) => `${b.label} (${b.range_description})`),
  ];
  lines.push(headers.map(escapeCsvCell).join(","));

  // Inflows Section
  lines.push(
    [
      escapeCsvCell("Customer Invoices"),
      ...buckets.map((b) => escapeCsvCell(paiseToRupeesString(b.invoices_paise))),
    ].join(",")
  );

  lines.push(
    [
      escapeCsvCell("Payment Milestones (Un-invoiced)"),
      ...buckets.map((b) => escapeCsvCell(paiseToRupeesString(b.milestones_paise))),
    ].join(",")
  );

  lines.push(
    [
      escapeCsvCell("Company Cash Inflows"),
      ...buckets.map((b) => escapeCsvCell(paiseToRupeesString(b.company_inflows_paise))),
    ].join(",")
  );

  lines.push(
    [
      escapeCsvCell("TOTAL INFLOWS"),
      ...buckets.map((b) => escapeCsvCell(paiseToRupeesString(b.total_inflows_paise))),
    ].join(",")
  );

  // Outflows Section
  lines.push(
    [
      escapeCsvCell("Vendor Bills"),
      ...buckets.map((b) => escapeCsvCell(paiseToRupeesString(b.bills_paise))),
    ].join(",")
  );

  lines.push(
    [
      escapeCsvCell("Company Cash Outflows"),
      ...buckets.map((b) => escapeCsvCell(paiseToRupeesString(b.company_outflows_paise))),
    ].join(",")
  );

  lines.push(
    [
      escapeCsvCell("TOTAL OUTFLOWS"),
      ...buckets.map((b) => escapeCsvCell(paiseToRupeesString(b.total_outflows_paise))),
    ].join(",")
  );

  // Net Cash
  lines.push(
    [
      escapeCsvCell("NET CASH (Inflows - Outflows)"),
      ...buckets.map((b) => escapeCsvCell(paiseToRupeesString(b.net_cash_paise))),
    ].join(",")
  );

  // Running Balance
  lines.push(
    [
      escapeCsvCell("RUNNING BALANCE"),
      ...buckets.map((b) => escapeCsvCell(paiseToRupeesString(b.running_balance_paise))),
    ].join(",")
  );

  lines.push("");

  // Informational Lines
  lines.push(
    [
      escapeCsvCell("Committed Not Billed (Excluded from Net)"),
      ...buckets.map((b) => escapeCsvCell(paiseToRupeesString(b.committed_not_billed_paise))),
    ].join(",")
  );

  lines.push("");

  // Excluded Overdue Receivables
  lines.push(
    [
      escapeCsvCell(projection.overdue_receivables_label),
      escapeCsvCell(paiseToRupeesString(projection.overdue_receivables_paise)),
      escapeCsvCell("Excluded from projection - not assumed received"),
    ].join(",")
  );

  return lines.join("\n");
}

/**
 * Generates CSV string for bank balances history.
 */
export function exportBankBalancesCsv(balances: BankBalance[]): string {
  const lines: string[] = [];

  const headers = [
    "Account Label",
    "Balance (INR)",
    "As-of Date",
    "Note",
    "Recorded By",
    "Recorded At",
  ];
  lines.push(headers.map(escapeCsvCell).join(","));

  for (const b of balances) {
    lines.push(
      [
        escapeCsvCell(b.account_label),
        escapeCsvCell(Number(b.balance).toFixed(2)),
        escapeCsvCell(b.as_of_date),
        escapeCsvCell(b.note || ""),
        escapeCsvCell(b.recorded_by_name || ""),
        escapeCsvCell(b.created_at),
      ].join(",")
    );
  }

  return lines.join("\n");
}
