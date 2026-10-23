import { connection } from "next/server";
import { Suspense } from "react";
import { getAssignedActiveProjectsForUser } from "@/lib/site-reports/queries";
import { SiteReportForm } from "./site-report-form";
import { Loader2 } from "lucide-react";

async function SiteReportPageContent() {
  await connection();
  const projects = await getAssignedActiveProjectsForUser();

  return <SiteReportForm projects={projects} />;
}

export default function EmployeeSiteReportPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading projects and site report form...</span>
        </div>
      }
    >
      <SiteReportPageContent />
    </Suspense>
  );
}
