import { Suspense } from "react";
import { connection } from "next/server";
import { getOverviewBlock1Data } from "@/lib/overview/queries";
import { OverviewClient } from "./overview-client";
import { Loader2 } from "lucide-react";

async function OverviewPageContent() {
  await connection();
  const data = await getOverviewBlock1Data();

  return <OverviewClient data={data} />;
}

export default function AdminOverviewPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Computing live operational status and delay alerts...</span>
        </div>
      }
    >
      <OverviewPageContent />
    </Suspense>
  );
}
