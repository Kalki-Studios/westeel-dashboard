"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ProjectDetail,
  ProjectStage,
  DELAY_REASONS,
  DELAY_REASON_LABELS,
  DelayReason,
  ProjectMilestone,
} from "@/lib/projects/types";
import {
  updateProjectStageAction,
  addDefaultMilestonesAction,
  createMilestoneAction,
  updateMilestoneAction,
  assignProjectMemberAction,
  removeProjectMemberAction,
} from "@/lib/projects/actions";
import { isProjectDelayed, formatMilestoneProgress } from "@/lib/rules/projects";
import { DocumentItem, DOC_CATEGORIES } from "@/lib/documents/types";
import {
  uploadDocumentAction,
  reviewDrawingAction,
  getSignedDocumentUrlAction,
} from "@/lib/documents/actions";
import { ProjectBillingData } from "@/lib/billing/types";
import { BillingTab } from "./billing-tab";
import { ProjectCostsData } from "@/lib/costs/types";
import { OrdersTab } from "./orders-tab";
import { ProfitabilityTab } from "./profitability-tab";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  MapPin,
  User,
  Phone,
  Layers,
  Users,
  Flag,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Check,
  AlertTriangle,
  FileText,
  Upload,
  Download,
  FileCheck,
  Ban,
  Lock,
  IndianRupee,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";

interface ProjectDetailClientProps {
  project: ProjectDetail;
  stages: ProjectStage[];
  activeEmployees: Array<{
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    roles: string[];
  }>;
  initialDocuments?: DocumentItem[];
  initialBillingData?: ProjectBillingData | null;
  initialCostData?: ProjectCostsData | null;
}

export function ProjectDetailClient({
  project,
  stages,
  activeEmployees,
  initialDocuments = [],
  initialBillingData = null,
  initialCostData = null,
}: ProjectDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTabParam = searchParams.get("tab");
  const validInitialTab =
    initialTabParam === "billing" ||
    initialTabParam === "orders" ||
    initialTabParam === "profitability" ||
    initialTabParam === "milestones" ||
    initialTabParam === "team" ||
    initialTabParam === "documents"
      ? initialTabParam
      : "overview";

  const [activeTab, setActiveTab] = useState<
    "overview" | "milestones" | "team" | "documents" | "billing" | "orders" | "profitability"
  >(validInitialTab);

  // Loading states
  const [isChangingStage, setIsChangingStage] = useState(false);
  const [isAddingDefaults, setIsAddingDefaults] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Milestone Modals
  const [isAddMilestoneModalOpen, setIsAddMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null);
  const [isSubmittingMilestone, setIsSubmittingMilestone] = useState(false);

  // Member Modal
  const [isAssignMemberModalOpen, setIsAssignMemberModalOpen] = useState(false);
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);

  // Document states
  const [isUploadDocModalOpen, setIsUploadDocModalOpen] = useState(false);
  const [reviewingDoc, setReviewingDoc] = useState<DocumentItem | null>(null);
  const [revisionDoc, setRevisionDoc] = useState<DocumentItem | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"approved" | "rejected">("approved");
  const [reviewNote, setReviewNote] = useState("");
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);

  // Document Handlers
  async function handleDownloadDoc(docId: string) {
    setDownloadingDocId(docId);
    setActionError(null);
    const res = await getSignedDocumentUrlAction(docId);
    if (res.error) {
      setActionError(res.error);
    } else if (res.downloadUrl) {
      window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
    }
    setDownloadingDocId(null);
  }

  async function handleUploadDoc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmittingDoc(true);
    setActionError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("project_id", project.id);
    const res = await uploadDocumentAction(null, formData);

    if (res.error) {
      setActionError(res.error);
    } else {
      setIsUploadDocModalOpen(false);
      setRevisionDoc(null);
      router.refresh();
    }
    setIsSubmittingDoc(false);
  }

  async function handleReviewDrawing(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewingDoc) return;

    setIsSubmittingDoc(true);
    setActionError(null);

    const res = await reviewDrawingAction(reviewingDoc.id, reviewDecision, reviewNote);

    if (res.error) {
      setActionError(res.error);
    } else {
      setReviewingDoc(null);
      setReviewNote("");
      router.refresh();
    }
    setIsSubmittingDoc(false);
  }

  // Calculate Rule R1 and R2
  const milestonesForRules = (project.milestones || []).map((m) => ({
    id: m.id,
    title: m.title,
    plannedDate: m.planned_date,
    actualDate: m.actual_date,
    status: m.status,
    delayReason: m.delay_reason,
    delayNote: m.delay_note,
  }));

  const delayResult = isProjectDelayed({
    status: project.status,
    plannedCompletionDate: project.planned_completion_date,
    milestones: milestonesForRules,
  });

  const progressText = formatMilestoneProgress(milestonesForRules);

  // Handle stage change
  async function handleStageChange(newStageId: string) {
    if (newStageId === project.current_stage_id) return;
    setIsChangingStage(true);
    setActionError(null);

    const res = await updateProjectStageAction(project.id, newStageId);
    if (res.error) {
      setActionError(res.error);
    } else {
      router.refresh();
    }
    setIsChangingStage(false);
  }

  // Handle Add Default Milestones
  async function handleAddDefaultMilestones() {
    setIsAddingDefaults(true);
    setActionError(null);

    const res = await addDefaultMilestonesAction(project.id);
    if (res.error) {
      setActionError(res.error);
    } else {
      router.refresh();
    }
    setIsAddingDefaults(false);
  }

  // Handle Add Milestone submit
  async function handleAddMilestone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmittingMilestone(true);
    setActionError(null);

    const formData = new FormData(e.currentTarget);
    formData.append("project_id", project.id);

    const res = await createMilestoneAction(null, formData);
    if (res.error) {
      setActionError(res.error);
    } else {
      setIsAddMilestoneModalOpen(false);
      router.refresh();
    }
    setIsSubmittingMilestone(false);
  }

  // Handle Edit Milestone submit
  async function handleEditMilestone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingMilestone) return;

    setIsSubmittingMilestone(true);
    setActionError(null);

    const formData = new FormData(e.currentTarget);
    formData.append("project_id", project.id);
    formData.append("milestone_id", editingMilestone.id);

    const res = await updateMilestoneAction(null, formData);
    if (res.error) {
      setActionError(res.error);
    } else {
      setEditingMilestone(null);
      router.refresh();
    }
    setIsSubmittingMilestone(false);
  }

  // Handle Assign Member
  async function handleAssignMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmittingMember(true);
    setActionError(null);

    const formData = new FormData(e.currentTarget);
    formData.append("project_id", project.id);

    const res = await assignProjectMemberAction(null, formData);
    if (res.error) {
      setActionError(res.error);
    } else {
      setIsAssignMemberModalOpen(false);
      router.refresh();
    }
    setIsSubmittingMember(false);
  }

  // Handle Remove Member
  async function handleRemoveMember(userId: string) {
    setActionError(null);
    const res = await removeProjectMemberAction(project.id, userId);
    if (res.error) {
      setActionError(res.error);
    } else {
      router.refresh();
    }
  }

  const currentStagePosition = project.current_stage?.position || 1;

  return (
    <div className="space-y-6">
      {/* Back button & Title Bar */}
      <div>
        <Link
          href="/x9admin/projects"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Projects Directory</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-sm px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold">
                {project.code}
              </span>
              <h1 className="text-xl font-bold text-slate-100 tracking-tight">
                {project.name}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>{project.site_location}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {project.start_date} to {project.planned_completion_date}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Rule R1 Badge */}
            {delayResult.isDelayed ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  {delayResult.reason === "project_overdue"
                    ? "Delayed: Project Overdue"
                    : "Delayed: Milestone Overdue"}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>On Schedule</span>
              </div>
            )}

            {/* Rule R2 Progress Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono">
              <Flag className="w-3.5 h-3.5 text-amber-400" />
              <span>{progressText}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Action Error Alert */}
      {actionError && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
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

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold transition border-b-2 cursor-pointer ${
            activeTab === "overview"
              ? "border-amber-400 text-amber-400 bg-amber-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Stage Overview</span>
        </button>

        <button
          onClick={() => setActiveTab("milestones")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold transition border-b-2 cursor-pointer ${
            activeTab === "milestones"
              ? "border-amber-400 text-amber-400 bg-amber-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Flag className="w-4 h-4" />
          <span>Milestones</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px]">
            {project.milestones?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("team")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold transition border-b-2 cursor-pointer ${
            activeTab === "team"
              ? "border-amber-400 text-amber-400 bg-amber-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Assigned Team</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px]">
            {project.members?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("documents")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold transition border-b-2 cursor-pointer ${
            activeTab === "documents"
              ? "border-amber-400 text-amber-400 bg-amber-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Documents &amp; Drawings</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px]">
            {initialDocuments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("billing")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold transition border-b-2 cursor-pointer ${
            activeTab === "billing"
              ? "border-amber-400 text-amber-400 bg-amber-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <IndianRupee className="w-4 h-4 text-emerald-400" />
          <span>Billing &amp; Collections</span>
          {initialBillingData && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px]">
              {initialBillingData.invoices.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("orders")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold transition border-b-2 cursor-pointer ${
            activeTab === "orders"
              ? "border-amber-400 text-amber-400 bg-amber-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShoppingBag className="w-4 h-4 text-amber-400" />
          <span>Orders &amp; Costs</span>
          {initialCostData && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px]">
              {initialCostData.orders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("profitability")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold transition border-b-2 cursor-pointer ${
            activeTab === "profitability"
              ? "border-amber-400 text-amber-400 bg-amber-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>Profitability</span>
          {initialCostData?.summary.isOverBudget && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-400 font-mono text-[9px] uppercase font-bold">
              Overrun
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: OVERVIEW & STAGES */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stage Pipeline Visualizer */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-semibold text-sm text-slate-100">
                  9-Stage Structural Pipeline
                </h3>
                <p className="text-xs text-slate-400">
                  Current Stage:{" "}
                  <span className="text-amber-400 font-medium">
                    Stage {project.current_stage?.position}: {project.current_stage?.name}
                  </span>
                </p>
              </div>

              {/* Stage Switcher */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Change to:</span>
                <select
                  value={project.current_stage_id || ""}
                  onChange={(e) => handleStageChange(e.target.value)}
                  disabled={isChangingStage}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500 disabled:opacity-50 cursor-pointer"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      Stage {s.position}: {s.name}
                    </option>
                  ))}
                </select>
                {isChangingStage && <Loader2 className="w-4 h-4 animate-spin text-amber-400" />}
              </div>
            </div>

            {/* Stages Stepper Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-9 gap-2 pt-2">
              {stages.map((stg) => {
                const isCurrent = stg.position === currentStagePosition;
                const isCompleted = stg.position < currentStagePosition;

                return (
                  <button
                    key={stg.id}
                    onClick={() => handleStageChange(stg.id)}
                    disabled={isChangingStage}
                    className={`text-left p-2.5 rounded-lg border transition cursor-pointer flex flex-col justify-between min-h-[90px] ${
                      isCurrent
                        ? "bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/5 ring-1 ring-amber-500/20"
                        : isCompleted
                        ? "bg-slate-900/90 border-emerald-800/40 text-slate-300"
                        : "bg-slate-950/40 border-slate-800/80 text-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isCurrent
                            ? "bg-amber-500 text-slate-950"
                            : isCompleted
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {stg.position}
                      </span>
                      {isCompleted && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      {isCurrent && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      )}
                    </div>

                    <div
                      className={`text-[11px] font-medium line-clamp-2 mt-2 leading-tight ${
                        isCurrent
                          ? "text-amber-200"
                          : isCompleted
                          ? "text-slate-200"
                          : "text-slate-400"
                      }`}
                    >
                      {stg.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Project Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Site & Contact Details
              </h4>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-slate-400 text-[11px]">Site Location</div>
                  <div className="text-slate-100 font-medium mt-0.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{project.site_location}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/60">
                  <div>
                    <div className="text-slate-400 text-[11px]">Site Contact Person</div>
                    <div className="text-slate-200 font-medium mt-0.5 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>{project.site_contact_name || "Not assigned"}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[11px]">Contact Phone</div>
                    <div className="text-slate-200 font-medium mt-0.5 flex items-center gap-1.5 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>{project.site_contact_phone || "Not available"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Schedule & Completion
              </h4>
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-slate-400 text-[11px]">Start Date</div>
                    <div className="text-slate-200 font-mono mt-0.5">{project.start_date}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[11px]">Planned Completion</div>
                    <div className="text-slate-200 font-mono mt-0.5 font-semibold text-amber-400">
                      {project.planned_completion_date}
                    </div>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-800/60">
                  <div className="text-slate-400 text-[11px]">Project Notes / Scope</div>
                  <div className="text-slate-300 mt-0.5 whitespace-pre-wrap leading-relaxed">
                    {project.notes || "No additional scope notes entered."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MILESTONES */}
      {activeTab === "milestones" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-slate-100">Project Milestones</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                  {progressText}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Milestones with past planned dates and pending status show as delayed.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddDefaultMilestones}
                disabled={isAddingDefaults}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition border border-slate-700 cursor-pointer disabled:opacity-50"
              >
                {isAddingDefaults ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>Add default milestones from stages</span>
              </button>

              <button
                onClick={() => setIsAddMilestoneModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Milestone</span>
              </button>
            </div>
          </div>

          {/* Milestones Table */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-12">#</th>
                    <th className="py-3 px-4">Milestone Title</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4">Planned Date</th>
                    <th className="py-3 px-4">Actual Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Delay Reason & Notes</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(!project.milestones || project.milestones.length === 0) ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <Flag className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                        <div>No milestones recorded for this project yet.</div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Click &quot;Add default milestones from stages&quot; to populate standard milestones.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    project.milestones.map((m, idx) => {
                      const isOverdue =
                        m.status === "pending" &&
                        m.planned_date &&
                        new Date(m.planned_date) < new Date();

                      return (
                        <tr
                          key={m.id}
                          className="hover:bg-slate-800/30 transition group"
                        >
                          <td className="py-3 px-4 font-mono text-slate-500">
                            {idx + 1}
                          </td>

                          <td className="py-3 px-4 font-medium text-slate-100">
                            {m.title}
                          </td>

                          <td className="py-3 px-4 text-slate-400">
                            {m.stage ? (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-300">
                                Stage {m.stage.position}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono text-xs">
                            {/* Requirement: planned date empty shown as "date missing" */}
                            {!m.planned_date ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/50 text-amber-400 font-sans text-[11px] font-medium">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                <span>Date missing</span>
                              </span>
                            ) : isOverdue ? (
                              <span className="text-rose-400 font-semibold flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{m.planned_date} (Overdue)</span>
                              </span>
                            ) : (
                              <span className="text-slate-300">{m.planned_date}</span>
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono text-xs text-slate-400">
                            {m.actual_date || "—"}
                          </td>

                          <td className="py-3 px-4">
                            {m.status === "done" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-[11px] font-medium">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>Done</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>Pending</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            {m.delay_reason ? (
                              <div>
                                <span className="inline-block px-1.5 py-0.5 rounded bg-rose-950/50 border border-rose-800/60 text-rose-300 text-[10px] font-semibold">
                                  {DELAY_REASON_LABELS[m.delay_reason as DelayReason] ||
                                    m.delay_reason}
                                </span>
                                {m.delay_note && (
                                  <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                                    {m.delay_note}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setEditingMilestone(m)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TEAM MEMBERS */}
      {activeTab === "team" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-slate-100">Assigned Team Members</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                  {project.members?.length || 0} assigned
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Assigned team members get contextual access to this project based on their departmental roles.
              </p>
            </div>

            <button
              onClick={() => setIsAssignMemberModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Assign Member</span>
            </button>
          </div>

          {/* Members Table */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Contact Phone</th>
                    <th className="py-3 px-4">Assigned Role on Project</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(!project.members || project.members.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                        <div>No members assigned to this project yet.</div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Click &quot;Assign Member&quot; to attach site engineers, project managers, or sales officers.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    project.members.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-medium text-slate-100">
                          {m.user?.full_name || "Unknown User"}
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                          {m.user?.email || "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                          {m.user?.phone || "—"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300 capitalize">
                            {m.member_role.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleRemoveMember(m.user_id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 text-[11px] transition cursor-pointer border border-rose-800/30"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DOCUMENTS & DRAWINGS */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <div>
              <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Project Documents &amp; Drawings</span>
              </h3>
            </div>

            <button
              onClick={() => {
                setActionError(null);
                setRevisionDoc(null);
                setIsUploadDocModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs tracking-wide transition shadow-lg shadow-amber-500/10 cursor-pointer shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>Upload File for this Project</span>
            </button>
          </div>

          {/* Documents Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                    <th className="py-3 px-4 font-medium">Document / File</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium">Version</th>
                    <th className="py-3 px-4 font-medium">Approval Status</th>
                    <th className="py-3 px-4 font-medium">Uploaded By</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {initialDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                        <p>No documents uploaded yet for this project.</p>
                      </td>
                    </tr>
                  ) : (
                    initialDocuments.map((doc) => {
                      const isDrawing = doc.category === "drawing";
                      const isRestricted =
                        doc.category === "contract" ||
                        doc.category === "invoice" ||
                        doc.category === "bill";

                      return (
                        <tr key={doc.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-200">{doc.title}</div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {(doc.size_bytes / 1024 / 1024).toFixed(2)} MB •{" "}
                              {new Date(doc.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="capitalize px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px] border border-slate-700">
                              {doc.category.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-amber-400">
                            v{doc.version_no}
                          </td>
                          <td className="py-3 px-4">
                            {isDrawing ? (
                              doc.review_status === "pending" ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/60 border border-amber-800/80 text-amber-300 font-semibold text-[11px]">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Pending (Age: {doc.drawing_age_days ?? 0}d)</span>
                                </div>
                              ) : doc.review_status === "approved" ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Approved</span>
                                </div>
                              ) : doc.review_status === "rejected" ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-950/60 border border-rose-800/80 text-rose-300 text-[11px]">
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>Rejected</span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 text-[10px]">
                                  <span>Superseded (Older)</span>
                                </div>
                              )
                            ) : isRestricted ? (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950/40 border border-purple-800/60 text-purple-300 text-[10px] font-mono">
                                <Lock className="w-3 h-3 text-purple-400" />
                                <span>Restricted</span>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {doc.uploader?.full_name || "System"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isDrawing && doc.review_status === "pending" && (
                                <button
                                  onClick={() => {
                                    setReviewingDoc(doc);
                                    setReviewDecision("approved");
                                    setReviewNote("");
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-semibold border border-amber-500/30 transition cursor-pointer"
                                >
                                  <FileCheck className="w-3 h-3" />
                                  <span>Review</span>
                                </button>
                              )}

                              {isDrawing && (
                                <button
                                  onClick={() => {
                                    setRevisionDoc(doc);
                                    setIsUploadDocModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition cursor-pointer"
                                >
                                  <Upload className="w-3 h-3" />
                                  <span>Revise</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleDownloadDoc(doc.id)}
                                disabled={downloadingDocId === doc.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 transition cursor-pointer disabled:opacity-50"
                              >
                                {downloadingDocId === doc.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                                ) : (
                                  <Download className="w-3 h-3 text-amber-400" />
                                )}
                                <span>Download</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: BILLING & COLLECTIONS */}
      {activeTab === "billing" && (
        initialBillingData ? (
          <BillingTab
            projectId={project.id}
            projectCode={project.code}
            projectName={project.name}
            billingData={initialBillingData}
            isDirector={true}
          />
        ) : (
          <div className="p-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-xl">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
            <span>Loading billing and collections data...</span>
          </div>
        )
      )}

      {/* TAB 6: ORDERS & COSTS */}
      {activeTab === "orders" && (
        initialCostData ? (
          <OrdersTab
            projectId={project.id}
            projectCode={project.code}
            projectName={project.name}
            costData={initialCostData}
            isDirector={true}
          />
        ) : (
          <div className="p-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-xl">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
            <span>Loading orders and costs data...</span>
          </div>
        )
      )}

      {/* TAB 7: PROFITABILITY */}
      {activeTab === "profitability" && (
        initialCostData ? (
          <ProfitabilityTab
            projectId={project.id}
            projectCode={project.code}
            projectName={project.name}
            costData={initialCostData}
            isDirector={true}
          />
        ) : (
          <div className="p-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-xl">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
            <span>Loading profitability data...</span>
          </div>
        )
      )}

      {/* MODAL 1: ADD MILESTONE */}
      {isAddMilestoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
              <h3 className="font-semibold text-sm text-slate-100">Add Milestone</h3>
              <button
                onClick={() => setIsAddMilestoneModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddMilestone} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Milestone Title *
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Anchor bolt casting inspection"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Link to Stage (optional)
                </label>
                <select
                  name="stage_id"
                  defaultValue=""
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">No Stage Link</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      Stage {s.position}: {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Planned Date (leave empty for &quot;Date missing&quot;)
                </label>
                <input
                  name="planned_date"
                  type="date"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddMilestoneModalOpen(false)}
                  disabled={isSubmittingMilestone}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMilestone}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs disabled:opacity-50"
                >
                  {isSubmittingMilestone && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Add Milestone</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT MILESTONE */}
      {editingMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
              <h3 className="font-semibold text-sm text-slate-100">
                Edit Milestone: {editingMilestone.title}
              </h3>
              <button
                onClick={() => setEditingMilestone(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleEditMilestone} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Milestone Title *
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={editingMilestone.title}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Planned Date
                  </label>
                  <input
                    name="planned_date"
                    type="date"
                    defaultValue={editingMilestone.planned_date || ""}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Actual Date
                  </label>
                  <input
                    name="actual_date"
                    type="date"
                    defaultValue={editingMilestone.actual_date || ""}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Status *
                </label>
                <select
                  name="status"
                  defaultValue={editingMilestone.status}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="pending">Pending</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Delay Reason (if delayed)
                </label>
                <select
                  name="delay_reason"
                  defaultValue={editingMilestone.delay_reason || ""}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">None / On Track</option>
                  {DELAY_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {DELAY_REASON_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Delay Explanation Note
                </label>
                <textarea
                  name="delay_note"
                  rows={2}
                  defaultValue={editingMilestone.delay_note || ""}
                  placeholder="Specific details regarding root cause of delay and mitigation..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMilestone(null)}
                  disabled={isSubmittingMilestone}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMilestone}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs disabled:opacity-50"
                >
                  {isSubmittingMilestone && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Milestone</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ASSIGN MEMBER */}
      {isAssignMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
              <h3 className="font-semibold text-sm text-slate-100">
                Assign Team Member to Project
              </h3>
              <button
                onClick={() => setIsAssignMemberModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAssignMember} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Select Employee *
                </label>
                <select
                  name="user_id"
                  required
                  defaultValue=""
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="" disabled>
                    Choose an employee...
                  </option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Project Role *
                </label>
                <select
                  name="member_role"
                  required
                  defaultValue="site_engineer"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="site_engineer">Site Engineer</option>
                  <option value="project_manager">Project Manager</option>
                  <option value="sales">Sales Officer</option>
                  <option value="accounts">Accounts Officer</option>
                  <option value="purchase">Purchase Officer</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAssignMemberModalOpen(false)}
                  disabled={isSubmittingMember}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMember}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs disabled:opacity-50"
                >
                  {isSubmittingMember && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Assign to Project</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: UPLOAD DOCUMENT / DRAWING */}
      {isUploadDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
              <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>
                  {revisionDoc ? `Upload Revision (v${revisionDoc.version_no + 1})` : "Upload Document"}
                </span>
              </h3>
              <button
                onClick={() => {
                  setIsUploadDocModalOpen(false);
                  setRevisionDoc(null);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleUploadDoc} className="p-5 space-y-4 text-xs">
              {revisionDoc && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
                  <strong>Auto-supersede:</strong> Uploading this new file will supersede older revision <strong>v{revisionDoc.version_no}</strong>.
                  <input type="hidden" name="supersedes_id" value={revisionDoc.id} />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Category *
                </label>
                <select
                  name="category"
                  defaultValue={revisionDoc ? revisionDoc.category : "drawing"}
                  disabled={!!revisionDoc}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500 capitalize"
                >
                  {DOC_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.replace("_", " ")}
                    </option>
                  ))}
                </select>
                {revisionDoc && <input type="hidden" name="category" value={revisionDoc.category} />}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Document / Drawing Title *
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={revisionDoc ? revisionDoc.title : ""}
                  placeholder="e.g. Anchor Bolt Layout - GA Drawing"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Select File (Max 25 MB) *
                </label>
                <input
                  name="file"
                  type="file"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-amber-500/10 file:text-amber-400 hover:file:bg-amber-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadDocModalOpen(false);
                    setRevisionDoc(null);
                  }}
                  disabled={isSubmittingDoc}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDoc}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs disabled:opacity-50"
                >
                  {isSubmittingDoc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{revisionDoc ? "Upload Revision" : "Upload File"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: REVIEW DRAWING */}
      {reviewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
              <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-amber-400" />
                <span>Review Structural Drawing</span>
              </h3>
              <button
                onClick={() => setReviewingDoc(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleReviewDrawing} className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-slate-200">{reviewingDoc.title}</div>
                <div className="text-[11px] text-slate-400 flex items-center gap-3">
                  <span>Version: v{reviewingDoc.version_no}</span>
                  <span>Age: {reviewingDoc.drawing_age_days ?? 0} days</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-2">
                  Review Decision *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border cursor-pointer transition ${
                      reviewDecision === "approved"
                        ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value="approved"
                      checked={reviewDecision === "approved"}
                      onChange={() => setReviewDecision("approved")}
                      className="sr-only"
                    />
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve</span>
                  </label>

                  <label
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border cursor-pointer transition ${
                      reviewDecision === "rejected"
                        ? "bg-rose-950/60 border-rose-500 text-rose-300 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value="rejected"
                      checked={reviewDecision === "rejected"}
                      onChange={() => setReviewDecision("rejected")}
                      className="sr-only"
                    />
                    <Ban className="w-4 h-4" />
                    <span>Reject</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Reviewer Notes / Feedback {reviewDecision === "rejected" && "(Required for rejection)"}
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={3}
                  required={reviewDecision === "rejected"}
                  placeholder={
                    reviewDecision === "approved"
                      ? "Optional: Ready for fabrication and site erection..."
                      : "Reason for rejection: e.g. Column anchor dimensions mismatch with GA drawing..."
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setReviewingDoc(null)}
                  disabled={isSubmittingDoc}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDoc}
                  className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-semibold text-xs disabled:opacity-50 ${
                    reviewDecision === "approved"
                      ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                      : "bg-rose-500 hover:bg-rose-400 text-white"
                  }`}
                >
                  {isSubmittingDoc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
