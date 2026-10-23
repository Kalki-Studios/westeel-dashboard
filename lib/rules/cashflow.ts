/**
 * Westeel Rules F11 and F12: Cash on Hand and Cash Flow Projection
 * 
 * Rule F11 Cash on hand:
 * - Sum over each distinct `account_label` of the balance from its latest `as_of_date` entry.
 * - Show the oldest of those dates as the as-of date for the total.
 * - If any account's latest entry is older than 7 days, show "Stale: update balances".
 * 
 * Rule F12 Cash projection (from today, IST):
 * - 5 Buckets:
 *   1. "Due now" (all overdue payables)
 *   2. "0 to 7 days"
 *   3. "8 to 30 days"
 *   4. "31 to 60 days"
 *   5. "61 to 90 days"
 * - Inflows:
 *   - Outstanding invoices by `due_date` (future-dated only, due_date >= today)
 *   - PLUS payment milestones not yet invoiced by `expected_date`
 *   - PLUS planned company cash inflows
 * - Outflows:
 *   - Outstanding bills by `due_date` (overdue ones land in "Due now")
 *   - PLUS planned company cash outflows
 * - Overdue receivables are NOT assumed to arrive. Shown as a separate line "Overdue receivables (not assumed received)".
 * - Committed but not yet billed is shown as an informational line, EXCLUDED from net total.
 * - Running balance per bucket = cash on hand + cumulative inflows - cumulative outflows.
 * - If it goes below zero in any bucket within 30 days (Due now, 0-7d, 8-30d), raise "Projected cash shortfall" alert.
 * - Mandatory label: "Projection from recorded data. Excludes anything not entered."
 */

import { differenceInDays, parseISO, startOfDay } from "date-fns";
import { rupeesToPaise } from "../money";

export function getTodayISTString(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().split("T")[0];
}

// -----------------------------------------------------------------------------
// Input Types
// -----------------------------------------------------------------------------

export interface BankBalanceEntry {
  id?: string;
  account_label: string;
  balance: number | string;
  as_of_date: string; // YYYY-MM-DD
  note?: string | null;
  created_at?: string;
}

export interface CashInvoiceItem {
  id: string;
  invoice_number?: string;
  amount_incl_gst: number | string;
  total_received_incl_tds: number | string;
  due_date: string; // YYYY-MM-DD
  is_cancelled?: boolean;
  project_code?: string;
  customer_name?: string;
}

export interface CashMilestoneItem {
  id: string;
  label: string;
  amount_excl_gst: number | string;
  // If milestone is already attached to an active invoice, it must NOT be counted again
  is_invoiced?: boolean;
  status: "pending" | "done";
  expected_date: string; // YYYY-MM-DD
  project_code?: string;
}

export interface CashBillItem {
  id: string;
  bill_number?: string;
  vendor_name?: string;
  amount_incl_gst: number | string;
  total_paid_incl_tds: number | string;
  due_date: string; // YYYY-MM-DD
  is_cancelled?: boolean;
  project_code?: string;
}

export interface CompanyCashItemInput {
  id: string;
  direction: "inflow" | "outflow";
  category: string;
  description: string;
  amount: number | string;
  expected_date: string; // YYYY-MM-DD
  status: "planned" | "done" | "cancelled";
}

export interface CommittedOrderInput {
  id: string;
  order_number?: string;
  vendor_name?: string;
  amount_excl_gst: number | string;
  billed_amount_excl_gst: number | string;
  expected_delivery_date?: string | null; // YYYY-MM-DD
  fulfilment_status: string;
  project_code?: string;
}

// -----------------------------------------------------------------------------
// Output Types
// -----------------------------------------------------------------------------

export interface AccountBalanceSummary {
  account_label: string;
  balance_paise: number;
  as_of_date: string;
  is_stale: boolean;
  age_days: number;
}

export interface CashOnHandResult {
  total_cash_on_hand_paise: number;
  as_of_date: string | null;
  is_stale: boolean;
  stale_warning: string | null;
  accounts: AccountBalanceSummary[];
}

export type ProjectionBucketKey =
  | "due_now"
  | "days_0_to_7"
  | "days_8_to_30"
  | "days_31_to_60"
  | "days_61_to_90";

export interface BucketCashBreakdown {
  invoices_paise: number;
  milestones_paise: number;
  company_inflows_paise: number;
  total_inflows_paise: number;

  bills_paise: number;
  company_outflows_paise: number;
  total_outflows_paise: number;

  net_cash_paise: number; // inflows - outflows
  running_balance_paise: number; // cash on hand + cumulative net
  committed_not_billed_paise: number; // informational line only
}

export interface ProjectionBucketSummary extends BucketCashBreakdown {
  key: ProjectionBucketKey;
  label: string;
  range_description: string;
  is_within_30_days: boolean;
  is_shortfall: boolean;
}

export interface CashProjectionResult {
  as_of_date: string;
  cash_on_hand_paise: number;
  buckets: Record<ProjectionBucketKey, ProjectionBucketSummary>;
  bucket_list: ProjectionBucketSummary[];
  overdue_receivables_paise: number;
  total_committed_not_billed_paise: number;
  has_projected_shortfall: boolean;
  shortfall_bucket?: ProjectionBucketKey;
  shortfall_amount_paise?: number;
  shortfall_message?: string;
  mandatory_label: string;
  overdue_receivables_label: string;
  committed_not_billed_label: string;
}

// -----------------------------------------------------------------------------
// Rule F11: Compute Cash On Hand
// -----------------------------------------------------------------------------

export function computeCashOnHand(
  entries: BankBalanceEntry[],
  currentDateInput: Date | string = new Date()
): CashOnHandResult {
  const currentDate =
    typeof currentDateInput === "string"
      ? parseISO(currentDateInput)
      : currentDateInput;
  const today = startOfDay(currentDate);

  if (!entries || entries.length === 0) {
    return {
      total_cash_on_hand_paise: 0,
      as_of_date: null,
      is_stale: false,
      stale_warning: null,
      accounts: [],
    };
  }

  // Group by account_label and pick latest as_of_date entry
  const latestByAccount = new Map<string, BankBalanceEntry>();

  for (const entry of entries) {
    const existing = latestByAccount.get(entry.account_label);
    if (!existing) {
      latestByAccount.set(entry.account_label, entry);
      continue;
    }

    const existingDate = parseISO(existing.as_of_date);
    const candidateDate = parseISO(entry.as_of_date);

    if (candidateDate > existingDate) {
      latestByAccount.set(entry.account_label, entry);
    } else if (
      candidateDate.getTime() === existingDate.getTime() &&
      entry.created_at &&
      existing.created_at
    ) {
      if (new Date(entry.created_at) > new Date(existing.created_at)) {
        latestByAccount.set(entry.account_label, entry);
      }
    }
  }

  let totalCashPaise = 0;
  let oldestDate: Date | null = null;
  let oldestDateStr: string | null = null;
  let isAnyAccountStale = false;

  const accounts: AccountBalanceSummary[] = [];

  for (const [account_label, entry] of latestByAccount.entries()) {
    const balancePaise = rupeesToPaise(entry.balance);
    totalCashPaise += balancePaise;

    const entryDate = startOfDay(parseISO(entry.as_of_date));
    const ageDays = differenceInDays(today, entryDate);
    const isStale = ageDays > 7;

    if (isStale) {
      isAnyAccountStale = true;
    }

    if (!oldestDate || entryDate < oldestDate) {
      oldestDate = entryDate;
      oldestDateStr = entry.as_of_date;
    }

    accounts.push({
      account_label,
      balance_paise: balancePaise,
      as_of_date: entry.as_of_date,
      is_stale: isStale,
      age_days: Math.max(0, ageDays),
    });
  }

  // Sort accounts alphabetically
  accounts.sort((a, b) => a.account_label.localeCompare(b.account_label));

  return {
    total_cash_on_hand_paise: totalCashPaise,
    as_of_date: oldestDateStr,
    is_stale: isAnyAccountStale,
    stale_warning: isAnyAccountStale ? "Stale: update balances" : null,
    accounts,
  };
}

// -----------------------------------------------------------------------------
// Helper: Map Date to Bucket Key
// -----------------------------------------------------------------------------

export function getBucketForDate(
  dateStr: string,
  today: Date,
  isOutflow: boolean = false
): ProjectionBucketKey | "overdue" | "future_beyond_90" {
  const itemDate = startOfDay(parseISO(dateStr));
  const diffDays = differenceInDays(itemDate, today);

  if (diffDays < 0) {
    // If it's an outflow (like an unpaid bill or overdue company cash item), it goes to Due now
    if (isOutflow) {
      return "due_now";
    }
    return "overdue";
  }

  if (diffDays >= 0 && diffDays <= 7) {
    return "days_0_to_7";
  }
  if (diffDays >= 8 && diffDays <= 30) {
    return "days_8_to_30";
  }
  if (diffDays >= 31 && diffDays <= 60) {
    return "days_31_to_60";
  }
  if (diffDays >= 61 && diffDays <= 90) {
    return "days_61_to_90";
  }

  return "future_beyond_90";
}

// -----------------------------------------------------------------------------
// Rule F12: Compute Cash Projection
// -----------------------------------------------------------------------------

export interface CashProjectionInput {
  bank_balances: BankBalanceEntry[];
  invoices: CashInvoiceItem[];
  payment_milestones: CashMilestoneItem[];
  bills: CashBillItem[];
  company_cash_items: CompanyCashItemInput[];
  committed_orders?: CommittedOrderInput[];
  currentDate?: Date | string;
}

export function computeCashProjection(
  input: CashProjectionInput
): CashProjectionResult {
  const currentDate =
    typeof input.currentDate === "string"
      ? parseISO(input.currentDate)
      : input.currentDate || new Date();
  const today = startOfDay(currentDate);

  // 1. Calculate Cash on Hand (Rule F11)
  const cashOnHandResult = computeCashOnHand(input.bank_balances, today);
  const startingCashPaise = cashOnHandResult.total_cash_on_hand_paise;

  // 2. Initialize Buckets
  const bucketKeys: ProjectionBucketKey[] = [
    "due_now",
    "days_0_to_7",
    "days_8_to_30",
    "days_31_to_60",
    "days_61_to_90",
  ];

  const bucketMetadata: Record<
    ProjectionBucketKey,
    { label: string; range_description: string; is_within_30_days: boolean }
  > = {
    due_now: {
      label: "Due now",
      range_description: "Overdue payables",
      is_within_30_days: true,
    },
    days_0_to_7: {
      label: "0 to 7 days",
      range_description: "Next 7 days",
      is_within_30_days: true,
    },
    days_8_to_30: {
      label: "8 to 30 days",
      range_description: "Days 8 through 30",
      is_within_30_days: true,
    },
    days_31_to_60: {
      label: "31 to 60 days",
      range_description: "Days 31 through 60",
      is_within_30_days: false,
    },
    days_61_to_90: {
      label: "61 to 90 days",
      range_description: "Days 61 through 90",
      is_within_30_days: false,
    },
  };

  const buckets: Record<ProjectionBucketKey, BucketCashBreakdown> = {
    due_now: {
      invoices_paise: 0,
      milestones_paise: 0,
      company_inflows_paise: 0,
      total_inflows_paise: 0,
      bills_paise: 0,
      company_outflows_paise: 0,
      total_outflows_paise: 0,
      net_cash_paise: 0,
      running_balance_paise: 0,
      committed_not_billed_paise: 0,
    },
    days_0_to_7: {
      invoices_paise: 0,
      milestones_paise: 0,
      company_inflows_paise: 0,
      total_inflows_paise: 0,
      bills_paise: 0,
      company_outflows_paise: 0,
      total_outflows_paise: 0,
      net_cash_paise: 0,
      running_balance_paise: 0,
      committed_not_billed_paise: 0,
    },
    days_8_to_30: {
      invoices_paise: 0,
      milestones_paise: 0,
      company_inflows_paise: 0,
      total_inflows_paise: 0,
      bills_paise: 0,
      company_outflows_paise: 0,
      total_outflows_paise: 0,
      net_cash_paise: 0,
      running_balance_paise: 0,
      committed_not_billed_paise: 0,
    },
    days_31_to_60: {
      invoices_paise: 0,
      milestones_paise: 0,
      company_inflows_paise: 0,
      total_inflows_paise: 0,
      bills_paise: 0,
      company_outflows_paise: 0,
      total_outflows_paise: 0,
      net_cash_paise: 0,
      running_balance_paise: 0,
      committed_not_billed_paise: 0,
    },
    days_61_to_90: {
      invoices_paise: 0,
      milestones_paise: 0,
      company_inflows_paise: 0,
      total_inflows_paise: 0,
      bills_paise: 0,
      company_outflows_paise: 0,
      total_outflows_paise: 0,
      net_cash_paise: 0,
      running_balance_paise: 0,
      committed_not_billed_paise: 0,
    },
  };

  let overdueReceivablesPaise = 0;

  // 3. Process Customer Invoices
  // Outstanding invoices = amount_incl_gst - total_received_incl_tds
  // Rule F12: Overdue receivables are NOT assumed to arrive. Shown as separate line.
  // Future-dated only land in projection buckets.
  for (const inv of input.invoices || []) {
    if (inv.is_cancelled) continue;

    const totalPaise = rupeesToPaise(inv.amount_incl_gst);
    const receivedPaise = rupeesToPaise(inv.total_received_incl_tds);
    const outstandingPaise = Math.max(0, totalPaise - receivedPaise);

    if (outstandingPaise <= 0) continue;

    const bucketKey = getBucketForDate(inv.due_date, today, false);
    if (bucketKey === "overdue") {
      overdueReceivablesPaise += outstandingPaise;
    } else if (bucketKey !== "future_beyond_90") {
      buckets[bucketKey].invoices_paise += outstandingPaise;
    }
  }

  // 4. Process Payment Milestones (not yet invoiced)
  // Rule F12: Milestone not yet invoiced counted once (not also when invoiced).
  // Status must be pending, and is_invoiced !== true.
  for (const ms of input.payment_milestones || []) {
    if (ms.status !== "pending") continue;
    if (ms.is_invoiced) continue;

    const msPaise = rupeesToPaise(ms.amount_excl_gst); // milestones are ex-GST per A11
    if (msPaise <= 0) continue;

    const bucketKey = getBucketForDate(ms.expected_date, today, false);
    if (bucketKey === "overdue") {
      // Overdue un-invoiced milestones are also treated as overdue receivables / not assumed
      overdueReceivablesPaise += msPaise;
    } else if (bucketKey !== "future_beyond_90") {
      buckets[bucketKey].milestones_paise += msPaise;
    }
  }

  // 5. Process Company Cash Items (Inflows and Outflows)
  // Only status = 'planned' are projected
  for (const item of input.company_cash_items || []) {
    if (item.status !== "planned") continue;

    const itemPaise = rupeesToPaise(item.amount);
    if (itemPaise <= 0) continue;

    const isOutflow = item.direction === "outflow";
    const bucketKey = getBucketForDate(item.expected_date, today, isOutflow);

    if (bucketKey === "overdue") {
      // Inflow expected in the past is overdue -> not assumed
      overdueReceivablesPaise += itemPaise;
    } else if (bucketKey !== "future_beyond_90") {
      if (item.direction === "inflow") {
        buckets[bucketKey].company_inflows_paise += itemPaise;
      } else {
        buckets[bucketKey].company_outflows_paise += itemPaise;
      }
    }
  }

  // 6. Process Vendor Bills
  // Outstanding bills = amount_incl_gst - total_paid_incl_tds
  // Overdue bills land in "Due now"
  for (const bill of input.bills || []) {
    if (bill.is_cancelled) continue;

    const totalPaise = rupeesToPaise(bill.amount_incl_gst);
    const paidPaise = rupeesToPaise(bill.total_paid_incl_tds);
    const outstandingPaise = Math.max(0, totalPaise - paidPaise);

    if (outstandingPaise <= 0) continue;

    const bucketKey = getBucketForDate(bill.due_date, today, true);
    if (bucketKey !== "future_beyond_90" && bucketKey !== "overdue") {
      buckets[bucketKey].bills_paise += outstandingPaise;
    }
  }

  // 7. Process Committed But Not Yet Billed Orders (Informational Line Only)
  // Excluded from net total!
  let totalCommittedNotBilledPaise = 0;
  for (const order of input.committed_orders || []) {
    if (order.fulfilment_status === "cancelled") continue;

    const orderPaise = rupeesToPaise(order.amount_excl_gst);
    const billedPaise = rupeesToPaise(order.billed_amount_excl_gst);
    const remainingPaise = Math.max(0, orderPaise - billedPaise);

    if (remainingPaise <= 0) continue;

    totalCommittedNotBilledPaise += remainingPaise;

    if (order.expected_delivery_date) {
      const bucketKey = getBucketForDate(
        order.expected_delivery_date,
        today,
        true
      );
      if (bucketKey !== "future_beyond_90" && bucketKey !== "overdue") {
        buckets[bucketKey].committed_not_billed_paise += remainingPaise;
      }
    } else {
      // Default un-dated committed order to "0 to 7 days" or "Due now" informational
      buckets.due_now.committed_not_billed_paise += remainingPaise;
    }
  }

  // 8. Calculate Totals, Net Cash, and Running Balance
  let runningBalance = startingCashPaise;
  let hasShortfall = false;
  let shortfallBucket: ProjectionBucketKey | undefined;
  let shortfallAmountPaise: number | undefined;
  let shortfallMessage: string | undefined;

  const bucketList: ProjectionBucketSummary[] = [];

  for (const key of bucketKeys) {
    const b = buckets[key];
    b.total_inflows_paise =
      b.invoices_paise + b.milestones_paise + b.company_inflows_paise;
    b.total_outflows_paise = b.bills_paise + b.company_outflows_paise;
    b.net_cash_paise = b.total_inflows_paise - b.total_outflows_paise;

    runningBalance += b.net_cash_paise;
    b.running_balance_paise = runningBalance;

    const meta = bucketMetadata[key];
    const isShortfall = runningBalance < 0;

    // Rule F12: If it goes below zero in any bucket within 30 days (Due now, 0-7d, 8-30d),
    // raise a "Projected cash shortfall" alert.
    if (meta.is_within_30_days && isShortfall && !hasShortfall) {
      hasShortfall = true;
      shortfallBucket = key;
      shortfallAmountPaise = Math.abs(runningBalance);
      shortfallMessage = `Projected cash shortfall in bucket "${meta.label}": running balance drops to negative ₹${(
        Math.abs(runningBalance) / 100
      ).toLocaleString("en-IN", { minimumFractionDigits: 2 })}.`;
    }

    const summary: ProjectionBucketSummary = {
      ...b,
      key,
      label: meta.label,
      range_description: meta.range_description,
      is_within_30_days: meta.is_within_30_days,
      is_shortfall: isShortfall,
    };

    bucketList.push(summary);
  }

  const finalBuckets = {
    due_now: bucketList[0],
    days_0_to_7: bucketList[1],
    days_8_to_30: bucketList[2],
    days_31_to_60: bucketList[3],
    days_61_to_90: bucketList[4],
  };

  return {
    as_of_date: today.toISOString().split("T")[0],
    cash_on_hand_paise: startingCashPaise,
    buckets: finalBuckets,
    bucket_list: bucketList,
    overdue_receivables_paise: overdueReceivablesPaise,
    total_committed_not_billed_paise: totalCommittedNotBilledPaise,
    has_projected_shortfall: hasShortfall,
    shortfall_bucket: shortfallBucket,
    shortfall_amount_paise: shortfallAmountPaise,
    shortfall_message: shortfallMessage,
    mandatory_label:
      "Projection from recorded data. Excludes anything not entered.",
    overdue_receivables_label: "Overdue receivables (not assumed received)",
    committed_not_billed_label:
      "Committed but not yet billed (informational, excluded from net total)",
  };
}
