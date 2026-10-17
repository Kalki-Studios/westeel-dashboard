import { Briefcase, Clock } from "lucide-react";

export default function EmployeeWorkPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-100">
          My Work
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Assigned tasks, active project commitments, and role-specific action items.
        </p>
      </div>

      {/* Honest Empty State */}
      <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50 flex items-start gap-3">
        <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="text-sm font-medium text-slate-200">
            Employee Shell Initialized (T1)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            The employee navigation and layout structure is configured. Active user assignments, tasks, and site reporting will activate during Tasks T3–T8.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center space-y-2">
        <Briefcase className="w-8 h-8 text-slate-400 mx-auto" />
        <div className="text-sm font-medium text-slate-300">No active assignments yet</div>
        <div className="text-xs text-slate-400 max-w-sm mx-auto">
          You are not currently assigned to any projects or pending tasks. Once tasks or site projects are assigned, they will appear here.
        </div>
      </div>
    </div>
  );
}
