import { Suspense } from "react";
import { createEmployeePortalClient } from "@/lib/supabase/server-employee";
import { connection } from "next/server";
import { getPurchaseQueueData, getCostCategories } from "@/lib/costs/queries";
import { OrdersClient, QueueOrderItem } from "@/app/admin/orders/orders-client";
import { Loader2 } from "lucide-react";

async function EmployeeOrdersContent() {
  await connection();
  const supabase = await createEmployeePortalClient();

  const [orders, categories, projectsRes] = await Promise.all([
    getPurchaseQueueData(),
    getCostCategories(),
    supabase
      .from("projects")
      .select("id, code, name")
      .eq("is_archived", false)
      .order("code"),
  ]);

  const projects = projectsRes.data || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <OrdersClient
        orders={orders as unknown as QueueOrderItem[]}
        categories={categories}
        projects={projects}
        isDirector={false}
        isPurchase={true}
        baseHref="/employee"
      />
    </div>
  );
}

export default function EmployeeVendorOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading purchase queue & vendor orders...</span>
        </div>
      }
    >
      <EmployeeOrdersContent />
    </Suspense>
  );
}
