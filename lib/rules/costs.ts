/**
 * Westeel Rules F6 to F10 and R9: Vendor Orders, Project Costs, Payables, Forecast
 * Rule A11:
 * - Budget lines, vendor orders, bills are strictly ex-GST.
 * - Invoices, receipts, and bill payments are cash numbers including GST.
 * - TDS (Rule A12) is recorded as an input field on bill payments, never auto-computed.
 * - Floating-point arithmetic is forbidden: all currency math in TypeScript uses integer paise.
 */

import { differenceInDays, parseISO } from "date-fns";
import { rupeesToPaise } from "../money";

export interface CostCategoryInput {
  id: string;
  name: string;
  is_active?: boolean;
}

export interface BudgetLineInput {
  id?: string;
  project_id: string;
  category_id: string;
  amount_excl_gst: number | string;
  note?: string | null;
}

export interface VendorOrderInput {
  id: string;
  project_id: string;
  category_id: string;
  kind?: string;
  vendor_name: string;
  description?: string;
  amount_excl_gst: number | string;
  gst_amount?: number | string;
  order_date?: string;
  expected_delivery_date: string; // YYYY-MM-DD
  fulfilment_status: "ordered" | "in_progress" | "partially_fulfilled" | "fulfilled" | "issue" | "cancelled";
  delivery_note?: string | null;
}

export interface BillInput {
  id: string;
  project_id: string;
  category_id: string;
  vendor_order_id?: string | null;
  bill_type?: string;
  vendor_name: string;
  bill_number: string;
  bill_date: string; // YYYY-MM-DD
  due_date: string; // YYYY-MM-DD
  amount_excl_gst: number | string;
  gst_amount?: number | string;
  is_cancelled: boolean;
  note?: string | null;
}

export interface BillPaymentInput {
  id: string;
  bill_id: string;
  payment_date: string; // YYYY-MM-DD
  amount_paid: number | string;
  tds_amount?: number | string | null;
  mode?: string;
  reference?: string | null;
  note?: string | null;
}

export interface BillCalculation {
  billId: string;
  billNumber: string;
  vendorName: string;
  isCancelled: boolean;
  exGstPaise: number;
  gstPaise: number;
  totalPaise: number;
  paidPaise: number;
  tdsPaise: number;
  settledPaise: number;
  outstandingPaise: number;
  isOverdue: boolean;
  daysOverdue: number;
}

export interface CategoryCostForecast {
  categoryId: string;
  categoryName: string;
  hasBudget: boolean;
  budgetPaise: number;
  committedPaise: number;
  billedPaise: number;
  paidPaise: number;
  settledPaise: number;
  remainingCommittedPaise: number;
  uncommittedBudgetPaise: number;
  forecastCostPaise: number;
  isOverBudget: boolean;
  overrunPaise: number;
  ordersCount: number;
  billsCount: number;
}

export interface ProjectCostSummary {
  projectId: string;
  revisedContractValuePaise: number;
  hasContractValue: boolean;
  hasExplicitContractValue: boolean;
  hasBudget: boolean;
  isIncomplete: boolean;
  incompleteReason?: string;
  // Six cost states of Rule F6
  budgetPaise: number;
  totalBudgetPaise: number;
  committedPaise: number;
  totalCommittedPaise: number;
  billedPaise: number;
  totalBilledPaise: number;
  paidPaise: number;
  totalPaidPaise: number;
  settledPaise: number;
  totalSettledPaise: number;
  collectedPaise: number;
  totalReceiptsCollectedPaise: number;
  totalRemainingCommittedPaise: number;
  totalUncommittedBudgetPaise: number;
  forecastCostPaise: number;
  totalForecastCostPaise: number;
  // Rule F9
  forecastProfitPaise: number | null;
  marginPct: number | null;
  forecastMarginPct: number | null;
  // Rule F10
  isOverBudget: boolean;
  hasOverrun: boolean;
  totalOverrunPaise: number;
  categories: CategoryCostForecast[];
}

export interface PayablesAgingBuckets {
  totalPayablePaise: number;
  totalOverduePaise: number;
  currentPaise: number;
  bucket1_30Paise: number;
  bucket31_60Paise: number;
  bucket61_90Paise: number;
  bucketOver90Paise: number;
  overdueBillsCount: number;
  dueWithin7DaysPaise: number;
  dueWithin30DaysPaise: number;
}

/**
 * Returns today's date formatted as YYYY-MM-DD in Asia/Kolkata (IST).
 */
export function getTodayISTString(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/**
 * Rule F7: Bill Calculation & Settlement.
 * Total = ex-GST + GST
 * Settled = sum of (amount_paid + tds_amount)
 * Outstanding = total - settled
 * Overdue: outstanding > 0 AND due_date < today
 * Cancelled bills are excluded from payables.
 */
export function computeBillCalculation(
  bill: BillInput,
  payments: BillPaymentInput[],
  todayStr: string = getTodayISTString()
): BillCalculation {
  const exGstPaise = rupeesToPaise(bill.amount_excl_gst);
  const gstPaise = rupeesToPaise(bill.gst_amount || 0);
  const totalPaise = exGstPaise + gstPaise;

  if (bill.is_cancelled) {
    return {
      billId: bill.id,
      billNumber: bill.bill_number,
      vendorName: bill.vendor_name,
      isCancelled: true,
      exGstPaise,
      gstPaise,
      totalPaise,
      paidPaise: 0,
      tdsPaise: 0,
      settledPaise: 0,
      outstandingPaise: 0,
      isOverdue: false,
      daysOverdue: 0,
    };
  }

  const linkedPayments = payments.filter((p) => p.bill_id === bill.id);
  let paidPaise = 0;
  let tdsPaise = 0;

  for (const p of linkedPayments) {
    paidPaise += rupeesToPaise(p.amount_paid);
    tdsPaise += rupeesToPaise(p.tds_amount || 0);
  }

  const settledPaise = paidPaise + tdsPaise;
  const outstandingPaise = Math.max(0, totalPaise - settledPaise);

  let isOverdue = false;
  let daysOverdue = 0;

  if (outstandingPaise > 0 && bill.due_date) {
    try {
      const todayDate = parseISO(todayStr);
      const dueDate = parseISO(bill.due_date);
      const diff = differenceInDays(todayDate, dueDate);
      if (diff > 0) {
        isOverdue = true;
        daysOverdue = diff;
      }
    } catch {
      // Fallback
    }
  }

  return {
    billId: bill.id,
    billNumber: bill.bill_number,
    vendorName: bill.vendor_name,
    isCancelled: false,
    exGstPaise,
    gstPaise,
    totalPaise,
    paidPaise,
    tdsPaise,
    settledPaise,
    outstandingPaise,
    isOverdue,
    daysOverdue,
  };
}

/**
 * Rule R9: Vendor order late or in trouble.
 * fulfilment_status not in ('fulfilled', 'cancelled') AND expected_delivery_date < today
 * OR fulfilment_status == 'issue'.
 */
export function isVendorOrderLate(
  order: {
    expected_delivery_date?: string | null;
    fulfilment_status?: string | null;
  },
  todayStr: string = getTodayISTString()
): { isLate: boolean; isIssue: boolean; isTrouble: boolean; daysLate: number } {
  const isCancelled = order.fulfilment_status === "cancelled";
  const isFulfilled = order.fulfilment_status === "fulfilled";
  const isIssue = order.fulfilment_status === "issue";

  if (isCancelled || isFulfilled) {
    return { isLate: false, isIssue: false, isTrouble: false, daysLate: 0 };
  }

  let isLate = false;
  let daysLate = 0;

  if (order.expected_delivery_date) {
    try {
      const todayDate = parseISO(todayStr);
      const deliveryDate = parseISO(order.expected_delivery_date);
      const diff = differenceInDays(todayDate, deliveryDate);
      if (diff > 0) {
        isLate = true;
        daysLate = diff;
      }
    } catch {
      // Fallback
    }
  }

  const isTrouble = isLate || isIssue;

  return { isLate, isIssue, isTrouble, daysLate };
}

/**
 * Rule F8: Forecast cost per category.
 * forecast = billed_cat + remaining_committed_cat + uncommitted_budget_cat
 * - remaining_committed (per order) = max(order amount - sum of bills linked to that order, 0), summed per category
 * - uncommitted_budget_cat = max(0, budget_cat - (committed_cat + unlinked_billed_cat))
 * - unlinked_billed = bills with no vendor_order_id (or where the linked order was cancelled)
 * If category has orders or bills but no budget line: forecast = billed + remaining_committed, flagged "No budget for this category".
 */
export function computeCategoryCostForecast(
  categoryId: string,
  categoryName: string,
  budgetLine: BudgetLineInput | null | undefined,
  allOrders: VendorOrderInput[],
  allBills: BillInput[],
  payments: BillPaymentInput[] = []
): CategoryCostForecast {
  const hasBudget = budgetLine !== null && budgetLine !== undefined && budgetLine.amount_excl_gst !== null && budgetLine.amount_excl_gst !== undefined;
  const budgetPaise = hasBudget ? rupeesToPaise(budgetLine.amount_excl_gst) : 0;

  // Filter category orders excluding cancelled
  const catOrders = allOrders.filter(
    (o) => o.category_id === categoryId && o.fulfilment_status !== "cancelled"
  );
  // Active orders map for fast lookup
  const activeOrderIds = new Set(catOrders.map((o) => o.id));

  // Filter category bills excluding cancelled
  const catBills = allBills.filter((b) => b.category_id === categoryId && !b.is_cancelled);

  let committedPaise = 0;
  for (const o of catOrders) {
    committedPaise += rupeesToPaise(o.amount_excl_gst);
  }

  let billedPaise = 0;
  let unlinkedBilledPaise = 0;

  // Map of bills per order id
  const billsPerOrder = new Map<string, number>();

  for (const b of catBills) {
    const billAmtPaise = rupeesToPaise(b.amount_excl_gst);
    billedPaise += billAmtPaise;

    if (b.vendor_order_id && activeOrderIds.has(b.vendor_order_id)) {
      const prev = billsPerOrder.get(b.vendor_order_id) || 0;
      billsPerOrder.set(b.vendor_order_id, prev + billAmtPaise);
    } else {
      // No vendor_order_id or linked order is cancelled
      unlinkedBilledPaise += billAmtPaise;
    }
  }

  // Calculate remaining committed per active order
  let remainingCommittedPaise = 0;
  for (const o of catOrders) {
    const orderAmtPaise = rupeesToPaise(o.amount_excl_gst);
    const linkedBillsPaise = billsPerOrder.get(o.id) || 0;
    const rem = Math.max(0, orderAmtPaise - linkedBillsPaise);
    remainingCommittedPaise += rem;
  }

  // Uncommitted budget
  let uncommittedBudgetPaise = 0;
  if (hasBudget) {
    uncommittedBudgetPaise = Math.max(0, budgetPaise - (committedPaise + unlinkedBilledPaise));
  }

  // Total forecast cost for category
  let forecastCostPaise = 0;
  if (hasBudget) {
    forecastCostPaise = billedPaise + remainingCommittedPaise + uncommittedBudgetPaise;
  } else {
    forecastCostPaise = billedPaise + remainingCommittedPaise;
  }

  // Overrun calculation
  let isOverBudget = false;
  let overrunPaise = 0;

  if (hasBudget) {
    if (forecastCostPaise > budgetPaise) {
      isOverBudget = true;
      overrunPaise = forecastCostPaise - budgetPaise;
    }
  } else if (forecastCostPaise > 0) {
    isOverBudget = true;
    overrunPaise = forecastCostPaise;
  }

  // Paid cash out for category bills
  const billIdSet = new Set(catBills.map((b) => b.id));
  let paidPaise = 0;
  let settledPaise = 0;
  for (const p of payments) {
    if (billIdSet.has(p.bill_id)) {
      paidPaise += rupeesToPaise(p.amount_paid);
      settledPaise += rupeesToPaise(p.amount_paid) + rupeesToPaise(p.tds_amount || 0);
    }
  }

  return {
    categoryId,
    categoryName,
    hasBudget,
    budgetPaise,
    committedPaise,
    billedPaise,
    paidPaise,
    settledPaise,
    remainingCommittedPaise,
    uncommittedBudgetPaise,
    forecastCostPaise,
    isOverBudget,
    overrunPaise,
    ordersCount: catOrders.length,
    billsCount: catBills.length,
  };
}

/**
 * Rules F6, F8, F9, F10: Comprehensive Project Cost Summary & Profitability.
 */
export function computeProjectCostSummary(
  projectId: string,
  categories: CostCategoryInput[],
  budgetLines: BudgetLineInput[],
  orders: VendorOrderInput[],
  bills: BillInput[],
  payments: BillPaymentInput[],
  receiptsCollectedPaise: number = 0,
  revisedContractValuePaise: number = 0,
  hasExplicitContractValue: boolean = false
): ProjectCostSummary {
  const budgetMap = new Map<string, BudgetLineInput>();
  for (const bl of budgetLines) {
    budgetMap.set(bl.category_id, bl);
  }

  // Include all categories that exist, plus any orphan categories present in budget/orders/bills
  const categoryMap = new Map<string, string>();
  for (const c of categories) {
    categoryMap.set(c.id, c.name);
  }
  for (const bl of budgetLines) {
    if (!categoryMap.has(bl.category_id)) {
      categoryMap.set(bl.category_id, "Unknown Category");
    }
  }
  for (const o of orders) {
    if (!categoryMap.has(o.category_id)) {
      categoryMap.set(o.category_id, "Unknown Category");
    }
  }
  for (const b of bills) {
    if (!categoryMap.has(b.category_id)) {
      categoryMap.set(b.category_id, "Unknown Category");
    }
  }

  const categoryForecasts: CategoryCostForecast[] = [];
  let totalBudgetPaise = 0;
  let totalCommittedPaise = 0;
  let totalBilledPaise = 0;
  let totalPaidPaise = 0;
  let totalForecastCostPaise = 0;
  let totalOverrunPaise = 0;
  let anyCategoryOverBudget = false;

  for (const [catId, catName] of categoryMap.entries()) {
    const bl = budgetMap.get(catId);
    const forecast = computeCategoryCostForecast(catId, catName, bl, orders, bills, payments);

    // Only include categories that have budget, orders, or bills, OR are active default categories
    if (forecast.hasBudget || forecast.ordersCount > 0 || forecast.billsCount > 0 || categories.find((c) => c.id === catId)?.is_active) {
      categoryForecasts.push(forecast);
      totalBudgetPaise += forecast.budgetPaise;
      totalCommittedPaise += forecast.committedPaise;
      totalBilledPaise += forecast.billedPaise;
      totalPaidPaise += forecast.paidPaise;
      totalForecastCostPaise += forecast.forecastCostPaise;

      if (forecast.isOverBudget) {
        anyCategoryOverBudget = true;
      }
    }
  }

  // Calculate settled amount on all active bills
  const billCalcMap = new Map<string, BillCalculation>();
  let totalSettledPaise = 0;
  for (const b of bills) {
    const calc = computeBillCalculation(b, payments);
    billCalcMap.set(b.id, calc);
    if (!b.is_cancelled) {
      totalSettledPaise += calc.settledPaise;
    }
  }

  // Rule F10: Overrun flag
  const isOverBudget = totalForecastCostPaise > totalBudgetPaise || anyCategoryOverBudget;
  if (totalForecastCostPaise > totalBudgetPaise) {
    totalOverrunPaise = totalForecastCostPaise - totalBudgetPaise;
  } else {
    // Sum of category overruns
    totalOverrunPaise = categoryForecasts.reduce((acc, c) => acc + (c.isOverBudget ? c.overrunPaise : 0), 0);
  }

  // Rule F9: Forecast Profit and Margin %
  // Calculate ONLY if the project has a contract value AND at least one budget line
  const hasBudget = budgetLines.length > 0;
  const hasContractValue = hasExplicitContractValue && revisedContractValuePaise > 0;

  let isIncomplete = false;
  let incompleteReason: string | undefined;
  let forecastProfitPaise: number | null = null;
  let marginPct: number | null = null;

  if (!hasContractValue && !hasBudget) {
    isIncomplete = true;
    incompleteReason = "Missing contract value and budget";
  } else if (!hasContractValue) {
    isIncomplete = true;
    incompleteReason = "Missing contract value";
  } else if (!hasBudget) {
    isIncomplete = true;
    incompleteReason = "Missing budget";
  } else {
    forecastProfitPaise = revisedContractValuePaise - totalForecastCostPaise;
    marginPct = revisedContractValuePaise > 0 ? (forecastProfitPaise / revisedContractValuePaise) * 100 : 0;
  }

  const totalRemainingCommittedPaise = categoryForecasts.reduce(
    (acc, c) => acc + c.remainingCommittedPaise,
    0
  );
  const totalUncommittedBudgetPaise = categoryForecasts.reduce(
    (acc, c) => acc + c.uncommittedBudgetPaise,
    0
  );

  return {
    projectId,
    revisedContractValuePaise,
    hasContractValue,
    hasExplicitContractValue,
    hasBudget,
    isIncomplete,
    incompleteReason,
    budgetPaise: totalBudgetPaise,
    totalBudgetPaise,
    committedPaise: totalCommittedPaise,
    totalCommittedPaise,
    billedPaise: totalBilledPaise,
    totalBilledPaise,
    paidPaise: totalPaidPaise,
    totalPaidPaise,
    settledPaise: totalSettledPaise,
    totalSettledPaise,
    collectedPaise: receiptsCollectedPaise,
    totalReceiptsCollectedPaise: receiptsCollectedPaise,
    totalRemainingCommittedPaise,
    totalUncommittedBudgetPaise,
    forecastCostPaise: totalForecastCostPaise,
    totalForecastCostPaise,
    forecastProfitPaise,
    marginPct,
    forecastMarginPct: marginPct,
    isOverBudget,
    hasOverrun: isOverBudget,
    totalOverrunPaise,
    categories: categoryForecasts,
  };
}

/**
 * Rule F7: Payables Aging Buckets & Summary.
 * Aging buckets for overdue payables (1 to 30, 31 to 60, 61 to 90, over 90).
 */
export function computePayablesAging(
  bills: BillInput[],
  payments: BillPaymentInput[],
  todayStr: string = getTodayISTString()
): PayablesAgingBuckets {
  let totalPayablePaise = 0;
  let totalOverduePaise = 0;
  let currentPaise = 0;
  let bucket1_30Paise = 0;
  let bucket31_60Paise = 0;
  let bucket61_90Paise = 0;
  let bucketOver90Paise = 0;
  let overdueBillsCount = 0;
  let dueWithin7DaysPaise = 0;
  let dueWithin30DaysPaise = 0;

  const todayDate = parseISO(todayStr);

  for (const b of bills) {
    if (b.is_cancelled) continue;

    const calc = computeBillCalculation(b, payments, todayStr);
    if (calc.outstandingPaise <= 0) continue;

    totalPayablePaise += calc.outstandingPaise;

    if (calc.isOverdue) {
      totalOverduePaise += calc.outstandingPaise;
      overdueBillsCount++;

      if (calc.daysOverdue <= 30) {
        bucket1_30Paise += calc.outstandingPaise;
      } else if (calc.daysOverdue <= 60) {
        bucket31_60Paise += calc.outstandingPaise;
      } else if (calc.daysOverdue <= 90) {
        bucket61_90Paise += calc.outstandingPaise;
      } else {
        bucketOver90Paise += calc.outstandingPaise;
      }
    } else {
      currentPaise += calc.outstandingPaise;

      // Check upcoming due dates (future-dated)
      try {
        const dueDate = parseISO(b.due_date);
        const daysUntilDue = differenceInDays(dueDate, todayDate);
        if (daysUntilDue >= 0 && daysUntilDue <= 7) {
          dueWithin7DaysPaise += calc.outstandingPaise;
        }
        if (daysUntilDue >= 0 && daysUntilDue <= 30) {
          dueWithin30DaysPaise += calc.outstandingPaise;
        }
      } catch {
        // Fallback
      }
    }
  }

  return {
    totalPayablePaise,
    totalOverduePaise,
    currentPaise,
    bucket1_30Paise,
    bucket31_60Paise,
    bucket61_90Paise,
    bucketOver90Paise,
    overdueBillsCount,
    dueWithin7DaysPaise,
    dueWithin30DaysPaise,
  };
}
