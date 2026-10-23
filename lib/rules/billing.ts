/**
 * Westeel Rules F1 to F5: Customer Billing, Invoicing, Receipts and Collections
 * Rule A11:
 * - Contract value, variation orders, and payment milestones are strictly ex-GST.
 * - Invoices, receipts, and bill payments are cash numbers including GST.
 * - TDS (Rule A12) is recorded as an input field on receipts and bill payments, never auto-computed.
 * - Floating-point arithmetic is forbidden: all currency math in TypeScript uses integer paise.
 */

import { differenceInDays, parseISO } from "date-fns";
import { rupeesToPaise, formatPaise } from "../money";

export interface VariationOrderInput {
  id: string;
  title?: string;
  amount_excl_gst: number | string;
  status: "proposed" | "approved" | "rejected";
}

export interface PaymentMilestoneInput {
  id: string;
  label: string;
  amount_excl_gst: number | string;
  expected_date: string; // YYYY-MM-DD
  position: number;
}

export interface InvoiceInput {
  id: string;
  invoice_number: string;
  amount_excl_gst: number | string;
  gst_amount: number | string;
  is_cancelled: boolean;
  due_date: string; // YYYY-MM-DD
  payment_milestone_id?: string | null;
  project_id?: string;
  created_at?: string;
}

export interface ReceiptInput {
  id: string;
  invoice_id?: string | null;
  amount_received: number | string;
  tds_amount?: number | string | null;
  receipt_date: string; // YYYY-MM-DD
  project_id?: string;
  mode?: string;
  reference?: string | null;
  note?: string | null;
}

export interface InvoiceCalculation {
  invoiceId: string;
  invoiceNumber: string;
  isCancelled: boolean;
  exGstPaise: number;
  gstPaise: number;
  totalPaise: number;
  settledPaise: number;
  outstandingPaise: number;
  isOverdue: boolean;
  daysOverdue: number;
  linkedReceiptsCount: number;
}

export interface AgingBucketsPaise {
  currentPaise: number; // not overdue (due_date >= today)
  bucket1_30Paise: number;
  bucket31_60Paise: number;
  bucket61_90Paise: number;
  bucketOver90Paise: number;
  totalOverduePaise: number;
  totalOutstandingPaise: number;
}

export interface MilestoneCompleteness {
  isMatch: boolean;
  revisedContractValuePaise: number;
  milestonesTotalPaise: number;
  differencePaise: number; // revised - milestones
  message?: string;
}

export interface MilestoneInvoicingStatus {
  milestoneId: string;
  label: string;
  expectedDate: string;
  amountExclGstPaise: number;
  hasActiveInvoice: boolean;
  activeInvoiceNumber?: string;
  isDueForInvoicingWithin7Days: boolean;
}

/**
 * F1: Revised contract value = contract_value_excl_gst + sum of variation_orders.amount_excl_gst where status is approved.
 * Note: variation amount may be negative.
 */
export function computeRevisedContractValuePaise(
  contractValueExclGst: number | string,
  variations: VariationOrderInput[]
): number {
  let totalPaise = rupeesToPaise(contractValueExclGst || 0);
  for (const v of variations) {
    if (v.status === "approved") {
      totalPaise += rupeesToPaise(v.amount_excl_gst);
    }
  }
  return totalPaise;
}

/**
 * F2: Invoice Total, Settled & Outstanding.
 * Invoice total = amount_excl_gst + gst_amount.
 * Invoice settled = sum over linked receipts of (amount_received + tds_amount).
 * Invoice outstanding = total - settled.
 * CANCELLED INVOICES ARE EXCLUDED FROM EVERYTHING (return zero values).
 */
export function computeInvoiceCalculation(
  invoice: InvoiceInput,
  receipts: ReceiptInput[],
  todayStr: string = getTodayISTString()
): InvoiceCalculation {
  if (invoice.is_cancelled) {
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      isCancelled: true,
      exGstPaise: 0,
      gstPaise: 0,
      totalPaise: 0,
      settledPaise: 0,
      outstandingPaise: 0,
      isOverdue: false,
      daysOverdue: 0,
      linkedReceiptsCount: 0,
    };
  }

  const exGstPaise = rupeesToPaise(invoice.amount_excl_gst || 0);
  const gstPaise = rupeesToPaise(invoice.gst_amount || 0);
  const totalPaise = exGstPaise + gstPaise;

  let settledPaise = 0;
  let linkedCount = 0;

  for (const r of receipts) {
    if (r.invoice_id === invoice.id) {
      const recPaise = rupeesToPaise(r.amount_received || 0);
      const tdsPaise = rupeesToPaise(r.tds_amount || 0);
      settledPaise += (recPaise + tdsPaise);
      linkedCount++;
    }
  }

  const outstandingPaise = Math.max(0, totalPaise - settledPaise);

  let isOverdue = false;
  let daysOverdue = 0;

  if (outstandingPaise > 0 && invoice.due_date) {
    const today = parseISO(todayStr.slice(0, 10));
    const due = parseISO(invoice.due_date.slice(0, 10));
    const diff = differenceInDays(today, due);
    if (diff > 0) {
      isOverdue = true;
      daysOverdue = diff;
    }
  }

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    isCancelled: false,
    exGstPaise,
    gstPaise,
    totalPaise,
    settledPaise,
    outstandingPaise,
    isOverdue,
    daysOverdue,
    linkedReceiptsCount: linkedCount,
  };
}

/**
 * F3: Advances
 * Receipts with invoice_id null are "advance received, not yet allocated".
 */
export function getUnallocatedAdvances(receipts: ReceiptInput[]): {
  advances: ReceiptInput[];
  totalPaise: number;
} {
  const advances = receipts.filter(r => !r.invoice_id);
  const totalPaise = advances.reduce(
    (sum, r) => sum + rupeesToPaise(r.amount_received || 0),
    0
  );
  return { advances, totalPaise };
}

/**
 * F4: Overdue receivables and aging buckets.
 * Buckets:
 * - Current (not overdue: due_date >= today)
 * - 1 to 30 days overdue
 * - 31 to 60 days overdue
 * - 61 to 90 days overdue
 * - Over 90 days overdue
 */
export function computeReceivablesAging(
  invoices: InvoiceInput[],
  receipts: ReceiptInput[],
  todayStr: string = getTodayISTString()
): AgingBucketsPaise {
  let currentPaise = 0;
  let bucket1_30Paise = 0;
  let bucket31_60Paise = 0;
  let bucket61_90Paise = 0;
  let bucketOver90Paise = 0;

  for (const inv of invoices) {
    if (inv.is_cancelled) continue;

    const calc = computeInvoiceCalculation(inv, receipts, todayStr);
    if (calc.outstandingPaise <= 0) continue;

    if (!calc.isOverdue) {
      currentPaise += calc.outstandingPaise;
    } else {
      if (calc.daysOverdue >= 1 && calc.daysOverdue <= 30) {
        bucket1_30Paise += calc.outstandingPaise;
      } else if (calc.daysOverdue >= 31 && calc.daysOverdue <= 60) {
        bucket31_60Paise += calc.outstandingPaise;
      } else if (calc.daysOverdue >= 61 && calc.daysOverdue <= 90) {
        bucket61_90Paise += calc.outstandingPaise;
      } else {
        bucketOver90Paise += calc.outstandingPaise;
      }
    }
  }

  const totalOverduePaise = bucket1_30Paise + bucket31_60Paise + bucket61_90Paise + bucketOver90Paise;
  const totalOutstandingPaise = currentPaise + totalOverduePaise;

  return {
    currentPaise,
    bucket1_30Paise,
    bucket31_60Paise,
    bucket61_90Paise,
    bucketOver90Paise,
    totalOverduePaise,
    totalOutstandingPaise,
  };
}

/**
 * F5: Billing schedule completeness.
 * Sum of payment_milestones.amount_excl_gst should equal revised contract value.
 * If not, show "Billing schedule does not match contract value (difference ₹X)".
 */
export function checkBillingScheduleCompleteness(
  revisedContractValuePaise: number,
  milestones: PaymentMilestoneInput[]
): MilestoneCompleteness {
  let milestonesTotalPaise = 0;
  for (const m of milestones) {
    milestonesTotalPaise += rupeesToPaise(m.amount_excl_gst || 0);
  }

  const differencePaise = revisedContractValuePaise - milestonesTotalPaise;
  const isMatch = differencePaise === 0;

  let message: string | undefined;
  if (!isMatch) {
    const absDiff = Math.abs(differencePaise);
    message = `Billing schedule does not match contract value (difference ${formatPaise(absDiff)})`;
  }

  return {
    isMatch,
    revisedContractValuePaise,
    milestonesTotalPaise,
    differencePaise,
    message,
  };
}

/**
 * F5: Milestones with expected_date within the next 7 days and no linked invoice
 * raise an "Invoice to raise" alert.
 */
export function checkMilestonesForInvoicing(
  milestones: PaymentMilestoneInput[],
  invoices: InvoiceInput[],
  todayStr: string = getTodayISTString()
): MilestoneInvoicingStatus[] {
  const today = parseISO(todayStr.slice(0, 10));

  // Active (non-cancelled) invoices indexed by milestone id
  const activeInvoicesByMilestoneId = new Map<string, InvoiceInput>();
  for (const inv of invoices) {
    if (!inv.is_cancelled && inv.payment_milestone_id) {
      activeInvoicesByMilestoneId.set(inv.payment_milestone_id, inv);
    }
  }

  return milestones.map(m => {
    const expected = parseISO(m.expected_date.slice(0, 10));
    const activeInv = activeInvoicesByMilestoneId.get(m.id);
    const hasActiveInvoice = !!activeInv;

    // Due within 7 days: expected_date <= in7Days (including overdue milestones not yet invoiced)
    const diff = differenceInDays(expected, today);
    const isDueWithin7Days = diff <= 7;

    return {
      milestoneId: m.id,
      label: m.label,
      expectedDate: m.expected_date,
      amountExclGstPaise: rupeesToPaise(m.amount_excl_gst || 0),
      hasActiveInvoice,
      activeInvoiceNumber: activeInv?.invoice_number,
      isDueForInvoicingWithin7Days: isDueWithin7Days && !hasActiveInvoice,
    };
  });
}

/**
 * Returns today's date formatted as YYYY-MM-DD in Asia/Kolkata (IST).
 */
export function getTodayISTString(): string {
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return istFormatter.format(now);
}
