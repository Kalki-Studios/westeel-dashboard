"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  CheckSquare,
  AlertTriangle,
  Camera,
  FileText,
  AlertCircle,
  Building2,
  Calendar,
  Clock,
  ArrowRight,
  ShieldAlert,
  HardHat,
  Layers,
  PhoneCall,
  Receipt,
  CheckCircle2,
} from "lucide-react";
import { TaskItem } from "@/lib/tasks/types";
import { ProjectListItem } from "@/lib/projects/queries";
import { SiteReportItem } from "@/lib/site-reports/types";
import { DocumentItem } from "@/lib/documents/types";
import { getIstDateString } from "@/lib/rules/alerts";
import { EnquiryItem } from "@/lib/sales/types";
import { formatMeeting, istDateOf } from "@/lib/sales/meeting";

type RoleKey = "site_engineer" | "sales" | "accounts" | "purchase_pm";

const ROLES: { key: RoleKey; label: string; icon: typeof HardHat; description: string }[] = [
  {
    key: "site_engineer",
    label: "Site Engineer",
    icon: HardHat,
    description: "Daily site progress reports, drawing reviews, and field issue escalation",
  },
  {
    key: "purchase_pm",
    label: "Project Manager",
    icon: Layers,
    description: "Milestone tracking, site report reviews, drawing approvals, and team blockers",
  },
  {
    key: "sales",
    label: "Sales",
    icon: PhoneCall,
    description: "Client calls, quick visit logging, enquiry follow-ups, and quotation pipeline",
  },
  {
    key: "accounts",
    label: "Accounts",
    icon: Receipt,
    description: "Billing schedules, customer collections, invoice verification, and payment tracking",
  },
];

const subscribeStorage = (callback: () => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

const getClientRole = (): RoleKey | null => {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem("westeel_employee_role") as RoleKey) || null;
};

const getServerRole = (): RoleKey | null => null;

export interface EmployeeMyWorkClientProps {
  tasks: TaskItem[];
  projects: ProjectListItem[];
  reports: SiteReportItem[];
  pendingDrawings: DocumentItem[];
  userRole?: RoleKey;
  salesMode?: "lead" | "field" | "both";
  enquiries?: EnquiryItem[];
}

export function EmployeeMyWorkClient({
  tasks,
  projects,
  reports,
  pendingDrawings,
  userRole,
  salesMode = "both",
  enquiries = [],
}: EmployeeMyWorkClientProps) {
  const storedRole = useSyncExternalStore(subscribeStorage, getClientRole, getServerRole);
  const [taskFilter, setTaskFilter] = useState<"all" | "overdue" | "blocked" | "issues">("all");
  const currentRole: RoleKey = userRole ?? storedRole ?? "site_engineer";

  const todayIst = getIstDateString();
  const todayDateObj = new Date();
  const isSunday = todayDateObj.getDay() === 0;

  // Task computations
  const openTasks = tasks.filter((t) => t.status !== "done");
  const overdueTasks = openTasks.filter((t) => t.is_overdue);
  const blockedTasks = openTasks.filter((t) => t.is_blocked || t.status === "blocked");
  const issues = openTasks.filter((t) => t.kind === "issue");

  const filteredTasks = openTasks.filter((t) => {
    if (taskFilter === "overdue") return t.is_overdue;
    if (taskFilter === "blocked") return t.is_blocked || t.status === "blocked";
    if (taskFilter === "issues") return t.kind === "issue";
    return true;
  });

  // Report computations
  const pendingReviewReports = reports.filter((r) => r.status === "submitted");
  const correctionReports = reports.filter((r) => r.status === "correction_required");
  const todayReport = reports.find((r) => r.report_date === todayIst);

  // Project computations
  const delayedProjects = projects.filter((p) => p.is_delayed);
  const activeProjects = projects.filter((p) => p.status === "active");

  const roleMeta = ROLES.find((r) => r.key === currentRole) || ROLES[0];
  const RoleIcon = roleMeta.icon;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 shadow-sm">
              <RoleIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                <span>My Work:</span>
                <span className="text-orange-600">{roleMeta.label}</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Role Badge */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl chip-orange font-bold text-xs self-start md:self-auto shadow-sm">
          <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
          <span>{roleMeta.label}</span>
        </div>
      </div>

      {/* KPI / Metric Pills Bar (All Clickable) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Link
          href="/employee/tasks"
          className="glass-card-blue p-4 rounded-2xl flex items-center justify-between group shadow-sm"
        >
          <div>
            <div className="text-[10px] font-bold tracking-wider text-blue-700 uppercase font-mono">
              Open Tasks
            </div>
            <div className="text-2xl font-extrabold text-slate-900 group-hover:text-blue-700 transition mt-0.5 font-mono">
              {openTasks.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600">
            <CheckSquare className="w-5 h-5" />
          </div>
        </Link>

        <Link
          href="/employee/tasks"
          className="glass-card-orange p-4 rounded-2xl flex items-center justify-between group shadow-sm"
        >
          <div>
            <div className="text-[10px] font-bold tracking-wider text-orange-700 uppercase font-mono">
              Overdue Tasks
            </div>
            <div
              className={`text-2xl font-extrabold mt-0.5 font-mono ${
                overdueTasks.length > 0 ? "text-orange-600" : "text-slate-900"
              }`}
            >
              {overdueTasks.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600">
            <Clock className="w-5 h-5" />
          </div>
        </Link>

        <Link
          href="/employee/tasks"
          className="glass-card p-4 rounded-2xl flex items-center justify-between group shadow-sm"
        >
          <div>
            <div className="text-[10px] font-bold tracking-wider text-rose-700 uppercase font-mono">
              Blocked Tasks
            </div>
            <div
              className={`text-2xl font-extrabold mt-0.5 font-mono ${
                blockedTasks.length > 0 ? "text-rose-600" : "text-slate-900"
              }`}
            >
              {blockedTasks.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </Link>

        <Link
          href="/employee/tasks"
          className="glass-card p-4 rounded-2xl flex items-center justify-between group shadow-sm"
        >
          <div>
            <div className="text-[10px] font-bold tracking-wider text-rose-700 uppercase font-mono">
              Site Issues
            </div>
            <div
              className={`text-2xl font-extrabold mt-0.5 font-mono ${
                issues.length > 0 ? "text-rose-600" : "text-slate-900"
              }`}
            >
              {issues.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600">
            <AlertCircle className="w-5 h-5" />
          </div>
        </Link>

        {currentRole === "purchase_pm" ? (
          <Link
            href="/employee/review-reports"
            className="glass-card p-4 rounded-2xl flex items-center justify-between group shadow-sm"
          >
            <div>
              <div className="text-[10px] font-bold tracking-wider text-emerald-700 uppercase font-mono">
                Reports to Review
              </div>
              <div
                className={`text-2xl font-extrabold mt-0.5 font-mono ${
                  pendingReviewReports.length > 0 ? "text-emerald-600" : "text-slate-900"
                }`}
              >
                {pendingReviewReports.length}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <FileText className="w-5 h-5" />
            </div>
          </Link>
        ) : (
          <Link
            href="/employee/site-report"
            className="glass-card p-4 rounded-2xl flex items-center justify-between group shadow-sm"
          >
            <div>
              <div className="text-[10px] font-bold tracking-wider text-slate-700 uppercase font-mono">
                Today&apos;s Report
              </div>
              <div
                className={`text-xs font-bold mt-1.5 flex items-center gap-1 font-mono ${
                  todayReport
                    ? "text-emerald-600"
                    : isSunday
                    ? "text-slate-500"
                    : "text-orange-600"
                }`}
              >
                {todayReport ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Submitted</span>
                  </>
                ) : isSunday ? (
                  <span>Sunday Skip</span>
                ) : (
                  <span>Pending</span>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/15 flex items-center justify-center text-slate-300 shadow-inner">
              <Camera className="w-5 h-5 text-orange-400" />
            </div>
          </Link>
        )}
      </div>

      {/* Role-Specific Hero Section */}
      {currentRole === "site_engineer" && (
        <div className="space-y-4">
          {/* Rule R6: Correction Required Alert Banner */}
          {correctionReports.length > 0 && (
            <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Action Required: Correction requested on submitted report</span>
              </div>
              {correctionReports.map((cr) => (
                <div
                  key={cr.id}
                  className="p-3 rounded-lg bg-slate-900/80 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-200">
                      {cr.project?.code} • {cr.report_date}
                    </div>
                    {cr.review_note && (
                      <div className="text-amber-200/90 italic">
                        Reviewer note: &ldquo;{cr.review_note}&rdquo;
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/employee/site-report?edit=${cr.id}`}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition self-start sm:self-auto text-xs"
                  >
                    Edit &amp; Resubmit
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions Grid for Site Engineer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Link
              href="/employee/site-report"
              className="p-5 rounded-xl border border-amber-500/40 bg-amber-500/5 hover:border-amber-400 hover:bg-amber-500/10 transition flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition">
                  Daily Site Report
                </div>
                <div className="text-xs text-slate-400">
                  {todayReport
                    ? `Today's report logged for ${todayReport.project?.code}. Click to view or create another.`
                    : isSunday
                    ? "Sunday: Site work paused. Click to log emergency or weekend work."
                    : "Capture headcount, work completed, delays, and photo evidence."}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-amber-400">
                <span>{todayReport ? "Log Additional Report" : "Submit Today's Report"}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
              </div>
            </Link>

            <Link
              href="/employee/drawings"
              className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-blue-500/40 hover:bg-slate-900 transition flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-sm font-bold text-slate-100 group-hover:text-blue-300 transition">
                  Site Drawings &amp; Specs
                </div>
                <div className="text-xs text-slate-400">
                  Review approved engineering blueprints, fabrication drawings, and latest revisions on site.
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-blue-400">
                <span>Open Drawings</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
              </div>
            </Link>

            <Link
              href="/employee/raise-issue"
              className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-rose-500/40 hover:bg-slate-900 transition flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="text-sm font-bold text-slate-100 group-hover:text-rose-300 transition">
                  Raise Field Issue (T5)
                </div>
                <div className="text-xs text-slate-400">
                  Flag unexpected foundation delays, weather halts, or vendor shortages directly to Project Manager.
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-rose-400">
                <span>Escalate Issue</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
              </div>
            </Link>
          </div>
        </div>
      )}

      {currentRole === "purchase_pm" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Link
              href="/employee/review-reports"
              className="p-5 rounded-xl border border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-400 hover:bg-emerald-500/10 transition flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-sm font-bold text-slate-100 group-hover:text-emerald-300 transition">
                  Review Site Reports
                </div>
                <div className="text-xs text-slate-400">
                  {pendingReviewReports.length === 0
                    ? "All daily reports reviewed. No pending approvals in queue."
                    : `${pendingReviewReports.length} submitted report(s) awaiting your review and sign-off.`}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-emerald-400">
                <span>Open Review Queue</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
              </div>
            </Link>

            <Link
              href="/employee/drawings"
              className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-blue-500/40 hover:bg-slate-900 transition flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="text-sm font-bold text-slate-100 group-hover:text-blue-300 transition">
                  Drawing Approvals
                </div>
                <div className="text-xs text-slate-400">
                  {pendingDrawings.length === 0
                    ? "All drawings reviewed. No pending drawings in queue."
                    : `${pendingDrawings.length} drawing(s) awaiting review status decision.`}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-blue-400">
                <span>View Drawings</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
              </div>
            </Link>

            <Link
              href="/employee/tasks"
              className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-amber-500/40 hover:bg-slate-900 transition flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition">
                  Unblock Team &amp; Issues
                </div>
                <div className="text-xs text-slate-400">
                  {blockedTasks.length === 0 && issues.length === 0
                    ? "No blocked tasks or unresolved issues reported."
                    : `${blockedTasks.length} blocked task(s) and ${issues.length} issue(s) require intervention.`}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-amber-400">
                <span>Manage Blockers</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
              </div>
            </Link>
          </div>
        </div>
      )}

      {currentRole === "sales" && (
        <div className="p-5 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-3">
          <div className="flex items-center gap-2.5 text-blue-300 font-bold text-sm">
            <PhoneCall className="w-4 h-4" />
            <span>{salesMode === "lead" ? "Leads waiting for a meeting" : "Today's visits"}</span>
          </div>
          {(() => {
            const today = getIstDateString();
            const open = enquiries.filter((e) => e.status === "open");
            const list =
              salesMode === "lead"
                ? open.filter((e) => !e.meeting_at)
                : open.filter((e) => e.meeting_at && istDateOf(e.meeting_at) === today);
            return list.length === 0 ? (
              <p className="text-xs text-slate-400">
                {salesMode === "lead" ? "No leads waiting." : "No visits today."}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {list.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-slate-800 truncate">
                      {e.title}
                      {e.customer?.name ? ` · ${e.customer.name}` : ""}
                    </span>
                    {e.meeting_at && <span className="text-slate-500 shrink-0">{formatMeeting(e.meeting_at)}</span>}
                  </li>
                ))}
              </ul>
            );
          })()}
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href="/employee/quick-log"
              className="px-3 py-1.5 rounded-lg bg-blue-500 text-slate-950 font-bold hover:bg-blue-400 transition text-xs"
            >
              Quick-Log Call / Visit
            </Link>
            <Link
              href="/employee/enquiries"
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition text-xs border border-slate-700"
            >
              Enquiries &amp; Pipeline
            </Link>
          </div>
        </div>
      )}

      {currentRole === "accounts" && (
        <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
          <div className="flex items-center gap-2.5 text-emerald-300 font-bold text-sm">
            <Receipt className="w-4 h-4" />
            <span>Accounts &amp; Commercial Operations</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Milestone billing schedules, customer receivables, and vendor invoice settlements.
            All contract values and payment schedules strictly adhere to Section 5 permissions.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href="/employee/invoices"
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition text-xs"
            >
              Invoices &amp; Receipts
            </Link>
            <Link
              href="/employee/bills"
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition text-xs border border-slate-700"
            >
              Vendor Bills
            </Link>
            <Link
              href="/employee/bank-balances"
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition text-xs border border-slate-700"
            >
              Bank Balances
            </Link>
          </div>
        </div>
      )}

      {/* Assigned Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-200">
              Assigned Projects ({activeProjects.length} Active)
            </h2>
          </div>
          {delayedProjects.length > 0 && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium">
              {delayedProjects.length} Delayed
            </span>
          )}
        </div>

        {activeProjects.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center space-y-2">
            <Building2 className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-sm font-medium text-slate-300">No active projects assigned yet</div>
            <div className="text-xs text-slate-500 max-w-sm mx-auto">
              Your profile is not currently assigned to any active PEB engineering projects.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeProjects.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {p.code}
                      </span>
                      {p.is_delayed && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                          Delayed
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-slate-200 mt-0.5">
                      {p.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {p.site_location || "Location unassigned"}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium border border-slate-700">
                      {p.current_stage ? `Stage ${p.current_stage.position}` : "No stage"}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="text-slate-400">
                    Progress:{" "}
                    <span className="font-semibold text-slate-200">
                      {p.progress_text}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/employee/site-report?project=${p.id}`}
                      className="text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1"
                    >
                      <span>Report</span>
                    </Link>
                    <span className="text-slate-600">•</span>
                    <Link
                      href={`/employee/drawings?project=${p.id}`}
                      className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
                    >
                      <span>Drawings</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Action Items & Tasks Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-200">
              Action Items &amp; Task Assignments ({openTasks.length} Pending)
            </h2>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTaskFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                taskFilter === "all"
                  ? "bg-slate-700 text-slate-100"
                  : "bg-slate-900 text-slate-400 hover:text-slate-300"
              }`}
            >
              All ({openTasks.length})
            </button>
            <button
              type="button"
              onClick={() => setTaskFilter("overdue")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                taskFilter === "overdue"
                  ? "bg-rose-500/30 text-rose-300 border border-rose-500/40"
                  : "bg-slate-900 text-slate-400 hover:text-slate-300"
              }`}
            >
              Overdue ({overdueTasks.length})
            </button>
            <button
              type="button"
              onClick={() => setTaskFilter("blocked")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                taskFilter === "blocked"
                  ? "bg-amber-500/30 text-amber-300 border border-amber-500/40"
                  : "bg-slate-900 text-slate-400 hover:text-slate-300"
              }`}
            >
              Blocked ({blockedTasks.length})
            </button>
            <button
              type="button"
              onClick={() => setTaskFilter("issues")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                taskFilter === "issues"
                  ? "bg-blue-500/30 text-blue-300 border border-blue-500/40"
                  : "bg-slate-900 text-slate-400 hover:text-slate-300"
              }`}
            >
              Issues ({issues.length})
            </button>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center space-y-2">
            <CheckSquare className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-sm font-medium text-slate-300">
              {taskFilter === "all"
                ? "No pending tasks or action items assigned to you"
                : `No ${taskFilter} tasks found`}
            </div>
            <div className="text-xs text-slate-500 max-w-sm mx-auto">
              You are all caught up on your assigned operational commitments.
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTasks.map((task) => (
              <Link
                key={task.id}
                href={`/employee/tasks?id=${task.id}`}
                className="block p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900 transition group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                          task.kind === "issue"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {task.kind}
                      </span>
                      {task.is_overdue && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Overdue</span>
                        </span>
                      )}
                      {task.status === "blocked" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Blocked</span>
                        </span>
                      )}
                      {task.project && (
                        <span className="text-xs font-mono text-slate-400">
                          {task.project.code}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-slate-200 group-hover:text-amber-300 transition">
                      {task.title}
                    </div>
                    {task.blocked_reason && task.status === "blocked" && (
                      <div className="text-xs text-amber-300/90 italic">
                        Blocker: {task.blocked_reason}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto text-xs text-slate-400">
                    {task.due_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Due {task.due_date}</span>
                      </div>
                    )}
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
