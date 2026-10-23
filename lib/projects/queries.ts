import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isProjectDelayed, formatMilestoneProgress, ProjectMilestoneItem } from "@/lib/rules/projects";
import { ProjectDetail, ProjectStage, ProjectStatus } from "./types";

export interface ProjectListItem {
  id: string;
  code: string;
  name: string;
  site_location: string;
  start_date: string;
  planned_completion_date: string;
  status: ProjectStatus;
  current_stage: {
    id: string;
    position: number;
    name: string;
  } | null;
  milestones_count: number;
  milestones_done: number;
  progress_text: string;
  is_delayed: boolean;
  delay_reason?: "project_overdue" | "milestone_overdue";
}

/**
 * Fetches the project list for the current user session (enforces RLS).
 * Computes Rule R1 (isProjectDelayed) and Rule R2 (formatMilestoneProgress) on read.
 */
export async function getProjectsList(): Promise<ProjectListItem[]> {
  const supabase = createAdminClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select(`
      id,
      code,
      name,
      site_location,
      start_date,
      planned_completion_date,
      status,
      current_stage_id,
      stages:current_stage_id (
        id,
        position,
        name
      ),
      milestones:project_milestones (
        id,
        title,
        planned_date,
        actual_date,
        status,
        delay_reason,
        delay_note
      )
    `)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error || !projects) {
    if (error) {
      console.error("Error fetching projects list:", error.message || error);
    }
    return [];
  }

  return projects.map((p) => {
    const rawMilestones = ((p as Record<string, unknown>).milestones || (p as Record<string, unknown>).project_milestones || []) as Array<{
      id: string;
      title: string;
      planned_date: string | null;
      actual_date: string | null;
      status: "pending" | "done";
      delay_reason: string | null;
      delay_note: string | null;
    }>;

    const milestonesForRules: ProjectMilestoneItem[] = rawMilestones.map((m) => ({
      id: m.id,
      title: m.title,
      plannedDate: m.planned_date,
      actualDate: m.actual_date,
      status: m.status,
      delayReason: m.delay_reason,
      delayNote: m.delay_note,
    }));

    const delayCheck = isProjectDelayed({
      status: p.status as ProjectStatus,
      plannedCompletionDate: p.planned_completion_date,
      milestones: milestonesForRules,
    });

    const progressText = formatMilestoneProgress(milestonesForRules);
    const stage = ((p as Record<string, unknown>).stages || (p as Record<string, unknown>).project_stages) as unknown as { id: string; position: number; name: string } | null;

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      site_location: p.site_location,
      start_date: p.start_date,
      planned_completion_date: p.planned_completion_date,
      status: p.status as ProjectStatus,
      current_stage: stage,
      milestones_count: milestonesForRules.length,
      milestones_done: milestonesForRules.filter((m) => m.status === "done").length,
      progress_text: progressText,
      is_delayed: delayCheck.isDelayed,
      delay_reason: delayCheck.reason,
    };
  });
}

/**
 * Fetches full project details including stages, milestones, and assigned members.
 */
export async function getProjectDetail(id: string): Promise<ProjectDetail | null> {
  const supabase = createAdminClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select(`
      id,
      code,
      name,
      customer_id,
      quotation_id,
      site_location,
      site_contact_name,
      site_contact_phone,
      current_stage_id,
      start_date,
      planned_completion_date,
      actual_completion_date,
      status,
      notes,
      is_archived,
      created_by,
      created_at,
      updated_at,
      project_stages!projects_current_stage_id_fkey (
        id,
        position,
        name,
        created_at,
        updated_at
      ),
      project_milestones (
        id,
        project_id,
        stage_id,
        title,
        planned_date,
        actual_date,
        status,
        delay_reason,
        delay_note,
        position,
        created_at,
        updated_at,
        project_stages (
          id,
          position,
          name
        )
      ),
      project_members (
        id,
        project_id,
        user_id,
        member_role,
        created_at,
        profiles:user_id (
          id,
          full_name,
          phone
        )
      )
    `)
    .eq("id", id)
    .single();

  if (error || !project) {
    if (error) console.error(`Error fetching project ${id}:`, error.message || error);
    return null;
  }

  // Sort milestones by position asc, then created_at asc
  interface RawMilestone {
    position: number;
    created_at: string;
    [key: string]: unknown;
  }
  const milestones = ((project.project_milestones || []) as unknown as RawMilestone[]).sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  interface RawMember {
    id: string;
    project_id: string;
    user_id: string;
    member_role: string;
    created_at: string;
    profiles?: {
      id: string;
      full_name: string;
      email?: string;
      phone: string | null;
    } | null;
  }

  const members = ((project.project_members || []) as unknown as RawMember[]).map((m) => ({
    id: m.id,
    project_id: m.project_id,
    user_id: m.user_id,
    member_role: m.member_role,
    created_at: m.created_at,
    user: m.profiles
      ? {
          id: m.profiles.id,
          full_name: m.profiles.full_name,
          email: m.profiles.email,
          phone: m.profiles.phone,
        }
      : undefined,
  }));

  return {
    ...project,
    current_stage: project.project_stages as unknown as ProjectStage,
    milestones,
    members,
  } as unknown as ProjectDetail;
}

/**
 * Fetches all 9 predefined stages ordered by position (1 to 9).
 */
export async function getProjectStages(): Promise<ProjectStage[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("project_stages")
    .select("id, position, name, created_at, updated_at")
    .order("position", { ascending: true });

  if (error || !data) {
    if (error) console.error("Error fetching project stages:", error.message || error);
    return [];
  }

  return data as ProjectStage[];
}

/**
 * Fetches active employees for member assignment.
 */
export async function getActiveEmployees() {
  const supabase = createAdminClient();

  const [profilesRes, usersRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        phone,
        user_roles (
          role
        )
      `)
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase.auth.admin.listUsers().catch(() => ({ data: { users: [] }, error: null })),
  ]);

  if (profilesRes.error || !profilesRes.data) {
    if (profilesRes.error) console.error("Error fetching active employees:", profilesRes.error.message || profilesRes.error);
    return [];
  }

  const emailMap = new Map<string, string>();
  if (usersRes?.data?.users) {
    for (const u of usersRes.data.users) {
      if (u.id && u.email) emailMap.set(u.id, u.email);
    }
  }

  return profilesRes.data.map((u) => ({
    id: u.id,
    full_name: u.full_name,
    email: emailMap.get(u.id) || "",
    phone: u.phone,
    roles: ((u.user_roles || []) as Array<{ role: string }>).map((r) => r.role),
  }));
}
