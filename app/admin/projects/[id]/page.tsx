import { connection } from "next/server";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProjectDetail, getProjectStages, getActiveEmployees } from "@/lib/projects/queries";
import { getDocumentsList } from "@/lib/documents/queries";
import { getProjectBillingData } from "@/lib/billing/queries";
import { getProjectCostData } from "@/lib/costs/queries";
import { ProjectDetailClient } from "./project-detail-client";
import { Loader2 } from "lucide-react";

interface ProjectDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

async function ProjectDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  const [project, stages, employees, documents, billingData, costData] = await Promise.all([
    getProjectDetail(id),
    getProjectStages(),
    getActiveEmployees(),
    getDocumentsList({ projectId: id }),
    getProjectBillingData(id),
    getProjectCostData(id),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <ProjectDetailClient
      project={project}
      stages={stages}
      activeEmployees={employees}
      initialDocuments={documents}
      initialBillingData={billingData}
      initialCostData={costData}
    />
  );
}

export default function AdminProjectDetailPage({ params }: ProjectDetailPageProps) {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading project details & milestones...</span>
        </div>
      }
    >
      <ProjectDetailContent params={params} />
    </Suspense>
  );
}
