import { Clock } from "lucide-react";

export default function AdminOverviewPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-100">
          Director Overview
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Operational visibility: Project Status, Cash Flow &amp; Costs, and Sales Tracker.
        </p>
      </div>

      {/* Honest Scaffold Banner */}
      <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50 flex items-start gap-3">
        <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="text-sm font-medium text-slate-200">
            System Scaffold Initialized (T1)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            The dashboard structure is established. Live data and calculations will activate serially as database migrations (T2), projects (T4–T8), financials (T10–T12), and sales metrics (T13–T14) are built.
          </p>
        </div>
      </div>

      {/* Planned Overview Structure Grid (Honest Empty States - No Fake Data) */}
      <div className="space-y-4">
        {/* Block 1: Status & Delays */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Block 1: Project Status &amp; Delays (Priority 1)
            </h2>
            <span className="text-[11px] font-mono text-slate-400">Awaiting T4–T8</span>
          </div>
          <div className="py-8 text-center text-xs text-slate-400">
            No projects registered yet. Projects and delay tracking activate in Task T4.
          </div>
        </div>

        {/* Block 2: Money & Cash */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Block 2: Cash Flow, Collections &amp; Costs (Priority 2)
            </h2>
            <span className="text-[11px] font-mono text-slate-400">Awaiting T10–T12</span>
          </div>
          <div className="py-8 text-center text-xs text-slate-400">
            Financial records unconfigured. Commercials, receivables, and payables activate in Task T10.
          </div>
        </div>

        {/* Block 3: Sales Tracker */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Block 3: Sales Tracker (Priority 3)
            </h2>
            <span className="text-[11px] font-mono text-slate-400">Awaiting T13–T14</span>
          </div>
          <div className="py-8 text-center text-xs text-slate-400">
            Sales pipeline unconfigured. Enquiries, follow-ups, and quotations activate in Task T13.
          </div>
        </div>
      </div>
    </div>
  );
}
