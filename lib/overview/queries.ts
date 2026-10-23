import { createClient } from "@/lib/supabase/server";
import { formatMilestoneProgress, isProjectDelayed, ProjectMilestoneItem } from "@/lib/rules/projects";
import {
  computeLiveAlerts,
  AlertItem,
  ProjectAlertInput,
  TaskAlertInput,
  DrawingAlertInput,
  InvoiceAlertInput,
  PaymentMilestoneAlertInput,
  CostAlertsInput,
  CashFlowAlertsInput,
  SalesAlertsInput,
} from "@/lib/rules/alerts";
import {
  computeCashOnHand,
  computeCashProjection,
  CashInvoiceItem,
  CashMilestoneItem,
  CashBillItem,
  CompanyCashItemInput,
  CommittedOrderInput,
} from "@/lib/rules/cashflow";
import {
  computeInvoiceCalculation,
  getUnallocatedAdvances,
  computeReceivablesAging,
  computeRevisedContractValuePaise,
  getTodayISTString,
} from "@/lib/rules/billing";
import {
  computeBillCalculation,
  computePayablesAging,
  computeProjectCostSummary,
  isVendorOrderLate,
  CostCategoryInput,
  BudgetLineInput,
  VendorOrderInput,
  BillInput,
  BillPaymentInput,
} from "@/lib/rules/costs";
import { rupeesToPaise } from "@/lib/money";
import {
  SalesTrackerResult,
  getPeriodDateRange,
  computeSalesTrackerMetrics,
  mapEnquiryRecordToTrackerInput,
} from "@/lib/rules/sales";

export interface ActiveProjectRow {
  id: string;
  code: string;
  name: string;
  site_location: string;
  stage_name: string;
  stage_position: number;
  progress_text: string;
  is_delayed: boolean;
  delay_reason?: "project_overdue" | "milestone_overdue";
  last_report_date: string | null;
  total_milestones: number;
  completed_milestones: number;
}

export interface ReceivablesBlockData {
  total_receivable_paise: number;
  total_overdue_paise: number;
  total_advances_paise: number;
  current_paise: number;
  bucket1_30_paise: number;
  bucket31_60_paise: number;
  bucket61_90_paise: number;
  bucket_over90_paise: number;
  overdue_invoices_count: number;
}

export interface PayablesBlockData {
  total_payable_paise: number;
  total_overdue_paise: number;
  current_paise: number;
  bucket1_30_paise: number;
  bucket31_60_paise: number;
  bucket61_90_paise: number;
  bucket_over90_paise: number;
  overdue_bills_count: number;
  due_within_7days_paise: number;
  due_within_30days_paise: number;
}

export interface CashOverviewBlockData {
  cash_on_hand_paise: number;
  as_of_date: string | null;
  is_stale: boolean;
  stale_warning: string | null;
  projected_30d_cash_paise: number;
  has_projected_shortfall: boolean;
  shortfall_bucket?: string;
  shortfall_amount_paise?: number;
  shortfall_message?: string;
  mandatory_label: string;
}

export interface OverviewBlock1Data {
  metrics: {
    active_projects_count: number;
    delayed_projects_count: number;
    overdue_tasks_count: number;
    blocked_tasks_count: number;
    pending_drawings_count: number;
    missing_reports_count: number;
    late_orders_count: number;
    over_budget_projects_count: number;
    incomplete_projects_count: number;
  };
  active_projects: ActiveProjectRow[];
  receivables: ReceivablesBlockData;
  payables: PayablesBlockData;
  cash: CashOverviewBlockData;
  sales_this_month: SalesTrackerResult;
  projects_over_budget: Array<{
    id: string;
    code: string;
    name: string;
    budget_paise: number;
    forecast_cost_paise: number;
    overrun_paise: number;
  }>;
  projects_incomplete: Array<{
    id: string;
    code: string;
    name: string;
    reason: string;
  }>;
  alerts: AlertItem[];
}

/**
 * Fetches and live-computes Priority 1 and Priority 2 Director Overview data.
 * Pure computation on read - no stored alert tables, no fabricated numbers.
 */
export async function getOverviewBlock1Data(): Promise<OverviewBlock1Data> {
  const supabase = await createClient();
  const todayStr = getTodayISTString();
  const now = new Date();

  // 1. Fetch active projects with milestones, current stage, and site report dates
  const [
    projectsRes,
    tasksRes,
    drawingsRes,
    invoicesRes,
    receiptsRes,
    milestonesRes,
    categoriesRes,
    budgetRes,
    ordersRes,
    billsRes,
    paymentsRes,
    commercialsRes,
    variationsRes,
    bankBalancesRes,
    companyCashItemsRes,
    enquiriesRes,
    quotationsRes,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(`
        id,
        code,
        name,
        site_location,
        status,
        start_date,
        planned_completion_date,
        current_stage_id,
        stages:current_stage_id (
          id,
          position,
          name
        ),
        milestones:project_milestones (
          id,
          title,
          planned_date,
          actual_date,
          status,
          delay_reason,
          delay_note,
          position
        ),
        site_reports (
          id,
          report_date
        )
      `)
      .eq("status", "active")
      .eq("is_archived", false)
      .order("code"),
    supabase
      .from("tasks")
      .select(`
        id,
        title,
        kind,
        status,
        due_date,
        blocked_reason,
        project_id,
        created_at,
        projects (id, code, name),
        assignee:assignee_id (id, full_name)
      `)
      .neq("status", "done"),
    supabase
      .from("documents")
      .select("id, title, category, review_status, version_no, project_id, created_at, projects(id, code, name)")
      .eq("category", "drawing")
      .eq("review_status", "pending")
      .eq("is_archived", false),
    supabase
      .from("invoices")
      .select("*, projects(id, code, name)")
      .order("due_date", { ascending: true }),
    supabase.from("receipts").select("*").order("receipt_date", { ascending: false }),
    supabase.from("payment_milestones").select("*, projects(id, code, name)").order("expected_date", { ascending: true }),
    supabase.from("cost_categories").select("id, name, is_active"),
    supabase.from("budget_lines").select("*, projects(id, code, name)"),
    supabase.from("vendor_orders").select("*, projects(id, code, name)").order("expected_delivery_date", { ascending: true }),
    supabase.from("bills").select("*, projects(id, code, name)").order("due_date", { ascending: true }),
    supabase.from("bill_payments").select("*"),
    supabase.from("project_commercials").select("project_id, contract_value_excl_gst"),
    supabase.from("variation_orders").select("project_id, amount_excl_gst, status"),
    supabase.from("bank_balances").select("*").order("as_of_date", { ascending: false }),
    supabase.from("company_cash_items").select("*").order("expected_date", { ascending: true }),
    supabase
      .from("enquiries")
      .select(`
        id,
        title,
        customer_id,
        status,
        expected_value_excl_gst,
        created_at,
        won_at,
        lost_at,
        next_followup_date,
        source_id,
        lost_reason_id,
        lost_note,
        assigned_to,
        customer:customers(name),
        source:lead_sources(name),
        lost_reason:lost_reasons(name),
        assigned_person:profiles!enquiries_assigned_to_fkey(full_name),
        project:projects(id, code, name),
        followups:enquiry_followups(id, kind, followup_date),
        quotations:quotations(id, quote_number, version, amount_excl_gst, status, validity_date, sent_at, accepted_at)
      `),
    supabase
      .from("quotations")
      .select("id, quote_number, status, validity_date, enquiry_id, enquiries(title)"),
  ]);

  const projects = projectsRes.data || [];
  const tasks = tasksRes.data || [];
  const drawings = drawingsRes.data || [];
  const rawInvoices = invoicesRes.data || [];
  const rawReceipts = receiptsRes.data || [];
  const rawMilestones = milestonesRes.data || [];
  const rawCategories = (categoriesRes.data || []) as CostCategoryInput[];
  const rawBudgets = (budgetRes.data || []) as BudgetLineInput[];
  const rawOrders = (ordersRes.data || []) as VendorOrderInput[];
  const rawBills = (billsRes.data || []) as BillInput[];
  const rawPayments = (paymentsRes.data || []) as BillPaymentInput[];
  const rawCommercials = commercialsRes.data || [];
  const rawVariations = variationsRes.data || [];
  const rawBankBalances = (bankBalancesRes.data || []) as unknown as Array<{
    id?: string;
    account_label: string;
    balance: number | string;
    as_of_date: string;
    note?: string | null;
  }>;
  const rawCompanyCashItems = (companyCashItemsRes.data || []) as unknown as Array<{
    id: string;
    direction: "inflow" | "outflow";
    category: string;
    description: string;
    amount: number | string;
    expected_date: string;
    status: "planned" | "done" | "cancelled";
  }>;

  // P1 Alert inputs
  const projectAlertInputs: ProjectAlertInput[] = projects.map((p) => {
    const stageObj = p.stages as unknown as { id: string; position: number; name: string } | null;
    const reportDates = (p.site_reports || []).map((sr) => sr.report_date);

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
      planned_completion_date: p.planned_completion_date,
      stage_position: stageObj?.position ?? null,
      milestones: (p.milestones || []).map((m) => ({
        id: m.id,
        title: m.title,
        plannedDate: m.planned_date,
        actualDate: m.actual_date,
        status: m.status,
        delayReason: m.delay_reason,
        delayNote: m.delay_note,
      })),
      existing_report_dates: reportDates,
    };
  });

  const taskAlertInputs: TaskAlertInput[] = tasks.map((t) => {
    const proj = t.projects as unknown as { id: string; code: string; name: string } | null;
    const assignee = t.assignee as unknown as { id: string; full_name: string } | null;

    return {
      id: t.id,
      title: t.title,
      kind: t.kind as "task" | "issue",
      status: t.status,
      due_date: t.due_date,
      blocked_reason: t.blocked_reason,
      project_id: t.project_id,
      project_code: proj?.code ?? null,
      project_name: proj?.name ?? null,
      assignee_name: assignee?.full_name ?? null,
      created_at: t.created_at,
    };
  });

  const drawingAlertInputs: DrawingAlertInput[] = drawings.map((d) => {
    const proj = d.projects as unknown as { id: string; code: string; name: string } | null;

    return {
      id: d.id,
      title: d.title,
      category: d.category,
      review_status: d.review_status,
      version_no: d.version_no,
      project_id: d.project_id,
      project_code: proj?.code ?? null,
      project_name: proj?.name ?? null,
      created_at: d.created_at,
    };
  });

  // Receivables computation (Rule F4)
  const receiptInputs = rawReceipts.map((r) => ({
    id: r.id,
    invoice_id: r.invoice_id,
    amount_received: r.amount_received,
    tds_amount: r.tds_amount,
    receipt_date: r.receipt_date,
    project_id: r.project_id,
  }));

  const aging = computeReceivablesAging(
    rawInvoices.map((inv) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      amount_excl_gst: inv.amount_excl_gst,
      gst_amount: inv.gst_amount,
      is_cancelled: inv.is_cancelled,
      due_date: inv.due_date,
      project_id: inv.project_id,
    })),
    receiptInputs,
    todayStr
  );

  const advances = getUnallocatedAdvances(receiptInputs);

  let overdueInvoicesCount = 0;
  const invoiceAlertInputs: InvoiceAlertInput[] = [];
  const activeMilestoneIds = new Set<string>();

  for (const inv of rawInvoices) {
    if (!inv.is_cancelled && inv.payment_milestone_id) {
      activeMilestoneIds.add(inv.payment_milestone_id);
    }

    const calc = computeInvoiceCalculation(
      {
        id: inv.id,
        invoice_number: inv.invoice_number,
        amount_excl_gst: inv.amount_excl_gst,
        gst_amount: inv.gst_amount,
        is_cancelled: inv.is_cancelled,
        due_date: inv.due_date,
      },
      receiptInputs,
      todayStr
    );

    if (calc.isOverdue && calc.outstandingPaise > 0) {
      overdueInvoicesCount++;
    }

    const proj = inv.projects as unknown as { id: string; code: string; name: string } | null;
    invoiceAlertInputs.push({
      id: inv.id,
      invoice_number: inv.invoice_number,
      project_id: inv.project_id,
      project_code: proj?.code || "Unknown",
      project_name: proj?.name || "Unknown",
      due_date: inv.due_date,
      is_cancelled: inv.is_cancelled,
      outstanding_paise: calc.outstandingPaise,
    });
  }

  const milestoneAlertInputs: PaymentMilestoneAlertInput[] = rawMilestones.map((m) => {
    const proj = m.projects as unknown as { code?: string; name?: string } | null;
    return {
      id: m.id,
      label: m.label,
      project_id: m.project_id,
      project_code: proj?.code || "Unknown",
      project_name: proj?.name || "Unknown",
      expected_date: m.expected_date,
      amount_excl_gst: m.amount_excl_gst,
      has_active_invoice: activeMilestoneIds.has(m.id),
    };
  });

  // Payables computation (Rule F7)
  const payablesAging = computePayablesAging(rawBills, rawPayments, todayStr);

  // Cost overruns and incomplete data check per active project
  const projectsOverBudget: OverviewBlock1Data["projects_over_budget"] = [];
  const projectsIncomplete: OverviewBlock1Data["projects_incomplete"] = [];
  const projectsOverrunForAlerts: CostAlertsInput["projectsOverrun"] = [];

  const commercialMap = new Map(rawCommercials.map((c) => [c.project_id, c]));
  const variationsByProject = new Map<string, Array<{ amount_excl_gst: number; status: string }>>();
  for (const v of rawVariations) {
    const list = variationsByProject.get(v.project_id) || [];
    list.push({ amount_excl_gst: v.amount_excl_gst, status: v.status });
    variationsByProject.set(v.project_id, list);
  }

  const receiptsByProject = new Map<string, number>();
  for (const r of rawReceipts) {
    if (r.project_id) {
      const prev = receiptsByProject.get(r.project_id) || 0;
      receiptsByProject.set(r.project_id, prev + rupeesToPaise(r.amount_received));
    }
  }

  for (const p of projects) {
    const comm = commercialMap.get(p.id);
    const hasExplicitContractValue = !!comm;
    const baseContractPaise = rupeesToPaise(comm?.contract_value_excl_gst || 0);
    const projVars = (variationsByProject.get(p.id) || []).map((v) => ({
      id: "",
      amount_excl_gst: v.amount_excl_gst,
      status: v.status as "proposed" | "approved" | "rejected",
    }));
    const revisedContractValuePaise = computeRevisedContractValuePaise(
      baseContractPaise,
      projVars
    );

    const projBudgets = rawBudgets.filter((b) => b.project_id === p.id);
    const projOrders = rawOrders.filter((o) => o.project_id === p.id);
    const projBills = rawBills.filter((b) => b.project_id === p.id);
    const projReceiptsPaise = receiptsByProject.get(p.id) || 0;

    const costSummary = computeProjectCostSummary(
      p.id,
      rawCategories,
      projBudgets,
      projOrders,
      projBills,
      rawPayments,
      projReceiptsPaise,
      revisedContractValuePaise,
      hasExplicitContractValue
    );

    if (costSummary.isIncomplete) {
      projectsIncomplete.push({
        id: p.id,
        code: p.code,
        name: p.name,
        reason: costSummary.incompleteReason || "Missing financial data",
      });
    }

    if (costSummary.isOverBudget) {
      projectsOverBudget.push({
        id: p.id,
        code: p.code,
        name: p.name,
        budget_paise: costSummary.budgetPaise,
        forecast_cost_paise: costSummary.forecastCostPaise,
        overrun_paise: costSummary.totalOverrunPaise,
      });

      projectsOverrunForAlerts.push({
        project_id: p.id,
        project_code: p.code,
        project_name: p.name,
        budget_paise: costSummary.budgetPaise,
        forecast_cost_paise: costSummary.forecastCostPaise,
        overrun_paise: costSummary.totalOverrunPaise,
      });
    }
  }

  // Cost Alert Inputs
  let lateOrdersCount = 0;
  const costAlertInputs: CostAlertsInput = {
    vendorOrders: rawOrders.map((ord) => {
      const proj = (ord as unknown as Record<string, unknown>).projects as { code?: string; name?: string } | null;
      const lateCheck = isVendorOrderLate(ord, todayStr);
      if (lateCheck.isTrouble) {
        lateOrdersCount++;
      }
      return {
        id: ord.id,
        project_id: ord.project_id,
        project_code: proj?.code || "Unknown",
        project_name: proj?.name || "Unknown",
        vendor_name: ord.vendor_name,
        description: ord.description || "Vendor Order",
        expected_delivery_date: ord.expected_delivery_date,
        fulfilment_status: ord.fulfilment_status,
      };
    }),
    bills: rawBills.map((b) => {
      const proj = (b as unknown as Record<string, unknown>).projects as { code?: string; name?: string } | null;
      const calc = computeBillCalculation(b, rawPayments, todayStr);
      return {
        id: b.id,
        project_id: b.project_id,
        project_code: proj?.code || "Unknown",
        project_name: proj?.name || "Unknown",
        vendor_name: b.vendor_name,
        bill_number: b.bill_number,
        due_date: b.due_date,
        outstanding_paise: calc.outstandingPaise,
        is_cancelled: b.is_cancelled,
      };
    }),
    projectsOverrun: projectsOverrunForAlerts,
  };

  // Rule F11 & F12 Cash Flow Computation for Overview
  const typedInvoices = rawInvoices as unknown as Array<{
    id: string;
    invoice_number?: string;
    amount_excl_gst: number | string;
    gst_amount: number | string;
    is_cancelled: boolean;
    due_date: string;
    payment_milestone_id: string | null;
    projects?: { code?: string } | null;
  }>;

  const typedReceipts = rawReceipts as unknown as Array<{
    invoice_id: string | null;
    amount_received: number | string;
    tds_amount: number | string | null;
  }>;

  const typedMilestones = rawMilestones as unknown as Array<{
    id: string;
    label: string;
    amount_excl_gst: number | string;
    expected_date: string;
    status: "pending" | "done";
    projects?: { code?: string } | null;
  }>;

  const typedBills = rawBills as unknown as Array<{
    id: string;
    vendor_order_id?: string | null;
    bill_number?: string;
    vendor_name?: string;
    amount_excl_gst: number | string;
    gst_amount: number | string;
    due_date: string;
    is_cancelled: boolean;
    projects?: { code?: string } | null;
  }>;

  const typedPayments = rawPayments as unknown as Array<{
    bill_id: string;
    amount_paid: number | string;
    tds_amount: number | string | null;
  }>;

  const typedOrders = rawOrders as unknown as Array<{
    id: string;
    order_number?: string;
    vendor_name?: string;
    amount_excl_gst: number | string;
    expected_delivery_date: string | null;
    fulfilment_status: string;
    projects?: { code?: string } | null;
  }>;

  const cashInvoices: CashInvoiceItem[] = typedInvoices.map((inv) => {
    const amountInclGst = Number(inv.amount_excl_gst || 0) + Number(inv.gst_amount || 0);
    const invoiceReceipts = typedReceipts.filter((r) => r.invoice_id === inv.id);
    const totalReceived = invoiceReceipts.reduce(
      (sum, r) => sum + Number(r.amount_received || 0) + Number(r.tds_amount || 0),
      0
    );
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

  const invoicedMilestoneIds = new Set(
    typedInvoices
      .filter((inv) => !inv.is_cancelled && inv.payment_milestone_id)
      .map((inv) => inv.payment_milestone_id)
  );

  const cashMilestones: CashMilestoneItem[] = typedMilestones.map((ms) => ({
    id: ms.id,
    label: ms.label,
    amount_excl_gst: Number(ms.amount_excl_gst || 0),
    is_invoiced: invoicedMilestoneIds.has(ms.id),
    status: ms.status,
    expected_date: ms.expected_date,
    project_code: ms.projects?.code,
  }));

  const cashBills: CashBillItem[] = typedBills.map((b) => {
    const amountInclGst = Number(b.amount_excl_gst || 0) + Number(b.gst_amount || 0);
    const billPayments = typedPayments.filter((p) => p.bill_id === b.id);
    const totalPaid = billPayments.reduce(
      (sum, p) => sum + Number(p.amount_paid || 0) + Number(p.tds_amount || 0),
      0
    );
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

  const committedOrders: CommittedOrderInput[] = typedOrders.map((o) => {
    const orderBills = typedBills.filter((b) => b.vendor_order_id === o.id && !b.is_cancelled);
    const billedAmount = orderBills.reduce((sum, b) => sum + Number(b.amount_excl_gst || 0), 0);
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

  const cashOnHandResult = computeCashOnHand(rawBankBalances, todayStr);
  const projectionResult = computeCashProjection({
    bank_balances: rawBankBalances,
    invoices: cashInvoices,
    payment_milestones: cashMilestones,
    bills: cashBills,
    company_cash_items: rawCompanyCashItems,
    committed_orders: committedOrders,
    currentDate: todayStr,
  });

  const cashOverviewBlock: CashOverviewBlockData = {
    cash_on_hand_paise: cashOnHandResult.total_cash_on_hand_paise,
    as_of_date: cashOnHandResult.as_of_date,
    is_stale: cashOnHandResult.is_stale,
    stale_warning: cashOnHandResult.stale_warning,
    projected_30d_cash_paise: projectionResult.buckets.days_8_to_30.running_balance_paise,
    has_projected_shortfall: projectionResult.has_projected_shortfall,
    shortfall_bucket: projectionResult.shortfall_bucket,
    shortfall_amount_paise: projectionResult.shortfall_amount_paise,
    shortfall_message: projectionResult.shortfall_message,
    mandatory_label: projectionResult.mandatory_label,
  };

  const cashflowAlertInputs: CashFlowAlertsInput = {
    has_projected_shortfall: projectionResult.has_projected_shortfall,
    shortfall_bucket: projectionResult.shortfall_bucket,
    shortfall_amount_paise: projectionResult.shortfall_amount_paise,
    shortfall_message: projectionResult.shortfall_message,
    is_stale: cashOnHandResult.is_stale,
    stale_warning: cashOnHandResult.stale_warning,
    as_of_date: cashOnHandResult.as_of_date,
  };

  // Sales Alerts Inputs (Rule S10 & S11) and Sales Tracker (Rules S6-S10)
  const rawEnquiries = enquiriesRes.data || [];
  const rawQuotations = quotationsRes.data || [];

  const mappedSalesEnquiries = rawEnquiries.map((e: any) =>
    mapEnquiryRecordToTrackerInput({
      id: e.id,
      title: e.title,
      customer_id: e.customer_id || "",
      status: e.status,
      expected_value_excl_gst: e.expected_value_excl_gst,
      source_id: e.source_id,
      assigned_to: e.assigned_to,
      next_followup_date: e.next_followup_date,
      lost_reason_id: e.lost_reason_id,
      lost_note: e.lost_note,
      lost_at: e.lost_at,
      won_at: e.won_at,
      created_at: e.created_at,
      project_id: e.project_id,
      customer: e.customer,
      source: e.source,
      lost_reason: e.lost_reason,
      assigned_person: e.assigned_person,
      project: e.project,
      followups: e.followups,
      quotations: e.quotations,
    })
  );

  const thisMonthRange = getPeriodDateRange("this_month", now);
  const salesThisMonth = computeSalesTrackerMetrics(mappedSalesEnquiries, thisMonthRange, todayStr);

  const salesAlertInputs: SalesAlertsInput = {
    enquiries: rawEnquiries.map((e: Record<string, unknown>) => ({
      id: e.id as string,
      title: e.title as string,
      status: e.status as string,
      next_followup_date: e.next_followup_date as string | null,
      customer_name: (e.customer as { name?: string } | null)?.name || (e.customers as { name?: string } | null)?.name || null,
      assigned_name: (e.assigned_person as { full_name?: string } | null)?.full_name || (e.profiles as { full_name?: string } | null)?.full_name || null,
    })),
    quotations: rawQuotations.map((q: Record<string, unknown>) => ({
      id: q.id as string,
      quote_number: q.quote_number as string,
      status: q.status as string,
      validity_date: q.validity_date as string | null,
      enquiry_id: q.enquiry_id as string,
      enquiry_title: (q.enquiries as { title?: string } | null)?.title || null,
    })),
  };

  // Compute live alerts across P1, P2 Billing, P2 Costs, P2 Cash Flow, and P3 Sales
  const alerts = computeLiveAlerts(
    {
      projects: projectAlertInputs,
      tasks: taskAlertInputs,
      drawings: drawingAlertInputs,
    },
    {
      invoices: invoiceAlertInputs,
      milestones: milestoneAlertInputs,
    },
    costAlertInputs,
    cashflowAlertInputs,
    now,
    salesAlertInputs
  );

  // Build active projects table
  let delayedProjectsCount = 0;

  const activeProjectsRows: ActiveProjectRow[] = projects.map((p) => {
    const stageObj = p.stages as unknown as { id: string; position: number; name: string } | null;
    const milestones = p.milestones || [];

    const milestonesForRule: ProjectMilestoneItem[] = milestones.map((m) => ({
      id: m.id,
      title: m.title,
      plannedDate: m.planned_date,
      actualDate: m.actual_date,
      status: m.status as ProjectMilestoneItem["status"],
      delayReason: m.delay_reason as ProjectMilestoneItem["delayReason"],
      delayNote: m.delay_note,
    }));

    const delayCheck = isProjectDelayed(
      {
        status: p.status,
        plannedCompletionDate: p.planned_completion_date,
        milestones: milestonesForRule,
      },
      now
    );

    if (delayCheck.isDelayed) {
      delayedProjectsCount++;
    }

    const progressText = formatMilestoneProgress(milestonesForRule);

    const reportDates = (p.site_reports || [])
      .map((sr) => sr.report_date)
      .sort((a, b) => b.localeCompare(a));
    const lastReportDate = reportDates[0] || null;

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      site_location: p.site_location,
      stage_name: stageObj?.name || "Enquiry",
      stage_position: stageObj?.position || 1,
      progress_text: progressText,
      is_delayed: delayCheck.isDelayed,
      delay_reason: delayCheck.reason,
      last_report_date: lastReportDate,
      total_milestones: milestones.length,
      completed_milestones: milestones.filter((m) => m.status === "completed").length,
    };
  });

  const overdueTasksCount = alerts.filter((a) => a.type === "overdue_task").length;
  const blockedTasksCount = alerts.filter((a) => a.type === "blocked_task").length;
  const pendingDrawingsCount = alerts.filter((a) => a.type === "pending_drawing").length;
  const missingReportsCount = alerts.filter((a) => a.type === "missing_site_report").length;

  return {
    metrics: {
      active_projects_count: projects.length,
      delayed_projects_count: delayedProjectsCount,
      overdue_tasks_count: overdueTasksCount,
      blocked_tasks_count: blockedTasksCount,
      pending_drawings_count: pendingDrawingsCount,
      missing_reports_count: missingReportsCount,
      late_orders_count: lateOrdersCount,
      over_budget_projects_count: projectsOverBudget.length,
      incomplete_projects_count: projectsIncomplete.length,
    },
    active_projects: activeProjectsRows,
    receivables: {
      total_receivable_paise: aging.totalOutstandingPaise,
      total_overdue_paise: aging.totalOverduePaise,
      total_advances_paise: advances.totalPaise,
      current_paise: aging.currentPaise,
      bucket1_30_paise: aging.bucket1_30Paise,
      bucket31_60_paise: aging.bucket31_60Paise,
      bucket61_90_paise: aging.bucket61_90Paise,
      bucket_over90_paise: aging.bucketOver90Paise,
      overdue_invoices_count: overdueInvoicesCount,
    },
    payables: {
      total_payable_paise: payablesAging.totalPayablePaise,
      total_overdue_paise: payablesAging.totalOverduePaise,
      current_paise: payablesAging.currentPaise,
      bucket1_30_paise: payablesAging.bucket1_30Paise,
      bucket31_60_paise: payablesAging.bucket31_60Paise,
      bucket61_90_paise: payablesAging.bucket61_90Paise,
      bucket_over90_paise: payablesAging.bucketOver90Paise,
      overdue_bills_count: payablesAging.overdueBillsCount,
      due_within_7days_paise: payablesAging.dueWithin7DaysPaise,
      due_within_30days_paise: payablesAging.dueWithin30DaysPaise,
    },
    cash: cashOverviewBlock,
    sales_this_month: salesThisMonth,
    projects_over_budget: projectsOverBudget,
    projects_incomplete: projectsIncomplete,
    alerts,
  };
}
