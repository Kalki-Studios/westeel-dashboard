"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CollectionsOverviewData, PaymentMode, BillingExportData } from "@/lib/billing/types";
import { createReceiptAction, allocateReceiptAction } from "@/lib/billing/actions";
import { formatPaise } from "@/lib/money";
import { generateCsvText, downloadCsvInBrowser } from "@/lib/billing/csv";
import {
  IndianRupee,
  ArrowDownRight,
  Clock,
  AlertTriangle,
  Download,
  Plus,
  ArrowRight,
  Building2,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  Loader2,
  X,
  CreditCard,
  UserCheck,
} from "lucide-react";

interface CollectionsClientProps {
  data: CollectionsOverviewData;
  activeProjects: Array<{ id: string; code: string; name: string }>;
  openInvoices: Array<{
    id: string;
    invoice_number: string;
    project_id: string;
    project_code: string;
    outstanding_paise: number;
  }>;
  exportRows: BillingExportData;
}

export function CollectionsClient({
  data,
  activeProjects,
  openInvoices,
  exportRows,
}: CollectionsClientProps) {
  const router = useRouter();
  const { metrics, projects, overdueInvoices, unallocatedAdvances } = data;

  const [activeTab, setActiveTab] = useState<"overdue" | "projects" | "advances">("overdue");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isRecordReceiptOpen, setIsRecordReceiptOpen] = useState(false);
  const [isAllocateAdvanceOpen, setIsAllocateAdvanceOpen] = useState(false);
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string | null>(null);
  const [selectedAdvanceProjectId, setSelectedAdvanceProjectId] = useState<string | null>(null);

  // Form states
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filtered lists
  const filteredOverdue = overdueInvoices.filter(
    (inv) =>
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.projectName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProjects = projects.filter(
    (p) =>
      p.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.projectName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAdvances = unallocatedAdvances.filter(
    (adv) =>
      adv.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      adv.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (adv.reference && adv.reference.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Filter invoices for selected project in the receipt modal
  const projectInvoicesForReceipt = openInvoices.filter(
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

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <ArrowDownRight className="w-5 h-5 text-emerald-400" />
              <span>Collections &amp; Receivables</span>
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportInvoicesCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Invoices CSV</span>
          </button>

          <button
            onClick={handleExportReceiptsCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Receipts CSV</span>
          </button>

          <button
            onClick={() => {
              setFormError(null);
              setIsRecordReceiptOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-600/25"
          >
            <Plus className="w-4 h-4" />
            <span>Record Receipt</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Receivables */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400">Total Receivables</div>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-2">
            {formatPaise(metrics.totalReceivablePaise)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Outstanding active invoices</div>
        </div>

        {/* Overdue Receivables */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            metrics.totalOverduePaise > 0
              ? "bg-rose-950/20 border-rose-800/60"
              : "bg-slate-900/60 border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
            <span>Overdue Receivables</span>
            {overdueInvoices.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {overdueInvoices.length} invoices
              </span>
            )}
          </div>
          <div
            className={`text-2xl font-bold font-mono mt-2 ${
              metrics.totalOverduePaise > 0 ? "text-rose-400" : "text-slate-100"
            }`}
          >
            {formatPaise(metrics.totalOverduePaise)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Past due date (IST)</div>
        </div>

        {/* Current (Not Yet Due) */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400">Current (Not Overdue)</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
            {formatPaise(metrics.currentPaise)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Within payment term</div>
        </div>

        {/* Unallocated Customer Advances */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
            <span>Customer Advances</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Unallocated
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
            {formatPaise(metrics.totalAdvancesPaise)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Receipts with no invoice linked</div>
        </div>
      </div>

      {/* Aging Buckets (Rule F4) */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-800">Receivables Aging Buckets</span>
          <span className="text-[11px] text-slate-500 font-mono">IST Calendar Days</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-medium text-slate-600">Current (Not Due)</div>
            <div className="text-base font-bold font-mono text-slate-900 mt-1">
              {formatPaise(metrics.currentPaise)}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
            <div className="text-[10px] font-medium text-amber-700">1–30 Days Overdue</div>
            <div className="text-base font-bold font-mono text-amber-800 mt-1">
              {formatPaise(metrics.bucket1_30Paise)}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
            <div className="text-[10px] font-medium text-orange-700">31–60 Days Overdue</div>
            <div className="text-base font-bold font-mono text-orange-800 mt-1">
              {formatPaise(metrics.bucket31_60Paise)}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
            <div className="text-[10px] font-medium text-rose-700">61–90 Days Overdue</div>
            <div className="text-base font-bold font-mono text-rose-800 mt-1">
              {formatPaise(metrics.bucket61_90Paise)}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-red-50 border border-red-200 col-span-2 sm:col-span-1">
            <div className="text-[10px] font-medium text-red-700">&gt; 90 Days Overdue</div>
            <div className="text-base font-bold font-mono text-red-800 mt-1">
              {formatPaise(metrics.bucketOver90Paise)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("overdue")}
            className={`px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 ${
              activeTab === "overdue"
                ? "bg-white text-slate-900 shadow-sm font-semibold border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-rose-500" />
            <span>Overdue Invoices</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-semibold border border-slate-300">
              {overdueInvoices.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("projects")}
            className={`px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 ${
              activeTab === "projects"
                ? "bg-white text-slate-900 shadow-sm font-semibold border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium"
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-amber-500" />
            <span>Project Receivables</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-semibold border border-slate-300">
              {projects.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("advances")}
            className={`px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 ${
              activeTab === "advances"
                ? "bg-white text-slate-900 shadow-sm font-semibold border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
            <span>Unallocated Advances</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-semibold border border-slate-300">
              {unallocatedAdvances.length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by invoice or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* TAB CONTENT 1: OVERDUE INVOICES */}
      {activeTab === "overdue" && (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-center">Overdue</th>
                  <th className="py-3 px-4 text-right">Total (Incl GST)</th>
                  <th className="py-3 px-4 text-right">Settled</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOverdue.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
                      <span>No overdue receivables found! All invoices are settled or current.</span>
                    </td>
                  </tr>
                ) : (
                  filteredOverdue.map((inv) => (
                    <tr key={inv.invoiceId} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-mono font-medium text-slate-200">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{inv.projectCode}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                          {inv.projectName}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {inv.dueDate}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            inv.daysOverdue > 60
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : inv.daysOverdue > 30
                              ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {inv.daysOverdue} days
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        {formatPaise(inv.totalPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        {formatPaise(inv.settledPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-400">
                        {formatPaise(inv.outstandingPaise)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedProjectId(inv.projectId);
                              setFormError(null);
                              setIsRecordReceiptOpen(true);
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium transition"
                          >
                            Collect
                          </button>
                          <Link
                            href={`/x9admin/projects/${inv.projectId}?tab=billing`}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] transition"
                          >
                            Project
                          </Link>
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

      {/* TAB CONTENT 2: PROJECT RECEIVABLES */}
      {activeTab === "projects" && (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4 text-center">Invoices</th>
                  <th className="py-3 px-4 text-right">Invoiced Total</th>
                  <th className="py-3 px-4 text-right">Settled</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-right">Overdue</th>
                  <th className="py-3 px-4 text-right">Advances</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No project billing records found.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((p) => (
                    <tr key={p.projectId} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{p.projectCode}</div>
                        <div className="text-[11px] text-slate-400">{p.projectName}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="text-slate-300">{p.invoicesCount}</span>
                        {p.overdueInvoicesCount > 0 && (
                          <span className="ml-1.5 text-[10px] text-rose-400 font-bold">
                            ({p.overdueInvoicesCount} overdue)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        {formatPaise(p.totalInvoicedPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        {formatPaise(p.totalSettledPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">
                        {formatPaise(p.totalOutstandingPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-rose-400">
                        {p.totalOverduePaise > 0 ? formatPaise(p.totalOverduePaise) : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-400">
                        {p.unallocatedAdvancesPaise > 0
                          ? formatPaise(p.unallocatedAdvancesPaise)
                          : "-"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/x9admin/projects/${p.projectId}?tab=billing`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 transition"
                        >
                          <span>Billing Tab</span>
                          <ArrowRight className="w-3 h-3 text-amber-400" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: UNALLOCATED ADVANCES (RULE F3) */}
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
                  <th className="py-3 px-4 text-right">Advance Amount</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAdvances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
                      <span>All customer receipts have been allocated to specific invoices!</span>
                    </td>
                  </tr>
                ) : (
                  filteredAdvances.map((adv) => (
                    <tr key={adv.receiptId} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {adv.receiptDate}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{adv.projectCode}</div>
                        <div className="text-[11px] text-slate-400">{adv.projectName}</div>
                      </td>
                      <td className="py-3 px-4 font-mono uppercase text-slate-400">
                        {adv.mode.replace("_", " ")}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {adv.reference || "-"}
                      </td>
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
                          className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-medium transition"
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

      {/* MODAL: RECORD RECEIPT */}
      {isRecordReceiptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-emerald-400" />
                <span>Record Customer Receipt</span>
              </h2>
              <button
                onClick={() => setIsRecordReceiptOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordReceipt} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              {/* Project Select */}
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

              {/* Optional Invoice Link (Leave empty for unallocated advance per Rule F3) */}
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Invoice (Optional)
                </label>
                <select
                  name="invoiceId"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">Advance Received (Unallocated)</option>
                  {projectInvoicesForReceipt.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} (Outstanding: {formatPaise(inv.outstanding_paise)})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Leave unselected to record as an advance received. You can allocate it to an invoice later.
                </p>
              </div>

              {/* Dates & Amounts Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Receipt Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    name="receiptDate"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
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
                  <label className="block font-medium text-slate-300 mb-1">
                    TDS Deducted (₹)
                  </label>
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

              {/* Mode & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Payment Mode
                  </label>
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
                  <label className="block font-medium text-slate-300 mb-1">
                    Reference / UTR #
                  </label>
                  <input
                    type="text"
                    name="reference"
                    placeholder="Bank reference or cheque #"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Note
                </label>
                <textarea
                  name="note"
                  rows={2}
                  placeholder="Optional internal remarks..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRecordReceiptOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium transition"
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

      {/* MODAL: ALLOCATE ADVANCE TO INVOICE */}
      {isAllocateAdvanceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span>Allocate Customer Advance</span>
              </h2>
              <button
                onClick={() => setIsAllocateAdvanceOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAllocateAdvance} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              <p className="text-slate-400">
                Select an open invoice from this project to link this customer advance payment to.
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
                  {openInvoices
                    .filter((inv) => inv.project_id === selectedAdvanceProjectId)
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
                  className="px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium transition"
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
