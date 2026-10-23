"use client";

import { useState } from "react";
import { ProjectCostsData } from "@/lib/costs/types";
import { formatPaise, paiseToRupees } from "@/lib/money";
import { generateCsvText, downloadCsvInBrowser } from "@/lib/costs/csv";
import {
  TrendingUp,
  AlertTriangle,
  Download,
  Layers,
  ShoppingBag,
  Receipt,
  IndianRupee,
  CheckCircle2,
  Info,
  Lock,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";

interface ProfitabilityTabProps {
  projectId: string;
  projectCode: string;
  projectName: string;
  costData: ProjectCostsData;
  isDirector: boolean;
  isAccounts?: boolean;
}

export function ProfitabilityTab({
  projectId,
  projectCode,
  projectName,
  costData,
  isDirector,
  isAccounts = false,
}: ProfitabilityTabProps) {
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);

  // Authorization check (Section 5: Profit & margin restricted to Director & Accounts)
  if (!isDirector && !isAccounts) {
    return (
      <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400">
        <Lock className="w-10 h-10 mx-auto mb-3 text-amber-400/60" />
        <h3 className="text-sm font-semibold text-slate-200">Access Restricted</h3>
      </div>
    );
  }

  const { summary } = costData;

  function handleExportCsv() {
    const headers = [
      "Category",
      "Budget (Ex-GST)",
      "Committed (Ex-GST)",
      "Billed (Ex-GST)",
      "Paid (Cash)",
      "Settled (Paid+TDS)",
      "Remaining Committed",
      "Uncommitted Budget",
      "Forecast Cost",
      "Status",
      "Overrun Amount",
    ];

    const rows = summary.categories.map((c) => [
      c.categoryName,
      paiseToRupees(c.budgetPaise).toFixed(2),
      paiseToRupees(c.committedPaise).toFixed(2),
      paiseToRupees(c.billedPaise).toFixed(2),
      paiseToRupees(c.paidPaise).toFixed(2),
      paiseToRupees(c.settledPaise).toFixed(2),
      paiseToRupees(c.remainingCommittedPaise).toFixed(2),
      paiseToRupees(c.uncommittedBudgetPaise).toFixed(2),
      paiseToRupees(c.forecastCostPaise).toFixed(2),
      c.isOverBudget ? "OVER BUDGET" : "ON BUDGET",
      paiseToRupees(c.overrunPaise).toFixed(2),
    ]);

    // Totals row
    rows.push([
      "TOTAL",
      paiseToRupees(summary.totalBudgetPaise).toFixed(2),
      paiseToRupees(summary.totalCommittedPaise).toFixed(2),
      paiseToRupees(summary.totalBilledPaise).toFixed(2),
      paiseToRupees(summary.totalPaidPaise).toFixed(2),
      paiseToRupees(summary.totalSettledPaise).toFixed(2),
      paiseToRupees(summary.totalRemainingCommittedPaise).toFixed(2),
      paiseToRupees(summary.totalUncommittedBudgetPaise).toFixed(2),
      paiseToRupees(summary.totalForecastCostPaise).toFixed(2),
      summary.hasOverrun ? "OVER BUDGET" : "ON BUDGET",
      paiseToRupees(summary.totalOverrunPaise).toFixed(2),
    ]);

    const csvContent = generateCsvText(headers, rows);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsvInBrowser(`westeel_${projectCode}_profitability_${dateStr}.csv`, csvContent);
  }

  return (
    <div className="space-y-8">
      {/* HEADER WITH EXPORT BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Project Profitability &amp; Cost Forecast
          </h2>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Export Cost Summary (CSV)</span>
        </button>
      </div>

      {/* RULE F9 INCOMPLETE BADGE OR OVERRUN ALERT */}
      {summary.isIncomplete ? (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                Incomplete Financials
              </span>
              <span>Reason: {summary.incompleteReason}</span>
            </div>
            <p className="text-slate-300 text-[11px]">
              Add a contract value and at least one cost category budget line to see forecast profit and margin. Please complete commercial terms or set budget lines.
            </p>
          </div>
        </div>
      ) : summary.hasOverrun ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-red-500/20 text-red-300 border border-red-500/30 uppercase">
                Cost Overrun
              </span>
              <span>Project forecast cost exceeds budget by {formatPaise(summary.totalOverrunPaise)}</span>
            </div>
            <p className="text-slate-300 text-[11px]">
              Some categories exceed their allocated budget.
            </p>
          </div>
        </div>
      ) : null}

      {/* KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Contract Value (Rule F1) */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
            <IndianRupee className="w-3.5 h-3.5 text-blue-400" />
            Revised Contract Value
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {formatPaise(summary.revisedContractValuePaise)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {summary.hasExplicitContractValue ? "Base contract + approved VOs" : "Not yet set"}
          </div>
        </div>

        {/* Forecast Cost (Rule F8) */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Total Forecast Cost
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {formatPaise(summary.totalForecastCostPaise)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Budget: {formatPaise(summary.totalBudgetPaise)}</span>
            {summary.hasOverrun && (
              <span className="text-red-400 font-mono text-[10px]">
                +{formatPaise(summary.totalOverrunPaise)}
              </span>
            )}
          </div>
        </div>

        {/* Forecast Profit (Rule F9) */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            Forecast Profit
          </div>
          {summary.isIncomplete || summary.forecastProfitPaise === null ? (
            <div className="text-xl font-bold font-mono text-amber-400">Incomplete</div>
          ) : (
            <div
              className={`text-2xl font-bold font-mono ${
                summary.forecastProfitPaise >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatPaise(summary.forecastProfitPaise)}
            </div>
          )}
          <div className="mt-2 text-[10px] text-slate-500 italic">
            Management estimate, not accounting profit
          </div>
        </div>

        {/* Forecast Margin % (Rule F9) */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
            Forecast Margin %
          </div>
          {summary.isIncomplete || summary.forecastMarginPct === null ? (
            <div className="text-xl font-bold font-mono text-amber-400">Incomplete</div>
          ) : (
            <div
              className={`text-2xl font-bold font-mono ${
                summary.forecastMarginPct >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {summary.forecastMarginPct.toFixed(1)}%
            </div>
          )}
          <div className="mt-2 text-[11px] text-slate-400">
            {summary.isIncomplete
              ? summary.incompleteReason
              : `${(summary.forecastMarginPct ?? 0) >= 15 ? "Healthy margin" : "Tight margin"}`}
          </div>
        </div>
      </div>

      {/* SECONDARY CASH ROW: PAID, SETTLED, COLLECTED */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs">
          <div className="text-slate-400 mb-1 flex items-center justify-between">
            <span className="font-medium">Total Billed &amp; Paid (Payables)</span>
            <Receipt className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-slate-200">
              Billed: {formatPaise(summary.totalBilledPaise)}
            </span>
            <span className="font-mono text-emerald-400 font-semibold">
              Paid: {formatPaise(summary.totalPaidPaise)}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs">
          <div className="text-slate-400 mb-1 flex items-center justify-between">
            <span className="font-medium">Total Settled (Paid + TDS)</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-emerald-400 font-bold text-sm">
              {formatPaise(summary.totalSettledPaise)}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs">
          <div className="text-slate-400 mb-1 flex items-center justify-between">
            <span className="font-medium">Customer Collections</span>
            <IndianRupee className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-blue-400 font-bold text-sm">
              {formatPaise(summary.totalReceiptsCollectedPaise)}
            </span>
            <span className="text-[11px] text-slate-500">Collected cash</span>
          </div>
        </div>
      </div>

      {/* 6 COST STATES TABLE (RULE F6 & F8) */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden backdrop-blur-sm">
        <div className="p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              Six-State Cost Breakdown &amp; Category Forecast
            </h3>
          </div>

          <button
            onClick={() => setShowFormulaDetails(!showFormulaDetails)}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Info className="w-3.5 h-3.5" />
            <span>{showFormulaDetails ? "Hide formula" : "Show formula"}</span>
          </button>
        </div>

        {showFormulaDetails && (
          <div className="p-4 bg-slate-950/70 border-b border-slate-800 text-xs text-slate-300 space-y-2">
            <div className="font-semibold text-slate-100">Category cost forecast formula:</div>
            <div className="font-mono text-[11px] p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-300">
              forecast = billed + max(0, committed - billed_against_orders) + max(0, budget - max(committed, billed_against_orders) - unlinked_bills)
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Where: (1) <strong>billed</strong> is actual bills received; (2) <strong>remaining committed</strong> is orders still to be fulfilled/billed; (3) <strong>uncommitted budget</strong> is the remaining buffer after committed orders, bills against orders, and any unlinked bills. If no budget line exists, forecast equals total commitments and unlinked bills.
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
              <tr>
                <th className="py-3 px-3">Cost Category</th>
                <th className="py-3 px-3 text-right">1. Budget</th>
                <th className="py-3 px-3 text-right">2. Committed</th>
                <th className="py-3 px-3 text-right">3. Billed</th>
                <th className="py-3 px-3 text-right">4. Paid</th>
                <th className="py-3 px-3 text-right">5. Settled</th>
                <th className="py-3 px-3 text-right text-slate-400">Rem. Committed</th>
                <th className="py-3 px-3 text-right text-slate-400">Uncommitted</th>
                <th className="py-3 px-3 text-right text-emerald-400 font-bold">Forecast Cost</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {summary.categories.map((c) => (
                <tr
                  key={c.categoryId}
                  className={`hover:bg-slate-800/30 transition ${
                    c.isOverBudget ? "bg-red-500/5" : ""
                  }`}
                >
                  <td className="py-3 px-3 font-semibold text-slate-100">{c.categoryName}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">
                    {c.hasBudget ? formatPaise(c.budgetPaise) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-amber-400">
                    {c.committedPaise > 0 ? formatPaise(c.committedPaise) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-200">
                    {c.billedPaise > 0 ? formatPaise(c.billedPaise) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">
                    {c.paidPaise > 0 ? formatPaise(c.paidPaise) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-400">
                    {c.settledPaise > 0 ? formatPaise(c.settledPaise) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-400 text-[11px]">
                    {formatPaise(c.remainingCommittedPaise)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-400 text-[11px]">
                    {formatPaise(c.uncommittedBudgetPaise)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                    {formatPaise(c.forecastCostPaise)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {c.isOverBudget ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                        Over (+{formatPaise(c.overrunPaise)})
                      </span>
                    ) : !c.hasBudget && c.forecastCostPaise > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        No Budget
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        On Budget
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* TOTALS FOOTER */}
            <tfoot className="bg-slate-950/80 border-t-2 border-slate-700 font-mono font-bold text-xs text-slate-100">
              <tr>
                <td className="py-3.5 px-3 uppercase text-[11px]">TOTALS</td>
                <td className="py-3.5 px-3 text-right text-slate-200">
                  {formatPaise(summary.totalBudgetPaise)}
                </td>
                <td className="py-3.5 px-3 text-right text-amber-400">
                  {formatPaise(summary.totalCommittedPaise)}
                </td>
                <td className="py-3.5 px-3 text-right text-slate-100">
                  {formatPaise(summary.totalBilledPaise)}
                </td>
                <td className="py-3.5 px-3 text-right text-slate-200">
                  {formatPaise(summary.totalPaidPaise)}
                </td>
                <td className="py-3.5 px-3 text-right text-emerald-400">
                  {formatPaise(summary.totalSettledPaise)}
                </td>
                <td className="py-3.5 px-3 text-right text-slate-400 text-[11px]">
                  {formatPaise(summary.totalRemainingCommittedPaise)}
                </td>
                <td className="py-3.5 px-3 text-right text-slate-400 text-[11px]">
                  {formatPaise(summary.totalUncommittedBudgetPaise)}
                </td>
                <td className="py-3.5 px-3 text-right text-emerald-400 text-sm">
                  {formatPaise(summary.totalForecastCostPaise)}
                </td>
                <td className="py-3.5 px-3 text-center">
                  {summary.hasOverrun ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                      Overrun
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      On Budget
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
