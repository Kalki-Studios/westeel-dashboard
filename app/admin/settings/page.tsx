import { connection } from "next/server";
import { Suspense } from "react";
import { getCostCategories } from "@/lib/costs/queries";
import { getLeadSources, getLostReasons } from "@/lib/sales/queries";
import { SettingsClient } from "./settings-client";
import { createAdminPortalClient } from "@/lib/supabase/server-admin";
import { Loader2 } from "lucide-react";


async function SettingsContent() {
  await connection();
  const supabase = await createAdminPortalClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user?.id ?? "").maybeSingle();

  const [categories, leadSources, lostReasons] = await Promise.all([
    getCostCategories(),
    getLeadSources(true),
    getLostReasons(true),
  ]);

  return (
    <SettingsClient
      categories={categories}
      leadSources={leadSources}
      lostReasons={lostReasons}
      isDirector={true}
      account={{ fullName: profile?.full_name ?? "", email: user?.email ?? "" }}
    />
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span>Loading system settings, categories &amp; lead sources...</span>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
