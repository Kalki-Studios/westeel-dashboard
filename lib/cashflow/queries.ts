import { createClient } from "@/lib/supabase/server";
import {
  BankBalance,
  CompanyCashItem,
  CashFlowOverviewSummary,
  CashFlowWorkspaceData,
} from "./types";
import {
  computeCashOnHand,
  computeCashProjection,
  getTodayISTString,
  CashInvoiceItem,
  CashMilestoneItem,
  CashBillItem,
  CommittedOrderInput,
} from "../rules/cashflow";

interface DbProfile {
  full_name: string | null;
}

interface DbBankBalanceRow {
  id: string;
  account_label: string;
  balance: number | string;
  as_of_date: string;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
  profiles?: DbProfile | null;
}

interface DbCompanyCashItemRow {
  id: string;
  direction: "inflow" | "outflow";
  category: string;
  description: string;
  amount: number | string;
  expected_date: string;
  status: "planned" | "done" | "cancelled";
  recurring_group_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  profiles?: DbProfile | null;
}

interface DbReceiptRow {
  amount_received: number | string;
  tds_amount: number | string | null;
}

interface DbInvoiceRow {
  id: string;
  invoice_number?: string;
  amount_excl_gst: number | string;
  gst_amount: number | string;
  is_cancelled: boolean;
  due_date: string;
  payment_milestone_id: string | null;
  projects?: { code?: string } | null;
  receipts?: DbReceiptRow[] | null;
}

interface DbMilestoneRow {
  id: string;
  label: string;
  amount_excl_gst: number | string;
  expected_date: string;
  status: "pending" | "done";
  position: number;
  projects?: { code?: string } | null;
}

interface DbBillPaymentRow {
  amount_paid: number | string;
  tds_amount: number | string | null;
}

interface DbBillRow {
  id: string;
  bill_number?: string;
  vendor_name?: string;
  amount_excl_gst: number | string;
  gst_amount: number | string;
  due_date: string;
  is_cancelled: boolean;
  projects?: { code?: string } | null;
  bill_payments?: DbBillPaymentRow[] | null;
}

interface DbOrderBillRow {
  amount_excl_gst: number | string;
  is_cancelled: boolean;
}

interface DbOrderRow {
  id: string;
  order_number?: string;
  vendor_name?: string;
  amount_excl_gst: number | string;
  expected_delivery_date: string | null;
  fulfilment_status: string;
  projects?: { code?: string } | null;
  bills?: DbOrderBillRow[] | null;
}

/**
 * Returns all bank balance entries ordered by as_of_date DESC, created_at DESC.
 */
export async function getBankBalances(): Promise<BankBalance[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bank_balances")
    .select(`
      id,
      account_label,
      balance,
      as_of_date,
      note,
      recorded_by,
      created_at,
      updated_at,
      profiles:recorded_by (full_name)
    `)
    .order("as_of_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching bank balances:", error);
    return [];
  }

  const rows = data as unknown as DbBankBalanceRow[];
  return rows.map((row) => ({
    id: row.id,
    account_label: row.account_label,
    balance: Number(row.balance),
    as_of_date: row.as_of_date,
    note: row.note,
    recorded_by: row.recorded_by,
    recorded_by_name: row.profiles?.full_name || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Returns list of distinct account labels recorded so far.
 */
export async function getDistinctAccountLabels(): Promise<string[]> {
  const balances = await getBankBalances();
  const set = new Set<string>();
  for (const b of balances) {
    if (b.account_label) set.add(b.account_label);
  }
  return Array.from(set).sort();
}

/**
 * Returns all company cash items ordered by expected_date ASC, created_at DESC.
 */
export async function getCompanyCashItems(): Promise<CompanyCashItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("company_cash_items")
    .select(`
      id,
      direction,
      category,
      description,
      amount,
      expected_date,
      status,
      recurring_group_id,
      created_by,
      created_at,
      updated_at,
      profiles:created_by (full_name)
    `)
    .order("expected_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching company cash items:", error);
    return [];
  }

  const rows = data as unknown as DbCompanyCashItemRow[];
  return rows.map((row) => ({
    id: row.id,
    direction: row.direction,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    expected_date: row.expected_date,
    status: row.status,
    recurring_group_id: row.recurring_group_id,
    created_by: row.created_by,
    created_by_name: row.profiles?.full_name || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Loads all financial data needed for cash flow projection:
 * - Bank Balances
 * - Invoices & Receipts
 * - Payment Milestones (un-invoiced check)
 * - Vendor Bills & Payments
 * - Company Cash Items
 * - Committed Vendor Orders
 */
export async function getCashFlowWorkspaceData(): Promise<CashFlowWorkspaceData> {
  const supabase = await createClient();
  const todayStr = getTodayISTString();

  // 1. Fetch user roles
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isDirector = false;
  let isAccounts = false;

  if (user) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roleList = ((roles || []) as Array<{ role: string }>).map((r) => r.role);
    isDirector = roleList.includes("director");
    isAccounts = roleList.includes("accounts");
  }

  // 2. Fetch Bank Balances
  const bankBalances = await getBankBalances();

  // 3. Fetch Company Cash Items
  const companyCashItems = await getCompanyCashItems();

  // 4. Fetch Invoices and Receipts
  const { data: invoicesData } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      amount_excl_gst,
      gst_amount,
      is_cancelled,
      due_date,
      payment_milestone_id,
      projects:project_id (code),
      receipts (
        amount_received,
        tds_amount
      )
    `)
    .order("due_date", { ascending: true });

  const invoiceRows = (invoicesData || []) as unknown as DbInvoiceRow[];
  const cashInvoices: CashInvoiceItem[] = invoiceRows.map((inv) => {
    const amountInclGst = Number(inv.amount_excl_gst || 0) + Number(inv.gst_amount || 0);
    let totalReceived = 0;
    for (const r of inv.receipts || []) {
      totalReceived += Number(r.amount_received || 0) + Number(r.tds_amount || 0);
    }

    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      amount_incl_gst: amountInclGst,
      total_received_incl_tds: totalReceived,
      due_date: inv.due_date,
      is_cancelled: inv.is_cancelled,
      project_code: inv.projects?.code,
    };
  });

  // Track which milestone IDs are already linked to an uncancelled invoice
  const invoicedMilestoneIds = new Set<string>();
  for (const inv of invoiceRows) {
    if (!inv.is_cancelled && inv.payment_milestone_id) {
      invoicedMilestoneIds.add(inv.payment_milestone_id);
    }
  }

  // 5. Fetch Payment Milestones
  const { data: milestonesData } = await supabase
    .from("payment_milestones")
    .select(`
      id,
      label,
      amount_excl_gst,
      expected_date,
      status,
      position,
      projects:project_id (code)
    `)
    .order("expected_date", { ascending: true });

  const milestoneRows = (milestonesData || []) as unknown as DbMilestoneRow[];
  const cashMilestones: CashMilestoneItem[] = milestoneRows.map((ms) => ({
    id: ms.id,
    label: ms.label,
    amount_excl_gst: Number(ms.amount_excl_gst || 0),
    is_invoiced: invoicedMilestoneIds.has(ms.id),
    status: ms.status,
    expected_date: ms.expected_date,
    project_code: ms.projects?.code,
  }));

  // 6. Fetch Vendor Bills and Payments
  const { data: billsData } = await supabase
    .from("bills")
    .select(`
      id,
      bill_number,
      vendor_name,
      amount_excl_gst,
      gst_amount,
      due_date,
      is_cancelled,
      projects:project_id (code),
      bill_payments (
        amount_paid,
        tds_amount
      )
    `)
    .order("due_date", { ascending: true });

  const billRows = (billsData || []) as unknown as DbBillRow[];
  const cashBills: CashBillItem[] = billRows.map((b) => {
    const amountInclGst = Number(b.amount_excl_gst || 0) + Number(b.gst_amount || 0);
    let totalPaid = 0;
    for (const p of b.bill_payments || []) {
      totalPaid += Number(p.amount_paid || 0) + Number(p.tds_amount || 0);
    }

    return {
      id: b.id,
      bill_number: b.bill_number,
      vendor_name: b.vendor_name,
      amount_incl_gst: amountInclGst,
      total_paid_incl_tds: totalPaid,
      due_date: b.due_date,
      is_cancelled: b.is_cancelled,
      project_code: b.projects?.code,
    };
  });

  // 7. Fetch Committed Vendor Orders
  const { data: ordersData } = await supabase
    .from("vendor_orders")
    .select(`
      id,
      order_number,
      vendor_name,
      amount_excl_gst,
      expected_delivery_date,
      fulfilment_status,
      projects:project_id (code),
      bills (
        amount_excl_gst,
        is_cancelled
      )
    `);

  const orderRows = (ordersData || []) as unknown as DbOrderRow[];
  const committedOrders: CommittedOrderInput[] = orderRows.map((o) => {
    let billedAmount = 0;
    for (const b of o.bills || []) {
      if (!b.is_cancelled) {
        billedAmount += Number(b.amount_excl_gst || 0);
      }
    }

    return {
      id: o.id,
      order_number: o.order_number,
      vendor_name: o.vendor_name,
      amount_excl_gst: Number(o.amount_excl_gst || 0),
      billed_amount_excl_gst: billedAmount,
      expected_delivery_date: o.expected_delivery_date,
      fulfilment_status: o.fulfilment_status,
      project_code: o.projects?.code,
    };
  });

  // 8. Compute Rule F11 Cash on Hand & Rule F12 Projection
  const cashOnHand = computeCashOnHand(bankBalances, todayStr);

  const projection = computeCashProjection({
    bank_balances: bankBalances,
    invoices: cashInvoices,
    payment_milestones: cashMilestones,
    bills: cashBills,
    company_cash_items: companyCashItems,
    committed_orders: committedOrders,
    currentDate: todayStr,
  });

  const distinctAccountLabels = Array.from(
    new Set(bankBalances.map((b) => b.account_label).filter(Boolean))
  ).sort();

  return {
    cashOnHand,
    projection,
    bankBalances,
    companyCashItems,
    distinctAccountLabels,
    userRoles: {
      isDirector,
      isAccounts,
    },
  };
}

/**
 * Returns summary cash flow data for Block 2 of the Admin Overview dashboard.
 */
export async function getCashFlowOverviewData(): Promise<CashFlowOverviewSummary> {
  const data = await getCashFlowWorkspaceData();

  // 30-day projected cash balance is the running balance at the end of bucket 3 ("8 to 30 days")
  const projected30dCashPaise =
    data.projection.buckets.days_8_to_30.running_balance_paise;

  const dueNowBillsPaise = data.projection.buckets.due_now.bills_paise;

  return {
    cash_on_hand_paise: data.cashOnHand.total_cash_on_hand_paise,
    as_of_date: data.cashOnHand.as_of_date,
    is_stale: data.cashOnHand.is_stale,
    stale_warning: data.cashOnHand.stale_warning,
    projected_30d_cash_paise: projected30dCashPaise,
    has_projected_shortfall: data.projection.has_projected_shortfall,
    shortfall_bucket: data.projection.shortfall_bucket,
    shortfall_amount_paise: data.projection.shortfall_amount_paise,
    shortfall_message: data.projection.shortfall_message,
    overdue_receivables_paise: data.projection.overdue_receivables_paise,
    overdue_payables_paise: dueNowBillsPaise,
  };
}
