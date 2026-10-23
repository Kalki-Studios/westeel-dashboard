"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TaskItem, TaskStatus } from "@/lib/tasks/types";
import { updateTaskStatusAction, addTaskCommentAction } from "@/lib/tasks/actions";
import {
  CheckSquare,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  MessageSquare,
  Send,
  Loader2,
  ArrowRight,
  X,
} from "lucide-react";

interface EmployeeTasksClientProps {
  tasks: TaskItem[];
}

export function EmployeeTasksClient({ tasks }: EmployeeTasksClientProps) {
  const router = useRouter();
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>("open");
  const [blockedReason, setBlockedReason] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openTask(t: TaskItem) {
    setActiveTask(t);
    setSelectedStatus(t.status);
    setBlockedReason(t.blocked_reason || "");
    setResolutionNote(t.resolution_note || "");
    setError(null);
  }

  async function handleStatusChange() {
    if (!activeTask) return;
    setIsSubmitting(true);
    setError(null);

    const res = await updateTaskStatusAction(
      activeTask.id,
      selectedStatus,
      blockedReason,
      resolutionNote
    );

    if (res.error) {
      setError(res.error);
    } else {
      setActiveTask({
        ...activeTask,
        status: selectedStatus,
        blocked_reason: selectedStatus === "blocked" ? blockedReason : null,
        resolution_note: selectedStatus === "done" ? resolutionNote : null,
      });
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTask || !commentText.trim()) return;

    setIsSubmittingComment(true);
    const formData = new FormData();
    formData.append("task_id", activeTask.id);
    formData.append("body", commentText);

    const res = await addTaskCommentAction(null, formData);
    if (!res.error) {
      setCommentText("");
      router.refresh();
    }
    setIsSubmittingComment(false);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            My Tasks &amp; Action Items
          </h1>
        </div>

        <Link
          href="/employee/raise-issue"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition shadow-sm"
        >
          <AlertTriangle className="w-4 h-4 text-white" />
          <span className="text-white">Raise an Issue</span>
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
          <CheckSquare className="w-8 h-8 text-slate-600 mx-auto" />
          <div className="text-sm font-medium text-slate-300">No active tasks assigned</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You do not currently have any pending tasks or open action items assigned to your profile.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <div
              key={t.id}
              className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  {t.kind === "issue" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/50 border border-rose-800/60 text-rose-300 text-[10px] font-semibold uppercase">
                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                      <span>Issue</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/40 border border-blue-800/50 text-blue-300 text-[10px] font-semibold uppercase">
                      <CheckSquare className="w-3 h-3 text-blue-400" />
                      <span>Task</span>
                    </span>
                  )}
                  <span className="font-semibold text-sm text-slate-100">{t.title}</span>
                </div>

                <div className="flex items-center gap-2">
                  {t.status === "blocked" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/80 text-rose-300 text-[11px] font-semibold">
                      <AlertCircle className="w-3 h-3 text-rose-400" />
                      <span>Blocked</span>
                    </span>
                  ) : t.status === "done" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-[11px] font-medium">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Done</span>
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-medium capitalize">
                      {t.status.replace("_", " ")}
                    </span>
                  )}
                </div>
              </div>

              {t.project && (
                <div className="flex items-center gap-1.5 text-xs text-amber-400 font-mono">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>
                    {t.project.code}: {t.project.name}
                  </span>
                </div>
              )}

              {t.description && (
                <p className="text-xs text-slate-300 leading-relaxed">{t.description}</p>
              )}

              {t.blocked_reason && (
                <div className="p-2.5 rounded bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 space-y-0.5">
                  <div className="font-semibold text-[10px] uppercase tracking-wider text-rose-400">
                    Blocker Note
                  </div>
                  <div>{t.blocked_reason}</div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  {t.due_date && (
                    <div className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span className={t.is_overdue ? "text-rose-400 font-semibold" : ""}>
                        Due: {t.due_date} {t.is_overdue && "(Overdue)"}
                      </span>
                    </div>
                  )}
                  <span className="uppercase text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {t.priority}
                  </span>
                </div>

                <button
                  onClick={() => openTask(t)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition cursor-pointer"
                >
                  <span>Update &amp; Discuss</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: UPDATE STATUS & COMMENTS */}
      {activeTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40 shrink-0">
              <h3 className="font-semibold text-sm text-slate-100 truncate max-w-md">
                {activeTask.title}
              </h3>
              <button
                onClick={() => setActiveTask(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {error && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg text-xs">
                  {error}
                </div>
              )}

              {/* Status Selector */}
              <div className="space-y-3 bg-slate-950/60 p-4 rounded-lg border border-slate-800">
                <div className="font-semibold text-slate-200 flex items-center justify-between">
                  <span>My Task Status</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Blocked tasks trigger immediate alerts
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["open", "in_progress", "blocked", "done"] as TaskStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSelectedStatus(st)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border transition capitalize cursor-pointer ${
                        selectedStatus === st
                          ? st === "blocked"
                            ? "bg-rose-950/80 border-rose-600 text-rose-300 ring-1 ring-rose-500"
                            : st === "done"
                            ? "bg-emerald-950/80 border-emerald-600 text-emerald-300 ring-1 ring-emerald-500"
                            : "bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))}
                </div>

                {selectedStatus === "blocked" && (
                  <div className="pt-2 space-y-1">
                    <label className="block text-[11px] font-semibold text-rose-400">
                      Why is this task blocked? * (Required)
                    </label>
                    <textarea
                      value={blockedReason}
                      onChange={(e) => setBlockedReason(e.target.value)}
                      rows={2}
                      placeholder="e.g. Waiting for drawings from client, delivery delayed..."
                      className="w-full px-3 py-2 bg-slate-950 border border-rose-900/60 rounded-lg text-xs text-rose-200 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                )}

                {selectedStatus === "done" && (
                  <div className="pt-2 space-y-1">
                    <label className="block text-[11px] font-semibold text-emerald-400">
                      Resolution Note (optional)
                    </label>
                    <textarea
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      rows={2}
                      placeholder="e.g. Completed and verified on site..."
                      className="w-full px-3 py-2 bg-slate-950 border border-emerald-900/60 rounded-lg text-xs text-emerald-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleStatusChange}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Update Status</span>
                  </button>
                </div>
              </div>

              {/* Discussion Thread */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  <span>Discussion Thread</span>
                </div>

                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {(!activeTask.comments || activeTask.comments.length === 0) ? (
                    <div className="p-4 text-center text-slate-500 bg-slate-950/30 rounded-lg">
                      No comments yet on this task.
                    </div>
                  ) : (
                    activeTask.comments.map((c) => (
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

                <form onSubmit={handleAddComment} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Type an update or reply..."
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
