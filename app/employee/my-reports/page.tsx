import { connection } from "next/server";
import { Suspense } from "react";
import { getSiteReportsList } from "@/lib/site-reports/queries";
import { MyReportsClient } from "./my-reports-client";
import { Loader2 } from "lucide-react";

async function MyReportsPageContent() {
  await connection();
  const reports = await getSiteReportsList();

  return <MyReportsClient initialReports={reports} />;
}

export default function EmployeeMyReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading submitted daily site reports...</span>
        </div>
      }
    >
      <MyReportsPageContent />
    </Suspense>
  );
}
