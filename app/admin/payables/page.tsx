import { Suspense } from "react";
import { connection } from "next/server";
import { getPayablesOverviewData, getExportBillsData } from "@/lib/costs/queries";
import { PayablesClient } from "./payables-client";
import { Loader2 } from "lucide-react";

async function PayablesContent() {
  await connection();
  const [payablesData, exportData] = await Promise.all([
    getPayablesOverviewData(),
    getExportBillsData(),
  ]);

  return (
    <PayablesClient
      overviewData={payablesData}
      exportData={exportData}
      isDirector={true}
    />
  );
}

export default function AdminPayablesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading vendor payables and aging breakdown...</span>
        </div>
      }
    >
      <PayablesContent />
    </Suspense>
  );
}
