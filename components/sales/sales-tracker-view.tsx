"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  SalesPeriodPreset,
  SalesTrackerEnquiryInput,
  computeSalesTrackerMetrics,
  getPeriodDateRange,
} from "@/lib/rules/sales";
import { getIstDateString } from "@/lib/rules/alerts";
import {
  TrendingUp,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Briefcase,
  ArrowRight,
  Filter,
  Layers,
  Percent,
  Timer,
  PieChart,
  UserCheck,
  Building,
  Target,
  BarChart3,
  ExternalLink,
} from "lucide-react";

interface SalesTrackerViewProps {
  enquiries: SalesTrackerEnquiryInput[];
  isDirector?: boolean;
  defaultPreset?: SalesPeriodPreset;
  title?: string;
}

export function SalesTrackerView({
  enquiries,
  isDirector = true,
  defaultPreset = "this_month",
  title = "Sales Tracker Dashboard",
}: SalesTrackerViewProps) {
  const todayIst = getIstDateString();

  // Period Preset State (Rule S6)
  const [preset, setPreset] = useState<SalesPeriodPreset>(defaultPreset);
  const [customStart, setCustomStart] = useState<string>(todayIst);
  const [customEnd, setCustomEnd] = useState<string>(todayIst);

  // Compute Active Date Range (Rule S6)
  const dateRange = useMemo(() => {
    return getPeriodDateRange(preset, new Date(), customStart, customEnd);
  }, [preset, customStart, customEnd]);

  // Compute Full Sales Tracker Metrics (Rules S7 to S10)
  const metrics = useMemo(() => {
    return computeSalesTrackerMetrics(enquiries, dateRange, todayIst);
  }, [enquiries, dateRange, todayIst]);

  const {
    activity,
    funnel,
    average_sales_cycle_days,
    sales_cycle_sample_count,
    breakdown_by_salesperson,
    breakdown_by_source,
    breakdown_by_lost_reason,
    open_pipeline_count,
    open_pipeline_value,
    followups_due_count,
    finalised_projects,
  } = metrics;

  const formatRupees = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const presets: { id: SalesPeriodPreset; label: string }[] = [
    { id: "this_month", label: "This Month" },
    { id: "last_month", label: "Last Month" },
    { id: "this_quarter", label: "This Quarter" },
    { id: "this_fy", label: "This FY" },
    { id: "last_fy", label: "Last FY" },
    { id: "custom", label: "Custom Range" },
  ];

  return (
    <div className="space-y-8">
      {/* 1. Header & Period Preset Controls (Rule S6) */}
      <div className="p-6 rounded-2xl glass-panel border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-orange-600 uppercase tracking-wider font-mono">
              <TrendingUp className="w-4 h-4" />
              <span>Sales Performance Analytics</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              {title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-orange-600" />
              <span>
                {dateRange.startDate} &rarr; {dateRange.endDate}
              </span>
              <span className="text-[10px] text-slate-400 font-sans ml-1">({dateRange.label})</span>
            </div>
          </div>
        </div>

        {/* Period Preset Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-500 mr-2 flex items-center gap-1 font-mono">
            <Filter className="w-3 h-3 text-slate-400" /> Period Preset:
          </span>
          {presets.map((p) => {
            const isActive = preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? "bg-orange-600 text-white shadow-sm"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Custom Date Range Selectors */}
        {preset === "custom" && (
          <div className="p-3.5 rounded-xl bg-orange-50/60 border border-orange-200 flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">From (IST):</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">To (IST):</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <span className="text-[11px] text-slate-500">
              Indian Financial Year &amp; dates calculated strictly in Asia/Kolkata timezone.
            </span>
          </div>
        )}
      </div>

      {/* 2. Rule S7.1: Activity Block in the Period */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 font-mono">
              <ActivityIcon className="w-4 h-4 text-orange-600" />
              <span>1. Activity in the Period</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Live events that occurred between {dateRange.startDate} and {dateRange.endDate}, regardless of enquiry creation date.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full chip-orange">
            Period: {dateRange.label}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Leads Received */}
          <div className="p-4 rounded-2xl glass-card flex flex-col justify-between shadow-sm">
            <div className="text-[11px] font-semibold text-slate-600 font-mono">Leads Received</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono mt-2">
              {activity.leads_received}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Created in period</div>
          </div>

          {/* Meetings Held */}
          <div className="p-4 rounded-2xl glass-card flex flex-col justify-between shadow-sm">
            <div className="text-[11px] font-semibold text-blue-700 font-mono">Meetings Held</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-700 font-mono mt-2">
              {activity.meetings_held}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Meetings &amp; site visits</div>
          </div>

          {/* Enquiries Quoted */}
          <div className="p-4 rounded-2xl glass-card flex flex-col justify-between shadow-sm">
            <div className="text-[11px] font-semibold text-indigo-700 font-mono">Enquiries Quoted</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-indigo-700 font-mono mt-2">
              {activity.enquiries_quoted}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">First sent in period</div>
          </div>

          {/* Quotation Value Sent */}
          <div className="p-4 rounded-2xl glass-card flex flex-col justify-between shadow-sm">
            <div className="text-[11px] font-semibold text-slate-700 font-mono">Quoted Value Sent</div>
            <div className="text-lg sm:text-xl font-extrabold text-slate-900 font-mono mt-2 truncate">
              {formatRupees(activity.quotation_value_sent)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Latest sent vers. ex-GST</div>
          </div>

          {/* Projects Finalised (Won) */}
          <div className="p-4 rounded-2xl glass-card-emerald flex flex-col justify-between shadow-sm">
            <div className="text-[11px] font-semibold text-emerald-800 font-mono">Projects Finalised</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono mt-2">
              {activity.projects_finalised}
            </div>
            <div className="text-[10px] text-emerald-800 mt-1">Won in period</div>
          </div>

          {/* Total Win Value */}
          <div className="p-4 rounded-2xl glass-card-emerald flex flex-col justify-between shadow-sm">
            <div className="text-[11px] font-semibold text-emerald-800 font-mono">Total Win Value</div>
            <div className="text-lg sm:text-xl font-extrabold text-emerald-700 font-mono mt-2 truncate">
              {formatRupees(activity.total_win_value)}
            </div>
            <div className="text-[10px] text-emerald-800 mt-1">Accepted quotes ex-GST</div>
          </div>

          {/* Leads Lost */}
          <div className="p-4 rounded-2xl glass-card-rose flex flex-col justify-between shadow-sm">
            <div className="text-[11px] font-semibold text-rose-800 font-mono">Leads Lost</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-700 font-mono mt-2">
              {activity.leads_lost}
            </div>
            <div className="text-[10px] text-rose-800 mt-1">Marked lost in period</div>
          </div>
        </div>
      </div>

      {/* 3. Rule S7.2: Cohort Funnel for Leads Received in the Period */}
      <div className="p-6 rounded-2xl glass-panel border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-orange-600" />
                <span>2. Cohort Funnel for Leads Received in Period</span>
              </h3>
              {funnel.is_small_sample && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full chip-orange font-bold">
                  Small sample (N &lt; 5)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Tracks the lifecycle conversion of the {funnel.cohort_size} leads created between {dateRange.startDate} and {dateRange.endDate}.
            </p>
          </div>

          <div className="text-xs font-mono font-bold text-slate-700">
            Cohort Size N = {funnel.cohort_size}
          </div>
        </div>

        {/* Small Sample Warning Notice if N < 5 */}
        {funnel.is_small_sample && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Small sample size (N = {funnel.cohort_size} &lt; 5):</span>
              <span className="ml-1 text-slate-700">
                Percentages for cohorts under 5 leads are volatile; verify alongside exact counts.
              </span>
            </div>
          </div>
        )}

        {/* 6 Funnel Steps */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Step 1: Leads Received */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="text-[11px] font-semibold text-slate-600 font-mono">1. Leads Received</div>
            <div className="text-xl font-extrabold text-slate-900 font-mono">
              {funnel.leads_received.display_text}
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-slate-600 h-full rounded-full transition-all"
                style={{ width: `${funnel.leads_received.percentage}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500">Base cohort (100%)</div>
          </div>

          {/* Step 2: With >= 1 Meeting */}
          <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200 space-y-2">
            <div className="text-[11px] font-semibold text-blue-700 font-mono">2. &ge; 1 Meeting Held</div>
            <div className="text-xl font-extrabold text-blue-800 font-mono">
              {funnel.with_meeting.display_text}
            </div>
            <div className="w-full bg-blue-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all"
                style={{ width: `${funnel.with_meeting.percentage}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500">Meeting or site visit</div>
          </div>

          {/* Step 3: Quoted */}
          <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-2">
            <div className="text-[11px] font-semibold text-indigo-700 font-mono">3. Quoted</div>
            <div className="text-xl font-extrabold text-indigo-800 font-mono">
              {funnel.quoted.display_text}
            </div>
            <div className="w-full bg-indigo-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all"
                style={{ width: `${funnel.quoted.percentage}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500">Sent quotes (multi-ver. = 1)</div>
          </div>

          {/* Step 4: Won */}
          <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2">
            <div className="text-[11px] font-semibold text-emerald-800 font-mono">4. Won</div>
            <div className="text-xl font-extrabold text-emerald-700 font-mono">
              {funnel.won.display_text}
            </div>
            <div className="w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all"
                style={{ width: `${funnel.won.percentage}%` }}
              />
            </div>
            <div className="text-[10px] text-emerald-800 font-semibold">Finalised deals</div>
          </div>

          {/* Step 5: Lost */}
          <div className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-200 space-y-2">
            <div className="text-[11px] font-semibold text-rose-800 font-mono">5. Lost</div>
            <div className="text-xl font-extrabold text-rose-700 font-mono">
              {funnel.lost.display_text}
            </div>
            <div className="w-full bg-rose-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-rose-500 h-full rounded-full transition-all"
                style={{ width: `${funnel.lost.percentage}%` }}
              />
            </div>
            <div className="text-[10px] text-rose-800">Has lost reason</div>
          </div>

          {/* Step 6: Still Open */}
          <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2">
            <div className="text-[11px] font-semibold text-amber-800 font-mono">6. Still Open</div>
            <div className="text-xl font-extrabold text-amber-700 font-mono">
              {funnel.still_open.display_text}
            </div>
            <div className="w-full bg-amber-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all"
                style={{ width: `${funnel.still_open.percentage}%` }}
              />
            </div>
            <div className="text-[10px] text-amber-800">In negotiation/active</div>
          </div>
        </div>
      </div>

      {/* 4. Sales Cycle (S8) & Open Pipeline (S10) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Rule S8: Average Sales Cycle */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 font-mono">
            <span className="flex items-center gap-1.5">
              <Timer className="w-4 h-4 text-orange-600" />
              <span>Avg Sales Cycle</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full chip-grey">
              Wins in Period
            </span>
          </div>

          <div className="my-3">
            {average_sales_cycle_days !== null ? (
              <div className="text-3xl font-extrabold text-slate-900 font-mono">
                {average_sales_cycle_days}{" "}
                <span className="text-base font-semibold text-slate-600">days</span>
              </div>
            ) : (
              <div className="text-3xl font-extrabold text-slate-400 font-mono">—</div>
            )}
            <p className="text-xs text-slate-500 mt-1">
              {average_sales_cycle_days !== null
                ? `Average days from enquiry creation to won_at for ${sales_cycle_sample_count} project(s) finalised in this period.`
                : "No projects finalised in this period to calculate sales cycle."}
            </p>
          </div>

          <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 font-mono">
            enquiry created_at &rarr; won_at
          </div>
        </div>

        {/* Rule S10: Open Pipeline Value */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 font-mono">
            <span className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-blue-600" />
              <span>Open Pipeline</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full chip-blue">
              {open_pipeline_count} Enquiries
            </span>
          </div>

          <div className="my-3">
            <div className="text-3xl font-extrabold text-slate-900 font-mono">
              {formatRupees(open_pipeline_value)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Total expected value (ex-GST) across active enquiries with status &apos;open&apos; or &apos;quoted&apos;.
            </p>
          </div>

          <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 font-mono">
            status in (&apos;open&apos;, &apos;quoted&apos;)
          </div>
        </div>

        {/* Rule S10: Due Follow-ups */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 font-mono">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Follow-ups Due</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full chip-orange">
              IST &le; Today
            </span>
          </div>

          <div className="my-3">
            <div
              className={`text-3xl font-extrabold font-mono ${
                followups_due_count > 0 ? "text-amber-600" : "text-slate-900"
              }`}
            >
              {followups_due_count}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {followups_due_count > 0
                ? `${followups_due_count} enquiry follow-up(s) due today or overdue in IST.`
                : "All scheduled follow-ups are up to date."}
            </p>
          </div>

          <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 font-mono">
            next_followup_date &le; today ({todayIst})
          </div>
        </div>
      </div>

      {/* 5. Rule S9: Breakdowns for the Selected Period */}
      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 font-mono">
            <BarChart3 className="w-4 h-4 text-orange-600" />
            <span>3. Breakdowns for the Selected Period</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 5a. By Salesperson */}
          <div className="p-5 rounded-2xl glass-panel border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span>By Salesperson</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {breakdown_by_salesperson.length} active
              </span>
            </div>

            {breakdown_by_salesperson.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center italic">
                No activity recorded by salespeople in this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] text-slate-500 uppercase font-mono">
                      <th className="py-1.5 font-semibold">Rep</th>
                      <th className="py-1.5 text-center font-semibold">Leads</th>
                      <th className="py-1.5 text-center font-semibold">Mtgs</th>
                      <th className="py-1.5 text-center font-semibold">Won</th>
                      <th className="py-1.5 text-right font-semibold">Win Val</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {breakdown_by_salesperson.map((sp) => (
                      <tr key={sp.salesperson_id} className="hover:bg-slate-50/80">
                        <td className="py-2 font-sans font-medium text-slate-900 truncate max-w-[120px]">
                          {sp.salesperson_name}
                        </td>
                        <td className="py-2 text-center text-slate-700">{sp.leads_received}</td>
                        <td className="py-2 text-center text-blue-700">{sp.meetings_held}</td>
                        <td className="py-2 text-center text-emerald-700 font-bold">{sp.projects_won}</td>
                        <td className="py-2 text-right text-emerald-700 font-bold">
                          {formatRupees(sp.win_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 5b. By Lead Source */}
          <div className="p-5 rounded-2xl glass-panel border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-indigo-600" />
                <span>By Lead Source</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {breakdown_by_source.length} sources
              </span>
            </div>

            {breakdown_by_source.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center italic">
                No leads received in this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] text-slate-500 uppercase font-mono">
                      <th className="py-1.5 font-semibold">Source</th>
                      <th className="py-1.5 text-center font-semibold">Leads</th>
                      <th className="py-1.5 text-center font-semibold">Won</th>
                      <th className="py-1.5 text-right font-semibold">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {breakdown_by_source.map((src) => (
                      <tr key={src.source_id} className="hover:bg-slate-50/80">
                        <td className="py-2 font-sans font-medium text-slate-900 truncate max-w-[120px]">
                          {src.source_name}
                        </td>
                        <td className="py-2 text-center text-slate-700">{src.leads_count}</td>
                        <td className="py-2 text-center text-emerald-700 font-bold">{src.won_count}</td>
                        <td className="py-2 text-right font-bold text-slate-900">
                          {src.win_rate_percent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 5c. By Lost Reason */}
          <div className="p-5 rounded-2xl glass-panel border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Lost Reasons</span>
              </span>
              <span className="text-[10px] font-mono text-rose-600 font-bold">
                {activity.leads_lost} lost
              </span>
            </div>

            {breakdown_by_lost_reason.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center italic">
                No leads marked lost in this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] text-slate-500 uppercase font-mono">
                      <th className="py-1.5 font-semibold">Reason</th>
                      <th className="py-1.5 text-center font-semibold">Count</th>
                      <th className="py-1.5 text-right font-semibold">% of Lost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {breakdown_by_lost_reason.map((lr) => (
                      <tr key={lr.reason_id} className="hover:bg-slate-50/80">
                        <td className="py-2 font-sans font-medium text-slate-900 truncate max-w-[140px]">
                          {lr.reason_name}
                        </td>
                        <td className="py-2 text-center text-rose-700 font-bold">{lr.count}</td>
                        <td className="py-2 text-right text-slate-600">{lr.percentage_of_lost}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. List of Finalised Projects (Wins) in the Period */}
      <div className="p-6 rounded-2xl glass-panel border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>4. Finalised Projects in Period ({finalised_projects.length})</span>
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-700">
            Total Win: {formatRupees(activity.total_win_value)}
          </span>
        </div>

        {finalised_projects.length === 0 ? (
          <div className="text-xs text-slate-500 py-8 text-center italic">
            No projects were finalised in the selected period ({dateRange.label}).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] text-slate-500 uppercase font-mono">
                  <th className="py-2 font-semibold">Date Won (IST)</th>
                  <th className="py-2 font-semibold">Customer</th>
                  <th className="py-2 font-semibold">Enquiry Requirement</th>
                  <th className="py-2 font-semibold">Salesperson</th>
                  <th className="py-2 font-semibold">Project Code</th>
                  <th className="py-2 text-right font-semibold">Days to Close</th>
                  <th className="py-2 text-right font-semibold">Win Value (ex-GST)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {finalised_projects.map((fp) => (
                  <tr key={fp.enquiry_id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 text-slate-700 whitespace-nowrap">{fp.won_at}</td>
                    <td className="py-2.5 font-sans font-bold text-slate-900 whitespace-nowrap">
                      {fp.customer_name}
                    </td>
                    <td className="py-2.5 font-sans text-slate-700 max-w-[200px] truncate">
                      {fp.enquiry_title}
                    </td>
                    <td className="py-2.5 font-sans text-slate-600 whitespace-nowrap">
                      {fp.salesperson_name}
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      {fp.project_code ? (
                        isDirector ? (
                          <Link
                            href={`/x9admin/projects/${fp.project_id}`}
                            className="font-bold text-orange-600 hover:underline inline-flex items-center gap-1"
                          >
                            <span>{fp.project_code}</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        ) : (
                          <span className="font-bold text-slate-800">{fp.project_code}</span>
                        )
                      ) : (
                        <span className="text-slate-400 italic">Not converted yet</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-800">
                      {fp.sales_cycle_days} d
                    </td>
                    <td className="py-2.5 text-right font-bold text-emerald-700 text-sm">
                      {formatRupees(fp.win_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
