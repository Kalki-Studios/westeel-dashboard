import { Suspense } from "react";
import { connection } from "next/server";
import { getDocumentsList } from "@/lib/documents/queries";
import { getProjectsList } from "@/lib/projects/queries";
import { DocumentsClient } from "./documents-client";
import { Loader2 } from "lucide-react";

async function DocumentsContent() {
  await connection();
  const [documents, projects] = await Promise.all([
    getDocumentsList(),
    getProjectsList(),
  ]);

  const cleanProjects = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
  }));

  return (
    <DocumentsClient
      initialDocuments={documents}
      projects={cleanProjects}
    />
  );
}

export default function AdminDocumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading project documents, drawings, and approvals...</span>
        </div>
      }
    >
      <DocumentsContent />
    </Suspense>
  );
}
