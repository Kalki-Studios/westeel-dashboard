"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { raiseIssueAction } from "@/lib/tasks/actions";
import { AlertTriangle, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

interface RaiseIssueClientProps {
  projects: Array<{ id: string; code: string; name: string }>;
}

export function RaiseIssueClient({ projects }: RaiseIssueClientProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const res = await raiseIssueAction(null, formData);

    if (res.error) {
      setError(res.error);
      setIsSubmitting(false);
    } else {
      setSuccess(true);
      setIsSubmitting(false);
      setTimeout(() => {
        router.push("/employee/tasks");
        router.refresh();
      }, 1500);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/employee/tasks"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Tasks</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Raise Project Issue
            </h1>
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/40 text-center space-y-2">
          <div className="text-sm font-medium text-slate-300">
            No Assigned Projects Found
          </div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You are not currently assigned to any active projects. Issues can only be raised on projects where you are an active member.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4 shadow-xl text-xs"
        >
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg text-xs">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Issue raised successfully! Routing to Project Manager...</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Select Project *
            </label>
            <select
              name="project_id"
              required
              defaultValue={projects[0]?.id || ""}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}: {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Issue Summary *
            </label>
            <input
              name="title"
              type="text"
              required
              placeholder="e.g. Column anchor bolts alignment mismatch on Grid Line 4"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Severity / Priority
              </label>
              <select
                name="priority"
                defaultValue="high"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="critical">CRITICAL (Work Stoppage)</option>
                <option value="high">HIGH (Schedule Risk)</option>
                <option value="medium">MEDIUM (Quality / Defect)</option>
                <option value="low">LOW</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Target Resolution Date
              </label>
              <input
                name="due_date"
                type="date"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Issue Details &amp; Root Cause
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Describe the exact location on site, cause of defect, drawings referenced, and immediate mitigation needed..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Link
              href="/employee/tasks"
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || success}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Submit &amp; Route to Project Manager</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
