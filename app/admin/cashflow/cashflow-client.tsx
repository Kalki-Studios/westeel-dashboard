"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BankBalance,
  CompanyCashItem,
  CashFlowWorkspaceData,
} from "@/lib/cashflow/types";
import {
  createBankBalanceAction,
  deleteBankBalanceAction,
  createCompanyCashItemAction,
  updateCompanyCashItemStatusAction,
} from "@/lib/cashflow/actions";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import {
  exportProjectionCsv,
  exportBankBalancesCsv,
  downloadCsvInBrowser,
} from "@/lib/cashflow/csv";
import { getTodayISTString } from "@/lib/rules/cashflow";
import {
  IndianRupee,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Download,
  Plus,
  Trash2,
  Building,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Info,
  Loader2,
  X,
  Layers,
  Repeat,
  AlertCircle,
} from "lucide-react";

interface CashflowClientProps {
  data: CashFlowWorkspaceData;
}

export function CashflowClient({ data }: CashflowClientProps) {
  const router = useRouter();
  const { cashOnHand, projection, bankBalances, companyCashItems, distinctAccountLabels, userRoles } = data;

  const todayStr = getTodayISTString();
  const isDirector = userRoles.isDirector;
  const isAccounts = userRoles.isAccounts;
  const canAddBalance = isDirector || isAccounts;
  const canManageCashItems = isDirector;

  // Active Tab for bottom registers
  const [activeTab, setActiveTab] = useState<"projection" | "balances" | "cash_items">("projection");

  // Filter for company cash items
  const [cashItemStatusFilter, setCashItemStatusFilter] = useState<"all" | "planned" | "done" | "cancelled">("all");

  // Modals
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showCashItemModal, setShowCashItemModal] = useState(false);

  // Form states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Bank Balance Form Fields
  const [bbAccountLabel, setBbAccountLabel] = useState("");
  const [bbCustomLabel, setBbCustomLabel] = useState("");
  const [bbBalance, setBbBalance] = useState("");
  const [bbAsOfDate, setBbAsOfDate] = useState(todayStr);
  const [bbNote, setBbNote] = useState("");

  // Company Cash Item Form Fields
  const [ciDirection, setCiDirection] = useState<"inflow" | "outflow">("outflow");
  const [ciCategory, setCiCategory] = useState("Payroll");
  const [ciDescription, setCiDescription] = useState("");
  const [ciAmount, setCiAmount] = useState("");
  const [ciExpectedDate, setCiExpectedDate] = useState(todayStr);
  const [ciRepeatMonths, setCiRepeatMonths] = useState(1);

  // CSV Exports
  const handleExportProjection = () => {
    const csv = exportProjectionCsv(projection);
    downloadCsvInBrowser(`westeel_cash_projection_${todayStr}.csv`, csv);
  };

  const handleExportBalances = () => {
    const csv = exportBankBalancesCsv(bankBalances);
    downloadCsvInBrowser(`westeel_bank_balances_${todayStr}.csv`, csv);
  };

  // Submit Bank Balance
  const handleSubmitBankBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const finalLabel = bbAccountLabel === "__custom__" || !bbAccountLabel ? bbCustomLabel.trim() : bbAccountLabel.trim();
    if (!finalLabel) {
      setFormError("Account label is required");
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData();
    formData.append("accountLabel", finalLabel);
    formData.append("balance", bbBalance);
    formData.append("asOfDate", bbAsOfDate);
    if (bbNote) formData.append("note", bbNote);

    const res = await createBankBalanceAction(formData);
    setIsSubmitting(false);

    if (res.success) {
      setShowBalanceModal(false);
      setBbAccountLabel("");
      setBbCustomLabel("");
      setBbBalance("");
      setBbNote("");
      router.refresh();
    } else {
      setFormError(res.error || "Failed to record balance");
    }
  };

  // Delete Bank Balance
  const handleDeleteBalance = async (id: string, label: string) => {
    if (!confirm(`Are you sure you want to delete the balance record for "${label}"? This action is logged.`)) {
      return;
    }
    const res = await deleteBankBalanceAction(id);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.error || "Failed to delete balance");
    }
  };

  // Submit Company Cash Item
  const handleSubmitCashItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const formData = new FormData();
    formData.append("direction", ciDirection);
    formData.append("category", ciCategory);
    formData.append("description", ciDescription);
    formData.append("amount", ciAmount);
    formData.append("expectedDate", ciExpectedDate);
    formData.append("repeatMonths", String(ciRepeatMonths));

    const res = await createCompanyCashItemAction(formData);
    setIsSubmitting(false);

    if (res.success) {
      setShowCashItemModal(false);
      setCiDescription("");
      setCiAmount("");
      setCiRepeatMonths(1);
      router.refresh();
    } else {
      setFormError(res.error || "Failed to record cash item");
    }
  };

  // Update Status of Company Cash Item
  const handleUpdateCashItemStatus = async (id: string, status: "planned" | "done" | "cancelled") => {
    const res = await updateCompanyCashItemStatusAction(id, status);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.error || "Failed to update item status");
    }
  };

  // Filtered Cash Items
  const filteredCashItems = companyCashItems.filter((item) => {
    if (cashItemStatusFilter === "all") return true;
    return item.status === cashItemStatusFilter;
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-emerald-400" />
              <span>Cash Flow &amp; Projections</span>
            </h1>
          </div>
          {/* Required disclaimer: keep visible */}
          <p className="text-xs text-slate-500 mt-1 italic">
            &ldquo;{projection.mandatory_label}&rdquo;
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canAddBalance && (
            <button
              onClick={() => {
                setFormError(null);
                setShowBalanceModal(true);
              }}
              className="px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-blue-600/25"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Balance Entry</span>
            </button>
          )}

          {canManageCashItems && (
            <button
              onClick={() => {
                setFormError(null);
                setShowCashItemModal(true);
              }}
              className="px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-blue-600/25"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Cash Item</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
            <button
              onClick={handleExportProjection}
              title="Export 5-Bucket Projection CSV"
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Projection CSV</span>
            </button>
            <button
              onClick={handleExportBalances}
              title="Export Bank Balances CSV"
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Balances CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Cash on Hand (F11) */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between shadow-sm ${
            cashOnHand.is_stale
              ? "bg-amber-50 border-amber-200"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
            <span>Cash on Hand</span>
            {cashOnHand.is_stale ? (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-bold">
                Stale: update balances
              </span>
            ) : (
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold">Active</span>
            )}
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-700 mt-2">
            {formatPaise(cashOnHand.total_cash_on_hand_paise)}
          </div>
          <div className="text-[10px] text-slate-600 mt-1 flex items-center justify-between">
            <span>
              {cashOnHand.as_of_date
                ? `As of: ${cashOnHand.as_of_date} (oldest)`
                : "No balances recorded"}
            </span>
            <span className="text-slate-600 font-medium">{cashOnHand.accounts.length} accounts</span>
          </div>
        </div>

        {/* Card 2: 30-Day Liquidity & Shortfall (F12) */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between shadow-sm ${
            projection.has_projected_shortfall
              ? "bg-rose-50 border-rose-200"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
            <span>Projected 30-Day Cash</span>
            {projection.has_projected_shortfall ? (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                Shortfall Alert
              </span>
            ) : (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                Stable
              </span>
            )}
          </div>
          <div
            className={`text-2xl font-bold font-mono mt-2 ${
              projection.buckets.days_8_to_30.running_balance_paise < 0
                ? "text-rose-700"
                : "text-emerald-700"
            }`}
          >
            {formatPaise(projection.buckets.days_8_to_30.running_balance_paise)}
          </div>
          <div className="text-[10px] text-slate-600 mt-1">
            {projection.has_projected_shortfall
              ? projection.shortfall_message || "Deficit expected within 30 days"
              : "Running balance through day 30"}
          </div>
        </div>

        {/* Card 3: Overdue Receivables (Excluded from projection) */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
            <span>Overdue Receivables</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
              Excluded
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 mt-2">
            {formatPaise(projection.overdue_receivables_paise)}
          </div>
          <div className="text-[10px] text-slate-600 mt-1 italic">
            Not assumed received
          </div>
        </div>

        {/* Card 4: Committed Not Yet Billed Orders */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
            <span>Committed Not Billed</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
              Informational
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {formatPaise(projection.total_committed_not_billed_paise)}
          </div>
          <div className="text-[10px] text-slate-600 mt-1">
            Vendor orders pending bills (excluded from net)
          </div>
        </div>
      </div>

      {/* Account Balance Chips Preview */}
      {cashOnHand.accounts.length > 0 && (
        <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-900/40 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mr-2">
            <Building className="w-3.5 h-3.5 text-cyan-400" />
            Accounts on Hand:
          </span>
          {cashOnHand.accounts.map((acc) => (
            <div
              key={acc.account_label}
              className={`px-2.5 py-1 rounded-md text-xs font-mono border flex items-center gap-2 ${
                acc.is_stale
                  ? "bg-amber-950/30 border-amber-800/60 text-amber-300"
                  : "bg-slate-950/60 border-slate-800 text-slate-200"
              }`}
            >
              <span className="font-sans font-medium text-slate-300">{acc.account_label}:</span>
              <span className="font-bold text-cyan-300">{formatPaise(acc.balance_paise)}</span>
              <span className="text-[10px] text-slate-500">
                ({acc.as_of_date}{acc.is_stale ? ` • ${acc.age_days}d stale` : ""})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pt-2">
        <button
          onClick={() => setActiveTab("projection")}
          className={`px-4 py-2 text-xs rounded-t-lg transition-colors border-t border-l border-r ${
            activeTab === "projection"
              ? "bg-white text-slate-900 border-slate-200 font-bold shadow-sm"
              : "text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100 font-medium"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-600" />
            <span>5-Bucket Projection Table</span>
          </span>
        </button>

        <button
          onClick={() => setActiveTab("balances")}
          className={`px-4 py-2 text-xs rounded-t-lg transition-colors border-t border-l border-r ${
            activeTab === "balances"
              ? "bg-white text-slate-900 border-slate-200 font-bold shadow-sm"
              : "text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100 font-medium"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-emerald-600" />
            <span>Bank Balances History ({bankBalances.length})</span>
          </span>
        </button>

        <button
          onClick={() => setActiveTab("cash_items")}
          className={`px-4 py-2 text-xs rounded-t-lg transition-colors border-t border-l border-r ${
            activeTab === "cash_items"
              ? "bg-white text-slate-900 border-slate-200 font-bold shadow-sm"
              : "text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100 font-medium"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Repeat className="w-3.5 h-3.5 text-amber-600" />
            <span>Company Cash Items ({companyCashItems.length})</span>
          </span>
        </button>
      </div>

      {/* 4. Tab Content */}
      {activeTab === "projection" && (
        <div className="space-y-4">
          {/* Main 5-Bucket Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Cash Flow Projection by Buckets</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                    Base Cash on Hand: {formatPaise(cashOnHand.total_cash_on_hand_paise)}
                  </span>
                </h2>
              </div>

              {projection.has_projected_shortfall && (
                <div className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>30-Day Cash Shortfall Alert</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 text-slate-700 uppercase text-[11px] font-mono tracking-wider font-semibold">
                    <th className="py-3 px-4 w-1/4">Line Item / Metric</th>
                    {projection.bucket_list.map((bucket) => (
                      <th
                        key={bucket.key}
                        className={`py-3 px-4 text-right ${
                          bucket.is_shortfall ? "bg-rose-50 text-rose-800 border-b-2 border-rose-400 font-bold" : "text-slate-800"
                        }`}
                      >
                        <div className="font-bold">{bucket.label}</div>
                        <div className="text-[10px] font-normal text-slate-600 lowercase">
                          {bucket.range_description}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {/* INFLOWS SECTION */}
                  <tr className="bg-emerald-50 text-emerald-800 font-bold text-xs border-y border-emerald-200">
                    <td colSpan={6} className="py-2.5 px-4 font-bold">
                      ▲ CASH INFLOWS
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50 text-slate-800">
                    <td className="py-2.5 px-4 pl-7 text-slate-800 font-medium">
                      Customer Invoices (future-dated)
                    </td>
                    {projection.bucket_list.map((b) => (
                      <td key={b.key} className="py-2.5 px-4 text-right font-mono text-slate-900 font-semibold">
                        {formatPaise(b.invoices_paise)}
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-slate-50 text-slate-800">
                    <td className="py-2.5 px-4 pl-7 text-slate-800 font-medium">
                      Payment Milestones (un-invoiced)
                    </td>
                    {projection.bucket_list.map((b) => (
                      <td key={b.key} className="py-2.5 px-4 text-right font-mono text-slate-900 font-semibold">
                        {formatPaise(b.milestones_paise)}
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-slate-50 text-slate-800">
                    <td className="py-2.5 px-4 pl-7 text-slate-800 font-medium">
                      Company Cash Inflows (planned)
                    </td>
                    {projection.bucket_list.map((b) => (
                      <td key={b.key} className="py-2.5 px-4 text-right font-mono text-slate-900 font-semibold">
                        {formatPaise(b.company_inflows_paise)}
                      </td>
                    ))}
                  </tr>

                  <tr className="bg-emerald-50/70 font-bold text-slate-900 border-t border-emerald-200">
                    <td className="py-2.5 px-4 pl-7 text-emerald-950 font-bold">TOTAL INFLOWS</td>
                    {projection.bucket_list.map((b) => (
                      <td key={b.key} className="py-2.5 px-4 text-right font-mono text-emerald-700 font-bold">
                        {formatPaise(b.total_inflows_paise)}
                      </td>
                    ))}
                  </tr>

                  {/* OUTFLOWS SECTION */}
                  <tr className="bg-rose-50 text-rose-800 font-bold text-xs border-y border-rose-200">
                    <td colSpan={6} className="py-2.5 px-4 font-bold">
                      ▼ CASH OUTFLOWS
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50 text-slate-800">
                    <td className="py-2.5 px-4 pl-7 text-slate-800 font-medium">
                      Vendor Bills (unpaid)
                    </td>
                    {projection.bucket_list.map((b) => (
                      <td key={b.key} className="py-2.5 px-4 text-right font-mono text-slate-900 font-semibold">
                        {formatPaise(b.bills_paise)}
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-slate-50 text-slate-800">
                    <td className="py-2.5 px-4 pl-7 text-slate-800 font-medium">
                      Company Cash Outflows (planned)
                    </td>
                    {projection.bucket_list.map((b) => (
                      <td key={b.key} className="py-2.5 px-4 text-right font-mono text-slate-900 font-semibold">
                        {formatPaise(b.company_outflows_paise)}
                      </td>
                    ))}
                  </tr>

                  <tr className="bg-rose-50/70 font-bold text-slate-900 border-t border-rose-200">
                    <td className="py-2.5 px-4 pl-7 text-rose-950 font-bold">TOTAL OUTFLOWS</td>
                    {projection.bucket_list.map((b) => (
                      <td key={b.key} className="py-2.5 px-4 text-right font-mono text-rose-700 font-bold">
                        {formatPaise(b.total_outflows_paise)}
                      </td>
                    ))}
                  </tr>

                  {/* NET CASH */}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      NET CASH (Inflows − Outflows)
                    </td>
                    {projection.bucket_list.map((b) => (
                      <td
                        key={b.key}
                        className={`py-3 px-4 text-right font-mono text-xs font-bold ${
                          b.net_cash_paise >= 0 ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {b.net_cash_paise >= 0 ? "+" : ""}
                        {formatPaise(b.net_cash_paise)}
                      </td>
                    ))}
                  </tr>

                  {/* RUNNING BALANCE */}
                  <tr className="bg-blue-50/90 font-bold border-t-2 border-blue-200 text-sm">
                    <td className="py-3 px-4 flex items-center gap-2">
                      <span className="text-slate-900 font-extrabold">RUNNING BALANCE</span>
                      <span className="text-[11px] font-medium text-slate-600 font-mono">
                        (cumulative)
                      </span>
                    </td>
                    {projection.bucket_list.map((b) => {
                      const isNegative = b.running_balance_paise < 0;
                      return (
                        <td
                          key={b.key}
                          className={`py-3 px-4 text-right font-mono font-bold ${
                            isNegative
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : "text-blue-800"
                          }`}
                        >
                          {formatPaise(b.running_balance_paise)}
                        </td>
                      );
                    })}
                  </tr>

                  {/* INFORMATIONAL ROW: COMMITTED NOT BILLED */}
                  <tr className="bg-slate-50 text-slate-600 italic text-[11px] border-t border-slate-200">
                    <td className="py-2.5 px-4 pl-4 text-slate-600 font-medium">
                      Committed but not yet billed (Informational, excluded from net)
                    </td>
                    {projection.bucket_list.map((b) => (
                      <td key={b.key} className="py-2.5 px-4 text-right font-mono text-slate-700 font-semibold">
                        {formatPaise(b.committed_not_billed_paise)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Excluded Overdue Receivables Notification Banner */}
            <div className="p-3 bg-amber-50/90 border-t border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-2 text-amber-900">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong className="font-bold text-amber-950">{projection.overdue_receivables_label}:</strong>{" "}
                  {formatPaise(projection.overdue_receivables_paise)} are strictly excluded from projection inflows.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Bank Balances History */}
      {activeTab === "balances" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building className="w-4 h-4 text-emerald-600" />
                  <span>Bank Balances Register</span>
                </h2>
              </div>

              {canAddBalance && (
                <button
                  onClick={() => {
                    setFormError(null);
                    setShowBalanceModal(true);
                  }}
                  className="px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-blue-600/25"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Balance Entry</span>
                </button>
              )}
            </div>

            {bankBalances.length === 0 ? (
              <div className="p-12 text-center text-slate-600 text-xs">
                No bank balance entries recorded yet. Click &ldquo;Add Balance Entry&rdquo; to record account balances.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100 text-slate-700 uppercase text-[10px] font-mono font-semibold">
                      <th className="py-3 px-4">Account Label</th>
                      <th className="py-3 px-4 text-right">Balance</th>
                      <th className="py-3 px-4">As-of Date</th>
                      <th className="py-3 px-4">Recorded By</th>
                      <th className="py-3 px-4">Note</th>
                      {isDirector && <th className="py-3 px-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {bankBalances.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50 text-slate-800">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {b.account_label}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-700 text-right">
                          {formatPaise(rupeesToPaise(b.balance))}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {b.as_of_date}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {b.recorded_by_name || "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-600 italic">
                          {b.note || "—"}
                        </td>
                        {isDirector && (
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDeleteBalance(b.id, b.account_label)}
                              title="Delete balance entry"
                              className="p-1 text-slate-500 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Company Cash Items */}
      {activeTab === "cash_items" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-amber-600" />
                  <span>Company Cash Items (Non-Project Movements)</span>
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {/* Filter buttons */}
                <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
                  {(["all", "planned", "done", "cancelled"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setCashItemStatusFilter(status)}
                      className={`px-2.5 py-1 rounded-md text-[11px] capitalize font-semibold transition-colors ${
                        cashItemStatusFilter === status
                          ? "bg-white text-slate-900 shadow-sm font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                {canManageCashItems && (
                  <button
                    onClick={() => {
                      setFormError(null);
                      setShowCashItemModal(true);
                    }}
                    className="px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-md shadow-blue-600/25"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Cash Item</span>
                  </button>
                )}
              </div>
            </div>

            {filteredCashItems.length === 0 ? (
              <div className="p-12 text-center text-slate-600 text-xs">
                No company cash items found matching current filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100 text-slate-700 uppercase text-[10px] font-mono font-semibold">
                      <th className="py-3 px-4">Direction</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4">Expected Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Created By</th>
                      {canManageCashItems && <th className="py-3 px-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredCashItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 text-slate-800">
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                              item.direction === "inflow"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-rose-100 text-rose-800 border border-rose-300"
                            }`}
                          >
                            {item.direction === "inflow" ? (
                              <ArrowDownLeft className="w-3 h-3 text-emerald-700" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3 text-rose-700" />
                            )}
                            {item.direction}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {item.category}
                        </td>
                        <td className="py-3 px-4 text-slate-800">
                          {item.description}
                          {item.recurring_group_id && (
                            <span className="ml-2 text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800 border border-cyan-300 font-semibold">
                              Recurring
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-right text-slate-900">
                          {formatPaise(rupeesToPaise(item.amount))}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {item.expected_date}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold capitalize ${
                              item.status === "done"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : item.status === "cancelled"
                                ? "bg-slate-100 text-slate-500 line-through border border-slate-200"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {item.created_by_name || "—"}
                        </td>
                        {canManageCashItems && (
                          <td className="py-3 px-4 text-right">
                            {item.status === "planned" && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleUpdateCashItemStatus(item.id, "done")}
                                  className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 text-[10px] font-semibold transition-colors"
                                >
                                  Done
                                </button>
                                <button
                                  onClick={() => handleUpdateCashItemStatus(item.id, "cancelled")}
                                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-800 border border-slate-300 text-[10px] font-semibold transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Add Bank Balance */}
      {showBalanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-600" />
                <span>Record Bank Balance Entry</span>
              </h3>
              <button
                onClick={() => setShowBalanceModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitBankBalance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Account Label <span className="text-rose-600">*</span>
                </label>
                {distinctAccountLabels.length > 0 && (
                  <select
                    value={bbAccountLabel}
                    onChange={(e) => setBbAccountLabel(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 mb-2 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Select Existing Account or Choose Custom...</option>
                    {distinctAccountLabels.map((lbl) => (
                      <option key={lbl} value={lbl}>
                        {lbl}
                      </option>
                    ))}
                    <option value="__custom__">+ Enter New Account Name</option>
                  </select>
                )}

                {(bbAccountLabel === "__custom__" || distinctAccountLabels.length === 0) && (
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC Current, SBI Cash Credit, Petty Cash"
                    value={bbCustomLabel}
                    onChange={(e) => setBbCustomLabel(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Balance (INR) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="e.g. 500000.00"
                  value={bbBalance}
                  onChange={(e) => setBbBalance(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  As-of Date (YYYY-MM-DD) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={bbAsOfDate}
                  onChange={(e) => setBbAsOfDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Note / Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Closing balance per netbanking statement"
                  value={bbNote}
                  onChange={(e) => setBbNote(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowBalanceModal(false)}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Balance Entry</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Company Cash Item */}
      {showCashItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Repeat className="w-4 h-4 text-cyan-600" />
                <span>Add Company Cash Item</span>
              </h3>
              <button
                onClick={() => setShowCashItemModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitCashItem} className="space-y-4">
              {/* Direction: Inflow vs Outflow */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Cash Movement Direction <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCiDirection("outflow")}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                      ciDirection === "outflow"
                        ? "bg-rose-50 border-rose-400 text-rose-800 font-bold"
                        : "bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-rose-700" />
                    <span>Outflow (Expense / Payment)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCiDirection("inflow")}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                      ciDirection === "inflow"
                        ? "bg-emerald-50 border-emerald-400 text-emerald-800 font-bold"
                        : "bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Inflow (Income / Injection)</span>
                  </button>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Category <span className="text-rose-600">*</span>
                </label>
                <select
                  value={ciCategory}
                  onChange={(e) => setCiCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="Payroll">Payroll / Salary Total</option>
                  <option value="Rent">Office / Factory Rent</option>
                  <option value="EMI">Loan EMI / Equipment Finance</option>
                  <option value="Statutory">GST / Statutory Taxes / TDS</option>
                  <option value="Capital">Capital Injection</option>
                  <option value="Loan">Loan Drawdown</option>
                  <option value="Operating Expenses">General Operating Expenses</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Strict Salary Rule Callout */}
              {ciCategory === "Payroll" && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Rule Constraint (Section 5 &amp; Brief):</span> Salary must be entered as <strong>ONE total line</strong>, never per employee.
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Description <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. October 2026 Staff Salary Total, Shed Rent, Machinery EMI"
                  value={ciDescription}
                  onChange={(e) => setCiDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Amount and Expected Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Amount (INR) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 250000"
                    value={ciAmount}
                    onChange={(e) => setCiAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Expected Date <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={ciExpectedDate}
                    onChange={(e) => setCiExpectedDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Repeat for N Months Generator (Brief line 506) */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Repeat for N Months</span>
                  </label>
                  <span className="text-[11px] font-mono text-cyan-800 font-bold">
                    {ciRepeatMonths} {ciRepeatMonths === 1 ? "month (single row)" : "months"}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={ciRepeatMonths}
                  onChange={(e) => setCiRepeatMonths(Number(e.target.value))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
                <p className="text-[10px] text-slate-600">
                  {ciRepeatMonths > 1
                    ? `Generates ${ciRepeatMonths} separate rows at creation spaced 1 month apart, stamped with a shared recurring ID.`
                    : "Single entry only."}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCashItemModal(false)}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Cash Item{ciRepeatMonths > 1 ? `s (${ciRepeatMonths})` : ""}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
