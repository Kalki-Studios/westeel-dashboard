import { connection } from "next/server";
import { Suspense } from "react";
import { getPayablesOverviewData, getExportBillsData } from "@/lib/costs/queries";
import { PayablesClient } from "@/app/admin/payables/payables-client";
import { Loader2 } from "lucide-react";

async function EmployeeBillsContent() {
  await connection();
  const [payablesData, exportData] = await Promise.all([
    getPayablesOverviewData(),
    getExportBillsData(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PayablesClient
        overviewData={payablesData}
        exportData={exportData}
        isDirector={false}
        isAccounts={true}
      />
    </div>
  );
}

export default function EmployeeBillsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading bills, payables, and payment settlements...</span>
        </div>
      }
    >
      <EmployeeBillsContent />
    </Suspense>
  );
}
