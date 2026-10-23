import { Suspense } from "react";
import { getTasksList } from "@/lib/tasks/queries";
import { getProjectsList } from "@/lib/projects/queries";
import { getSiteReportsList } from "@/lib/site-reports/queries";
import { getDocumentsList } from "@/lib/documents/queries";
import { getEnquiries } from "@/lib/sales/queries";
import { EmployeeMyWorkClient } from "./my-work-client";
import { Loader2 } from "lucide-react";

import { createEmployeePortalClient } from "@/lib/supabase/server-employee";
import { connection } from "next/server";

async function EmployeeWorkContent() {
  await connection();
  const supabase = await createEmployeePortalClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userRole: "site_engineer" | "sales" | "accounts" | "purchase_pm" | undefined;
  let salesMode: "lead" | "field" | "both" = "both";

  if (user) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const rList = (roles || []).map((r) => r.role);
    if (rList.includes("sales_lead")) salesMode = "lead";
    else if (rList.includes("sales_field")) salesMode = "field";
    if (rList.includes("sales")) userRole = "sales";
    else if (rList.includes("accounts")) userRole = "accounts";
    else if (rList.includes("project_manager") || rList.includes("purchase")) userRole = "purchase_pm";
    else if (rList.includes("site_engineer")) userRole = "site_engineer";
  }

  const [tasks, projects, reports, pendingDrawings, enquiries] = await Promise.all([
    user ? getTasksList({ assigneeId: user.id }) : Promise.resolve([]),
    getProjectsList(),
    getSiteReportsList(),
    getDocumentsList({ category: "drawing", reviewStatus: "pending" }),
    userRole === "sales" ? getEnquiries() : Promise.resolve([]),
  ]);

  return (
    <EmployeeMyWorkClient
      tasks={tasks}
      projects={projects}
      reports={reports}
      pendingDrawings={pendingDrawings}
      userRole={userRole}
      salesMode={salesMode}
      enquiries={enquiries}
    />
  );
}

export default function EmployeeWorkPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading workspace...</span>
        </div>
      }
    >
      <EmployeeWorkContent />
    </Suspense>
  );
}

