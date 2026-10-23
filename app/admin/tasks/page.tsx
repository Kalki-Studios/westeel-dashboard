import { Suspense } from "react";
import { connection } from "next/server";
import { getTasksList } from "@/lib/tasks/queries";
import { getProjectsList, getActiveEmployees } from "@/lib/projects/queries";
import { TasksClient } from "./tasks-client";
import { Loader2 } from "lucide-react";

async function TasksContent() {
  await connection();
  const [tasks, projects, employees] = await Promise.all([
    getTasksList(),
    getProjectsList(),
    getActiveEmployees(),
  ]);

  const cleanProjects = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
  }));

  const cleanEmployees = employees.map((e) => ({
    id: e.id,
    full_name: e.full_name,
    email: e.email,
  }));

  return (
    <TasksClient
      initialTasks={tasks}
      projects={cleanProjects}
      employees={cleanEmployees}
    />
  );
}

export default function AdminTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading tasks, blockers, and project issues...</span>
        </div>
      }
    >
      <TasksContent />
    </Suspense>
  );
}
