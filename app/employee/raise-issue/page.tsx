import { connection } from "next/server";
import { Suspense } from "react";
import { getMyProjectsForIssues } from "@/lib/tasks/queries";
import { RaiseIssueClient } from "./raise-issue-client";
import { Loader2 } from "lucide-react";

async function RaiseIssueContent() {
  await connection();
  const projects = await getMyProjectsForIssues();
  return <RaiseIssueClient projects={projects} />;
}

export default function EmployeeRaiseIssuePage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading project list...</span>
        </div>
      }
    >
      <RaiseIssueContent />
    </Suspense>
  );
}
