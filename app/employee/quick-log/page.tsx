import { connection } from "next/server";
import { Suspense } from "react";
import { getEnquiries } from "@/lib/sales/queries";
import { EmployeeQuickLogClient } from "./quick-log-client";
import { Loader2 } from "lucide-react";


async function QuickLogContent() {
  await connection();
  const enquiries = await getEnquiries();

  return <EmployeeQuickLogClient enquiries={enquiries} />;
}

export default function EmployeeQuickLogPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
          <span>Loading quick log form...</span>
        </div>
      }
    >
      <QuickLogContent />
    </Suspense>
  );
}
