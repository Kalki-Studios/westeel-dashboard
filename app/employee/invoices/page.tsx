import { Suspense } from "react";
import { getCollectionsOverviewData, getExportBillingData } from "@/lib/billing/queries";
import { AccountsInvoicesClient } from "./invoices-client";
import { createEmployeePortalClient } from "@/lib/supabase/server-employee";
import { connection } from "next/server";
import { computeInvoiceCalculation, getTodayISTString } from "@/lib/rules/billing";
import { Loader2 } from "lucide-react";

async function AccountsInvoicesPageContent() {
  await connection();
  const supabase = await createEmployeePortalClient();
  const todayStr = getTodayISTString();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [collectionsData, exportData, projectsRes, milestonesRes, invoicesRes, receiptsRes] =
    await Promise.all([
      getCollectionsOverviewData(),
      getExportBillingData(),
      supabase
        .from("projects")
        .select("id, code, name")
        .eq("is_archived", false)
        .order("code"),
      supabase
        .from("payment_milestones")
        .select("id, project_id, label, amount_excl_gst, expected_date")
        .order("expected_date", { ascending: true }),
      supabase
        .from("invoices")
        .select("id, invoice_number, project_id, amount_excl_gst, gst_amount, is_cancelled, invoice_date, due_date, projects(id, code, name)")
        .order("invoice_date", { ascending: false }),
      supabase
        .from("receipts")
        .select("id, invoice_id, amount_received, tds_amount, receipt_date"),
    ]);

  const activeProjects = projectsRes.data || [];
  const milestones = milestonesRes.data || [];
  const rawInvoices = invoicesRes.data || [];
  const rawReceipts = receiptsRes.data || [];

  const receiptInputs = rawReceipts.map((r) => {
    const rawR = r as { id: string; invoice_id?: string | null; amount_received: number; tds_amount?: number | null; receipt_date: string };
    return {
      id: rawR.id,
      invoice_id: rawR.invoice_id,
      amount_received: rawR.amount_received,
      tds_amount: rawR.tds_amount,
      receipt_date: rawR.receipt_date,
    };
  });

  const invoiceList = rawInvoices.map((inv) => {
    const rawInv = inv as {
      id: string;
      project_id: string;
      invoice_number: string;
      amount_excl_gst: number;
      gst_amount: number;
      is_cancelled: boolean;
      invoice_date: string;
      due_date: string;
      projects?: { code?: string; name?: string } | null;
    };
    const calc = computeInvoiceCalculation(
      {
        id: rawInv.id,
        invoice_number: rawInv.invoice_number,
        amount_excl_gst: rawInv.amount_excl_gst,
        gst_amount: rawInv.gst_amount,
        is_cancelled: rawInv.is_cancelled,
        due_date: rawInv.due_date,
      },
      receiptInputs,
      todayStr
    );

    const proj = rawInv.projects;

    return {
      id: inv.id,
      project_id: inv.project_id,
      project_code: proj?.code || "Unknown",
      project_name: proj?.name || "Unknown",
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      amount_excl_gst: inv.amount_excl_gst,
      gst_amount: inv.gst_amount,
      is_cancelled: inv.is_cancelled,
      total_paise: calc.totalPaise,
      settled_paise: calc.settledPaise,
      outstanding_paise: calc.outstandingPaise,
      is_overdue: calc.isOverdue,
      days_overdue: calc.daysOverdue,
    };
  });

  return (
    <AccountsInvoicesClient
      data={collectionsData}
      activeProjects={activeProjects}
      milestones={milestones}
      invoices={invoiceList}
      exportRows={exportData}
    />
  );
}

export default function AccountsInvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading customer billing, invoices, and collections...</span>
        </div>
      }
    >
      <AccountsInvoicesPageContent />
    </Suspense>
  );
}
