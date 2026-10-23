import { connection } from "next/server";
import { Suspense } from "react";
import {
  getEnquiries,
  getQuotations,
  getCustomers,
  getLeadSources,
  getLostReasons,
  getSalespeople,
  getSalesAlerts,
} from "@/lib/sales/queries";
import { SalesWorkspaceClient } from "./sales-client";
import { Loader2 } from "lucide-react";


async function SalesWorkspaceContent() {
  await connection();
  const [
    enquiries,
    quotations,
    customers,
    leadSources,
    lostReasons,
    salespeople,
    alerts,
  ] = await Promise.all([
    getEnquiries(),
    getQuotations(),
    getCustomers(),
    getLeadSources(),
    getLostReasons(),
    getSalespeople(),
    getSalesAlerts(),
  ]);

  return (
    <SalesWorkspaceClient
      initialEnquiries={enquiries}
      initialQuotations={quotations}
      initialCustomers={customers}
      leadSources={leadSources}
      lostReasons={lostReasons}
      salespeople={salespeople}
      salesAlerts={alerts}
    />
  );
}

export default function AdminSalesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3 text-sm">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span>Loading Sales Workspace...</span>
        </div>
      }
    >
      <SalesWorkspaceContent />
    </Suspense>
  );
}
