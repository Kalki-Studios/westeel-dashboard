"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DocumentItem,
  DOC_CATEGORIES,
} from "@/lib/documents/types";
import {
  uploadDocumentAction,
  reviewDrawingAction,
  getSignedDocumentUrlAction,
} from "@/lib/documents/actions";
import {
  FileText,
  Upload,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Building2,
  X,
  Loader2,
  FileCheck,
  Check,
  Ban,
  Lock,
} from "lucide-react";

interface DocumentsClientProps {
  initialDocuments: DocumentItem[];
  projects: Array<{ id: string; code: string; name: string }>;
}

export function DocumentsClient({ initialDocuments, projects }: DocumentsClientProps) {
  const router = useRouter();

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [reviewingDoc, setReviewingDoc] = useState<DocumentItem | null>(null);
  const [revisionDoc, setRevisionDoc] = useState<DocumentItem | null>(null);

  // Loading & error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Review form state
  const [reviewDecision, setReviewDecision] = useState<"approved" | "rejected">("approved");
  const [reviewNote, setReviewNote] = useState("");

  // Filtering
  const filteredDocs = initialDocuments.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.project?.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.project?.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === "all" ? true : d.category === categoryFilter;
    const matchesProject = projectFilter === "all" ? true : d.project_id === projectFilter;

    let matchesStatus = true;
    if (statusFilter === "pending") {
      matchesStatus = d.review_status === "pending";
    } else if (statusFilter === "approved") {
      matchesStatus = d.review_status === "approved";
    } else if (statusFilter === "rejected") {
      matchesStatus = d.review_status === "rejected";
    } else if (statusFilter === "superseded") {
      matchesStatus = d.review_status === "superseded";
    }

    return matchesSearch && matchesCategory && matchesProject && matchesStatus;
  });

  const totalCount = initialDocuments.length;
  const pendingDrawingsCount = initialDocuments.filter(
    (d) => d.category === "drawing" && d.review_status === "pending"
  ).length;
  const approvedDrawingsCount = initialDocuments.filter(
    (d) => d.category === "drawing" && d.review_status === "approved"
  ).length;
  const restrictedCount = initialDocuments.filter(
    (d) => d.category === "contract" || d.category === "invoice" || d.category === "bill"
  ).length;

  // Handle Download with Signed URL
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

  // Handle Upload
  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setActionError(null);

    const formData = new FormData(e.currentTarget);
    const res = await uploadDocumentAction(null, formData);

    if (res.error) {
      setActionError(res.error);
    } else {
      setIsUploadModalOpen(false);
      setRevisionDoc(null);
      router.refresh();
    }
    setIsSubmitting(false);
  }

  // Handle Review Drawing
  async function handleReviewDrawing(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewingDoc) return;

    setIsSubmitting(true);
    setActionError(null);

    const res = await reviewDrawingAction(reviewingDoc.id, reviewDecision, reviewNote);

    if (res.error) {
      setActionError(res.error);
    } else {
      setReviewingDoc(null);
      setReviewNote("");
      router.refresh();
    }
    setIsSubmitting(false);
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              Documents &amp; Drawings
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
              {totalCount} files
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            setActionError(null);
            setRevisionDoc(null);
            setIsUploadModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs tracking-wide transition shadow-lg shadow-amber-500/10 cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Global Error Banner */}
      {actionError && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-slate-400 hover:text-slate-200"
          >
            ×
          </button>
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Total Documents
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono mt-1">{totalCount}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Drawings Pending
          </div>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              pendingDrawingsCount > 0 ? "text-amber-400" : "text-slate-400"
            }`}
          >
            {pendingDrawingsCount}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Approved Drawings
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
            {approvedDrawingsCount}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Restricted Files
          </div>
          <div className="text-xl font-bold text-purple-400 font-mono mt-1">
            {restrictedCount}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, project code (e.g. WB-2026-001), or filename..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500/50 cursor-pointer"
          >
            <option value="all">All Categories</option>
            {DOC_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ").toUpperCase()}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500/50 cursor-pointer"
          >
            <option value="all">All Review States</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="superseded">Superseded</option>
          </select>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500/50 cursor-pointer"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}: {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Title &amp; Version</th>
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4">Review Status</th>
                <th className="py-3 px-4">File Size</th>
                <th className="py-3 px-4">Uploaded By</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <div>No documents found matching your filter criteria.</div>
                  </td>
                </tr>
              ) : (
                filteredDocs.map((d) => {
                  const isRestricted =
                    d.category === "contract" || d.category === "invoice" || d.category === "bill";

                  return (
                    <tr key={d.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            isRestricted
                              ? "bg-purple-950/60 border border-purple-800/60 text-purple-300"
                              : d.category === "drawing"
                              ? "bg-blue-950/50 border border-blue-800/60 text-blue-300"
                              : d.category === "purchase_order"
                              ? "bg-amber-950/50 border border-amber-800/60 text-amber-300"
                              : "bg-slate-800 border border-slate-700 text-slate-300"
                          }`}
                        >
                          {isRestricted && <Lock className="w-3 h-3 text-purple-400" />}
                          <span>{d.category.replace("_", " ")}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-100 flex items-center gap-1.5">
                          <span>{d.title}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            Rev {d.version_no}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {d.project ? (
                          <Link
                            href={`/x9admin/projects/${d.project.id}`}
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-400 hover:text-amber-300"
                          >
                            <Building2 className="w-3 h-3" />
                            <span>{d.project.code}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-500 italic">General</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {d.category === "drawing" ? (
                          d.review_status === "pending" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/50 border border-amber-800/60 text-amber-300 text-[11px] font-medium">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>
                                Pending ({d.drawing_age_days}d old)
                              </span>
                            </span>
                          ) : d.review_status === "approved" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-[11px] font-medium">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Approved</span>
                            </span>
                          ) : d.review_status === "rejected" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/50 border border-rose-800/60 text-rose-300 text-[11px] font-medium">
                              <Ban className="w-3 h-3 text-rose-400" />
                              <span>Rejected</span>
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[11px]">
                              Superseded
                            </span>
                          )
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {(d.size_bytes / 1024).toFixed(1)} KB
                      </td>

                      <td className="py-3 px-4 text-slate-300 text-[11px]">
                        <div>{d.uploader?.full_name || "Employee"}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {d.created_at.split("T")[0]}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5">
                        {/* Download button using secure signed URL */}
                        <button
                          onClick={() => handleDownload(d.id)}
                          disabled={downloadingId === d.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition cursor-pointer"
                        >
                          {downloadingId === d.id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                          ) : (
                            <Download className="w-3 h-3 text-slate-400" />
                          )}
                          <span>Download</span>
                        </button>

                        {/* Drawing Review action (if drawing pending review) */}
                        {d.category === "drawing" && d.review_status === "pending" && (
                          <button
                            onClick={() => {
                              setReviewingDoc(d);
                              setReviewDecision("approved");
                              setReviewNote("");
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] transition cursor-pointer"
                          >
                            <FileCheck className="w-3 h-3 text-amber-400" />
                            <span>Review</span>
                          </button>
                        )}

                        {/* Upload Revision action for drawings */}
                        {d.category === "drawing" && d.review_status !== "superseded" && (
                          <button
                            onClick={() => {
                              setRevisionDoc(d);
                              setIsUploadModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-950/40 hover:bg-blue-900/40 text-blue-300 border border-blue-800/40 text-[11px] transition cursor-pointer"
                          >
                            <Layers className="w-3 h-3 text-blue-400" />
                            <span>New Rev</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: UPLOAD DOCUMENT / DRAWING REVISION */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-sm text-slate-100">
                  {revisionDoc ? `Upload New Revision for: ${revisionDoc.title}` : "Upload Document"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setRevisionDoc(null);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpload} className="p-5 space-y-4 text-xs">
              {revisionDoc && (
                <div className="p-3 bg-blue-950/40 border border-blue-800 text-blue-300 rounded-lg text-xs space-y-0.5">
                  <div className="font-semibold">Revision control:</div>
                  <div>
                    Uploading this revision will advance version to <strong>Rev {revisionDoc.version_no + 1}</strong> and automatically mark Rev {revisionDoc.version_no} as <strong>superseded</strong>.
                  </div>
                </div>
              )}

              {revisionDoc && (
                <input type="hidden" name="supersedes_id" value={revisionDoc.id} />
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Document Title *
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={revisionDoc ? revisionDoc.title : ""}
                  placeholder="e.g. PEB Structural Foundation Layout Rev 0"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    name="category"
                    required
                    defaultValue={revisionDoc ? revisionDoc.category : "drawing"}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {DOC_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.replace("_", " ").toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Project Link (optional)
                  </label>
                  <select
                    name="project_id"
                    defaultValue={revisionDoc ? revisionDoc.project_id || "" : ""}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">General (No project)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code}: {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Select File * (PDF, CAD DWG, DXF, Word, Excel, Images up to 25MB)
                </label>
                <input
                  name="file"
                  type="file"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setRevisionDoc(null);
                  }}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Upload &amp; Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REVIEW DRAWING */}
      {reviewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-sm text-slate-100">Review Drawing</h3>
              </div>
              <button
                onClick={() => setReviewingDoc(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleReviewDrawing} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                <div className="font-medium text-slate-200">{reviewingDoc.title}</div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Rev {reviewingDoc.version_no} • {reviewingDoc.project?.code} • Age: {reviewingDoc.drawing_age_days} days
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Review Decision *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewDecision("approved")}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      reviewDecision === "approved"
                        ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve Drawing</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewDecision("rejected")}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      reviewDecision === "rejected"
                        ? "bg-rose-950/80 border-rose-500 text-rose-300 ring-1 ring-rose-500"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Ban className="w-4 h-4" />
                    <span>Reject Drawing</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Review Comments / Quality Notes
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={3}
                  placeholder={
                    reviewDecision === "approved"
                      ? "e.g. Approved for fabrication and shop detailing..."
                      : "e.g. Anchor bolt spacing does not match client civil drawing C-102. Resubmission required..."
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setReviewingDoc(null)}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 ${
                    reviewDecision === "approved"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-rose-600 hover:bg-rose-500 text-white"
                  }`}
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm {reviewDecision === "approved" ? "Approval" : "Rejection"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
