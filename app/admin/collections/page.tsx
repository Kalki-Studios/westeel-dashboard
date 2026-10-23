import { Suspense } from "react";
import { connection } from "next/server";
import { getCollectionsOverviewData, getExportBillingData } from "@/lib/billing/queries";
import { CollectionsClient } from "./collections-client";
import { createClient } from "@/lib/supabase/server";
import { Loader2 } from "lucide-react";
import { computeInvoiceCalculation, getTodayISTString } from "@/lib/rules/billing";

async function CollectionsPageContent() {
  await connection();
  const supabase = await createClient();
  const todayStr = getTodayISTString();

  const [collectionsData, exportData, projectsRes, invoicesRes, receiptsRes] =
    await Promise.all([
      getCollectionsOverviewData(),
      getExportBillingData(),
      supabase
        .from("projects")
        .select("id, code, name")
        .eq("is_archived", false)
        .order("code"),
      supabase
        .from("invoices")
        .select("id, invoice_number, project_id, amount_excl_gst, gst_amount, is_cancelled, due_date, projects(code)")
        .eq("is_cancelled", false),
      supabase.from("receipts").select("id, invoice_id, amount_received, tds_amount, receipt_date"),
    ]);

  const activeProjects = projectsRes.data || [];
  const rawInvoices = invoicesRes.data || [];
  const rawReceipts = receiptsRes.data || [];

  const receiptInputs = (
    rawReceipts as Array<{
      id: string;
      invoice_id: string | null;
      amount_received: number;
      tds_amount: number;
      receipt_date: string;
    }>
  ).map((r) => ({
    id: r.id,
    invoice_id: r.invoice_id,
    amount_received: r.amount_received,
    tds_amount: r.tds_amount,
    receipt_date: r.receipt_date,
  }));

  // Filter to invoices with outstanding balance
  const openInvoices: Array<{
    id: string;
    invoice_number: string;
    project_id: string;
    project_code: string;
    outstanding_paise: number;
  }> = [];

  for (const inv of rawInvoices) {
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

    if (calc.outstandingPaise > 0) {
      const proj = inv.projects as unknown as { code: string } | null;
      openInvoices.push({
        id: inv.id,
        invoice_number: inv.invoice_number,
        project_id: inv.project_id,
        project_code: proj?.code || "Unknown",
        outstanding_paise: calc.outstandingPaise,
      });
    }
  }

  return (
    <CollectionsClient
      data={collectionsData}
      activeProjects={activeProjects}
      openInvoices={openInvoices}
      exportRows={exportData}
    />
  );
}

export default function AdminCollectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading customer billing, aging buckets, and collections...</span>
        </div>
      }
    >
      <CollectionsPageContent />
    </Suspense>
  );
}
