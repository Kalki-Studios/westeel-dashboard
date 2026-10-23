"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertItem } from "@/lib/rules/alerts";
import {
  AlertCircle,
  Clock,
  Search,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

interface AlertsClientProps {
  initialAlerts: AlertItem[];
  projects: Array<{ id: string; code: string; name: string }>;
}

export function AlertsClient({ initialAlerts, projects }: AlertsClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const filteredAlerts = initialAlerts.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.project_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.assigned_person?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity = severityFilter === "all" ? true : a.severity === severityFilter;
    const matchesType = typeFilter === "all" ? true : a.type === typeFilter;
    const matchesProject = projectFilter === "all" ? true : a.project_id === projectFilter;

    return matchesSearch && matchesSeverity && matchesType && matchesProject;
  });

  const criticalCount = initialAlerts.filter((a) => a.severity === "critical").length;
  const highCount = initialAlerts.filter((a) => a.severity === "high").length;
  const warningCount = initialAlerts.filter((a) => a.severity === "warning").length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Operational Alerts
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
              {initialAlerts.length} total
            </span>
          </div>
        </div>
      </div>

      {/* Severity Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-rose-800/80 bg-rose-950/20">
          <div className="text-[11px] font-medium text-rose-300 uppercase tracking-wider flex items-center justify-between">
            <span>Critical Alerts</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono mt-1">
            {criticalCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Halted work / Blockers</div>
        </div>

        <div className="p-3.5 rounded-xl border border-amber-800/80 bg-amber-950/20">
          <div className="text-[11px] font-medium text-amber-300 uppercase tracking-wider flex items-center justify-between">
            <span>High Severity</span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono mt-1">
            {highCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Delays &amp; missing reports</div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Warnings</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-200 font-mono mt-1">
            {warningCount}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Pending reviews &amp; approvals</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search alert title, project, or assignee..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical Only</option>
            <option value="high">High Severity</option>
            <option value="warning">Warnings</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">All Alert Types</option>
            <option value="blocked_task">Blocked Tasks / Issues</option>
            <option value="overdue_task">Overdue Tasks</option>
            <option value="delayed_project">Delayed Projects</option>
            <option value="missing_site_report">Missing Site Reports</option>
            <option value="pending_drawing">Pending Drawings</option>
          </select>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            <p className="font-semibold text-slate-200">No alerts matching your criteria.</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Change your filters or search terms to inspect other alert categories.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isCritical = alert.severity === "critical";
            const isHigh = alert.severity === "high";

            return (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                  isCritical
                    ? "bg-rose-950/30 border-rose-800 text-rose-200"
                    : isHigh
                    ? "bg-amber-950/20 border-amber-800/80 text-amber-200"
                    : "bg-slate-900/60 border-slate-800 text-slate-300"
                }`}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                        isCritical
                          ? "bg-rose-500 text-slate-950"
                          : isHigh
                          ? "bg-amber-500 text-slate-950"
                          : "bg-slate-700 text-slate-200"
                      }`}
                    >
                      {alert.severity}
                    </span>

                    {alert.project_code && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-bold border border-slate-700">
                        {alert.project_code}
                      </span>
                    )}

                    <span className="font-semibold text-sm text-slate-100">
                      {alert.title}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">{alert.description}</p>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-0.5">
                    <span>Age: {alert.age_days} days</span>
                    {alert.assigned_person && (
                      <span>Assigned to: {alert.assigned_person}</span>
                    )}
                    {alert.project_name && (
                      <span>Project: {alert.project_name}</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  <Link
                    href={alert.source_url}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                  >
                    <span>View Record</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
