"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CostCategory } from "@/lib/costs/types";
import { AccountForm, AuthenticatorReset } from "./account-form";
import { DeveloperMode } from "./developer-mode";
import { LeadSourceItem, LostReasonItem } from "@/lib/sales/types";
import {
  createCostCategoryAction,
  updateCostCategoryAction,
} from "@/lib/costs/actions";
import {
  createLeadSourceAction,
  toggleLeadSourceAction,
  createLostReasonAction,
  toggleLostReasonAction,
} from "@/lib/sales/actions";
import {
  Settings,
  UserRound,
  Wrench,
  Layers,
  Plus,
  Edit2,
  Check,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Ban,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

interface SettingsClientProps {
  categories: CostCategory[];
  leadSources: LeadSourceItem[];
  lostReasons: LostReasonItem[];
  isDirector: boolean;
  account: { fullName: string; email: string };
  flags: { underConstruction: boolean; mfaOffUntil: string | null };
}

export function SettingsClient({
  categories,
  leadSources,
  lostReasons,
  isDirector,
  account,
  flags,
}: SettingsClientProps) {
  const router = useRouter();

  // Active Tab
  const [activeTab, setActiveTab] = useState<"account" | "costs" | "lead_sources" | "lost_reasons" | "developer">("account");

  // Create Modal State (Cost Categories)
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Edit Modal State (Cost Categories)
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CostCategory | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  // Lead Source Modal State
  const [isCreateSourceModalOpen, setIsCreateSourceModalOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");

  // Lost Reason Modal State
  const [isCreateReasonModalOpen, setIsCreateReasonModalOpen] = useState(false);
  const [newReasonName, setNewReasonName] = useState("");

  // Loading & error
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handlers for Cost Categories
  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirector) return;
    setIsSubmitting(true);
    setActionError(null);
    setSuccessMessage(null);

    const res = await createCostCategoryAction(newCategoryName.trim());
    setIsSubmitting(false);

    if (res.error) {
      setActionError(res.error);
    } else {
      setIsCreateCategoryModalOpen(false);
      setNewCategoryName("");
      setSuccessMessage("Cost category created successfully.");
      router.refresh();
    }
  }

  function openEditModal(category: CostCategory) {
    setEditingCategory(category);
    setEditCategoryName(category.name);
    setEditIsActive(category.is_active ?? true);
    setActionError(null);
    setIsEditCategoryModalOpen(true);
  }

  async function handleUpdateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCategory || !isDirector) return;
    setIsSubmitting(true);
    setActionError(null);
    setSuccessMessage(null);

    const res = await updateCostCategoryAction(
      editingCategory.id,
      editCategoryName.trim(),
      editIsActive
    );

    setIsSubmitting(false);
    if (res.error) {
      setActionError(res.error);
    } else {
      setIsEditCategoryModalOpen(false);
      setEditingCategory(null);
      setSuccessMessage("Cost category updated successfully.");
      router.refresh();
    }
  }

  async function handleToggleCategoryActive(category: CostCategory) {
    if (!isDirector) return;
    setIsSubmitting(true);
    setActionError(null);

    const res = await updateCostCategoryAction(
      category.id,
      category.name,
      !category.is_active
    );

    setIsSubmitting(false);
    if (res.error) {
      setActionError(res.error);
    } else {
      router.refresh();
    }
  }

  // Handlers for Lead Sources
  async function handleCreateSource(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirector) return;
    setIsSubmitting(true);
    setActionError(null);
    setSuccessMessage(null);

    const fd = new FormData();
    fd.append("name", newSourceName.trim());
    const res = await createLeadSourceAction(null, fd);
    setIsSubmitting(false);

    if (res.error) {
      setActionError(res.error);
    } else {
      setIsCreateSourceModalOpen(false);
      setNewSourceName("");
      setSuccessMessage("Lead source added successfully.");
      router.refresh();
    }
  }

  async function handleToggleSourceActive(source: LeadSourceItem) {
    if (!isDirector) return;
    setIsSubmitting(true);
    setActionError(null);

    const res = await toggleLeadSourceAction(source.id, source.is_active);
    setIsSubmitting(false);

    if (res.error) {
      setActionError(res.error);
    } else {
      router.refresh();
    }
  }

  // Handlers for Lost Reasons
  async function handleCreateReason(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirector) return;
    setIsSubmitting(true);
    setActionError(null);
    setSuccessMessage(null);

    const fd = new FormData();
    fd.append("name", newReasonName.trim());
    const res = await createLostReasonAction(null, fd);
    setIsSubmitting(false);

    if (res.error) {
      setActionError(res.error);
    } else {
      setIsCreateReasonModalOpen(false);
      setNewReasonName("");
      setSuccessMessage("Lost reason added successfully.");
      router.refresh();
    }
  }

  async function handleToggleReasonActive(reason: LostReasonItem) {
    if (!isDirector) return;
    setIsSubmitting(true);
    setActionError(null);

    const res = await toggleLostReasonAction(reason.id, reason.is_active);
    setIsSubmitting(false);

    if (res.error) {
      setActionError(res.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <Settings className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Settings
            </h1>
          </div>
        </div>

        {isDirector && (
          <div className="flex items-center gap-2">
            {activeTab === "costs" && (
              <button
                onClick={() => setIsCreateCategoryModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Cost Category</span>
              </button>
            )}
            {activeTab === "lead_sources" && (
              <button
                onClick={() => setIsCreateSourceModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Lead Source</span>
              </button>
            )}
            {activeTab === "lost_reasons" && (
              <button
                onClick={() => setIsCreateReasonModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Lost Reason</span>
              </button>
            )}
          </div>
        )}
      </div>

      {actionError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-red-600 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TABS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("account")}
          className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition ${
            activeTab === "account"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <UserRound className="w-3.5 h-3.5" />
          <span>Account</span>
        </button>

        <button
          onClick={() => setActiveTab("costs")}
          className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition ${
            activeTab === "costs"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Cost Categories</span>
        </button>

        <button
          onClick={() => setActiveTab("lead_sources")}
          className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition ${
            activeTab === "lead_sources"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Lead Sources</span>
        </button>

        <button
          onClick={() => setActiveTab("lost_reasons")}
          className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition ${
            activeTab === "lost_reasons"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Lost Reasons</span>
        </button>

        <button
          onClick={() => setActiveTab("developer")}
          className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition ${
            activeTab === "developer"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Developer</span>
        </button>
      </div>

      {activeTab === "developer" && (
        <DeveloperMode underConstruction={flags.underConstruction} mfaOffUntil={flags.mfaOffUntil} />
      )}

      {activeTab === "account" && (
        <div className="space-y-4">
          <AccountForm fullName={account.fullName} email={account.email} />
          <AuthenticatorReset />
        </div>
      )}

      {/* TAB 1: COST CATEGORIES */}
      {activeTab === "costs" && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Standard Cost Categories</h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900">{c.name}</td>
                    <td className="py-3 px-4">
                      {c.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-300">
                          <Ban className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {c.created_at ? c.created_at.slice(0, 10) : "Default"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isDirector && (
                          <>
                            <button
                              onClick={() => openEditModal(c)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-blue-700 transition"
                              title="Edit Category Name & Status"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleCategoryActive(c)}
                              disabled={isSubmitting}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition ${
                                c.is_active
                                  ? "border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {c.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: LEAD SOURCES */}
      {activeTab === "lead_sources" && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Lead Sources</h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Lead Source Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leadSources.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900 capitalize">{s.name}</td>
                    <td className="py-3 px-4">
                      {s.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-300">
                          <Ban className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {s.created_at ? s.created_at.slice(0, 10) : "Default"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isDirector && (
                        <button
                          onClick={() => handleToggleSourceActive(s)}
                          disabled={isSubmitting}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition ${
                            s.is_active
                              ? "border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {s.is_active ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LOST REASONS */}
      {activeTab === "lost_reasons" && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Lost Reasons</h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Required</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Lost Reason Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lostReasons.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900 capitalize">{r.name}</td>
                    <td className="py-3 px-4">
                      {r.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-300">
                          <Ban className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {r.created_at ? r.created_at.slice(0, 10) : "Default"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isDirector && (
                        <button
                          onClick={() => handleToggleReasonActive(r)}
                          disabled={isSubmitting}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition ${
                            r.is_active
                              ? "border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {r.is_active ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE CATEGORY MODAL */}
      {isCreateCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-sm">Add Cost Category</h3>
              <button
                onClick={() => setIsCreateCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Structural Steel, Roofing, Cladding"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateCategoryModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newCategoryName.trim()}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CATEGORY MODAL */}
      {isEditCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-sm">Edit Cost Category</h3>
              <button
                onClick={() => setIsEditCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateCategory} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={editCategoryName}
                  onChange={(e) => setEditCategoryName(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="editIsActive" className="text-slate-700 font-semibold">
                  Active category
                </label>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditCategoryModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !editCategoryName.trim()}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Update Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE LEAD SOURCE MODAL */}
      {isCreateSourceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-sm">Add Lead Source</h3>
              <button
                onClick={() => setIsCreateSourceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSource} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Source Name *
                </label>
                <input
                  type="text"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  placeholder="e.g. Exhibition, Cold Call, Trade Partner"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateSourceModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newSourceName.trim()}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Lead Source</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE LOST REASON MODAL */}
      {isCreateReasonModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-sm">Add Lost Reason</h3>
              <button
                onClick={() => setIsCreateReasonModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateReason} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Lost Reason Name *
                </label>
                <input
                  type="text"
                  value={newReasonName}
                  onChange={(e) => setNewReasonName(e.target.value)}
                  placeholder="e.g. Delivery timeline delayed, Credit terms rejected"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateReasonModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newReasonName.trim()}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Lost Reason</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
