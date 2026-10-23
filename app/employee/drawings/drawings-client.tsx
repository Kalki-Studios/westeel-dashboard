"use client";

import { useState } from "react";
import { DocumentItem } from "@/lib/documents/types";
import { getSignedDocumentUrlAction } from "@/lib/documents/actions";
import {
  FileText,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Ban,
  AlertTriangle,
  Loader2,
  ShieldAlert,
} from "lucide-react";

interface EmployeeDrawingsClientProps {
  initialDrawings: DocumentItem[];
}

export function EmployeeDrawingsClient({ initialDrawings }: EmployeeDrawingsClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = initialDrawings.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.project?.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.project?.name.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === "approved") {
      matchesStatus = d.review_status === "approved";
    } else if (statusFilter === "pending") {
      matchesStatus = d.review_status === "pending";
    } else if (statusFilter === "superseded") {
      matchesStatus = d.review_status === "superseded";
    }

    return matchesSearch && matchesStatus;
  });

  async function handleDownload(docId: string) {
    setDownloadingId(docId);
    setActionError(null);

    const res = await getSignedDocumentUrlAction(docId);
    if (res.error) {
      setActionError(res.error);
    } else if (res.downloadUrl) {
      window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
    }
    setDownloadingId(null);
  }

  const approvedCount = initialDrawings.filter((d) => d.review_status === "approved").length;
  const pendingCount = initialDrawings.filter((d) => d.review_status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" />
          <h1 className="text-lg font-bold text-slate-100 tracking-tight">
            Project Drawings &amp; Revisions
          </h1>
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-slate-400 hover:text-slate-200">
            ×
          </button>
        </div>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Approved Drawings
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
            {approvedCount}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Pending Review
          </div>
          <div className={`text-xl font-bold font-mono mt-1 ${pendingCount > 0 ? "text-amber-400" : "text-slate-400"}`}>
            {pendingCount}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 col-span-2 sm:col-span-1">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Total Available
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono mt-1">
            {initialDrawings.length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search drawings or project code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
        >
          <option value="all">All Approval Statuses</option>
          <option value="approved">Approved Only (Ready for Site)</option>
          <option value="pending">Pending Approval</option>
          <option value="superseded">Superseded Revisions</option>
        </select>
      </div>

      {/* Drawings Cards List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p>No drawings found matching your filter criteria.</p>
          </div>
        ) : (
          filtered.map((doc) => {
            const isApproved = doc.review_status === "approved";
            const isPending = doc.review_status === "pending";
            const isSuperseded = doc.review_status === "superseded";
            const isRejected = doc.review_status === "rejected";

            return (
              <div
                key={doc.id}
                className={`bg-slate-900/70 border rounded-xl p-4 transition ${
                  isApproved
                    ? "border-emerald-800/40 shadow-sm shadow-emerald-950/20"
                    : isSuperseded
                    ? "border-slate-800/60 opacity-60"
                    : "border-slate-800"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {doc.project && (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-bold border border-slate-700">
                          {doc.project.code}
                        </span>
                      )}
                      <span className="font-mono text-[11px] font-bold text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                        v{doc.version_no}
                      </span>
                      <h3 className="font-semibold text-sm text-slate-100">{doc.title}</h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                      {doc.project && <span>{doc.project.name}</span>}
                      <span>•</span>
                      <span>{(doc.size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                      <span>•</span>
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>

                    {/* Status Badges */}
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      {isApproved && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Approved for Site Construction</span>
                        </div>
                      )}

                      {isPending && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/60 border border-amber-800/80 text-amber-300 text-[11px] font-semibold">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Pending Review ({doc.drawing_age_days ?? 0}d old)</span>
                        </div>
                      )}

                      {isSuperseded && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700 text-slate-400 text-[11px]">
                          <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                          <span>Superseded by newer revision — DO NOT ERECT</span>
                        </div>
                      )}

                      {isRejected && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-950/60 border border-rose-800/80 text-rose-300 text-[11px]">
                          <Ban className="w-3.5 h-3.5 text-rose-400" />
                          <span>Rejected: {doc.review_note || "Needs correction"}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex sm:flex-col justify-end">
                    <button
                      onClick={() => handleDownload(doc.id)}
                      disabled={downloadingId === doc.id}
                      className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                        isApproved
                          ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/10"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                      }`}
                    >
                      {downloadingId === doc.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>Download Drawing</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
