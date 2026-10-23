"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateSiteReportSchema, ReviewSiteReportSchema } from "./types";

const MAX_PHOTO_SIZE = 15 * 1024 * 1024; // 15MB before or after compression

export async function submitSiteReportAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  const rawData = {
    project_id: formData.get("project_id"),
    report_date: formData.get("report_date"),
    work_completed: formData.get("work_completed"),
    progress_note: formData.get("progress_note") || null,
    milestone_id: formData.get("milestone_id") || null,
    own_headcount: formData.get("own_headcount"),
    subcontractor_headcount: formData.get("subcontractor_headcount"),
    materials_received: formData.get("materials_received") || null,
    materials_required: formData.get("materials_required") || null,
    problems_delays: formData.get("problems_delays") || null,
    delay_reason: formData.get("delay_reason") || null,
    action_required: formData.get("action_required") || null,
    responsible_party: formData.get("responsible_party") || null,
  };

  const parsed = CreateSiteReportSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  // 1. Get project code for clean storage organization
  const { data: project } = await supabase
    .from("projects")
    .select("code")
    .eq("id", parsed.data.project_id)
    .single();

  const projectCode = project?.code || "general";

  // 2. Check if a report exists for this project and date
  const { data: existingReport } = await supabase
    .from("site_reports")
    .select("id, status, submitted_by")
    .eq("project_id", parsed.data.project_id)
    .eq("report_date", parsed.data.report_date)
    .maybeSingle();

  let reportId: string;

  if (existingReport) {
    // If report already exists and is reviewed, it cannot be modified per Rule R6
    if (existingReport.status === "reviewed") {
      return { error: "This daily site report has already been reviewed and locked (Rule R6)." };
    }

    // Update existing report and reset status to 'submitted' per Rule R6
    const { data: updatedReport, error: updateError } = await supabase
      .from("site_reports")
      .update({
        work_completed: parsed.data.work_completed,
        progress_note: parsed.data.progress_note || null,
        milestone_id: parsed.data.milestone_id || null,
        own_headcount: parsed.data.own_headcount,
        subcontractor_headcount: parsed.data.subcontractor_headcount,
        materials_received: parsed.data.materials_received || null,
        materials_required: parsed.data.materials_required || null,
        problems_delays: parsed.data.problems_delays || null,
        delay_reason: parsed.data.delay_reason || null,
        action_required: parsed.data.action_required || null,
        responsible_party: parsed.data.responsible_party || null,
        status: "submitted", // Reset status back to submitted
        reviewed_by: null,
        reviewed_at: null,
      })
      .eq("id", existingReport.id)
      .select("id")
      .single();

    if (updateError || !updatedReport) {
      return { error: updateError?.message || "Failed to update daily site report" };
    }

    reportId = updatedReport.id;
  } else {
    // Insert new report
    const { data: newReport, error: insertError } = await supabase
      .from("site_reports")
      .insert({
        project_id: parsed.data.project_id,
        report_date: parsed.data.report_date,
        submitted_by: user.id,
        work_completed: parsed.data.work_completed,
        progress_note: parsed.data.progress_note || null,
        milestone_id: parsed.data.milestone_id || null,
        own_headcount: parsed.data.own_headcount,
        subcontractor_headcount: parsed.data.subcontractor_headcount,
        materials_received: parsed.data.materials_received || null,
        materials_required: parsed.data.materials_required || null,
        problems_delays: parsed.data.problems_delays || null,
        delay_reason: parsed.data.delay_reason || null,
        action_required: parsed.data.action_required || null,
        responsible_party: parsed.data.responsible_party || null,
        status: "submitted",
      })
      .select("id")
      .single();

    if (insertError || !newReport) {
      return { error: insertError?.message || "Failed to submit daily site report" };
    }

    reportId = newReport.id;
  }

  // 3. Process Photo Uploads
  const photoFiles = formData.getAll("photos") as File[];
  const adminSupabase = createAdminClient();

  for (const file of photoFiles) {
    if (!file || file.size === 0) continue;
    if (file.size > MAX_PHOTO_SIZE) {
      return { error: `Photo ${file.name} exceeds maximum allowed size (15 MB)` };
    }

    const fileBytes = await file.arrayBuffer();
    const buffer = Buffer.from(fileBytes);
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `projects/${projectCode}/reports/${parsed.data.report_date}_${Date.now()}_${cleanFileName}`;

    const { error: uploadError } = await adminSupabase.storage
      .from("project-files")
      .upload(storagePath, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (!uploadError) {
      // Record photo document
      await supabase.from("documents").insert({
        project_id: parsed.data.project_id,
        site_report_id: reportId,
        category: "site_photo",
        title: `Site Photo: ${parsed.data.report_date} - ${file.name}`,
        storage_path: storagePath,
        mime_type: file.type || "image/jpeg",
        size_bytes: file.size,
        uploaded_by: user.id,
      });
    }
  }

  revalidatePath("/employee/my-reports");
  revalidatePath("/employee/site-report");
  revalidatePath("/admin/site-reports");
  revalidatePath(`/admin/projects/${parsed.data.project_id}`);

  return { success: true, reportId };
}

/**
 * Reviews a daily site report (Director or assigned Project Manager).
 * Sets status to 'reviewed' (locks it) or 'correction_required' with mandatory note.
 */
export async function reviewSiteReportAction(
  reportId: string,
  decision: "reviewed" | "correction_required",
  reviewNote?: string | null
) {
  const parsed = ReviewSiteReportSchema.safeParse({
    report_id: reportId,
    decision,
    review_note: reviewNote,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  const { error } = await supabase
    .from("site_reports")
    .update({
      status: parsed.data.decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: parsed.data.review_note || null,
    })
    .eq("id", parsed.data.report_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/site-reports");
  revalidatePath("/employee/my-reports");
  revalidatePath("/employee/review-reports");

  return { success: true };
}
