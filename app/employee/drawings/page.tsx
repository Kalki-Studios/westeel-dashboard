import { connection } from "next/server";
import { Suspense } from "react";
import { getDocumentsList } from "@/lib/documents/queries";
import { EmployeeDrawingsClient } from "./drawings-client";
import { Loader2 } from "lucide-react";

async function EmployeeDrawingsContent() {
  await connection();
  const drawings = await getDocumentsList({ category: "drawing" });

  return <EmployeeDrawingsClient initialDrawings={drawings} />;
}

export default function EmployeeDrawingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading project drawings &amp; revisions...</span>
        </div>
      }
    >
      <EmployeeDrawingsContent />
    </Suspense>
  );
}
