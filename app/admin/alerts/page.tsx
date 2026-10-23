import { Suspense } from "react";
import { connection } from "next/server";
import { getOverviewBlock1Data } from "@/lib/overview/queries";
import { getProjectsList } from "@/lib/projects/queries";
import { AlertsClient } from "./alerts-client";
import { Loader2 } from "lucide-react";

async function AlertsPageContent() {
  await connection();
  const [data, projects] = await Promise.all([
    getOverviewBlock1Data(),
    getProjectsList(),
  ]);

  const cleanProjects = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
  }));

  return (
    <AlertsClient
      initialAlerts={data.alerts}
      projects={cleanProjects}
    />
  );
}

export default function AdminAlertsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Computing live operational alerts and blockers...</span>
        </div>
      }
    >
      <AlertsPageContent />
    </Suspense>
  );
}
