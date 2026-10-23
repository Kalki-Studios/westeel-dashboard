"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteReportItem } from "@/lib/site-reports/types";
import { DELAY_REASON_LABELS } from "@/lib/projects/types";
import {
  FileText,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Camera,
  Edit2,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface MyReportsClientProps {
  initialReports: SiteReportItem[];
}

export function MyReportsClient({ initialReports }: MyReportsClientProps) {
  const [expandedId, setExpandedId] = useState<string | null>(initialReports[0]?.id || null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg font-bold text-slate-100 tracking-tight">
              My Submitted Reports
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {initialReports.length}
            </span>
          </div>
        </div>

        <Link
          href="/employee/site-report"
          className="fab inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shrink-0 cursor-pointer shadow-md shadow-blue-600/25"
        >
          <Plus className="w-4 h-4" />
          <span>New Daily Report</span>
        </Link>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {initialReports.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center text-slate-400 text-xs space-y-3">
            <FileText className="w-8 h-8 mx-auto text-slate-600" />
            <p>You haven&apos;t submitted any site reports yet.</p>
            <Link
              href="/employee/site-report"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold border border-amber-500/30 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Submit Today&apos;s Site Report</span>
            </Link>
          </div>
        ) : (
          initialReports.map((report) => {
            const isExpanded = expandedId === report.id;
            const isReviewed = report.status === "reviewed";
            const isCorrection = report.status === "correction_required";
            const isSubmitted = report.status === "submitted";

            return (
              <div
                key={report.id}
                className={`bg-slate-900/70 border rounded-xl overflow-hidden transition ${
                  isCorrection
                    ? "border-rose-800/80 shadow-sm shadow-rose-950/20"
                    : isReviewed
                    ? "border-emerald-800/40"
                    : "border-slate-800"
                }`}
              >
                {/* Header Card Row */}
                <div
                  onClick={() => toggleExpand(report.id)}
                  className="p-4 cursor-pointer hover:bg-slate-800/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
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
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-1">
                      {report.work_completed}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {/* Status Badge */}
                    {isReviewed && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-[11px] font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Reviewed &amp; Locked</span>
                      </div>
                    )}

                    {isCorrection && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-950/60 border border-rose-800/80 text-rose-300 text-[11px] font-semibold animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Correction Required</span>
                      </div>
                    )}

                    {isSubmitted && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-950/60 border border-amber-800/80 text-amber-300 text-[11px] font-semibold">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Awaiting PM Review</span>
                      </div>
                    )}

                    <button className="text-slate-400 hover:text-slate-200">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 space-y-4 text-xs">
                    {/* Reviewer Note Banner if correction required */}
                    {isCorrection && report.review_note && (
                      <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-lg text-rose-200 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5 text-rose-300">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Reviewer Feedback (Correction Needed):</span>
                        </div>
                        <p className="text-[11px]">{report.review_note}</p>
                        <div className="pt-2">
                          <Link
                            href={`/employee/site-report?edit=${report.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit &amp; Resubmit Report</span>
                          </Link>
                        </div>
                      </div>
                    )}

                    {/* Reviewed badge details */}
                    {isReviewed && (
                      <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-[11px] flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          <span>
                            Reviewed by {report.reviewer?.full_name || "Project Manager"} on{" "}
                            {report.reviewed_at ? new Date(report.reviewed_at).toLocaleDateString() : ""}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">Locked</span>
                      </div>
                    )}

                    {/* Detailed Content */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
                        <span className="text-slate-500">Workforce Headcount:</span>
                        <div className="font-mono text-slate-200">
                          Westeel Staff: <strong>{report.own_headcount}</strong> • Subcontractor:{" "}
                          <strong>{report.subcontractor_headcount}</strong> (Total:{" "}
                          {report.own_headcount + report.subcontractor_headcount})
                        </div>
                      </div>

                      {report.delay_reason && (
                        <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 space-y-1">
                          <span className="text-slate-400">Delay Reason:</span>
                          <div className="font-semibold">
                            {DELAY_REASON_LABELS[report.delay_reason]}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-400">Full Work Description:</span>
                      <p className="text-slate-200 bg-slate-950 p-3 rounded-lg border border-slate-800 whitespace-pre-wrap">
                        {report.work_completed}
                      </p>
                    </div>

                    {report.materials_received && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-slate-400">Materials Received:</span>
                        <p className="text-slate-300">{report.materials_received}</p>
                      </div>
                    )}

                    {/* Photos Gallery */}
                    {report.photos && report.photos.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <Camera className="w-3.5 h-3.5 text-amber-400" />
                          <span>Attached Photos ({report.photos.length})</span>
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
    </div>
  );
}
