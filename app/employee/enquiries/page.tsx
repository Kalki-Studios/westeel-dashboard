import { connection } from "next/server";
import { Suspense } from "react";
import {
  getEnquiries,
  getQuotations,
  getCustomers,
  getLeadSources,
  getLostReasons,
} from "@/lib/sales/queries";
import { EmployeeEnquiriesClient } from "./enquiries-client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Loader2 } from "lucide-react";


async function EmployeeEnquiriesContent() {
  await connection();
  const [enquiries, quotations, customers, leadSources, lostReasons] =
    await Promise.all([
      getEnquiries(),
      getQuotations(),
      getCustomers(),
      getLeadSources(),
      getLostReasons(),
    ]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: myRoles } = await supabase.from("user_roles").select("role").eq("user_id", user?.id ?? "");
  const roles = (myRoles ?? []).map((r) => r.role);
  const mode = roles.includes("sales_lead") ? "lead" : roles.includes("sales_field") ? "field" : "both";

  // Lead generators hand leads to field salespeople; sales RLS can't list other profiles, so use the service role.
  let fieldStaff: { id: string; full_name: string }[] = [];
  if (mode === "lead") {
    const admin = createAdminClient();
    const { data: fieldRoles } = await admin.from("user_roles").select("user_id").eq("role", "sales_field");
    const { data: people } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", (fieldRoles ?? []).map((r) => r.user_id))
      .eq("is_active", true);
    fieldStaff = people ?? [];
  }

  return (
    <EmployeeEnquiriesClient
      mode={mode}
      fieldStaff={fieldStaff}
      enquiries={enquiries}
      quotations={quotations}
      customers={customers}
      leadSources={leadSources}
      lostReasons={lostReasons}
    />
  );
}

export default function EmployeeEnquiriesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span>Loading your sales pipeline &amp; enquiries...</span>
        </div>
      }
    >
      <EmployeeEnquiriesContent />
    </Suspense>
  );
}
