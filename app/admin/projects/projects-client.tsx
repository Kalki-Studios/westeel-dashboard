"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectListItem } from "@/lib/projects/queries";
import { ProjectStage } from "@/lib/projects/types";
import { createProjectAction } from "@/lib/projects/actions";
import {
  Building2,
  Plus,
  Search,
  Calendar,
  MapPin,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  X,
  Loader2,
} from "lucide-react";

interface ProjectsClientProps {
  initialProjects: ProjectListItem[];
  stages: ProjectStage[];
}

export function ProjectsClient({ initialProjects, stages }: ProjectsClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filter projects
  const filteredProjects = initialProjects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.site_location.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "delayed"
        ? p.is_delayed
        : p.status === statusFilter;

    const matchesStage =
      stageFilter === "all" ? true : p.current_stage?.id === stageFilter;

    return matchesSearch && matchesStatus && matchesStage;
  });

  const delayedCount = initialProjects.filter((p) => p.is_delayed).length;
  const activeCount = initialProjects.filter((p) => p.status === "active").length;

  async function handleCreateProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const formData = new FormData(e.currentTarget);
    const result = await createProjectAction(null, formData);

    if (result.error) {
      setFormError(result.error);
      setIsSubmitting(false);
    } else if (result.success && result.projectId) {
      setIsCreateModalOpen(false);
      setIsSubmitting(false);
      router.push(`/x9admin/projects/${result.projectId}`);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Stat Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              Projects Directory
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
              {initialProjects.length} total
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs tracking-wide transition shadow-md shadow-blue-600/25 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Total Projects
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono mt-1">
            {initialProjects.length}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Active Projects
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
            {activeCount}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Delayed
          </div>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              delayedCount > 0 ? "text-rose-400" : "text-slate-400"
            }`}
          >
            {delayedCount}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Pipeline Stages
          </div>
          <div className="text-xl font-bold text-amber-400 font-mono mt-1">
            {stages.length} Fixed
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
            placeholder="Search by code (e.g. WB-2026-001), name, or site location..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <div className="flex gap-2 shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500/50 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="delayed">Delayed Only</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500/50 cursor-pointer"
          >
            <option value="all">All Stages</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                Stage {s.position}: {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Project Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Code & Project</th>
                <th className="py-3 px-4">Site Location</th>
                <th className="py-3 px-4">Current Stage</th>
                <th className="py-3 px-4">Milestone Progress</th>
                <th className="py-3 px-4">Status & Health</th>
                <th className="py-3 px-4">Planned Completion</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <div>No projects found matching your search and filter criteria.</div>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-800/30 transition group"
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/x9admin/projects/${p.id}`}
                          className="font-mono font-semibold text-amber-400 hover:text-amber-300 tracking-tight block"
                        >
                          {p.code}
                        </Link>
                        <div className="text-slate-200 font-medium mt-0.5">
                          {p.name}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate max-w-[180px]">{p.site_location}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {p.current_stage ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-950/40 border border-blue-800/40 text-blue-300 text-[11px]">
                            <span className="font-mono font-bold">
                              {p.current_stage.position}
                            </span>
                            <span className="truncate max-w-[160px]">
                              {p.current_stage.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">No stage set</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-300">
                        {/* Rule R2 Progress: Display "X of Y milestones done", never a percentage */}
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{p.progress_text}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {/* Rule R1: Delayed status */}
                        {p.is_delayed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/50 border border-rose-800/60 text-rose-300 text-[11px] font-semibold">
                            <AlertCircle className="w-3 h-3 text-rose-400" />
                            <span>
                              {p.delay_reason === "project_overdue"
                                ? "Delayed: Project Overdue"
                                : "Delayed: Milestone Overdue"}
                            </span>
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                              p.status === "active"
                                ? "bg-emerald-950/40 border border-emerald-800/40 text-emerald-300"
                                : p.status === "on_hold"
                                ? "bg-amber-950/40 border border-amber-800/40 text-amber-300"
                                : "bg-slate-800 border border-slate-700 text-slate-300"
                            }`}
                          >
                            {p.status.replace("_", " ")}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>{p.planned_completion_date}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/x9admin/projects/${p.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-[11px]"
                        >
                          <span>Manage</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-sm text-slate-100">Create New Project</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Project Name *
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Jindal Steel Raw Material Warehouse"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Site Location *
                </label>
                <input
                  name="site_location"
                  type="text"
                  required
                  placeholder="e.g. Angul Industrial Park, Odisha"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Site Contact Person
                  </label>
                  <input
                    name="site_contact_name"
                    type="text"
                    placeholder="e.g. Ramesh Mohapatra"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Site Contact Phone
                  </label>
                  <input
                    name="site_contact_phone"
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Initial Stage
                </label>
                <select
                  name="current_stage_id"
                  defaultValue={stages[0]?.id || ""}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500/50"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      Stage {s.position}: {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    name="start_date"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Planned Completion Date *
                  </label>
                  <input
                    name="planned_completion_date"
                    type="date"
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Initial Notes / Site Scope
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Key structural specifications, client requirements, or special erection conditions..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-semibold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Generate Code & Create</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
