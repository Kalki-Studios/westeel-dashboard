"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TaskItem, TASK_PRIORITIES } from "@/lib/tasks/types";
import { createTaskAction, raiseIssueAction, updateTaskAction, addTaskCommentAction } from "@/lib/tasks/actions";
import {
  CheckSquare,
  AlertTriangle,
  Plus,
  Search,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Building2,
  X,
  Loader2,
  ArrowRight,
  Send,
} from "lucide-react";

interface TasksClientProps {
  initialTasks: TaskItem[];
  projects: Array<{ id: string; code: string; name: string }>;
  employees: Array<{ id: string; full_name: string; email: string }>;
}

export function TasksClient({ initialTasks, projects, employees }: TasksClientProps) {
  const router = useRouter();

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRaiseIssueModalOpen, setIsRaiseIssueModalOpen] = useState(false);
  const [activeTaskDetail, setActiveTaskDetail] = useState<TaskItem | null>(null);

  // Submissions
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Filtering
  const filteredTasks = initialTasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.project?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.project?.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.assignee?.full_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesKind = kindFilter === "all" ? true : t.kind === kindFilter;
    const matchesPriority = priorityFilter === "all" ? true : t.priority === priorityFilter;

    let matchesStatus = true;
    if (statusFilter === "overdue") {
      matchesStatus = !!t.is_overdue;
    } else if (statusFilter === "blocked") {
      matchesStatus = t.status === "blocked";
    } else if (statusFilter !== "all") {
      matchesStatus = t.status === statusFilter;
    }

    return matchesSearch && matchesKind && matchesPriority && matchesStatus;
  });

  const totalCount = initialTasks.length;
  const blockedCount = initialTasks.filter((t) => t.status === "blocked").length;
  const overdueCount = initialTasks.filter((t) => t.is_overdue).length;
  const issuesCount = initialTasks.filter((t) => t.kind === "issue").length;
  const openCount = initialTasks.filter((t) => t.status === "open" || t.status === "in_progress").length;

  // Open detail modal
  function openTaskDetail(task: TaskItem) {
    setActiveTaskDetail(task);
    setFormError(null);
  }

  // Handle Create Task
  async function handleCreateTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const formData = new FormData(e.currentTarget);
    const res = await createTaskAction(null, formData);

    if (res.error) {
      setFormError(res.error);
    } else {
      setIsCreateModalOpen(false);
      router.refresh();
    }
    setIsSubmitting(false);
  }

  // Handle Raise Issue
  async function handleRaiseIssue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const formData = new FormData(e.currentTarget);
    const res = await raiseIssueAction(null, formData);

    if (res.error) {
      setFormError(res.error);
    } else {
      setIsRaiseIssueModalOpen(false);
      router.refresh();
    }
    setIsSubmitting(false);
  }

  // Handle Edit Task (wording / assignee only; status belongs to the employee)
  async function handleEditTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const res = await updateTaskAction(null, new FormData(e.currentTarget));

    if (res.error) {
      setFormError(res.error);
    } else {
      setActiveTaskDetail(null);
      router.refresh();
    }
    setIsSubmitting(false);
  }

  // Handle Add Comment
  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTaskDetail || !commentText.trim()) return;

    setIsSubmittingComment(true);
    const formData = new FormData();
    formData.append("task_id", activeTaskDetail.id);
    formData.append("body", commentText);

    const res = await addTaskCommentAction(null, formData);
    if (!res.error) {
      setCommentText("");
      router.refresh();
    }
    setIsSubmittingComment(false);
  }

  return (
    <div className="space-y-6">
      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              Tasks &amp; Issues
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
              {totalCount} total
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setFormError(null);
              setIsRaiseIssueModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs tracking-wide transition shadow-sm cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4 text-white" />
            <span className="text-white">Raise Issue</span>
          </button>

          <button
            onClick={() => {
              setFormError(null);
              setIsCreateModalOpen(true);
            }}
            className="fab inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs tracking-wide transition shadow-md shadow-blue-600/25 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Open &amp; Active
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono mt-1">{openCount}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Blocked
          </div>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              blockedCount > 0 ? "text-rose-400" : "text-slate-400"
            }`}
          >
            {blockedCount}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Overdue
          </div>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              overdueCount > 0 ? "text-amber-400" : "text-slate-400"
            }`}
          >
            {overdueCount}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Reported Issues
          </div>
          <div className="text-xl font-bold text-orange-400 font-mono mt-1">{issuesCount}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Total Logged
          </div>
          <div className="text-xl font-bold text-slate-300 font-mono mt-1">{totalCount}</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, project code/name, or assignee..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500/50 cursor-pointer"
          >
            <option value="all">All Kinds (Tasks &amp; Issues)</option>
            <option value="task">Tasks Only</option>
            <option value="issue">Issues Only</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500/50 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="blocked">Blocked</option>
            <option value="overdue">Overdue</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500/50 cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Title &amp; Project</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Assignee</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Status &amp; Alert</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <CheckSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <div>No tasks or issues matching your filters.</div>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 max-w-sm">
                      <div className="font-medium text-slate-100 flex items-center gap-1.5">
                        {t.kind === "issue" && (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" aria-label="Issue" />
                        )}
                        <span>{t.title}</span>
                      </div>
                      {t.project ? (
                        <Link
                          href={`/x9admin/projects/${t.project.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 hover:text-amber-300 mt-0.5"
                        >
                          <Building2 className="w-3 h-3" />
                          <span>
                            {t.project.code}: {t.project.name}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic block mt-0.5">
                          General / No Project
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          t.priority === "critical"
                            ? "bg-rose-950/60 border border-rose-800 text-rose-300"
                            : t.priority === "high"
                            ? "bg-amber-950/60 border border-amber-800 text-amber-300"
                            : t.priority === "medium"
                            ? "bg-blue-950/40 border border-blue-800 text-blue-300"
                            : "bg-slate-800 border border-slate-700 text-slate-400"
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-300">
                      {t.assignee ? (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span>{t.assignee.full_name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-xs">
                      {t.due_date ? (
                        t.is_overdue ? (
                          <span className="text-rose-400 font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-rose-400" />
                            <span>{t.due_date} (Overdue)</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">{t.due_date}</span>
                        )
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {t.status === "blocked" ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/80 text-rose-300 text-[11px] font-semibold">
                            <AlertCircle className="w-3 h-3 text-rose-400" />
                            <span>Blocked</span>
                          </span>
                          {t.blocked_reason && (
                            <div className="text-[11px] text-rose-400/80 mt-0.5 truncate max-w-[160px]">
                              {t.blocked_reason}
                            </div>
                          )}
                        </div>
                      ) : t.status === "done" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-[11px] font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Done</span>
                        </span>
                      ) : (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                            t.status === "in_progress"
                              ? "bg-amber-950/40 border border-amber-800/40 text-amber-300"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {t.status.replace("_", " ")}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openTaskDetail(t)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-[11px] cursor-pointer"
                      >
                        <span>Edit</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CREATE TASK */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-sm text-slate-100">Create New Task</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Task Title *
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Verify anchor bolt torque certificates"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Associated Project (optional)
                </label>
                <select
                  name="project_id"
                  defaultValue=""
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Assignee
                  </label>
                  <select
                    name="assignee_id"
                    defaultValue=""
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name} ({e.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    name="priority"
                    defaultValue="medium"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Due Date
                </label>
                <input
                  name="due_date"
                  type="date"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Description / Action Items
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Detailed specifications, safety precautions, or required deliverables..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RAISE ISSUE */}
      {isRaiseIssueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <h3 className="font-semibold text-sm text-slate-100">Raise Project Issue</h3>
              </div>
              <button
                onClick={() => setIsRaiseIssueModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRaiseIssue} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Project *
                </label>
                <select
                  name="project_id"
                  required
                  defaultValue={projects[0]?.id || ""}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code}: {p.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Note: Issues automatically route to the Project Manager assigned to this project.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Issue Summary *
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Crane breakdown halting rafter erection"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    name="priority"
                    defaultValue="high"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="critical">CRITICAL (Immediate site stop)</option>
                    <option value="high">HIGH (Schedule impact)</option>
                    <option value="medium">MEDIUM (Quality / minor delay)</option>
                    <option value="low">LOW</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Target Resolution Date
                  </label>
                  <input
                    name="due_date"
                    type="date"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Problem Details &amp; Immediate Site Impact
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Describe root cause, parts affected, and what action is required from PM/Director..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRaiseIssueModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Raise &amp; Route to PM</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT TASK + THREAD */}
      {activeTaskDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40 shrink-0">
              <div className="flex items-center gap-2">
                {activeTaskDetail.kind === "issue" ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                ) : (
                  <CheckSquare className="w-4 h-4 text-blue-400" />
                )}
                <h3 className="font-semibold text-sm text-slate-100 truncate max-w-md">
                  {activeTaskDetail.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveTaskDetail(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
              {formError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg text-xs">
                  {formError}
                </div>
              )}

              {/* Edit form */}
              <form key={activeTaskDetail.id} onSubmit={handleEditTask} className="space-y-4">
                <input type="hidden" name="id" value={activeTaskDetail.id} />
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Title *</label>
                  <input name="title" type="text" required defaultValue={activeTaskDetail.title} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Project</label>
                  <select name="project_id" defaultValue={activeTaskDetail.project?.id ?? ""} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500">
                    <option value="">General (No project)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code}: {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Assignee</label>
                    <select name="assignee_id" defaultValue={activeTaskDetail.assignee?.id ?? ""} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500">
                      <option value="">Unassigned</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name} ({e.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Priority</label>
                    <select name="priority" defaultValue={activeTaskDetail.priority} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500">
                      {TASK_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Due date</label>
                  <input name="due_date" type="date" defaultValue={activeTaskDetail.due_date ?? ""} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Description</label>
                  <textarea name="description" rows={3} defaultValue={activeTaskDetail.description ?? ""} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500" />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTaskDetail(null)}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs disabled:opacity-50"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save changes</span>
                  </button>
                </div>
              </form>

              {/* The assignee owns the status: read-only here */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 space-y-1.5 text-slate-300">
                <div>
                  <span className="text-slate-400">Status: </span>
                  <span className="font-medium capitalize">{activeTaskDetail.status.replace("_", " ")}</span>
                </div>
                {activeTaskDetail.blocked_reason && (
                  <div>
                    <span className="text-rose-400">Blocked: </span>
                    {activeTaskDetail.blocked_reason}
                  </div>
                )}
                {activeTaskDetail.resolution_note && (
                  <div>
                    <span className="text-emerald-400">Resolution: </span>
                    {activeTaskDetail.resolution_note}
                  </div>
                )}
              </div>

              {/* Comments Thread */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  <span>Discussion Thread &amp; Audit Comments</span>
                </div>

                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {(!activeTaskDetail.comments || activeTaskDetail.comments.length === 0) ? (
                    <div className="p-4 text-center text-slate-500 bg-slate-950/30 rounded-lg">
                      No comments yet. Post an update or coordination note below.
                    </div>
                  ) : (
                    activeTaskDetail.comments.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-amber-300">
                            {c.author?.full_name || "Employee"}
                          </span>
                          <span className="text-slate-500 font-mono text-[10px]">
                            {new Date(c.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                          </span>
                        </div>
                        <p className="text-slate-200 leading-relaxed">{c.body}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment Input */}
                <form onSubmit={handleAddComment} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Type an update or resolution note..."
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingComment || !commentText.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingComment ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
