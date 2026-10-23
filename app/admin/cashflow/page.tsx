import { Suspense } from "react";
import { connection } from "next/server";
import { getCashFlowWorkspaceData } from "@/lib/cashflow/queries";
import { CashflowClient } from "./cashflow-client";
import { Loader2 } from "lucide-react";

async function CashFlowContent() {
  await connection();
  const data = await getCashFlowWorkspaceData();

  return <CashflowClient data={data} />;
}

export default function AdminCashFlowPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading cash flow projection, bank balances, and cash movements...</span>
        </div>
      }
    >
      <CashFlowContent />
    </Suspense>
  );
}
