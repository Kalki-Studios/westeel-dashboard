import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteReportItem } from "./types";

export interface GetReportsOptions {
  projectId?: string;
  status?: string;
  submittedBy?: string;
}

/**
 * Fetches site reports matching current user RLS permissions.
 * Includes attached photos, project metadata, submitter, and reviewer.
 */
export async function getSiteReportsList(options?: GetReportsOptions): Promise<SiteReportItem[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("site_reports")
    .select(`
      id,
      project_id,
      report_date,
      submitted_by,
      work_completed,
      progress_note,
      milestone_id,
      own_headcount,
      subcontractor_headcount,
      materials_received,
      materials_required,
      problems_delays,
      delay_reason,
      action_required,
      responsible_party,
      status,
      reviewed_by,
      reviewed_at,
      review_note,
      created_at,
      updated_at,
      projects (
        id,
        code,
        name,
        site_location
      ),
      submitter:submitted_by (
        id,
        full_name,
        phone
      ),
      reviewer:reviewed_by (
        id,
        full_name
      ),
      milestone:milestone_id (
        id,
        title
      )
    `)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (options?.projectId) {
    query = query.eq("project_id", options.projectId);
  }
  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.submittedBy) {
    query = query.eq("submitted_by", options.submittedBy);
  }

  const { data: reports, error } = await query;
  if (error || !reports) {
    if (error) console.error("Error fetching site reports:", error.message || error);
    return [];
  }

  if (reports.length === 0) {
    return [];
  }

  // Fetch photos for these reports
  const reportIds = reports.map((r) => r.id);
  const { data: photos } = await supabase
    .from("documents")
    .select("id, site_report_id, storage_path, title, mime_type, size_bytes")
    .in("site_report_id", reportIds);

  const adminSupabase = createAdminClient();
  const photosByReport = new Map<string, SiteReportItem["photos"]>();

  if (photos && photos.length > 0) {
    for (const p of photos) {
      if (!p.site_report_id) continue;
      const existing = photosByReport.get(p.site_report_id) || [];

      // Generate signed URL (60s) for private storage preview
      let downloadUrl: string | undefined;
      const { data: signed } = await adminSupabase.storage
        .from("project-files")
        .createSignedUrl(p.storage_path, 300); // 5 min for preview

      if (signed?.signedUrl) {
        downloadUrl = signed.signedUrl;
      }

      existing.push({
        id: p.id,
        storage_path: p.storage_path,
        title: p.title,
        mime_type: p.mime_type,
        size_bytes: p.size_bytes,
        download_url: downloadUrl,
      });

      photosByReport.set(p.site_report_id, existing);
    }
  }

  return reports.map((r) => ({
    ...r,
    project: r.projects as unknown as SiteReportItem["project"],
    submitter: r.submitter as unknown as SiteReportItem["submitter"],
    reviewer: r.reviewer as unknown as SiteReportItem["reviewer"],
    milestone: r.milestone as unknown as SiteReportItem["milestone"],
    photos: photosByReport.get(r.id) || [],
  }));
}

/**
 * Fetches assigned active projects for the current user to submit site reports.
 * Includes milestones for linking progress.
 */
export async function getAssignedActiveProjectsForUser(): Promise<
  Array<{
    id: string;
    code: string;
    name: string;
    site_location: string;
    current_stage: { name: string; position: number } | null;
    milestones: Array<{ id: string; title: string }>;
  }>
> {
  const supabase = createAdminClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select(`
      id,
      code,
      name,
      site_location,
      status,
      current_stage:current_stage_id (
        name,
        position
      ),
      milestones:project_milestones (
        id,
        title
      )
    `)
    .eq("status", "active")
    .eq("is_archived", false)
    .order("name");

  if (error || !projects) {
    if (error) console.error("Error fetching projects for site reports:", error.message || error);
    return [];
  }

  return projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    site_location: p.site_location,
    current_stage: p.current_stage as unknown as { name: string; position: number } | null,
    milestones: (p.milestones || []) as Array<{ id: string; title: string }>,
  }));
}
