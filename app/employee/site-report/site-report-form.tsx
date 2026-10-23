"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { submitSiteReportAction } from "@/lib/site-reports/actions";
import { compressSitePhoto } from "@/lib/site-reports/compression";
import { DELAY_REASONS, DELAY_REASON_LABELS } from "@/lib/projects/types";
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  Sparkles,
  FileText,
  Building2,
  Users,
  Package,
} from "lucide-react";

interface ProjectOption {
  id: string;
  code: string;
  name: string;
  site_location: string;
  current_stage: { name: string; position: number } | null;
  milestones: Array<{ id: string; title: string }>;
}

interface SiteReportFormProps {
  projects: ProjectOption[];
  prefilledReport?: {
    id?: string;
    project_id: string;
    report_date: string;
    work_completed: string;
    progress_note?: string | null;
    milestone_id?: string | null;
    own_headcount: number;
    subcontractor_headcount: number;
    materials_received?: string | null;
    materials_required?: string | null;
    problems_delays?: string | null;
    delay_reason?: string | null;
    action_required?: string | null;
    responsible_party?: string | null;
  };
}

function getStoredDraft(projectId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`westeel_report_draft_${projectId || "general"}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function SiteReportForm({ projects, prefilledReport }: SiteReportFormProps) {
  const router = useRouter();

  // Selected project state
  const defaultProjectId = prefilledReport?.project_id || projects[0]?.id || "";
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId);

  // Lazy draft retrieval
  const draft = !prefilledReport ? getStoredDraft(defaultProjectId) : null;

  // Today's date in local ISO YYYY-MM-DD
  const todayIso = new Date().toISOString().split("T")[0];
  const [reportDate, setReportDate] = useState(prefilledReport?.report_date || todayIso);

  // Form field states with lazy draft fallback
  const [workCompleted, setWorkCompleted] = useState(
    prefilledReport?.work_completed || draft?.workCompleted || ""
  );
  const [progressNote, setProgressNote] = useState(
    prefilledReport?.progress_note || draft?.progressNote || ""
  );
  const [milestoneId, setMilestoneId] = useState(
    prefilledReport?.milestone_id || draft?.milestoneId || ""
  );
  const [ownHeadcount, setOwnHeadcount] = useState(
    prefilledReport?.own_headcount?.toString() || draft?.ownHeadcount || "0"
  );
  const [subcontractorHeadcount, setSubcontractorHeadcount] = useState(
    prefilledReport?.subcontractor_headcount?.toString() || draft?.subcontractorHeadcount || "0"
  );
  const [materialsReceived, setMaterialsReceived] = useState(
    prefilledReport?.materials_received || draft?.materialsReceived || ""
  );
  const [materialsRequired, setMaterialsRequired] = useState(
    prefilledReport?.materials_required || draft?.materialsRequired || ""
  );
  const [problemsDelays, setProblemsDelays] = useState(
    prefilledReport?.problems_delays || draft?.problemsDelays || ""
  );
  const [delayReason, setDelayReason] = useState(
    prefilledReport?.delay_reason || draft?.delayReason || ""
  );
  const [actionRequired, setActionRequired] = useState(
    prefilledReport?.action_required || draft?.actionRequired || ""
  );
  const [responsibleParty, setResponsibleParty] = useState(
    prefilledReport?.responsible_party || draft?.responsibleParty || ""
  );

  // Photos state
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<string | null>(null);

  // Submission & Confirmation modal states
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const hasDraftRestored = Boolean(draft && (draft.workCompleted || draft.materialsReceived));

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const draftKey = `westeel_report_draft_${selectedProjectId || "general"}`;

  // 2. Autosave Draft on changes
  useEffect(() => {
    if (prefilledReport) return;
    const timeout = setTimeout(() => {
      try {
        const draft = {
          workCompleted,
          progressNote,
          milestoneId,
          ownHeadcount,
          subcontractorHeadcount,
          materialsReceived,
          materialsRequired,
          problemsDelays,
          delayReason,
          actionRequired,
          responsibleParty,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        // ignore
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [
    draftKey,
    workCompleted,
    progressNote,
    milestoneId,
    ownHeadcount,
    subcontractorHeadcount,
    materialsReceived,
    materialsRequired,
    problemsDelays,
    delayReason,
    actionRequired,
    responsibleParty,
    prefilledReport,
  ]);

  // Clear draft
  function clearDraft() {
    localStorage.removeItem(draftKey);
    setWorkCompleted("");
    setProgressNote("");
    setMilestoneId("");
    setOwnHeadcount("0");
    setSubcontractorHeadcount("0");
    setMaterialsReceived("");
    setMaterialsRequired("");
    setProblemsDelays("");
    setDelayReason("");
    setActionRequired("");
    setResponsibleParty("");
    setPhotos([]);
    setPhotoPreviews([]);
  }

  // 3. Handle Photo Selection & Client Compression
  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCompressing(true);
    setErrorMessage(null);
    const newPhotos: File[] = [];
    const newPreviews: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCompressionProgress(`Compressing photo ${i + 1} of ${files.length}...`);

      try {
        const compressed = await compressSitePhoto(file, 1280, 0.8);
        newPhotos.push(compressed);
        newPreviews.push(URL.createObjectURL(compressed));
      } catch {
        newPhotos.push(file);
        newPreviews.push(URL.createObjectURL(file));
      }
    }

    setPhotos((prev) => [...prev, ...newPhotos]);
    setPhotoPreviews((prev) => [...prev, ...newPreviews]);
    setIsCompressing(false);
    setCompressionProgress(null);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  // 4. Validate & Open Confirmation Modal
  function handleFormSubmitInitiate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedProjectId) {
      setErrorMessage("Please select a project.");
      return;
    }
    if (!workCompleted.trim()) {
      setErrorMessage("Please enter the description of work completed today.");
      return;
    }

    setIsConfirmModalOpen(true);
  }

  // 5. Final Submission via Server Action
  async function handleConfirmedSubmit() {
    setIsSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("project_id", selectedProjectId);
    formData.append("report_date", reportDate);
    formData.append("work_completed", workCompleted);
    if (progressNote) formData.append("progress_note", progressNote);
    if (milestoneId) formData.append("milestone_id", milestoneId);
    formData.append("own_headcount", ownHeadcount);
    formData.append("subcontractor_headcount", subcontractorHeadcount);
    if (materialsReceived) formData.append("materials_received", materialsReceived);
    if (materialsRequired) formData.append("materials_required", materialsRequired);
    if (problemsDelays) formData.append("problems_delays", problemsDelays);
    if (delayReason) formData.append("delay_reason", delayReason);
    if (actionRequired) formData.append("action_required", actionRequired);
    if (responsibleParty) formData.append("responsible_party", responsibleParty);

    // Append compressed photos
    for (const photo of photos) {
      formData.append("photos", photo);
    }

    const res = await submitSiteReportAction(null, formData);

    if (res.error) {
      setErrorMessage(res.error);
      setIsSubmitting(false);
      setIsConfirmModalOpen(false);
    } else {
      localStorage.removeItem(draftKey);
      setSuccessMessage("Daily site report submitted successfully!");
      setIsConfirmModalOpen(false);
      setTimeout(() => {
        router.push("/employee/my-reports");
      }, 1000);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Title Header */}
      <div className="border-b border-slate-800 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg font-bold text-slate-100 tracking-tight">
              {prefilledReport ? "Edit Site Report" : "Daily Site Report"}
            </h1>
          </div>
          {hasDraftRestored && !prefilledReport && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Draft Restored</span>
              </span>
              <button
                type="button"
                onClick={clearDraft}
                className="text-[10px] text-slate-400 hover:text-slate-200 underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Log daily site progress, workforce headcount, material status, and construction photos.
        </p>
      </div>

      {/* Global Error & Success Banners */}
      {errorMessage && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleFormSubmitInitiate} className="space-y-5 text-xs">
        {/* Project Selection Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>Project &amp; Date Details</span>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Assigned Project *
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name} ({p.site_location})
                </option>
              ))}
            </select>
          </div>

          {selectedProject && (
            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span>Current Stage:</span>
                <span className="font-medium text-amber-400">
                  Stage {selectedProject.current_stage?.position}: {selectedProject.current_stage?.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Location:</span>
                <span className="text-slate-300">{selectedProject.site_location}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Report Date *
            </label>
            <input
              type="date"
              required
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          {selectedProject && selectedProject.milestones.length > 0 && (
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Link to Milestone Progress (optional)
              </label>
              <select
                value={milestoneId}
                onChange={(e) => setMilestoneId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="">No Milestone Link</option>
                {selectedProject.milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Work Completed Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Daily Site Execution</span>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Work Completed Today *
            </label>
            <textarea
              required
              rows={3}
              value={workCompleted}
              onChange={(e) => setWorkCompleted(e.target.value)}
              placeholder="e.g. Completed erection of 4 main portal frames in Grid A-D. High strength bolt torquing completed on rafter joints..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Progress &amp; Engineering Notes (optional)
            </label>
            <textarea
              rows={2}
              value={progressNote}
              onChange={(e) => setProgressNote(e.target.value)}
              placeholder="e.g. Crane setup moved to Grid E for tomorrow's lift. Alignment check passed with surveyor."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>
        </div>

        {/* Workforce Headcount Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <Users className="w-4 h-4 text-amber-400" />
            <span>Workforce Headcount</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Westeel Own Staff *
              </label>
              <input
                type="number"
                min="0"
                required
                value={ownHeadcount}
                onChange={(e) => setOwnHeadcount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Subcontractor Labour *
              </label>
              <input
                type="number"
                min="0"
                required
                value={subcontractorHeadcount}
                onChange={(e) => setSubcontractorHeadcount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Materials Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <Package className="w-4 h-4 text-amber-400" />
            <span>Materials Management</span>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Materials Received Today
            </label>
            <input
              type="text"
              value={materialsReceived}
              onChange={(e) => setMaterialsReceived(e.target.value)}
              placeholder="e.g. 2 truckloads of sheeting coils, batch #2026-A"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Materials Required on Site
            </label>
            <input
              type="text"
              value={materialsRequired}
              onChange={(e) => setMaterialsRequired(e.target.value)}
              placeholder="e.g. Need 400 self-drilling screws and ridge caps by Friday"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Issues, Delays & Blockers Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Problems, Delays &amp; Blockers</span>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Delay Reason (if work delayed)
            </label>
            <select
              value={delayReason}
              onChange={(e) => setDelayReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="">No Delay Today</option>
              {DELAY_REASONS.map((r) => (
                <option key={r} value={r}>
                  {DELAY_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Problems / Obstacles Encountered
            </label>
            <textarea
              rows={2}
              value={problemsDelays}
              onChange={(e) => setProblemsDelays(e.target.value)}
              placeholder="e.g. Heavy rainfall from 2 PM to 5 PM stopped high-elevation sheeting work..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Action Required
              </label>
              <input
                type="text"
                value={actionRequired}
                onChange={(e) => setActionRequired(e.target.value)}
                placeholder="e.g. Arrange extra crane shift"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Responsible Party
              </label>
              <input
                type="text"
                value={responsibleParty}
                onChange={(e) => setResponsibleParty(e.target.value)}
                placeholder="e.g. Project Manager / Client"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Site Photos Upload Card (Mobile-First Compression & Progress) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <Camera className="w-4 h-4 text-amber-400" />
              <span>Site Photos (Compressed on Device)</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              {photos.length} photo{photos.length === 1 ? "" : "s"}
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            Photos are automatically compressed to under 1MB for fast upload on remote 4G/3G site connections.
          </p>

          {/* Upload Button / Trigger */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              className="hidden"
              id="site-photo-upload"
            />
            <label
              htmlFor="site-photo-upload"
              className="w-full py-3 px-4 border border-dashed border-slate-700 hover:border-amber-500/70 rounded-xl bg-slate-950/60 hover:bg-slate-950 text-slate-300 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition text-center"
            >
              <Camera className="w-5 h-5 text-amber-400" />
              <span className="font-semibold text-xs">Tap to Take or Select Photos</span>
              <span className="text-[10px] text-slate-500">Supports camera capture or gallery selection</span>
            </label>
          </div>

          {/* Compression Progress Indicator */}
          {isCompressing && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-2 text-[11px]">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
              <span>{compressionProgress || "Optimizing photos..."}</span>
            </div>
          )}

          {/* Photos Preview Grid */}
          {photoPreviews.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
              {photoPreviews.map((previewUrl, idx) => (
                <div
                  key={idx}
                  className="relative group rounded-lg overflow-hidden border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={`Photo preview ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-950/80 hover:bg-rose-950 text-slate-300 hover:text-rose-300 flex items-center justify-center transition border border-slate-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-1 left-1.5 text-[9px] px-1 py-0.2 rounded bg-black/70 text-slate-300 font-mono">
                    {(photos[idx].size / 1024).toFixed(0)} KB
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isCompressing || isSubmitting}
            className="w-full py-3.5 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm tracking-wide transition shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
            ) : (
              <Upload className="w-4 h-4 text-slate-950" />
            )}
            <span>Submit Daily Site Report</span>
          </button>
        </div>
      </form>

      {/* CONFIRMATION MODAL */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden text-xs">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
              <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                <span>Confirm Report Submission</span>
              </h3>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-slate-300">
                Are you ready to submit this daily site report for{" "}
                <strong className="text-amber-400">{selectedProject?.code}</strong> on{" "}
                <strong className="text-slate-100">{reportDate}</strong>?
              </p>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1.5 text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Workforce Total:</span>
                  <span className="font-mono text-slate-200 font-bold">
                    {parseInt(ownHeadcount || "0") + parseInt(subcontractorHeadcount || "0")} workers
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Photos Attached:</span>
                  <span className="font-mono text-slate-200 font-bold">{photos.length} photos</span>
                </div>
                {delayReason && (
                  <div className="flex justify-between text-rose-400">
                    <span>Delay Logged:</span>
                    <span>{DELAY_REASON_LABELS[delayReason as keyof typeof DELAY_REASON_LABELS]}</span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-500">
                This will submit the report for review by your Project Manager.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Go Back &amp; Review
              </button>
              <button
                type="button"
                onClick={handleConfirmedSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm &amp; Send</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
