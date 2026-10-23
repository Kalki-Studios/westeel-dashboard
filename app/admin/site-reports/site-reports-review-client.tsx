"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SiteReportItem } from "@/lib/site-reports/types";
import { reviewSiteReportAction } from "@/lib/site-reports/actions";
import { DELAY_REASON_LABELS } from "@/lib/projects/types";
import {
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Camera,
  Search,
  Check,
  Ban,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface SiteReportsReviewClientProps {
  initialReports: SiteReportItem[];
  projects: Array<{ id: string; code: string; name: string }>;
}

export function SiteReportsReviewClient({
  initialReports,
  projects,
}: SiteReportsReviewClientProps) {
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [expandedId, setExpandedId] = useState<string | null>(initialReports[0]?.id || null);

  // Review Modal state
  const [reviewingReport, setReviewingReport] = useState<SiteReportItem | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"reviewed" | "correction_required">("reviewed");
  const [reviewNote, setReviewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filter reports
  const filteredReports = initialReports.filter((r) => {
    const matchesSearch =
      r.work_completed.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.project?.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.project?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.submitter?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesProject = projectFilter === "all" ? true : r.project_id === projectFilter;
    const matchesStatus = statusFilter === "all" ? true : r.status === statusFilter;

    return matchesSearch && matchesProject && matchesStatus;
  });

  const submittedCount = initialReports.filter((r) => r.status === "submitted").length;
  const correctionCount = initialReports.filter((r) => r.status === "correction_required").length;
  const reviewedCount = initialReports.filter((r) => r.status === "reviewed").length;

  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewingReport) return;

    setIsSubmitting(true);
    setActionError(null);

    const res = await reviewSiteReportAction(reviewingReport.id, reviewDecision, reviewNote);

    if (res.error) {
      setActionError(res.error);
    } else {
      setReviewingReport(null);
      setReviewNote("");
      router.refresh();
    }
    setIsSubmitting(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              Daily Site Reports Review
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
              {initialReports.length} reports
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Total Reports
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono mt-1">
            {initialReports.length}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Awaiting Review
          </div>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              submittedCount > 0 ? "text-amber-400" : "text-slate-400"
            }`}
          >
            {submittedCount}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Correction Requested
          </div>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              correctionCount > 0 ? "text-rose-400" : "text-slate-400"
            }`}
          >
            {correctionCount}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Reviewed &amp; Locked
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
            {reviewedCount}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search work description, engineer, or project..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">All Review Statuses</option>
            <option value="submitted">Awaiting Review ({submittedCount})</option>
            <option value="correction_required">Correction Required ({correctionCount})</option>
            <option value="reviewed">Reviewed &amp; Locked ({reviewedCount})</option>
          </select>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {filteredReports.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center text-slate-400 text-xs">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p>No site reports found matching your criteria.</p>
          </div>
        ) : (
          filteredReports.map((report) => {
            const isExpanded = expandedId === report.id;
            const isReviewed = report.status === "reviewed";
            const isCorrection = report.status === "correction_required";
            const isSubmitted = report.status === "submitted";

            return (
              <div
                key={report.id}
                className={`bg-slate-900/70 border rounded-xl overflow-hidden transition ${
                  isSubmitted
                    ? "border-amber-500/40 shadow-sm shadow-amber-950/10"
                    : isCorrection
                    ? "border-rose-800/80"
                    : isReviewed
                    ? "border-emerald-800/40"
                    : "border-slate-800"
                }`}
              >
                {/* Header Row */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : report.id)}
                    className="space-y-1 flex-1 cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                        {report.project?.code}
                      </span>
                      <span className="text-xs font-semibold text-slate-200">
                        {new Date(report.report_date).toLocaleDateString(undefined, {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        by {report.submitter?.full_name || "Site Engineer"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-1">
                      {report.work_completed}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Status Badge */}
                    {isReviewed && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-[11px] font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Reviewed</span>
                      </div>
                    )}

                    {isCorrection && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-950/60 border border-rose-800/80 text-rose-300 text-[11px] font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Correction Needed</span>
                      </div>
                    )}

                    {isSubmitted && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-950/60 border border-amber-800/80 text-amber-300 text-[11px] font-semibold">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pending Review</span>
                      </div>
                    )}

                    {/* Review Action Button */}
                    <button
                      onClick={() => {
                        setReviewingReport(report);
                        setReviewDecision(report.status === "reviewed" ? "correction_required" : "reviewed");
                        setReviewNote(report.review_note || "");
                        setActionError(null);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-blue-600/25"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isReviewed ? "Re-Review" : "Review"}</span>
                    </button>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : report.id)}
                      className="text-slate-400 hover:text-slate-200 p-1"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-800 space-y-4 text-xs">
                    {report.review_note && (
                      <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-200">
                        <span className="font-semibold text-rose-300">Review Note: </span>
                        {report.review_note}
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-slate-500 block">Westeel Staff:</span>
                        <span className="font-mono font-bold text-slate-200">
                          {report.own_headcount} workers
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-slate-500 block">Subcontractor:</span>
                        <span className="font-mono font-bold text-slate-200">
                          {report.subcontractor_headcount} workers
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-slate-500 block">Total Workforce:</span>
                        <span className="font-mono font-bold text-amber-400">
                          {report.own_headcount + report.subcontractor_headcount} workers
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-slate-500 block">Delay Logged:</span>
                        <span
                          className={`font-semibold ${
                            report.delay_reason ? "text-rose-400" : "text-emerald-400"
                          }`}
                        >
                          {report.delay_reason
                            ? DELAY_REASON_LABELS[report.delay_reason]
                            : "None"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-400">Work Description:</span>
                      <p className="text-slate-200 bg-slate-950 p-3 rounded-lg border border-slate-800 whitespace-pre-wrap">
                        {report.work_completed}
                      </p>
                    </div>

                    {report.problems_delays && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-rose-400">Problems / Obstacles:</span>
                        <p className="text-rose-200 bg-rose-950/20 p-3 rounded-lg border border-rose-900/40">
                          {report.problems_delays}
                        </p>
                      </div>
                    )}

                    {/* Attached Photos */}
                    {report.photos && report.photos.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <Camera className="w-3.5 h-3.5 text-amber-400" />
                          <span>Photos ({report.photos.length})</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {report.photos.map((p) => (
                            <a
                              key={p.id}
                              href={p.download_url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg overflow-hidden border border-slate-800 aspect-video bg-slate-950 hover:border-amber-500/50 transition block"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.download_url}
                                alt={p.title}
                                className="w-full h-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* REVIEW REPORT MODAL */}
      {reviewingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden text-xs">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
              <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-400" />
                <span>Review Site Report</span>
              </h3>
              <button
                onClick={() => setReviewingReport(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="p-5 space-y-4">
              {actionError && (
                <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg text-xs">
                  {actionError}
                </div>
              )}

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between font-semibold text-slate-200">
                  <span>{reviewingReport.project?.code}</span>
                  <span>{reviewingReport.report_date}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Engineer: {reviewingReport.submitter?.full_name}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-2">
                  Review Decision *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border cursor-pointer transition ${
                      reviewDecision === "reviewed"
                        ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value="reviewed"
                      checked={reviewDecision === "reviewed"}
                      onChange={() => setReviewDecision("reviewed")}
                      className="sr-only"
                    />
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve (Reviewed)</span>
                  </label>

                  <label
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border cursor-pointer transition ${
                      reviewDecision === "correction_required"
                        ? "bg-rose-950/60 border-rose-500 text-rose-300 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value="correction_required"
                      checked={reviewDecision === "correction_required"}
                      onChange={() => setReviewDecision("correction_required")}
                      className="sr-only"
                    />
                    <Ban className="w-4 h-4" />
                    <span>Request Correction</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Reviewer Feedback / Notes{" "}
                  {reviewDecision === "correction_required" && (
                    <span className="text-rose-400 font-bold">* (Mandatory for correction)</span>
                  )}
                </label>
                <textarea
                  rows={3}
                  required={reviewDecision === "correction_required"}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={
                    reviewDecision === "reviewed"
                      ? "Optional: Site progress confirmed and verified..."
                      : "Explain what the engineer needs to correct before approval..."
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setReviewingReport(null)}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold ${
                    reviewDecision === "reviewed"
                      ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                      : "bg-rose-500 hover:bg-rose-400 text-white"
                  }`}
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    Confirm {reviewDecision === "reviewed" ? "Approval" : "Correction Request"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
