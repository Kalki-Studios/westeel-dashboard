"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PayablesOverviewData,
  BillsExportData,
  PaymentMode,
} from "@/lib/costs/types";
import { createBillPaymentAction } from "@/lib/costs/actions";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import { generateCsvText, downloadCsvInBrowser } from "@/lib/costs/csv";
import {
  ArrowUpRight,
  Receipt,
  Clock,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Search,
  Download,
  IndianRupee,
  Plus,
  Loader2,
  Check,
  X,
  CreditCard,
  Truck,
} from "lucide-react";

interface PayablesClientProps {
  overviewData: PayablesOverviewData;
  exportData: BillsExportData;
  isDirector: boolean;
  isAccounts?: boolean;
}

export function PayablesClient({
  overviewData,
  exportData,
  isDirector,
  isAccounts = false,
}: PayablesClientProps) {
  const router = useRouter();
  const canRecordPayment = isDirector || isAccounts;

  const [activeTab, setActiveTab] = useState<"overdue" | "projects" | "upcoming" | "payments">("overdue");
  const [searchQuery, setSearchQuery] = useState("");

  // Record Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<{
    billId: string;
    billNumber: string;
    projectId: string;
    projectCode: string;
    projectName: string;
    vendorName: string;
    totalPaise: number;
    settledPaise: number;
    outstandingPaise: number;
  } | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [paymentAmountPaid, setPaymentAmountPaid] = useState("");
  const [paymentTdsAmount, setPaymentTdsAmount] = useState("0");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("bank_transfer");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filtered lists
  const query = searchQuery.toLowerCase().trim();

  const filteredOverdueBills = useMemo(() => {
    return overviewData.overdueBills.filter((b) => {
      if (!query) return true;
      return (
        b.billNumber.toLowerCase().includes(query) ||
        b.vendorName.toLowerCase().includes(query) ||
        b.projectCode.toLowerCase().includes(query) ||
        b.projectName.toLowerCase().includes(query)
      );
    });
  }, [overviewData.overdueBills, query]);

  const filteredProjects = useMemo(() => {
    return overviewData.projects.filter((p) => {
      if (!query) return true;
      return (
        p.projectCode.toLowerCase().includes(query) ||
        p.projectName.toLowerCase().includes(query)
      );
    });
  }, [overviewData.projects, query]);

  const filteredUpcomingBills = useMemo(() => {
    return overviewData.upcomingBills.filter((b) => {
      if (!query) return true;
      return (
        b.billNumber.toLowerCase().includes(query) ||
        b.vendorName.toLowerCase().includes(query) ||
        b.projectCode.toLowerCase().includes(query) ||
        b.projectName.toLowerCase().includes(query)
      );
    });
  }, [overviewData.upcomingBills, query]);

  const filteredPayments = useMemo(() => {
    return overviewData.recentPayments.filter((p) => {
      if (!query) return true;
      return (
        p.billNumber.toLowerCase().includes(query) ||
        p.vendorName.toLowerCase().includes(query) ||
        p.projectCode.toLowerCase().includes(query) ||
        p.projectName.toLowerCase().includes(query) ||
        (p.reference && p.reference.toLowerCase().includes(query))
      );
    });
  }, [overviewData.recentPayments, query]);

  // CSV Export Handlers
  function handleExportBillsCsv() {
    const headers = [
      "Bill #",
      "Project Code",
      "Project Name",
      "Category",
      "Vendor",
      "Order Description",
      "Bill Type",
      "Bill Date",
      "Due Date",
      "Amount Ex-GST (₹)",
      "GST (₹)",
      "Total Amount (₹)",
      "Settled (₹)",
      "Outstanding (₹)",
      "Status",
      "Notes",
    ];

    const rows = exportData.billRows.map((b) => [
      b.bill_number,
      b.project_code,
      b.project_name,
      b.category,
      b.vendor_name,
      b.order_desc,
      b.bill_type,
      b.bill_date,
      b.due_date,
      b.amount_excl_gst,
      b.gst_amount,
      b.total_amount,
      b.settled_amount,
      b.outstanding_amount,
      b.status,
      b.note,
    ]);

    const csvContent = generateCsvText(headers, rows);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsvInBrowser(`westeel_bills_${dateStr}.csv`, csvContent);
  }

  function handleExportPaymentsCsv() {
    const headers = [
      "Payment Date",
      "Project Code",
      "Project Name",
      "Bill #",
      "Vendor",
      "Amount Paid (Cash ₹)",
      "TDS Amount (₹)",
      "Payment Mode",
      "Reference",
      "Notes",
    ];

    const rows = exportData.paymentRows.map((p) => [
      p.payment_date,
      p.project_code,
      p.project_name,
      p.bill_number,
      p.vendor_name,
      p.amount_paid,
      p.tds_amount,
      p.mode,
      p.reference,
      p.note,
    ]);

    const csvContent = generateCsvText(headers, rows);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsvInBrowser(`westeel_bill_payments_${dateStr}.csv`, csvContent);
  }

  // Record Payment
  function openPaymentModalForBill(bill: {
    billId: string;
    billNumber: string;
    projectId: string;
    projectCode: string;
    projectName: string;
    vendorName: string;
    totalPaise: number;
    settledPaise: number;
    outstandingPaise: number;
  }) {
    setSelectedBillForPayment(bill);
    setPaymentDate(todayStr);
    setPaymentAmountPaid((bill.outstandingPaise / 100).toFixed(2));
    setPaymentTdsAmount("0");
    setPaymentMode("bank_transfer");
    setPaymentRef("");
    setPaymentNote("");
    setActionError(null);
    setIsPaymentModalOpen(true);
  }

  async function handleRecordPaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBillForPayment || !canRecordPayment) return;
    setIsSubmitting(true);
    setActionError(null);

    const paidVal = parseFloat(paymentAmountPaid);
    const tdsVal = parseFloat(paymentTdsAmount || "0");

    if (isNaN(paidVal) || paidVal <= 0) {
      setActionError("Amount paid must be greater than 0");
      setIsSubmitting(false);
      return;
    }

    const totalSettlingPaise = rupeesToPaise(paidVal) + rupeesToPaise(isNaN(tdsVal) ? 0 : tdsVal);
    if (totalSettlingPaise > selectedBillForPayment.outstandingPaise) {
      setActionError(
        `Total settlement (Paid + TDS = ${formatPaise(
          totalSettlingPaise
        )}) exceeds outstanding balance (${formatPaise(selectedBillForPayment.outstandingPaise)})`
      );
      setIsSubmitting(false);
      return;
    }

    const res = await createBillPaymentAction({
      billId: selectedBillForPayment.billId,
      projectId: selectedBillForPayment.projectId,
      paymentDate,
      amountPaid: paidVal,
      tdsAmount: isNaN(tdsVal) ? 0 : tdsVal,
      mode: paymentMode,
      reference: paymentRef.trim() || null,
      note: paymentNote.trim() || null,
    });

    setIsSubmitting(false);
    if (res.error) {
      setActionError(res.error);
    } else {
      setIsPaymentModalOpen(false);
      setSelectedBillForPayment(null);
      router.refresh();
    }
  }

  const { metrics } = overviewData;

  return (
    <div className="space-y-8">
      {/* HEADER WITH EXPORTS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ArrowUpRight className="w-6 h-6 text-indigo-400" />
            Vendor Payables &amp; Cash Outflows
          </h1>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={handleExportBillsCsv}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-300 shadow-sm transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-500" />
            <span>Export Bills (CSV)</span>
          </button>
          <button
            onClick={handleExportPaymentsCsv}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-300 shadow-sm transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-500" />
            <span>Export Payments (CSV)</span>
          </button>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding Payables */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
            <Receipt className="w-3.5 h-3.5 text-indigo-400" />
            Total Outstanding Payables
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {formatPaise(metrics.totalPayablePaise)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Overdue: {formatPaise(metrics.totalOverduePaise)}</span>
            <span className="text-emerald-400">Current: {formatPaise(metrics.currentPaise)}</span>
          </div>
        </div>

        {/* Total Overdue */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              Total Overdue Payables
            </span>
            {metrics.totalOverduePaise > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-red-500/20 text-red-400 border border-red-500/30">
                Action Required
              </span>
            )}
          </div>
          <div className="text-2xl font-bold font-mono text-red-400">
            {formatPaise(metrics.totalOverduePaise)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{overviewData.overdueBills.length} overdue bills</span>
            <span className="text-slate-500">Past payment due date</span>
          </div>
        </div>

        {/* Due Next 7 Days */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Due Within 7 Days
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {formatPaise(metrics.dueWithin7DaysPaise)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Immediate cash requirement</span>
            <span className="font-mono text-[10px] text-slate-500">Next 7d</span>
          </div>
        </div>

        {/* Due Next 30 Days */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            Due Within 30 Days
          </div>
          <div className="text-2xl font-bold font-mono text-blue-400">
            {formatPaise(metrics.dueWithin30DaysPaise)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Near-term liabilities</span>
            <span className="font-mono text-[10px] text-slate-500">Next 30d</span>
          </div>
        </div>
      </div>

      {/* AGING BUCKETS ROW (RULE F7) */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono mb-3">
          Payables aging
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
            <div className="text-[11px] text-amber-700 font-medium">1 – 30 Days</div>
            <div className="text-lg font-bold font-mono text-amber-900 mt-1">
              {formatPaise(metrics.bucket1_30Paise)}
            </div>
            <div className="text-[10px] text-amber-600 mt-1">Grace period</div>
          </div>

          <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200">
            <div className="text-[11px] text-orange-700 font-medium">31 – 60 Days</div>
            <div className="text-lg font-bold font-mono text-orange-900 mt-1">
              {formatPaise(metrics.bucket31_60Paise)}
            </div>
            <div className="text-[10px] text-orange-600 mt-1">Follow-up needed</div>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
            <div className="text-[11px] text-rose-700 font-medium">61 – 90 Days</div>
            <div className="text-lg font-bold font-mono text-rose-900 mt-1">
              {formatPaise(metrics.bucket61_90Paise)}
            </div>
            <div className="text-[10px] text-rose-600 mt-1">Critical vendor hold</div>
          </div>

          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200">
            <div className="text-[11px] text-red-700 font-medium">&gt; 90 Days</div>
            <div className="text-lg font-bold font-mono text-red-900 mt-1">
              {formatPaise(metrics.bucketOver90Paise)}
            </div>
            <div className="text-[10px] text-red-600 mt-1">High dispute / legal risk</div>
          </div>
        </div>
      </div>

      {/* SEARCH AND TABS NAVIGATION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-3">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab("overdue")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "overdue"
                ? "bg-rose-50 text-rose-700 border border-rose-200 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Overdue Bills</span>
            <span
              className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold border ${
                activeTab === "overdue"
                  ? "bg-rose-100 text-rose-800 border-rose-300"
                  : "bg-slate-100 text-slate-800 border-slate-300"
              }`}
            >
              {overviewData.overdueBills.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("projects")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "projects"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Project Summary</span>
            <span
              className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold border ${
                activeTab === "projects"
                  ? "bg-indigo-100 text-indigo-800 border-indigo-300"
                  : "bg-slate-100 text-slate-800 border-slate-300"
              }`}
            >
              {overviewData.projects.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("upcoming")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "upcoming"
                ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Upcoming Bills</span>
            <span
              className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold border ${
                activeTab === "upcoming"
                  ? "bg-blue-100 text-blue-800 border-blue-300"
                  : "bg-slate-100 text-slate-800 border-slate-300"
              }`}
            >
              {overviewData.upcomingBills.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("payments")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "payments"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Recent Payments</span>
            <span
              className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold border ${
                activeTab === "payments"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-slate-100 text-slate-800 border-slate-300"
              }`}
            >
              {overviewData.recentPayments.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendor, bill, project..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none shadow-sm"
          />
        </div>
      </div>

      {/* TAB 1: OVERDUE BILLS */}
      {activeTab === "overdue" && (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden backdrop-blur-sm">
          {filteredOverdueBills.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400 opacity-60" />
              <p>Great news! No overdue bills found matching your criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px] uppercase font-mono">
                  <tr>
                    <th className="py-3 px-4">Bill # / Vendor</th>
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Due Date / Overdue</th>
                    <th className="py-3 px-4 text-right">Total Bill</th>
                    <th className="py-3 px-4 text-right">Settled</th>
                    <th className="py-3 px-4 text-right">Outstanding</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredOverdueBills.map((b) => (
                    <tr key={b.billId} className="hover:bg-slate-800/30 transition bg-red-500/5">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100">{b.billNumber}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{b.vendorName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/x9admin/projects/${b.projectId}?tab=orders`}
                          className="font-medium text-slate-200 hover:text-amber-400 transition"
                        >
                          {b.projectName}
                        </Link>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {b.projectCode}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-300">{b.dueDate}</div>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30 mt-0.5">
                          <AlertTriangle className="w-3 h-3" /> {b.daysOverdue}d overdue
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-200">
                        {formatPaise(b.totalPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">
                        {formatPaise(b.settledPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-red-400">
                        {formatPaise(b.outstandingPaise)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canRecordPayment && (
                          <button
                            onClick={() => openPaymentModalForBill(b)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer"
                          >
                            Pay
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PROJECT PAYABLES SUMMARY */}
      {activeTab === "projects" && (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden backdrop-blur-sm">
          {filteredProjects.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
              <p>No projects with payables found matching your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px] uppercase font-mono">
                  <tr>
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4 text-center">Bills Count</th>
                    <th className="py-3 px-4 text-right">Total Billed</th>
                    <th className="py-3 px-4 text-right">Settled</th>
                    <th className="py-3 px-4 text-right">Outstanding</th>
                    <th className="py-3 px-4 text-right">Overdue</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredProjects.map((p) => (
                    <tr key={p.projectId} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4">
                        <Link
                          href={`/x9admin/projects/${p.projectId}?tab=orders`}
                          className="font-semibold text-slate-100 hover:text-amber-400 transition"
                        >
                          {p.projectName}
                        </Link>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {p.projectCode}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-300">
                        {p.billsCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-200">
                        {formatPaise(p.totalBilledPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">
                        {formatPaise(p.totalSettledPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                        {formatPaise(p.totalOutstandingPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-red-400">
                        {p.totalOverduePaise > 0 ? (
                          formatPaise(p.totalOverduePaise)
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/x9admin/projects/${p.projectId}?tab=orders`}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                        >
                          View Orders
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: UPCOMING BILLS */}
      {activeTab === "upcoming" && (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden backdrop-blur-sm">
          {filteredUpcomingBills.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
              <p>No upcoming bills found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px] uppercase font-mono">
                  <tr>
                    <th className="py-3 px-4">Bill # / Vendor</th>
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-right">Total Bill</th>
                    <th className="py-3 px-4 text-right">Settled</th>
                    <th className="py-3 px-4 text-right">Outstanding</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredUpcomingBills.map((b) => (
                    <tr key={b.billId} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100">{b.billNumber}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{b.vendorName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/x9admin/projects/${b.projectId}?tab=orders`}
                          className="font-medium text-slate-200 hover:text-amber-400 transition"
                        >
                          {b.projectName}
                        </Link>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {b.projectCode}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-300">{b.dueDate}</div>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 mt-0.5">
                          <Clock className="w-3 h-3" /> Due in {b.daysUntilDue}d
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-200">
                        {formatPaise(b.totalPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">
                        {formatPaise(b.settledPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                        {formatPaise(b.outstandingPaise)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canRecordPayment && (
                          <button
                            onClick={() => openPaymentModalForBill(b)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer"
                          >
                            Pay
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: RECENT PAYMENTS */}
      {activeTab === "payments" && (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden backdrop-blur-sm">
          {filteredPayments.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
              <p>No recent payment records found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px] uppercase font-mono">
                  <tr>
                    <th className="py-3 px-4">Payment Date</th>
                    <th className="py-3 px-4">Bill # / Vendor</th>
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Mode &amp; Ref</th>
                    <th className="py-3 px-4 text-right">Amount Paid (Cash)</th>
                    <th className="py-3 px-4 text-right">TDS Settled</th>
                    <th className="py-3 px-4 text-right">Total Settled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredPayments.map((p) => {
                    const totalSettled = p.amountPaidPaise + p.tdsAmountPaise;
                    return (
                      <tr key={p.paymentId} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono text-slate-300">{p.paymentDate}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-100">{p.billNumber}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{p.vendorName}</div>
                        </td>
                        <td className="py-3 px-4">
                          <Link
                            href={`/x9admin/projects/${p.projectId}?tab=orders`}
                            className="font-medium text-slate-200 hover:text-amber-400 transition"
                          >
                            {p.projectName}
                          </Link>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            {p.projectCode}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono uppercase text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                            {p.mode}
                          </span>
                          {p.reference && (
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5 truncate max-w-[120px]">
                              {p.reference}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-200">
                          {formatPaise(p.amountPaidPaise)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-400">
                          {p.tdsAmountPaise > 0 ? (
                            formatPaise(p.tdsAmountPaise)
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          {formatPaise(totalSettled)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {isPaymentModalOpen && selectedBillForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <IndianRupee className="w-5 h-5 text-emerald-400" />
                  Record Bill Payment
                </h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="p-5 space-y-4">
              {actionError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Bill Details Summary Card */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Bill Number:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {selectedBillForPayment.billNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Vendor:</span>
                  <span className="text-slate-200">{selectedBillForPayment.vendorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Project:</span>
                  <span className="text-slate-200">
                    {selectedBillForPayment.projectCode} — {selectedBillForPayment.projectName}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-1 text-[11px]">
                  <span className="text-slate-400">Total Bill (with GST):</span>
                  <span className="font-mono text-slate-200">
                    {formatPaise(selectedBillForPayment.totalPaise)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Settled (Paid + TDS):</span>
                  <span className="font-mono text-emerald-400">
                    {formatPaise(selectedBillForPayment.settledPaise)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-xs text-amber-400">
                  <span>Outstanding:</span>
                  <span className="font-mono">
                    {formatPaise(selectedBillForPayment.outstandingPaise)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-emerald-400 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-emerald-400 focus:outline-none"
                    required
                  >
                    <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="cheque">Cheque</option>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Amount Paid (₹ Cash) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={paymentAmountPaid}
                    onChange={(e) => setPaymentAmountPaid(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-emerald-400 focus:outline-none"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    TDS Deducted (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={paymentTdsAmount}
                    onChange={(e) => setPaymentTdsAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-emerald-400 focus:outline-none"
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    TDS is settled against bill liability
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Bank Reference / UTR Number
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-emerald-400 focus:outline-none"
                  placeholder="e.g., UTR-HDFC-202610189912"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Payment Note / Remarks
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-emerald-400 focus:outline-none"
                  placeholder="Optional internal remark"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Record Payment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
