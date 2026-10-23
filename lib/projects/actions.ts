"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CreateProjectSchema,
  UpdateProjectStageSchema,
  CreateMilestoneSchema,
  UpdateMilestoneSchema,
  AssignMemberSchema,
  RemoveMemberSchema,
} from "./types";

/**
 * Creates a new project manually.
 * Automatically generates code (WB-YYYY-NNN) and attaches initial stage if unspecified.
 */
export async function createProjectAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  const rawData = {
    name: formData.get("name"),
    site_location: formData.get("site_location"),
    site_contact_name: formData.get("site_contact_name") || null,
    site_contact_phone: formData.get("site_contact_phone") || null,
    current_stage_id: formData.get("current_stage_id") || null,
    start_date: formData.get("start_date"),
    planned_completion_date: formData.get("planned_completion_date"),
    notes: formData.get("notes") || null,
  };

  const parsed = CreateProjectSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  // 1. Generate unique project code via RPC
  const { data: projectCode, error: codeErr } = await supabase.rpc("generate_project_code");
  if (codeErr || !projectCode) {
    return { error: codeErr?.message || "Failed to generate project code" };
  }

  // 2. Resolve default stage if not selected
  let stageId = parsed.data.current_stage_id;
  if (!stageId) {
    const { data: firstStage } = await supabase
      .from("project_stages")
      .select("id")
      .eq("position", 1)
      .single();
    stageId = firstStage?.id || null;
  }

  // 3. Insert project
  const { data: newProject, error: insertErr } = await supabase
    .from("projects")
    .insert({
      code: projectCode,
      name: parsed.data.name,
      site_location: parsed.data.site_location,
      site_contact_name: parsed.data.site_contact_name,
      site_contact_phone: parsed.data.site_contact_phone,
      current_stage_id: stageId,
      start_date: parsed.data.start_date,
      planned_completion_date: parsed.data.planned_completion_date,
      notes: parsed.data.notes,
      status: "active",
      created_by: user.id,
    })
    .select("id, code")
    .single();

  if (insertErr || !newProject) {
    return { error: insertErr?.message || "Failed to create project" };
  }

  revalidatePath("/admin/projects");
  return { success: true, projectId: newProject.id, projectCode: newProject.code };
}

/**
 * Updates the current stage of a project.
 */
export async function updateProjectStageAction(projectId: string, stageId: string) {
  const parsed = UpdateProjectStageSchema.safeParse({ project_id: projectId, stage_id: stageId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid inputs" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ current_stage_id: parsed.data.stage_id })
    .eq("id", parsed.data.project_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${projectId}`);
  return { success: true };
}

/**
 * Adds a single custom milestone to a project.
 */
export async function createMilestoneAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const rawData = {
    project_id: formData.get("project_id"),
    stage_id: formData.get("stage_id") || null,
    title: formData.get("title"),
    planned_date: formData.get("planned_date") || null,
    position: formData.get("position") ? Number(formData.get("position")) : 0,
  };

  const parsed = CreateMilestoneSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { error } = await supabase.from("project_milestones").insert({
    project_id: parsed.data.project_id,
    stage_id: parsed.data.stage_id,
    title: parsed.data.title,
    planned_date: parsed.data.planned_date || null,
    status: "pending",
    position: parsed.data.position,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/admin/projects/${parsed.data.project_id}`);
  return { success: true };
}

/**
 * Updates an existing milestone (status, planned date, actual date, delay reason, delay note).
 */
export async function updateMilestoneAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const rawData = {
    milestone_id: formData.get("milestone_id"),
    project_id: formData.get("project_id"),
    title: formData.get("title"),
    planned_date: formData.get("planned_date") || null,
    actual_date: formData.get("actual_date") || null,
    status: formData.get("status"),
    delay_reason: formData.get("delay_reason") || null,
    delay_note: formData.get("delay_note") || null,
  };

  const parsed = UpdateMilestoneSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { error } = await supabase
    .from("project_milestones")
    .update({
      title: parsed.data.title,
      planned_date: parsed.data.planned_date || null,
      actual_date: parsed.data.actual_date || null,
      status: parsed.data.status,
      delay_reason: parsed.data.delay_reason || null,
      delay_note: parsed.data.delay_note || null,
    })
    .eq("id", parsed.data.milestone_id)
    .eq("project_id", parsed.data.project_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/admin/projects/${parsed.data.project_id}`);
  revalidatePath("/admin/projects");
  return { success: true };
}

/**
 * Adds default milestones matching the 9 fixed project stages.
 * Per specification: "one per stage, planned date empty, shown as 'date missing'".
 */
export async function addDefaultMilestonesAction(projectId: string) {
  if (!projectId) return { error: "Project ID is required" };

  const supabase = await createClient();

  // 1. Fetch 9 fixed stages ordered by position
  const { data: stages, error: stagesErr } = await supabase
    .from("project_stages")
    .select("id, position, name")
    .order("position", { ascending: true });

  if (stagesErr || !stages || stages.length === 0) {
    return { error: stagesErr?.message || "Failed to load project stages" };
  }

  // 2. Prepare default milestones (one per stage, planned date empty)
  const rows = stages.map((s) => ({
    project_id: projectId,
    stage_id: s.id,
    title: s.name,
    planned_date: null,
    actual_date: null,
    status: "pending" as const,
    position: s.position,
  }));

  const { error: insertErr } = await supabase.from("project_milestones").insert(rows);

  if (insertErr) {
    return { error: insertErr.message };
  }

  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/projects");
  return { success: true, count: rows.length };
}

/**
 * Assigns an employee to a project with a specific role.
 */
export async function assignProjectMemberAction(prevState: unknown, formData: FormData) {
  const rawData = {
    project_id: formData.get("project_id"),
    user_id: formData.get("user_id"),
    member_role: formData.get("member_role"),
  };

  const parsed = AssignMemberSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("project_members").upsert(
    {
      project_id: parsed.data.project_id,
      user_id: parsed.data.user_id,
      member_role: parsed.data.member_role,
    },
    { onConflict: "project_id, user_id" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/admin/projects/${parsed.data.project_id}`);
  return { success: true };
}

/**
 * Removes an employee assignment from a project.
 */
export async function removeProjectMemberAction(projectId: string, userId: string) {
  const parsed = RemoveMemberSchema.safeParse({ project_id: projectId, user_id: userId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", parsed.data.project_id)
    .eq("user_id", parsed.data.user_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/admin/projects/${projectId}`);
  return { success: true };
}
