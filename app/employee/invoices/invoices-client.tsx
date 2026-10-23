"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CollectionsOverviewData } from "@/lib/billing/types";
import {
  createInvoiceAction,
  cancelInvoiceAction,
  createReceiptAction,
  allocateReceiptAction,
} from "@/lib/billing/actions";
import { formatPaise } from "@/lib/money";
import { generateCsvText, downloadCsvInBrowser } from "@/lib/billing/csv";
import {
  IndianRupee,
  Receipt,
  Plus,
  CheckCircle2,
  ArrowLeft,
  CreditCard,
  Download,
  Loader2,
  X,
  Ban,
} from "lucide-react";
import { BillingExportData } from "@/lib/billing/types";

function getDefaultDates() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const due = new Date(now.getTime() + 15 * 86400000).toISOString().slice(0, 10);
  return { today, due };
}

interface InvoicesClientProps {
  data: CollectionsOverviewData;
  activeProjects: Array<{ id: string; code: string; name: string }>;
  milestones: Array<{
    id: string;
    project_id: string;
    label: string;
    amount_excl_gst: number;
    expected_date: string;
  }>;
  invoices: Array<{
    id: string;
    project_id: string;
    project_code: string;
    project_name: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    amount_excl_gst: number;
    gst_amount: number;
    is_cancelled: boolean;
    total_paise: number;
    settled_paise: number;
    outstanding_paise: number;
    is_overdue: boolean;
    days_overdue: number;
  }>;
  exportRows: BillingExportData;
}

export function AccountsInvoicesClient({
  data,
  activeProjects,
  milestones,
  invoices,
  exportRows,
}: InvoicesClientProps) {
  const router = useRouter();
  const [defaultDates] = useState(getDefaultDates);
  const { metrics, overdueInvoices, unallocatedAdvances } = data;

  const [activeTab, setActiveTab] = useState<"invoices" | "advances" | "overdue">("invoices");

  // Modals
  const [isRaiseInvoiceOpen, setIsRaiseInvoiceOpen] = useState(false);
  const [isRecordReceiptOpen, setIsRecordReceiptOpen] = useState(false);
  const [isAllocateAdvanceOpen, setIsAllocateAdvanceOpen] = useState(false);
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string | null>(null);
  const [selectedAdvanceProjectId, setSelectedAdvanceProjectId] = useState<string | null>(null);

  // Form states
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filtered milestones for selected project
  const projectMilestones = milestones.filter(
    (m) => !selectedProjectId || m.project_id === selectedProjectId
  );

  // Filtered invoices for selected project
  const projectInvoices = invoices.filter(
    (inv) => !selectedProjectId || inv.project_id === selectedProjectId
  );

  // CSV Exporters
  function handleExportInvoicesCsv() {
    const headers = [
      "Invoice Number",
      "Project Code",
      "Project Name",
      "Milestone",
      "Invoice Date",
      "Due Date",
      "Amount Ex-GST (₹)",
      "GST (₹)",
      "Total Amount (₹)",
      "Settled Amount (₹)",
      "Outstanding (₹)",
      "Status",
      "Notes",
    ];

    const rows = exportRows.invoiceRows.map((r) => [
      r.invoice_number,
      r.project_code,
      r.project_name,
      r.milestone,
      r.invoice_date,
      r.due_date,
      r.amount_excl_gst,
      r.gst_amount,
      r.total_amount,
      r.settled_amount,
      r.outstanding_amount,
      r.status,
      r.note,
    ]);

    const csvText = generateCsvText(headers, rows);
    downloadCsvInBrowser(`westeel_invoices_${new Date().toISOString().slice(0, 10)}.csv`, csvText);
  }

  function handleExportReceiptsCsv() {
    const headers = [
      "Receipt Date",
      "Project Code",
      "Project Name",
      "Invoice Number",
      "Amount Received (₹)",
      "TDS Deducted (₹)",
      "Total Settlement (₹)",
      "Payment Mode",
      "Reference",
      "Notes",
    ];

    const rows = exportRows.receiptRows.map((r) => [
      r.receipt_date,
      r.project_code,
      r.project_name,
      r.invoice_number,
      r.amount_received,
      r.tds_amount,
      r.total_settlement,
      r.mode,
      r.reference,
      r.note,
    ]);

    const csvText = generateCsvText(headers, rows);
    downloadCsvInBrowser(`westeel_receipts_${new Date().toISOString().slice(0, 10)}.csv`, csvText);
  }

  // Handlers
  async function handleRaiseInvoice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const formData = new FormData(e.currentTarget);
    const res = await createInvoiceAction(formData);

    if (res.error) {
      setFormError(res.error);
    } else {
      setIsRaiseInvoiceOpen(false);
      setSelectedProjectId("");
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleRecordReceipt(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const formData = new FormData(e.currentTarget);
    const res = await createReceiptAction(formData);

    if (res.error) {
      setFormError(res.error);
    } else {
      setIsRecordReceiptOpen(false);
      setSelectedProjectId("");
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleAllocateAdvance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedAdvanceId || !selectedAdvanceProjectId) return;

    setIsSubmitting(true);
    setFormError(null);

    const formData = new FormData(e.currentTarget);
    const invoiceId = formData.get("invoiceId") as string;

    if (!invoiceId) {
      setFormError("Please select an invoice to allocate this advance to");
      setIsSubmitting(false);
      return;
    }

    const res = await allocateReceiptAction(selectedAdvanceId, invoiceId, selectedAdvanceProjectId);

    if (res.error) {
      setFormError(res.error);
    } else {
      setIsAllocateAdvanceOpen(false);
      setSelectedAdvanceId(null);
      setSelectedAdvanceProjectId(null);
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleCancelInvoice(invoiceId: string, projectId: string, invoiceNumber: string) {
    if (!confirm(`Cancel invoice ${invoiceNumber}? This will exclude it from receivables.`)) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const res = await cancelInvoiceAction(invoiceId, projectId);
    if (res.error) {
      setFormError(res.error);
    } else {
      router.refresh();
    }
    setIsSubmitting(false);
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <Link
            href="/employee"
            className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5 mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to My Work</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-400" />
              <span>Accounts: Customer Billing &amp; Collections</span>
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportInvoicesCsv}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition inline-flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Invoices CSV</span>
          </button>

          <button
            onClick={handleExportReceiptsCsv}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition inline-flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Receipts CSV</span>
          </button>

          <button
            onClick={() => {
              setFormError(null);
              setIsRaiseInvoiceOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Raise Invoice</span>
          </button>

          <button
            onClick={() => {
              setFormError(null);
              setIsRecordReceiptOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Record Receipt</span>
          </button>
        </div>
      </div>

      {formError && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs">
          {formError}
        </div>
      )}

      {/* Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="text-[11px] font-medium text-slate-400">Total Outstanding Receivables</div>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-2">
            {formatPaise(metrics.totalReceivablePaise)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Across all active projects</div>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            metrics.totalOverduePaise > 0
              ? "bg-rose-950/20 border-rose-800/60"
              : "bg-slate-900/60 border-slate-800"
          }`}
        >
          <div className="text-[11px] font-medium text-slate-400">Overdue Receivables</div>
          <div
            className={`text-2xl font-bold font-mono mt-2 ${
              metrics.totalOverduePaise > 0 ? "text-rose-400" : "text-slate-100"
            }`}
          >
            {formatPaise(metrics.totalOverduePaise)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {overdueInvoices.length} invoices past due date
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="text-[11px] font-medium text-slate-400">Unallocated Customer Advances</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
            {formatPaise(metrics.totalAdvancesPaise)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {unallocatedAdvances.length} advance receipts pending allocation
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit text-xs">
        <button
          onClick={() => setActiveTab("invoices")}
          className={`px-3 py-1.5 rounded-lg transition font-medium ${
            activeTab === "invoices"
              ? "bg-slate-800 text-slate-100 font-semibold shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          All Invoices ({invoices.length})
        </button>

        <button
          onClick={() => setActiveTab("advances")}
          className={`px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
            activeTab === "advances"
              ? "bg-slate-800 text-slate-100 font-semibold shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>Advances</span>
          {unallocatedAdvances.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-bold">
              {unallocatedAdvances.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("overdue")}
          className={`px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
            activeTab === "overdue"
              ? "bg-slate-800 text-slate-100 font-semibold shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>Overdue List</span>
          {overdueInvoices.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 font-bold">
              {overdueInvoices.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: ALL INVOICES */}
      {activeTab === "invoices" && (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total (Incl GST)</th>
                  <th className="py-3 px-4 text-right">Settled</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No customer invoices found. Click &quot;Raise Invoice&quot; to create one.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className={`hover:bg-slate-800/30 ${
                        inv.is_cancelled ? "opacity-50 line-through" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-200">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{inv.project_code}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                          {inv.project_name}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {inv.due_date}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        {formatPaise(inv.total_paise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        {formatPaise(inv.settled_paise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">
                        {formatPaise(inv.outstanding_paise)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {inv.is_cancelled ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            CANCELLED
                          </span>
                        ) : inv.outstanding_paise === 0 ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            SETTLED
                          </span>
                        ) : inv.is_overdue ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                            {inv.days_overdue}d OVERDUE
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            OPEN
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedProjectId(inv.project_id);
                              setFormError(null);
                              setIsRecordReceiptOpen(true);
                            }}
                            className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px]"
                          >
                            Collect
                          </button>
                          {!inv.is_cancelled && (
                            <button
                              onClick={() => handleCancelInvoice(inv.id, inv.project_id, inv.invoice_number)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition"
                              title="Cancel Invoice"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: UNALLOCATED ADVANCES */}
      {activeTab === "advances" && (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4">Receipt Date</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4 text-right">Amount Received</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {unallocatedAdvances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
                      <span>All customer receipts have been allocated to invoices.</span>
                    </td>
                  </tr>
                ) : (
                  unallocatedAdvances.map((adv) => (
                    <tr key={adv.receiptId} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-slate-300">{adv.receiptDate}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{adv.projectCode}</div>
                        <div className="text-[11px] text-slate-400">{adv.projectName}</div>
                      </td>
                      <td className="py-3 px-4 font-mono uppercase text-slate-400">
                        {adv.mode.replace("_", " ")}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">{adv.reference || "-"}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                        {formatPaise(adv.amountReceivedPaise)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedAdvanceId(adv.receiptId);
                            setSelectedAdvanceProjectId(adv.projectId);
                            setFormError(null);
                            setIsAllocateAdvanceOpen(true);
                          }}
                          className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px]"
                        >
                          Allocate to Invoice
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: OVERDUE RECEIVABLES */}
      {activeTab === "overdue" && (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-center">Days Overdue</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {overdueInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
                      <span>No overdue invoices found. All collections are up to date!</span>
                    </td>
                  </tr>
                ) : (
                  overdueInvoices.map((inv) => (
                    <tr key={inv.invoiceId} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono font-medium text-slate-200">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{inv.projectCode}</div>
                        <div className="text-[11px] text-slate-400">{inv.projectName}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{inv.dueDate}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                          {inv.daysOverdue} days
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        {formatPaise(inv.totalPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-400">
                        {formatPaise(inv.outstandingPaise)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedProjectId(inv.projectId);
                            setFormError(null);
                            setIsRecordReceiptOpen(true);
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px]"
                        >
                          Collect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: RAISE INVOICE */}
      {isRaiseInvoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Raise Customer Invoice</span>
              </h2>
              <button
                onClick={() => setIsRaiseInvoiceOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRaiseInvoice} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Project <span className="text-rose-400">*</span>
                </label>
                <select
                  name="projectId"
                  required
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select Project</option>
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Invoice # <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="invoiceNumber"
                    required
                    placeholder="e.g. WB-INV-2026-001"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Payment Milestone (Optional)
                  </label>
                  <select
                    name="paymentMilestoneId"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">None (Custom Invoice)</option>
                    {projectMilestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} (₹{m.amount_excl_gst})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Invoice Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    name="invoiceDate"
                    required
                    defaultValue={defaultDates.today}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Due Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    name="dueDate"
                    required
                    defaultValue={defaultDates.due}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Amount Ex-GST (₹) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="amountExclGst"
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">GST Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="gstAmount"
                    defaultValue="0"
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Notes</label>
                <textarea
                  name="note"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRaiseInvoiceOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Raise Invoice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD RECEIPT */}
      {isRecordReceiptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-emerald-400" />
                <span>Record Customer Receipt</span>
              </h2>
              <button
                onClick={() => setIsRecordReceiptOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordReceipt} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Project <span className="text-rose-400">*</span>
                </label>
                <select
                  name="projectId"
                  required
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select Project</option>
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Invoice (Optional)</label>
                <select
                  name="invoiceId"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">Advance Received (Unallocated)</option>
                  {projectInvoices
                    .filter((inv) => !inv.is_cancelled)
                    .map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} (Outstanding: {formatPaise(inv.outstanding_paise)})
                      </option>
                    ))}
                </select>
                <span className="text-[10px] text-slate-500">
                  Leave unselected to record as advance received.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Receipt Date</label>
                  <input
                    type="date"
                    name="receiptDate"
                    required
                    defaultValue={defaultDates.today}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Amount Received (₹) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="amountReceived"
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">TDS Deducted (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="tdsAmount"
                    defaultValue="0"
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Payment Mode</label>
                  <select
                    name="mode"
                    defaultValue="bank_transfer"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="cheque">Cheque</option>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Reference / UTR #</label>
                  <input
                    type="text"
                    name="reference"
                    placeholder="Bank reference or cheque #"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Notes</label>
                <textarea
                  name="note"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRecordReceiptOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Record Receipt</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ALLOCATE ADVANCE */}
      {isAllocateAdvanceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span>Allocate Customer Advance</span>
              </h2>
              <button
                onClick={() => setIsAllocateAdvanceOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAllocateAdvance} className="p-6 space-y-4 text-xs">
              <p className="text-slate-400">
                Select an open invoice from this project to allocate this customer advance to.
              </p>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Target Invoice <span className="text-rose-400">*</span>
                </label>
                <select
                  name="invoiceId"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select Invoice</option>
                  {invoices
                    .filter((inv) => inv.project_id === selectedAdvanceProjectId && !inv.is_cancelled)
                    .map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} (Outstanding: {formatPaise(inv.outstanding_paise)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAllocateAdvanceOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Allocate Advance</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
