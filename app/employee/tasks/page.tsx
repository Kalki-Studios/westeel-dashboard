import { Suspense } from "react";
import { getTasksList } from "@/lib/tasks/queries";
import { EmployeeTasksClient } from "./employee-tasks-client";
import { Loader2 } from "lucide-react";

import { createEmployeePortalClient } from "@/lib/supabase/server-employee";
import { connection } from "next/server";

async function EmployeeTasksContent() {
  await connection();
  const supabase = await createEmployeePortalClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tasks = user ? await getTasksList({ assigneeId: user.id }) : [];
  return <EmployeeTasksClient tasks={tasks} />;
}

export default function EmployeeTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading your assigned tasks...</span>
        </div>
      }
    >
      <EmployeeTasksContent />
    </Suspense>
  );
}
