"use client";

import Link from "next/link";
import { OverviewBlock1Data } from "@/lib/overview/queries";
import { formatPaise } from "@/lib/money";
import {
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  MapPin,
  Flag,
  ArrowUpRight,
  IndianRupee,
  Truck,
  TrendingDown,
  FileQuestion,
  TrendingUp,
} from "lucide-react";

interface OverviewClientProps {
  data: OverviewBlock1Data;
}

export function OverviewClient({ data }: OverviewClientProps) {
  const {
    metrics,
    active_projects,
    receivables,
    payables,
    cash,
    sales_this_month,
    projects_over_budget,
    projects_incomplete,
    alerts,
  } = data;

  const formatRupees = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const todayIstFormatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Page Title & IST Date Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-300 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-black">
              Director Overview
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-black font-mono glass-panel px-4 py-2.5 rounded-xl border border-slate-300 shadow-sm font-bold">
          <Clock className="w-4 h-4 text-orange-600" />
          <span>{todayIstFormatted} (IST)</span>
        </div>
      </div>

      {/* BLOCK 1: PROJECT STATUS & DELAYS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-orange-700 flex items-center gap-2 font-mono">
              <Building2 className="w-4 h-4 text-orange-700" />
              <span>Project Status &amp; Delays</span>
            </h2>
          </div>
        </div>

        {/* 6 Metric KPI Cards in Spatial Glass */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Active Projects */}
          <Link
            href="/x9admin/projects"
            className="glass-card-blue p-4 rounded-2xl flex flex-col justify-between group cursor-pointer shadow-sm"
          >
            <div className="text-xs font-bold text-blue-900 flex items-center justify-between font-mono">
              <span>Active Projects</span>
              <ArrowUpRight className="w-4 h-4 text-blue-600 group-hover:text-blue-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </div>
            <div className="text-3xl font-black text-black font-mono mt-2">
              {metrics.active_projects_count}
            </div>
          </Link>

          {/* Delayed Projects (Rule R1) */}
          <Link
            href="/x9admin/projects"
            className={`p-4 rounded-2xl flex flex-col justify-between group cursor-pointer shadow-sm ${
              metrics.delayed_projects_count > 0
                ? "glass-card-orange"
                : "glass-card"
            }`}
          >
            <div className="text-xs font-bold text-orange-900 flex items-center justify-between font-mono">
              <span>Delayed</span>
              <ArrowUpRight className="w-4 h-4 text-orange-600 group-hover:text-orange-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </div>
            <div
              className={`text-3xl font-black font-mono mt-2 ${
                metrics.delayed_projects_count > 0
                  ? "text-orange-700"
                  : "text-black"
              }`}
            >
              {metrics.delayed_projects_count}
            </div>
          </Link>

          {/* Overdue Tasks (Rule R3) */}
          <Link
            href="/x9admin/tasks"
            className={`p-4 rounded-2xl flex flex-col justify-between group cursor-pointer shadow-sm ${
              metrics.overdue_tasks_count > 0
                ? "glass-card-orange"
                : "glass-card"
            }`}
          >
            <div className="text-xs font-bold text-orange-900 flex items-center justify-between font-mono">
              <span>Overdue Tasks</span>
              <ArrowUpRight className="w-4 h-4 text-orange-600 group-hover:text-orange-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </div>
            <div
              className={`text-3xl font-black font-mono mt-2 ${
                metrics.overdue_tasks_count > 0 ? "text-orange-700" : "text-black"
              }`}
            >
              {metrics.overdue_tasks_count}
            </div>
          </Link>

          {/* Blocked Tasks & Issues (Rule R3) */}
          <Link
            href="/x9admin/tasks"
            className={`p-4 rounded-2xl flex flex-col justify-between group cursor-pointer shadow-sm ${
              metrics.blocked_tasks_count > 0
                ? "glass-card border-rose-300"
                : "glass-card"
            }`}
          >
            <div className="text-xs font-bold text-rose-900 flex items-center justify-between font-mono">
              <span>Blocked Tasks</span>
              <ArrowUpRight className="w-4 h-4 text-rose-600 group-hover:text-rose-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </div>
            <div
              className={`text-3xl font-black font-mono mt-2 ${
                metrics.blocked_tasks_count > 0 ? "text-rose-700" : "text-black"
              }`}
            >
              {metrics.blocked_tasks_count}
            </div>
          </Link>

          {/* Pending Drawing Approvals (Rule R5) */}
          <Link
            href="/x9admin/documents"
            className={`p-4 rounded-2xl flex flex-col justify-between group cursor-pointer shadow-sm ${
              metrics.pending_drawings_count > 0
                ? "glass-card-blue"
                : "glass-card"
            }`}
          >
            <div className="text-xs font-bold text-blue-900 flex items-center justify-between font-mono">
              <span>Pending Drawings</span>
              <ArrowUpRight className="w-4 h-4 text-blue-600 group-hover:text-blue-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </div>
            <div
              className={`text-3xl font-black font-mono mt-2 ${
                metrics.pending_drawings_count > 0 ? "text-blue-700" : "text-black"
              }`}
            >
              {metrics.pending_drawings_count}
            </div>
          </Link>

          {/* Late Vendor Orders (Rule R9) */}
          <Link
            href="/x9admin/projects"
            className={`p-4 rounded-2xl flex flex-col justify-between group cursor-pointer shadow-sm ${
              (metrics.late_orders_count || 0) > 0
                ? "glass-card-orange"
                : "glass-card"
            }`}
          >
            <div className="text-xs font-bold text-slate-900 flex items-center justify-between font-mono">
              <span>Late Orders</span>
              <Truck className="w-4 h-4 text-slate-700 group-hover:text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </div>
            <div
              className={`text-3xl font-black font-mono mt-2 ${
                (metrics.late_orders_count || 0) > 0 ? "text-orange-700" : "text-black"
              }`}
            >
              {metrics.late_orders_count || 0}
            </div>
          </Link>
        </div>

        {/* Table of Active Projects in Spatial Glass */}
        <div className="glass-panel rounded-2xl overflow-hidden mt-6 border border-slate-300 shadow-sm">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-100">
            <h3 className="font-extrabold text-base text-black flex items-center gap-2">
              <span>Active Projects Status &amp; Milestones</span>
            </h3>
            <Link
              href="/x9admin/projects"
              className="text-xs text-orange-700 hover:text-orange-900 font-bold inline-flex items-center gap-1"
            >
              <span>Projects Register</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100 font-mono">
                  <th className="py-3.5 px-4 font-bold uppercase tracking-wider text-black text-xs">Project</th>
                  <th className="py-3.5 px-4 font-bold uppercase tracking-wider text-black text-xs">Site Location</th>
                  <th className="py-3.5 px-4 font-bold uppercase tracking-wider text-black text-xs">Current Stage</th>
                  <th className="py-3.5 px-4 font-bold uppercase tracking-wider text-black text-xs">Progress</th>
                  <th className="py-3.5 px-4 font-bold uppercase tracking-wider text-black text-xs">Schedule</th>
                  <th className="py-3.5 px-4 font-bold uppercase tracking-wider text-black text-xs">Last Site Report</th>
                  <th className="py-3.5 px-4 font-bold uppercase tracking-wider text-black text-xs text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {active_projects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p>No active projects in execution pipeline.</p>
                      <Link
                        href="/x9admin/projects"
                        className="inline-flex items-center gap-1 text-orange-600 hover:underline mt-2 text-xs font-medium"
                      >
                        Create a project in the projects register
                      </Link>
                    </td>
                  </tr>
                ) : (
                  active_projects.map((proj) => (
                    <tr key={proj.id} className="hover:bg-slate-50 transition-colors border-b border-slate-200">
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/x9admin/projects/${proj.id}`}
                          className="font-bold text-orange-700 hover:text-orange-900 flex items-center gap-1.5 font-mono text-xs"
                        >
                          <span>{proj.code}</span>
                        </Link>
                        <div className="text-black font-semibold text-xs mt-0.5">{proj.name}</div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-900 font-medium">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                          <span>{proj.site_location}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="chip-grey px-2.5 py-1 rounded-lg text-xs font-mono font-bold inline-block text-black">
                          Stage {proj.stage_position}: {proj.stage_name}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-black font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Flag className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                          <span>{proj.progress_text}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {proj.is_delayed ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg chip-rose text-xs font-bold">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                            <span>
                              {proj.delay_reason === "project_overdue"
                                ? "Delayed: Project Overdue"
                                : "Delayed: Milestone Overdue"}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg chip-emerald text-xs font-bold text-emerald-950">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span>On Schedule</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-800 text-xs font-semibold">
                        {proj.last_report_date ? (
                          <span className="text-black font-bold">{proj.last_report_date}</span>
                        ) : (
                          <span className="text-slate-600 italic">No reports yet</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/x9admin/projects/${proj.id}`}
                          className="btn-spatial-glass inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-black border-slate-300 hover:border-black"
                        >
                          <span>Open</span>
                          <ArrowRight className="w-3 h-3 text-orange-600" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* BLOCK 2: MONEY (RECEIVABLES, PAYABLES, COSTS, FORECAST) */}
      <div className="space-y-6 pt-6 border-t border-slate-200">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-orange-600 flex items-center gap-2 font-mono">
            <IndianRupee className="w-4 h-4 text-emerald-600" />
            <span>Money &amp; Commercials</span>
          </h2>
        </div>

        {/* 1. Receivables Panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              Customer Receivables (Collections)
            </span>
            <Link
              href="/x9admin/collections"
              className="text-xs text-orange-600 hover:text-orange-700 font-semibold inline-flex items-center gap-1"
            >
              <span>Collections Register</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="glass-card p-4 rounded-2xl flex flex-col justify-between shadow-sm">
              <div className="text-[11px] font-medium text-slate-600 font-mono">Total Receivables</div>
              <div className="text-2xl font-extrabold font-mono text-slate-900 mt-2">
                {formatPaise(receivables?.total_receivable_paise || 0)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Excludes cancelled invoices</div>
            </div>

            <div
              className={`p-4 rounded-2xl flex flex-col justify-between shadow-sm ${
                (receivables?.total_overdue_paise || 0) > 0
                  ? "glass-card-orange"
                  : "glass-card"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-orange-700 font-mono">
                <span>Overdue Receivables</span>
                {(receivables?.overdue_invoices_count || 0) > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full chip-orange">
                    {receivables.overdue_invoices_count} overdue
                  </span>
                )}
              </div>
              <div
                className={`text-2xl font-extrabold font-mono mt-2 ${
                  (receivables?.total_overdue_paise || 0) > 0 ? "text-orange-600" : "text-slate-900"
                }`}
              >
                {formatPaise(receivables?.total_overdue_paise || 0)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Past invoice due date</div>
            </div>

            <div className="glass-card p-4 rounded-2xl flex flex-col justify-between shadow-sm">
              <div className="text-[11px] font-semibold text-emerald-700 font-mono">Current (Not Overdue)</div>
              <div className="text-2xl font-extrabold font-mono text-emerald-600 mt-2">
                {formatPaise(receivables?.current_paise || 0)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Due date on or after today</div>
            </div>

            <div className="glass-card p-4 rounded-2xl flex flex-col justify-between shadow-sm">
              <div className="text-[11px] font-semibold text-orange-700 flex items-center justify-between font-mono">
                <span>Customer Advances</span>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full chip-orange">
                  Unallocated
                </span>
              </div>
              <div className="text-2xl font-extrabold font-mono text-orange-600 mt-2">
                {formatPaise(receivables?.total_advances_paise || 0)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Receipts with no invoice linked</div>
            </div>
          </div>
        </div>

        {/* 2. Payables Panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
              Vendor Payables (Bills &amp; Expenses)
            </span>
            <Link
              href="/x9admin/payables"
              className="text-xs text-orange-600 hover:text-orange-700 font-semibold inline-flex items-center gap-1"
            >
              <span>Payables Register</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="glass-card p-4 rounded-2xl flex flex-col justify-between shadow-sm">
              <div className="text-[11px] font-medium text-slate-600 font-mono">Total Payables</div>
              <div className="text-2xl font-extrabold font-mono text-slate-900 mt-2">
                {formatPaise(payables?.total_payable_paise || 0)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Excludes cancelled bills</div>
            </div>

            <div
              className={`p-4 rounded-2xl flex flex-col justify-between shadow-sm ${
                (payables?.total_overdue_paise || 0) > 0
                  ? "glass-card-orange"
                  : "glass-card"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-rose-700 font-mono">
                <span>Overdue Payables</span>
                {(payables?.overdue_bills_count || 0) > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full chip-rose">
                    {payables.overdue_bills_count} overdue
                  </span>
                )}
              </div>
              <div
                className={`text-2xl font-extrabold font-mono mt-2 ${
                  (payables?.total_overdue_paise || 0) > 0 ? "text-rose-600" : "text-slate-900"
                }`}
              >
                {formatPaise(payables?.total_overdue_paise || 0)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Past bill due date</div>
            </div>

            <div className="glass-card p-4 rounded-2xl flex flex-col justify-between shadow-sm">
              <div className="text-[11px] font-semibold text-orange-700 font-mono">Due Within 7 Days</div>
              <div className="text-2xl font-extrabold font-mono text-orange-600 mt-2">
                {formatPaise(payables?.due_within_7days_paise || 0)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Immediate cash requirement</div>
            </div>

            <div className="glass-card p-4 rounded-2xl flex flex-col justify-between shadow-sm">
              <div className="text-[11px] font-medium text-slate-600 font-mono">Current (Not Overdue)</div>
              <div className="text-2xl font-extrabold font-mono text-slate-900 mt-2">
                {formatPaise(payables?.current_paise || 0)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Due date on or after today</div>
            </div>
          </div>

          {/* Payables Aging Buckets */}
          <div className="p-4 rounded-2xl glass-panel space-y-3 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900 font-mono uppercase tracking-wider">Payables Aging Buckets</span>
              <span className="text-[11px] text-slate-500 font-mono">IST Days Overdue</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-semibold text-slate-600 font-mono">Current</div>
                <div className="text-sm font-extrabold font-mono text-slate-900 mt-1">
                  {formatPaise(payables?.current_paise || 0)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-orange-50/60 border border-orange-200">
                <div className="text-[10px] font-semibold text-orange-700 font-mono">1–30 Days Overdue</div>
                <div className="text-sm font-extrabold font-mono text-orange-600 mt-1">
                  {formatPaise(payables?.bucket1_30_paise || 0)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-orange-50/60 border border-orange-200">
                <div className="text-[10px] font-semibold text-orange-700 font-mono">31–60 Days Overdue</div>
                <div className="text-sm font-extrabold font-mono text-orange-600 mt-1">
                  {formatPaise(payables?.bucket31_60_paise || 0)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200">
                <div className="text-[10px] font-semibold text-rose-700 font-mono">61–90 Days Overdue</div>
                <div className="text-sm font-extrabold font-mono text-rose-600 mt-1">
                  {formatPaise(payables?.bucket61_90_paise || 0)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 col-span-2 sm:col-span-1">
                <div className="text-[10px] font-semibold text-rose-700 font-mono">Over 90 Days Overdue</div>
                <div className="text-sm font-extrabold font-mono text-rose-600 mt-1">
                  {formatPaise(payables?.bucket_over90_paise || 0)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Cash Flow & Liquidity Panel (Rule F11 & F12) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
              Cash Flow &amp; Liquidity
            </span>
            <Link
              href="/x9admin/cashflow"
              className="text-xs text-orange-600 hover:text-orange-700 font-semibold inline-flex items-center gap-1"
            >
              <span>Cash Flow Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Cash on Hand */}
            <div
              className={`p-5 rounded-2xl flex flex-col justify-between shadow-sm ${
                cash?.is_stale
                  ? "glass-card-orange"
                  : "glass-card-blue"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-blue-700 font-mono">
                <span>Cash on Hand</span>
                {cash?.is_stale && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full chip-orange">
                    Stale: update balances
                  </span>
                )}
              </div>
              <div className="text-3xl font-extrabold font-mono text-blue-700 mt-2">
                {formatPaise(cash?.cash_on_hand_paise || 0)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {cash?.as_of_date ? `As of ${cash.as_of_date} (oldest recorded)` : "No balances entered"}
              </div>
            </div>

            {/* Projected 30-Day Cash */}
            <div
              className={`p-5 rounded-2xl flex flex-col justify-between shadow-sm ${
                (cash?.projected_30d_cash_paise || 0) < 0 || cash?.has_projected_shortfall
                  ? "glass-card-orange"
                  : "glass-card"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 font-mono">
                <span>Projected 30-Day Cash</span>
                {cash?.has_projected_shortfall && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full chip-rose">
                    Shortfall alert
                  </span>
                )}
              </div>
              <div
                className={`text-3xl font-extrabold font-mono mt-2 ${
                  (cash?.projected_30d_cash_paise || 0) < 0
                    ? "text-rose-600"
                    : "text-emerald-600"
                }`}
              >
                {formatPaise(cash?.projected_30d_cash_paise || 0)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Net running balance through day 30
              </div>
            </div>

            {/* Projection Notice & Details */}
            <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between shadow-sm border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-700 flex items-center justify-between font-mono">
                <span>Projection note</span>
              </div>
              <p className="text-[11px] text-slate-700 italic mt-2">
                &ldquo;Projection from recorded data. Excludes anything not entered.&rdquo;
              </p>
              <div className="text-[10px] text-slate-500 mt-1">
                Overdue receivables excluded &amp; shown separately
              </div>
            </div>
          </div>
        </div>

        {/* 4. Over-Budget & Incomplete Financials Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Projects Over Budget (Rule F10) */}
          <div className="p-4 rounded-2xl glass-panel space-y-3 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-rose-600" />
                <span>Projects Over Budget</span>
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded chip-rose font-bold">
                {projects_over_budget.length}
              </span>
            </div>

            {projects_over_budget.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">All projects are tracking on or under budget.</p>
            ) : (
              <div className="space-y-2">
                {projects_over_budget.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-orange-600 font-mono">{p.code}</div>
                      <div className="text-[11px] text-slate-700 font-medium">{p.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono text-rose-600">
                        +{formatPaise(p.overrun_paise)}
                      </div>
                      <Link
                        href={`/x9admin/projects/${p.id}?tab=profitability`}
                        className="text-[10px] text-slate-500 hover:text-orange-600 underline inline-flex items-center gap-0.5"
                      >
                        <span>View Profitability</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Incomplete Financial Data (Rule F9) */}
          <div className="p-4 rounded-2xl glass-panel space-y-3 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileQuestion className="w-4 h-4 text-orange-600" />
                <span>Incomplete Financial Data</span>
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded chip-orange font-bold">
                {projects_incomplete.length}
              </span>
            </div>

            {projects_incomplete.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">All active projects have contract values and budgets entered.</p>
            ) : (
              <div className="space-y-2">
                {projects_incomplete.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-orange-600 font-mono">{p.code}</div>
                      <div className="text-[11px] text-slate-700 font-medium">{p.name}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded chip-orange">
                        {p.reason}
                      </span>
                      <div className="mt-1">
                        <Link
                          href={`/x9admin/projects/${p.id}?tab=orders`}
                          className="text-[10px] text-slate-500 hover:text-orange-600 underline inline-flex items-center gap-0.5"
                        >
                          <span>Enter Data</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BLOCK 3: SALES (THIS MONTH) */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-orange-600 flex items-center gap-2 font-mono">
              <TrendingUp className="w-4 h-4 text-orange-600" />
              <span>Sales (This Month)</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Live activity &amp; pipeline metrics for {sales_this_month?.date_range?.label || "This Month"} ({sales_this_month?.date_range?.startDate || ""} &rarr; {sales_this_month?.date_range?.endDate || ""} IST).
            </p>
          </div>

          <Link
            href="/x9admin/sales?tab=tracker"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-3 py-1.5 rounded-xl transition self-start sm:self-auto"
          >
            <span>Full Sales Tracker</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 5 KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Leads */}
          <Link
            href="/x9admin/sales?tab=enquiries"
            className="glass-card p-4 rounded-2xl flex flex-col justify-between group cursor-pointer shadow-sm hover:border-slate-300 transition"
          >
            <div className="text-[11px] font-semibold text-slate-700 flex items-center justify-between font-mono">
              <span>Leads Received</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900 font-mono mt-2">
              {sales_this_month?.activity?.leads_received ?? 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Created this month</div>
          </Link>

          {/* Meetings */}
          <Link
            href="/x9admin/sales?tab=enquiries"
            className="glass-card-blue p-4 rounded-2xl flex flex-col justify-between group cursor-pointer shadow-sm hover:border-blue-300 transition"
          >
            <div className="text-[11px] font-semibold text-blue-700 flex items-center justify-between font-mono">
              <span>Meetings Held</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-blue-500 group-hover:text-blue-700 transition" />
            </div>
            <div className="text-3xl font-extrabold text-blue-700 font-mono mt-2">
              {sales_this_month?.activity?.meetings_held ?? 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Meetings &amp; site visits</div>
          </Link>

          {/* Quotations Sent */}
          <Link
            href="/x9admin/sales?tab=quotations"
            className="glass-card p-4 rounded-2xl flex flex-col justify-between group cursor-pointer shadow-sm hover:border-indigo-300 transition"
          >
            <div className="text-[11px] font-semibold text-indigo-700 flex items-center justify-between font-mono">
              <span>Quotations Sent</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-indigo-500 group-hover:text-indigo-700 transition" />
            </div>
            <div className="text-3xl font-extrabold text-indigo-700 font-mono mt-2">
              {sales_this_month?.activity?.enquiries_quoted ?? 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 truncate">
              {formatRupees(sales_this_month?.activity?.quotation_value_sent ?? 0)} sent
            </div>
          </Link>

          {/* Projects Finalised */}
          <Link
            href="/x9admin/sales?tab=tracker"
            className="glass-card-emerald p-4 rounded-2xl flex flex-col justify-between group cursor-pointer shadow-sm hover:border-emerald-300 transition"
          >
            <div className="text-[11px] font-semibold text-emerald-800 flex items-center justify-between font-mono">
              <span>Projects Finalised</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 group-hover:text-emerald-800 transition" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-700 font-mono mt-2">
              {sales_this_month?.activity?.projects_finalised ?? 0}
            </div>
            <div className="text-[10px] text-emerald-800 mt-1 truncate">
              {formatRupees(sales_this_month?.activity?.total_win_value ?? 0)} won
            </div>
          </Link>

          {/* Open Pipeline */}
          <Link
            href="/x9admin/sales?tab=enquiries"
            className="glass-card-orange p-4 rounded-2xl flex flex-col justify-between group cursor-pointer shadow-sm hover:border-orange-300 transition"
          >
            <div className="text-[11px] font-semibold text-orange-700 flex items-center justify-between font-mono">
              <span>Open Pipeline</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-orange-500 group-hover:text-orange-700 transition" />
            </div>
            <div className="text-2xl font-extrabold text-orange-600 font-mono mt-2 truncate">
              {formatRupees(sales_this_month?.open_pipeline_value ?? 0)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {sales_this_month?.open_pipeline_count ?? 0} open/quoted deals
            </div>
          </Link>
        </div>
      </div>

      {/* OPERATIONAL ALERTS LIST (RULE R11) */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 font-mono">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <span>Operational &amp; Financial Alerts</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                {alerts.length}
              </span>
            </h2>
          </div>

          <Link
            href="/x9admin/alerts"
            className="text-xs text-orange-600 hover:text-orange-700 font-semibold inline-flex items-center gap-1"
          >
            <span>Full Alerts Directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Alerts List */}
        <div className="space-y-2.5">
          {alerts.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-slate-600 text-xs shadow-sm">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
              <p className="font-semibold text-slate-800">All clear! No active operational alerts.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                All projects, milestones, tasks, site reports, drawings, vendor orders, and payables are on schedule.
              </p>
            </div>
          ) : (
            alerts.map((alert) => {
              const isCritical = alert.severity === "critical";
              const isHigh = alert.severity === "high";

              return (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition shadow-sm ${
                    isCritical
                      ? "bg-rose-50 border-rose-200 text-rose-900"
                      : isHigh
                      ? "bg-orange-50/70 border-orange-200 text-orange-950"
                      : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Severity Badge */}
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                          isCritical
                            ? "bg-rose-600 text-white"
                            : isHigh
                            ? "bg-orange-600 text-white"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {alert.severity}
                      </span>

                      {alert.project_code && (
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-white text-orange-700 font-bold border border-orange-200">
                          {alert.project_code}
                        </span>
                      )}

                      <span className="font-semibold text-xs text-slate-900">
                        {alert.title}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-700">
                      {alert.description}
                    </p>

                    <div className="flex items-center gap-4 text-[10px] text-slate-500 pt-0.5">
                      <span>Age: {alert.age_days} days</span>
                      {alert.assigned_person && (
                        <span>Assigned: {alert.assigned_person}</span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    <Link
                      href={alert.source_url}
                      className="btn-spatial-glass inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-slate-700 text-xs font-medium border border-slate-200 transition"
                    >
                      <span>View Record</span>
                      <ArrowRight className="w-3 h-3 text-orange-600" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
