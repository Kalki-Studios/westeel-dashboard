import { createClient } from "@/lib/supabase/server";
import {
  CostCategory,
  BudgetLine,
  VendorOrderItem,
  BillItem,
  BillPaymentItem,
  ProjectCostsData,
  PayablesOverviewData,
  PayablesProjectSummary,
  BillsExportData,
  CostSummaryExportRow,
} from "./types";
import {
  computeBillCalculation,
  computeProjectCostSummary,
  computePayablesAging,
  isVendorOrderLate,
  getTodayISTString,
} from "../rules/costs";
import { computeRevisedContractValuePaise } from "../rules/billing";
import { rupeesToPaise, paiseToRupees } from "../money";
import { parseISO, differenceInDays } from "date-fns";

/**
 * Returns list of all cost categories (ordered by active first, then name).
 */
export async function getCostCategories(): Promise<CostCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cost_categories")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching cost categories:", error);
    return [];
  }
  return data || [];
}

/**
 * Fetches all budget, order, bill, payment, and commercial data for a project,
 * computing Rule F6 cost states, Rule F8 forecast, Rule F9 profit/margin, and Rule F10 overruns.
 */
export async function getProjectCostData(
  projectId: string
): Promise<ProjectCostsData | null> {
  const supabase = await createClient();

  // 1. Fetch project header
  const { data: project, error: projError } = await supabase
    .from("projects")
    .select("id, code, name")
    .eq("id", projectId)
    .single();

  if (projError || !project) {
    console.error("Error fetching project for costs:", projError);
    return null;
  }

  // 2. Fetch all cost categories
  const categories = await getCostCategories();

  // 3. Fetch project commercials & variations for Rule F1 revised contract value
  const [commRes, varRes, budgetRes, ordersRes, billsRes, paymentsRes, receiptsRes] =
    await Promise.all([
      supabase
        .from("project_commercials")
        .select("contract_value_excl_gst")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("variation_orders")
        .select("amount_excl_gst, status")
        .eq("project_id", projectId),
      supabase
        .from("budget_lines")
        .select("*, cost_categories:category_id (id, name)")
        .eq("project_id", projectId),
      supabase
        .from("vendor_orders")
        .select(`
          *,
          cost_categories:category_id (id, name),
          profiles:created_by (full_name),
          documents:documents (
            id,
            title,
            storage_path,
            mime_type,
            size_bytes,
            created_at
          )
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("bills")
        .select(`
          *,
          cost_categories:category_id (id, name),
          vendor_orders:vendor_order_id (id, description, amount_excl_gst),
          documents:documents (
            id,
            title,
            storage_path,
            mime_type,
            size_bytes,
            created_at
          )
        `)
        .eq("project_id", projectId)
        .order("bill_date", { ascending: false }),
      supabase
        .from("bill_payments")
        .select("*")
        .order("payment_date", { ascending: false }),
      supabase
        .from("receipts")
        .select("amount_received")
        .eq("project_id", projectId),
    ]);

  const hasExplicitContractValue = !!commRes.data;
  const baseContractPaise = rupeesToPaise(commRes.data?.contract_value_excl_gst || 0);
  const variationInputs = (varRes.data || []).map((v) => ({
    id: "",
    amount_excl_gst: v.amount_excl_gst,
    status: v.status as "proposed" | "approved" | "rejected",
  }));
  const revisedContractValuePaise = computeRevisedContractValuePaise(
    baseContractPaise,
    variationInputs
  );

  let receiptsCollectedPaise = 0;
  for (const r of receiptsRes.data || []) {
    receiptsCollectedPaise += rupeesToPaise(r.amount_received);
  }

  const budgetLines = (budgetRes.data || []) as BudgetLine[];
  const orders = (ordersRes.data || []) as unknown as VendorOrderItem[];
  const bills = (billsRes.data || []) as unknown as BillItem[];
  const payments = (paymentsRes.data || []) as BillPaymentItem[];

  // Filter payments to bills belonging to this project
  const projectBillIds = new Set(bills.map((b) => b.id));
  const projectPayments = payments.filter((p) => projectBillIds.has(p.bill_id));

  const summary = computeProjectCostSummary(
    projectId,
    categories,
    budgetLines,
    orders,
    bills,
    projectPayments,
    receiptsCollectedPaise,
    revisedContractValuePaise,
    hasExplicitContractValue
  );

  return {
    projectId: project.id,
    projectCode: project.code,
    projectName: project.name,
    categories,
    budgetLines,
    orders,
    bills,
    payments: projectPayments,
    summary,
  };
}

/**
 * Returns company-wide Payables overview including aging buckets, overdue bills,
 * upcoming bills (7/30 days), and recent payments.
 */
export async function getPayablesOverviewData(): Promise<PayablesOverviewData> {
  const supabase = await createClient();
  const todayStr = getTodayISTString();
  const todayDate = parseISO(todayStr);

  const [billsRes, paymentsRes, projectsRes] = await Promise.all([
    supabase
      .from("bills")
      .select("*, projects:project_id(id, code, name), cost_categories:category_id(name)")
      .order("bill_date", { ascending: false }),
    supabase
      .from("bill_payments")
      .select("*, bills:bill_id(bill_number, vendor_name, project_id, projects(code, name))")
      .order("payment_date", { ascending: false })
      .limit(50),
    supabase
      .from("projects")
      .select("id, code, name")
      .eq("is_archived", false)
      .order("code"),
  ]);

  const rawBills = billsRes.data || [];
  const rawPayments = paymentsRes.data || [];
  const activeProjects = projectsRes.data || [];

  const billInputs = rawBills.map((b) => ({
    id: b.id,
    project_id: b.project_id,
    category_id: b.category_id,
    vendor_order_id: b.vendor_order_id,
    bill_type: b.bill_type,
    vendor_name: b.vendor_name,
    bill_number: b.bill_number,
    bill_date: b.bill_date,
    due_date: b.due_date,
    amount_excl_gst: b.amount_excl_gst,
    gst_amount: b.gst_amount,
    is_cancelled: b.is_cancelled,
    note: b.note,
  }));

  const paymentInputs = rawPayments.map((p) => ({
    id: p.id,
    bill_id: p.bill_id,
    payment_date: p.payment_date,
    amount_paid: p.amount_paid,
    tds_amount: p.tds_amount,
    mode: p.mode,
    reference: p.reference,
    note: p.note,
  }));

  const metrics = computePayablesAging(billInputs, paymentInputs, todayStr);

  // Group by project
  const projectMap = new Map<
    string,
    {
      projectId: string;
      projectCode: string;
      projectName: string;
      totalBilledPaise: number;
      totalSettledPaise: number;
      totalOutstandingPaise: number;
      totalOverduePaise: number;
      billsCount: number;
      overdueBillsCount: number;
    }
  >();

  for (const p of activeProjects) {
    projectMap.set(p.id, {
      projectId: p.id,
      projectCode: p.code,
      projectName: p.name,
      totalBilledPaise: 0,
      totalSettledPaise: 0,
      totalOutstandingPaise: 0,
      totalOverduePaise: 0,
      billsCount: 0,
      overdueBillsCount: 0,
    });
  }

  const overdueBills: PayablesOverviewData["overdueBills"] = [];
  const upcomingBills: PayablesOverviewData["upcomingBills"] = [];

  for (const b of rawBills) {
    if (b.is_cancelled) continue;

    const calc = computeBillCalculation(
      {
        id: b.id,
        project_id: b.project_id,
        category_id: b.category_id,
        vendor_name: b.vendor_name,
        bill_number: b.bill_number,
        bill_date: b.bill_date,
        due_date: b.due_date,
        amount_excl_gst: b.amount_excl_gst,
        gst_amount: b.gst_amount,
        is_cancelled: b.is_cancelled,
      },
      paymentInputs,
      todayStr
    );

    const projInfo = b.projects as { id?: string; code?: string; name?: string } | null;
    const projectCode = projInfo?.code || "";
    const projectName = projInfo?.name || "";

    const projSummary = projectMap.get(b.project_id);
    if (projSummary) {
      projSummary.totalBilledPaise += calc.totalPaise;
      projSummary.totalSettledPaise += calc.settledPaise;
      projSummary.totalOutstandingPaise += calc.outstandingPaise;
      projSummary.billsCount += 1;

      if (calc.isOverdue) {
        projSummary.totalOverduePaise += calc.outstandingPaise;
        projSummary.overdueBillsCount += 1;
      }
    }

    if (calc.outstandingPaise > 0) {
      if (calc.isOverdue) {
        overdueBills.push({
          billId: b.id,
          billNumber: b.bill_number,
          projectId: b.project_id,
          projectCode,
          projectName,
          vendorName: b.vendor_name,
          billDate: b.bill_date,
          dueDate: b.due_date,
          daysOverdue: calc.daysOverdue,
          totalPaise: calc.totalPaise,
          settledPaise: calc.settledPaise,
          outstandingPaise: calc.outstandingPaise,
        });
      } else {
        // Upcoming bills
        try {
          const dueDate = parseISO(b.due_date);
          const daysUntilDue = differenceInDays(dueDate, todayDate);
          upcomingBills.push({
            billId: b.id,
            billNumber: b.bill_number,
            projectId: b.project_id,
            projectCode,
            projectName,
            vendorName: b.vendor_name,
            billDate: b.bill_date,
            dueDate: b.due_date,
            daysUntilDue: Math.max(0, daysUntilDue),
            totalPaise: calc.totalPaise,
            settledPaise: calc.settledPaise,
            outstandingPaise: calc.outstandingPaise,
          });
        } catch {
          // Fallback
        }
      }
    }
  }

  // Sort lists
  overdueBills.sort((a, b) => b.daysOverdue - a.daysOverdue);
  upcomingBills.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const projectsList = Array.from(projectMap.values()).filter(
    (p) => p.billsCount > 0 || p.totalOutstandingPaise > 0
  );

  const recentPayments: PayablesOverviewData["recentPayments"] = rawPayments.map((p) => {
    const rawBill = p.bills as Record<string, unknown> | null;
    const rawProj = rawBill?.projects as Record<string, unknown> | null;
    return {
      paymentId: p.id,
      billId: p.bill_id,
      billNumber: String(rawBill?.bill_number || ""),
      projectId: String(rawBill?.project_id || ""),
      projectCode: String(rawProj?.code || ""),
      projectName: String(rawProj?.name || ""),
      vendorName: String(rawBill?.vendor_name || ""),
      paymentDate: p.payment_date,
      amountPaidPaise: rupeesToPaise(Number(p.amount_paid)),
      tdsAmountPaise: rupeesToPaise(Number(p.tds_amount || 0)),
      mode: p.mode,
      reference: p.reference,
    };
  });

  return {
    metrics,
    projects: projectsList,
    overdueBills,
    upcomingBills,
    recentPayments,
  };
}

/**
 * Returns all Vendor Orders across projects for the Purchase Queue workspace.
 */
export async function getPurchaseQueueData() {
  const supabase = await createClient();
  const todayStr = getTodayISTString();

  const { data, error } = await supabase
    .from("vendor_orders")
    .select(`
      *,
      projects:project_id (id, code, name),
      cost_categories:category_id (id, name),
      profiles:created_by (full_name)
    `)
    .order("expected_delivery_date", { ascending: true });

  if (error) {
    console.error("Error fetching purchase queue:", error);
    return [];
  }

  return (data || []).map((ord) => {
    const rawOrd = ord as Record<string, unknown>;
    const proj = rawOrd.projects as { id?: string; code?: string; name?: string } | null;
    const cat = rawOrd.cost_categories as { id?: string; name?: string } | null;
    const prof = rawOrd.profiles as { full_name?: string } | null;

    const lateInfo = isVendorOrderLate(ord, todayStr);

    return {
      ...ord,
      projectCode: proj?.code || "",
      projectName: proj?.name || "",
      categoryName: cat?.name || "",
      createdByName: prof?.full_name || "",
      isLate: lateInfo.isLate,
      isIssue: lateInfo.isIssue,
      isTrouble: lateInfo.isTrouble,
      daysLate: lateInfo.daysLate,
    };
  });
}

/**
 * Returns raw rows for CSV export of Bills and Payments.
 */
export async function getExportBillsData(): Promise<BillsExportData> {
  const supabase = await createClient();
  const todayStr = getTodayISTString();

  const [billsRes, paymentsRes, projectsRes, categoriesRes] = await Promise.all([
    supabase
      .from("bills")
      .select("*, vendor_orders:vendor_order_id(description)")
      .order("bill_date", { ascending: false }),
    supabase
      .from("bill_payments")
      .select("*, bills:bill_id(bill_number, vendor_name, project_id)")
      .order("payment_date", { ascending: false }),
    supabase.from("projects").select("id, code, name"),
    supabase.from("cost_categories").select("id, name"),
  ]);

  const projects = projectsRes.data || [];
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const categories = categoriesRes.data || [];
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const rawPayments = paymentsRes.data || [];
  const paymentInputs = rawPayments.map((p) => ({
    id: p.id,
    bill_id: p.bill_id,
    payment_date: p.payment_date,
    amount_paid: p.amount_paid,
    tds_amount: p.tds_amount,
    mode: p.mode,
    reference: p.reference,
    note: p.note,
  }));

  const billRows = (billsRes.data || []).map((b) => {
    const rawBill = b as Record<string, unknown>;
    const orderObj = rawBill.vendor_orders as { description?: string } | null;
    const proj = projectMap.get(b.project_id);
    const catName = categoryMap.get(b.category_id) || "Other";

    const calc = computeBillCalculation(
      {
        id: b.id,
        project_id: b.project_id,
        category_id: b.category_id,
        vendor_name: b.vendor_name,
        bill_number: b.bill_number,
        bill_date: b.bill_date,
        due_date: b.due_date,
        amount_excl_gst: b.amount_excl_gst,
        gst_amount: b.gst_amount,
        is_cancelled: b.is_cancelled,
      },
      paymentInputs,
      todayStr
    );

    return {
      bill_number: b.bill_number,
      project_code: proj?.code || "",
      project_name: proj?.name || "",
      category: catName,
      vendor_name: b.vendor_name,
      order_desc: orderObj?.description || "Direct Expense",
      bill_type: b.bill_type,
      bill_date: b.bill_date,
      due_date: b.due_date,
      amount_excl_gst: paiseToRupees(calc.exGstPaise).toFixed(2),
      gst_amount: paiseToRupees(calc.gstPaise).toFixed(2),
      total_amount: paiseToRupees(calc.totalPaise).toFixed(2),
      settled_amount: paiseToRupees(calc.settledPaise).toFixed(2),
      outstanding_amount: paiseToRupees(calc.outstandingPaise).toFixed(2),
      status: b.is_cancelled
        ? "CANCELLED"
        : calc.outstandingPaise === 0
        ? "SETTLED"
        : calc.isOverdue
        ? `OVERDUE (${calc.daysOverdue}d)`
        : "CURRENT",
      note: b.note || "",
    };
  });

  const paymentRows = rawPayments.map((p) => {
    const rawBill = p.bills as Record<string, unknown> | null;
    const proj = projectMap.get(String(rawBill?.project_id || ""));

    return {
      payment_date: p.payment_date,
      project_code: proj?.code || "",
      project_name: proj?.name || "",
      bill_number: String(rawBill?.bill_number || ""),
      vendor_name: String(rawBill?.vendor_name || ""),
      amount_paid: Number(p.amount_paid).toFixed(2),
      tds_amount: Number(p.tds_amount || 0).toFixed(2),
      mode: p.mode,
      reference: p.reference || "",
      note: p.note || "",
    };
  });

  return { billRows, paymentRows };
}

/**
 * Returns raw rows for CSV export of a Project Cost Summary (Profitability tab).
 */
export async function getExportCostSummaryData(
  projectId: string
): Promise<CostSummaryExportRow[]> {
  const data = await getProjectCostData(projectId);
  if (!data) return [];

  return data.summary.categories.map((c) => ({
    category: c.categoryName,
    budget_excl_gst: paiseToRupees(c.budgetPaise).toFixed(2),
    committed_excl_gst: paiseToRupees(c.committedPaise).toFixed(2),
    billed_excl_gst: paiseToRupees(c.billedPaise).toFixed(2),
    paid_cash: paiseToRupees(c.paidPaise).toFixed(2),
    remaining_committed: paiseToRupees(c.remainingCommittedPaise).toFixed(2),
    uncommitted_budget: paiseToRupees(c.uncommittedBudgetPaise).toFixed(2),
    forecast_cost: paiseToRupees(c.forecastCostPaise).toFixed(2),
    status: c.isOverBudget ? "OVER BUDGET" : "ON BUDGET",
    overrun_amount: paiseToRupees(c.overrunPaise).toFixed(2),
  }));
}
