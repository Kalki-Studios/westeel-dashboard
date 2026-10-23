import { connection } from "next/server";
import { Suspense } from "react";
import { getCashFlowWorkspaceData } from "@/lib/cashflow/queries";
import { CashflowClient } from "@/app/admin/cashflow/cashflow-client";
import { Loader2 } from "lucide-react";

async function EmployeeBankBalancesContent() {
  await connection();
  const data = await getCashFlowWorkspaceData();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <CashflowClient data={data} />
    </div>
  );
}

export default function EmployeeBankBalancesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading bank balances, accounts register, and cash projections...</span>
        </div>
      }
    >
      <EmployeeBankBalancesContent />
    </Suspense>
  );
}
