import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTaskOverdue, isTaskBlocked } from "@/lib/rules/tasks";
import { TaskItem, TaskComment, TaskKind, TaskStatus } from "./types";

/**
 * Fetches tasks matching current user RLS permissions.
 * Computes Rule R3 overdue and blocked flags on read.
 */
export async function getTasksList(options?: {
  projectId?: string;
  assigneeId?: string;
  kind?: TaskKind;
  status?: TaskStatus;
}): Promise<TaskItem[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("tasks")
    .select(`
      id,
      project_id,
      kind,
      title,
      description,
      priority,
      due_date,
      assignee_id,
      status,
      blocked_reason,
      resolution_note,
      completed_at,
      created_by,
      created_at,
      updated_at,
      projects (
        id,
        code,
        name
      ),
      assignee:assignee_id (
        id,
        full_name,
        phone
      ),
      creator:created_by (
        id,
        full_name,
        phone
      ),
      task_comments (
        id
      )
    `)
    .order("created_at", { ascending: false });

  if (options?.projectId) {
    query = query.eq("project_id", options.projectId);
  }
  if (options?.assigneeId) {
    query = query.eq("assignee_id", options.assigneeId);
  }
  if (options?.kind) {
    query = query.eq("kind", options.kind);
  }
  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error("Error fetching tasks list:", error.message || error);
    return [];
  }

  const now = new Date();

  return data.map((t) => {
    const overdue = isTaskOverdue(
      { status: t.status, dueDate: t.due_date },
      now
    );
    const blocked = isTaskBlocked({ status: t.status });

    return {
      id: t.id,
      project_id: t.project_id,
      kind: t.kind,
      title: t.title,
      description: t.description,
      priority: t.priority,
      due_date: t.due_date,
      assignee_id: t.assignee_id,
      status: t.status,
      blocked_reason: t.blocked_reason,
      resolution_note: t.resolution_note,
      completed_at: t.completed_at,
      created_by: t.created_by,
      created_at: t.created_at,
      updated_at: t.updated_at,
      project: t.projects as unknown as TaskItem["project"],
      assignee: t.assignee as unknown as TaskItem["assignee"],
      creator: t.creator as unknown as TaskItem["creator"],
      is_overdue: overdue,
      is_blocked: blocked,
    };
  });
}

/**
 * Fetches a single task with all comments and profiles.
 */
export async function getTaskDetail(taskId: string): Promise<TaskItem | null> {
  const supabase = createAdminClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select(`
      id,
      project_id,
      kind,
      title,
      description,
      priority,
      due_date,
      assignee_id,
      status,
      blocked_reason,
      resolution_note,
      completed_at,
      created_by,
      created_at,
      updated_at,
      projects (
        id,
        code,
        name
      ),
      assignee:assignee_id (
        id,
        full_name,
        phone
      ),
      creator:created_by (
        id,
        full_name,
        phone
      ),
      task_comments (
        id,
        task_id,
        author_id,
        body,
        created_at,
        profiles:author_id (
          id,
          full_name,
          phone
        )
      )
    `)
    .eq("id", taskId)
    .single();

  if (error || !task) {
    if (error) console.error(`Error fetching task ${taskId}:`, error.message || error);
    return null;
  }

  interface RawComment {
    id: string;
    task_id: string;
    author_id: string;
    body: string;
    created_at: string;
    profiles?: {
      id: string;
      full_name: string;
      phone?: string | null;
      email?: string;
    } | null;
  }

  const rawComments = (task.task_comments || []) as unknown as RawComment[];
  const comments: TaskComment[] = rawComments
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((c) => ({
      id: c.id,
      task_id: c.task_id,
      author_id: c.author_id,
      body: c.body,
      created_at: c.created_at,
      author: c.profiles
        ? {
            id: c.profiles.id,
            full_name: c.profiles.full_name,
            phone: c.profiles.phone,
            email: c.profiles.email,
          }
        : undefined,
    }));

  const now = new Date();
  const overdue = isTaskOverdue(
    { status: task.status, dueDate: task.due_date },
    now
  );
  const blocked = isTaskBlocked({ status: task.status });

  return {
    ...task,
    project: task.projects as unknown as TaskItem["project"],
    assignee: task.assignee as unknown as TaskItem["assignee"],
    creator: task.creator as unknown as TaskItem["creator"],
    comments,
    is_overdue: overdue,
    is_blocked: blocked,
  } as TaskItem;
}

/**
 * Fetches projects assigned to the current employee (for issue raising dropdown).
 */
export async function getMyProjectsForIssues() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Director can raise issue on any project
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const isDirector = (roles || []).some((r) => r.role === "director");

  if (isDirector) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, code, name")
      .eq("status", "active")
      .order("name", { ascending: true });
    return projects || [];
  }

  // Employees can raise issues only on projects they belong to
  const { data: members } = await supabase
    .from("project_members")
    .select(`
      project_id,
      projects!project_members_project_id_fkey (
        id,
        code,
        name,
        status
      )
    `)
    .eq("user_id", user.id);

  if (!members) return [];

  interface RawProjectMember {
    project_id: string;
    projects: {
      id: string;
      code: string;
      name: string;
      status: string;
    } | null;
  }

  const list = (members as unknown as RawProjectMember[])
    .map((m) => m.projects)
    .filter((p): p is { id: string; code: string; name: string; status: string } => p !== null && p.status === "active");

  return list;
}
