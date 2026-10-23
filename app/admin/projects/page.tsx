import { Suspense } from "react";
import { connection } from "next/server";
import { getProjectsList, getProjectStages } from "@/lib/projects/queries";
import { ProjectsClient } from "./projects-client";
import { Loader2 } from "lucide-react";

async function ProjectsContent() {
  await connection();
  const [projects, stages] = await Promise.all([
    getProjectsList(),
    getProjectStages(),
  ]);

  return <ProjectsClient initialProjects={projects} stages={stages} />;
}

export default function AdminProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading projects directory & stage pipelines...</span>
        </div>
      }
    >
      <ProjectsContent />
    </Suspense>
  );
}
