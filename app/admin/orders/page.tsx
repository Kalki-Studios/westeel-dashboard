import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPurchaseQueueData, getCostCategories } from "@/lib/costs/queries";
import { OrdersClient, QueueOrderItem } from "./orders-client";
import { Loader2 } from "lucide-react";

async function OrdersContent() {
  await connection();
  const supabase = await createClient();

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
    <OrdersClient
      orders={orders as unknown as QueueOrderItem[]}
      categories={categories}
      projects={projects}
      isDirector={true}
      isPurchase={true}
      baseHref="/x9admin"
    />
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading vendor orders and purchase queue...</span>
        </div>
      }
    >
      <OrdersContent />
    </Suspense>
  );
}
