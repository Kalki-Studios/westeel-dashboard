import { Suspense } from "react";
import { connection } from "next/server";
import { getSiteReportsList } from "@/lib/site-reports/queries";
import { getProjectsList } from "@/lib/projects/queries";
import { SiteReportsReviewClient } from "./site-reports-review-client";
import { Loader2 } from "lucide-react";

async function SiteReportsReviewContent() {
  await connection();
  const [reports, projects] = await Promise.all([
    getSiteReportsList(),
    getProjectsList(),
  ]);

  const cleanProjects = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
  }));

  return (
    <SiteReportsReviewClient
      initialReports={reports}
      projects={cleanProjects}
    />
  );
}

export default function AdminSiteReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading daily site reports and progress photos...</span>
        </div>
      }
    >
      <SiteReportsReviewContent />
    </Suspense>
  );
}
