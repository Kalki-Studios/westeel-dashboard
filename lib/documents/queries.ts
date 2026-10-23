import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDrawingPendingApproval, getDrawingAgeDays } from "@/lib/rules/documents";
import { DocumentItem, DocCategory, DrawingReviewStatus } from "./types";

/**
 * Fetches documents matching current user RLS permissions.
 * Computes Rule R5 pending status and age for drawings.
 */
export async function getDocumentsList(options?: {
  projectId?: string;
  category?: DocCategory;
  reviewStatus?: DrawingReviewStatus;
}): Promise<DocumentItem[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("documents")
    .select(`
      id,
      project_id,
      category,
      title,
      storage_path,
      mime_type,
      size_bytes,
      version_no,
      review_status,
      reviewed_by,
      reviewed_at,
      review_note,
      supersedes_id,
      uploaded_by,
      is_archived,
      created_at,
      updated_at,
      projects (
        id,
        code,
        name
      ),
      uploader:uploaded_by (
        id,
        full_name,
        phone
      ),
      reviewer:reviewed_by (
        id,
        full_name,
        phone
      )
    `)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (options?.projectId) {
    query = query.eq("project_id", options.projectId);
  }
  if (options?.category) {
    query = query.eq("category", options.category);
  }
  if (options?.reviewStatus) {
    query = query.eq("review_status", options.reviewStatus);
  }

  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error("Error fetching documents:", error.message || error);
    return [];
  }

  const now = new Date();

  return data.map((d) => {
    const isPending = isDrawingPendingApproval({
      category: d.category,
      reviewStatus: d.review_status,
      createdAt: d.created_at,
    });
    const ageDays = getDrawingAgeDays(
      {
        category: d.category,
        reviewStatus: d.review_status,
        createdAt: d.created_at,
      },
      now
    );

    return {
      ...d,
      project: d.projects as unknown as DocumentItem["project"],
      uploader: d.uploader as unknown as DocumentItem["uploader"],
      reviewer: d.reviewer as unknown as DocumentItem["reviewer"],
      is_pending_review: isPending,
      drawing_age_days: ageDays,
    };
  });
}
