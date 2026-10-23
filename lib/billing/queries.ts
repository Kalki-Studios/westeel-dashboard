import { createClient } from "@/lib/supabase/server";
import {
  ProjectBillingData,
  CollectionsOverviewData,
  CollectionsProjectSummary,
  InvoiceItem,
  ReceiptItem,
  BillingExportData,
} from "./types";
import {
  computeRevisedContractValuePaise,
  computeInvoiceCalculation,
  getUnallocatedAdvances,
  computeReceivablesAging,
  checkBillingScheduleCompleteness,
  getTodayISTString,
} from "../rules/billing";
import { rupeesToPaise, paiseToRupees } from "../money";

/**
 * Fetches all commercial, variation, milestone, invoice, and receipt data for a project,
 * and live-computes financial metrics per Rules F1 to F5.
 */
export async function getProjectBillingData(
  projectId: string
): Promise<ProjectBillingData | null> {
  const supabase = await createClient();

  // 1. Fetch project header
  const { data: project, error: projError } = await supabase
    .from("projects")
    .select("id, code, name")
    .eq("id", projectId)
    .single();

  if (projError || !project) {
    console.error("Error fetching project for billing:", projError);
    return null;
  }

  // 2. Fetch commercials (contract value)
  const { data: commercialData } = await supabase
    .from("project_commercials")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  // 3. Fetch variation orders
  const { data: variationsData } = await supabase
    .from("variation_orders")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  const variations = variationsData || [];

  // 4. Fetch payment milestones (billing schedule)
  const { data: milestonesData } = await supabase
    .from("payment_milestones")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .order("expected_date", { ascending: true });

  const milestones = milestonesData || [];

  // 5. Fetch invoices with linked milestone and documents
  const { data: invoicesData } = await supabase
    .from("invoices")
    .select(`
      *,
      payment_milestones:payment_milestone_id (
        id,
        label
      ),
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
    .order("invoice_date", { ascending: false });

  const invoices: InvoiceItem[] = (invoicesData || []).map((inv) => ({
    ...(inv as unknown as InvoiceItem),
    payment_milestone: ((inv as Record<string, unknown>).payment_milestones as { id: string; label: string } | null) || null,
    documents: (((inv as Record<string, unknown>).documents || []) as InvoiceItem["documents"]),
  }));

  // 6. Fetch receipts with joined invoice
  const { data: receiptsData } = await supabase
    .from("receipts")
    .select(`
      *,
      invoices:invoice_id (
        id,
        invoice_number
      )
    `)
    .eq("project_id", projectId)
    .order("receipt_date", { ascending: false });

  const receipts: ReceiptItem[] = (receiptsData || []).map((rec) => ({
    ...(rec as unknown as ReceiptItem),
    invoice: ((rec as Record<string, unknown>).invoices as { id: string; invoice_number: string } | null) || null,
  }));

  // Live Rule Computations
  const todayStr = getTodayISTString();

  // F1: Revised Contract Value
  const baseContractValue = commercialData?.contract_value_excl_gst ?? 0;
  const revisedContractValuePaise = computeRevisedContractValuePaise(
    baseContractValue,
    variations.map((v) => ({
      id: v.id,
      amount_excl_gst: v.amount_excl_gst,
      status: v.status,
    }))
  );

  // F5: Milestone Completeness
  const completeness = checkBillingScheduleCompleteness(
    revisedContractValuePaise,
    milestones.map((m) => ({
      id: m.id,
      label: m.label,
      amount_excl_gst: m.amount_excl_gst,
      expected_date: m.expected_date,
      position: m.position,
    }))
  );

  // F3: Unallocated Advances
  const advances = getUnallocatedAdvances(
    receipts.map((r) => ({
      id: r.id,
      invoice_id: r.invoice_id,
      amount_received: r.amount_received,
      receipt_date: r.receipt_date,
    }))
  );

  // F2 & F4: Invoices summary
  let totalInvoicedPaise = 0;
  let totalSettledPaise = 0;
  let totalOutstandingPaise = 0;
  let totalOverduePaise = 0;

  for (const inv of invoices) {
    if (inv.is_cancelled) continue;
    const calc = computeInvoiceCalculation(
      {
        id: inv.id,
        invoice_number: inv.invoice_number,
        amount_excl_gst: inv.amount_excl_gst,
        gst_amount: inv.gst_amount,
        is_cancelled: inv.is_cancelled,
        due_date: inv.due_date,
      },
      receipts.map((r) => ({
        id: r.id,
        invoice_id: r.invoice_id,
        amount_received: r.amount_received,
        tds_amount: r.tds_amount,
        receipt_date: r.receipt_date,
      })),
      todayStr
    );

    totalInvoicedPaise += calc.totalPaise;
    totalSettledPaise += calc.settledPaise;
    totalOutstandingPaise += calc.outstandingPaise;
    if (calc.isOverdue) {
      totalOverduePaise += calc.outstandingPaise;
    }
  }

  return {
    projectId: project.id,
    projectCode: project.code,
    projectName: project.name,
    customerName: null,
    commercials: commercialData || null,
    variations,
    milestones,
    invoices,
    receipts,
    revisedContractValuePaise,
    isCompletenessMatch: completeness.isMatch,
    completenessDifferencePaise: completeness.differencePaise,
    completenessMessage: completeness.message,
    unallocatedAdvancesPaise: advances.totalPaise,
    totalInvoicedPaise,
    totalSettledPaise,
    totalOutstandingPaise,
    totalOverduePaise,
  };
}

/**
 * Fetches company-wide collections data for the Collections Page and Overview Block 2.
 */
export async function getCollectionsOverviewData(): Promise<CollectionsOverviewData> {
  const supabase = await createClient();
  const todayStr = getTodayISTString();

  // 1. Fetch active projects
  const { data: projectsData } = await supabase
    .from("projects")
    .select("id, code, name")
    .eq("is_archived", false)
    .order("code");

  const projects = projectsData || [];
  const projectMap = new Map<string, { code: string; name: string }>();
  for (const p of projects) {
    projectMap.set(p.id, { code: p.code, name: p.name });
  }

  // 2. Fetch all invoices
  const { data: invoicesData } = await supabase
    .from("invoices")
    .select("*")
    .order("due_date", { ascending: true });

  const invoices = invoicesData || [];

  // 3. Fetch all receipts
  const { data: receiptsData } = await supabase
    .from("receipts")
    .select("*")
    .order("receipt_date", { ascending: false });

  const receipts = receiptsData || [];

  // Receipts input array
  const receiptInputs = receipts.map((r) => ({
    id: r.id,
    invoice_id: r.invoice_id,
    amount_received: r.amount_received,
    tds_amount: r.tds_amount,
    receipt_date: r.receipt_date,
    project_id: r.project_id,
  }));

  // F4 Aging buckets for all invoices
  const aging = computeReceivablesAging(
    invoices.map((inv) => ({
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

  // F3 Unallocated advances across all projects
  const advances = getUnallocatedAdvances(receiptInputs);
  const unallocatedAdvancesList = advances.advances.map((adv) => {
    const proj = projectMap.get(adv.project_id || "");
    const orig = receipts.find((r) => r.id === adv.id);
    return {
      receiptId: adv.id,
      projectId: adv.project_id || "",
      projectCode: proj?.code || "GEN",
      projectName: proj?.name || "General Advance",
      receiptDate: adv.receipt_date,
      amountReceivedPaise: rupeesToPaise(adv.amount_received),
      mode: orig?.mode || "bank_transfer",
      reference: orig?.reference || null,
    };
  });

  // Overdue Invoices List
  const overdueInvoices: CollectionsOverviewData["overdueInvoices"] = [];

  // Project summaries map
  const projectSummaries = new Map<string, CollectionsProjectSummary>();
  for (const p of projects) {
    projectSummaries.set(p.id, {
      projectId: p.id,
      projectCode: p.code,
      projectName: p.name,
      customerName: "Client",
      totalInvoicedPaise: 0,
      totalSettledPaise: 0,
      totalOutstandingPaise: 0,
      totalOverduePaise: 0,
      unallocatedAdvancesPaise: 0,
      invoicesCount: 0,
      overdueInvoicesCount: 0,
    });
  }

  // Aggregate project unallocated advances
  for (const adv of unallocatedAdvancesList) {
    const pSum = projectSummaries.get(adv.projectId);
    if (pSum) {
      pSum.unallocatedAdvancesPaise += adv.amountReceivedPaise;
    }
  }

  // Process all invoices
  for (const inv of invoices) {
    if (inv.is_cancelled) continue;

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

    const proj = projectMap.get(inv.project_id);
    let pSum = projectSummaries.get(inv.project_id);
    if (!pSum) {
      pSum = {
        projectId: inv.project_id,
        projectCode: proj?.code || "Unknown",
        projectName: proj?.name || "Unknown",
        customerName: "Client",
        totalInvoicedPaise: 0,
        totalSettledPaise: 0,
        totalOutstandingPaise: 0,
        totalOverduePaise: 0,
        unallocatedAdvancesPaise: 0,
        invoicesCount: 0,
        overdueInvoicesCount: 0,
      };
      projectSummaries.set(inv.project_id, pSum);
    }

    pSum.invoicesCount++;
    pSum.totalInvoicedPaise += calc.totalPaise;
    pSum.totalSettledPaise += calc.settledPaise;
    pSum.totalOutstandingPaise += calc.outstandingPaise;

    if (calc.isOverdue && calc.outstandingPaise > 0) {
      pSum.overdueInvoicesCount++;
      pSum.totalOverduePaise += calc.outstandingPaise;

      overdueInvoices.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        projectId: inv.project_id,
        projectCode: proj?.code || "",
        projectName: proj?.name || "",
        customerName: "Client",
        invoiceDate: inv.invoice_date,
        dueDate: inv.due_date,
        daysOverdue: calc.daysOverdue,
        totalPaise: calc.totalPaise,
        settledPaise: calc.settledPaise,
        outstandingPaise: calc.outstandingPaise,
      });
    }
  }

  // Sort overdue invoices by days overdue descending
  overdueInvoices.sort((a, b) => b.daysOverdue - a.daysOverdue);

  const projectsList = Array.from(projectSummaries.values()).filter(
    (p) => p.totalInvoicedPaise > 0 || p.unallocatedAdvancesPaise > 0
  );

  return {
    metrics: {
      totalReceivablePaise: aging.totalOutstandingPaise,
      totalOverduePaise: aging.totalOverduePaise,
      totalAdvancesPaise: advances.totalPaise,
      currentPaise: aging.currentPaise,
      bucket1_30Paise: aging.bucket1_30Paise,
      bucket31_60Paise: aging.bucket31_60Paise,
      bucket61_90Paise: aging.bucket61_90Paise,
      bucketOver90Paise: aging.bucketOver90Paise,
    },
    projects: projectsList,
    overdueInvoices,
    unallocatedAdvances: unallocatedAdvancesList,
  };
}

/**
 * Returns raw rows for CSV export of Invoices and Receipts.
 */
export async function getExportBillingData(): Promise<BillingExportData> {
  const supabase = await createClient();
  const todayStr = getTodayISTString();

  const [invoicesRes, receiptsRes, projectsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, payment_milestones:payment_milestone_id(label)")
      .order("invoice_date", { ascending: false }),
    supabase
      .from("receipts")
      .select("*, invoices:invoice_id(invoice_number)")
      .order("receipt_date", { ascending: false }),
    supabase.from("projects").select("id, code, name"),
  ]);

  const projects = projectsRes.data || [];
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const receipts = receiptsRes.data || [];
  const receiptInputs = receipts.map((r) => ({
    id: r.id,
    invoice_id: r.invoice_id,
    amount_received: r.amount_received,
    tds_amount: r.tds_amount,
    receipt_date: r.receipt_date,
  }));

  const invoiceRows = (invoicesRes.data || []).map((inv) => {
    const rawInv = inv as Record<string, unknown>;
    const milestoneObj = rawInv.payment_milestones as { label?: string } | null;
    const proj = projectMap.get(String(rawInv.project_id));
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

    return {
      invoice_number: inv.invoice_number,
      project_code: proj?.code || "",
      project_name: proj?.name || "",
      milestone: milestoneObj?.label || "",
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      amount_excl_gst: paiseToRupees(calc.exGstPaise).toFixed(2),
      gst_amount: paiseToRupees(calc.gstPaise).toFixed(2),
      total_amount: paiseToRupees(calc.totalPaise).toFixed(2),
      settled_amount: paiseToRupees(calc.settledPaise).toFixed(2),
      outstanding_amount: paiseToRupees(calc.outstandingPaise).toFixed(2),
      status: inv.is_cancelled
        ? "CANCELLED"
        : calc.outstandingPaise === 0
        ? "SETTLED"
        : calc.isOverdue
        ? `OVERDUE (${calc.daysOverdue}d)`
        : "CURRENT",
      note: inv.note || "",
    };
  });

  const receiptRows = receipts.map((rec) => {
    const rawRec = rec as Record<string, unknown>;
    const invObj = rawRec.invoices as { invoice_number?: string } | null;
    const proj = projectMap.get(String(rawRec.project_id));
    const totalPaise = rupeesToPaise(Number(rawRec.amount_received)) + rupeesToPaise(Number(rawRec.tds_amount || 0));

    return {
      receipt_date: rec.receipt_date,
      project_code: proj?.code || "",
      project_name: proj?.name || "",
      invoice_number: invObj?.invoice_number || "ADVANCE (Unallocated)",
      amount_received: Number(rec.amount_received).toFixed(2),
      tds_amount: Number(rec.tds_amount || 0).toFixed(2),
      total_settlement: paiseToRupees(totalPaise).toFixed(2),
      mode: rec.mode,
      reference: rec.reference || "",
      note: rec.note || "",
    };
  });

  return { invoiceRows, receiptRows };
}
