"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  RaiseIssueSchema,
  UpdateTaskStatusSchema,
  AddTaskCommentSchema,
} from "./types";

/**
 * Creates a new task or issue.
 * Directors and Project Managers can create and assign tasks (project optional).
 */
export async function createTaskAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  const rawData = {
    project_id: formData.get("project_id") || null,
    kind: formData.get("kind") || "task",
    title: formData.get("title"),
    description: formData.get("description") || null,
    priority: formData.get("priority") || "medium",
    due_date: formData.get("due_date") || null,
    assignee_id: formData.get("assignee_id") || null,
  };

  const parsed = CreateTaskSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: parsed.data.project_id || null,
      kind: parsed.data.kind,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      due_date: parsed.data.due_date || null,
      assignee_id: parsed.data.assignee_id || null,
      status: "open",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message || "Failed to create task" };
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/employee/tasks");
  if (parsed.data.project_id) {
    revalidatePath(`/admin/projects/${parsed.data.project_id}`);
  }

  return { success: true, taskId: data.id };
}

/**
 * Fixes the wording/assignment of an existing task. Status stays with the assignee (updateTaskStatusAction).
 */
export async function updateTaskAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Authentication required" };

  const parsed = UpdateTaskSchema.safeParse({
    id: formData.get("id"),
    project_id: formData.get("project_id") || null,
    title: formData.get("title"),
    description: formData.get("description") || null,
    priority: formData.get("priority") || "medium",
    due_date: formData.get("due_date") || null,
    assignee_id: formData.get("assignee_id") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({
      project_id: parsed.data.project_id || null,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      due_date: parsed.data.due_date || null,
      assignee_id: parsed.data.assignee_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "You cannot edit this task" };

  revalidatePath("/admin/tasks");
  revalidatePath("/employee/tasks");
  return { success: true };
}

/**
 * Raises an issue on a project.
 * Per specification: "Any employee can raise an issue (kind = issue) on a project they belong to; it defaults to the project manager."
 */
export async function raiseIssueAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  const rawData = {
    project_id: formData.get("project_id"),
    title: formData.get("title"),
    description: formData.get("description") || null,
    priority: formData.get("priority") || "high",
    due_date: formData.get("due_date") || null,
  };

  const parsed = RaiseIssueSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  // Find the assigned Project Manager for this project as the default assignee
  const { data: pmMember } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", parsed.data.project_id)
    .eq("member_role", "project_manager")
    .limit(1)
    .maybeSingle();

  const assigneeId = pmMember?.user_id || null;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: parsed.data.project_id,
      kind: "issue",
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      due_date: parsed.data.due_date || null,
      assignee_id: assigneeId,
      status: "open",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message || "Failed to raise issue" };
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/employee/tasks");
  revalidatePath("/employee/raise-issue");
  revalidatePath(`/admin/projects/${parsed.data.project_id}`);

  return { success: true, taskId: data.id };
}

/**
 * Updates task status, recording blocked reason when blocked or resolution note when resolved.
 */
export async function updateTaskStatusAction(
  taskId: string,
  status: "open" | "in_progress" | "blocked" | "done",
  blockedReason?: string | null,
  resolutionNote?: string | null
) {
  const parsed = UpdateTaskStatusSchema.safeParse({
    task_id: taskId,
    status,
    blocked_reason: blockedReason,
    resolution_note: resolutionNote,
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

  const { data: isDir } = await supabase.rpc("is_director");
  if (!isDir) {
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isPM = (userRoles || []).some((r) => r.role === "project_manager");
    if (!isPM) {
      const { data: task } = await supabase
        .from("tasks")
        .select("assignee_id")
        .eq("id", parsed.data.task_id)
        .single();
      if (!task || task.assignee_id !== user.id) {
        return { error: "You can only update tasks assigned to you." };
      }
    }
  }

  const updates: Record<string, unknown> = {
    status: parsed.data.status,
  };

  if (parsed.data.status === "blocked") {
    if (!parsed.data.blocked_reason?.trim()) {
      return { error: "A blocked reason is mandatory when marking a task blocked" };
    }
    updates.blocked_reason = parsed.data.blocked_reason.trim();
  } else if (parsed.data.status === "done") {
    updates.completed_at = new Date().toISOString();
    updates.resolution_note = parsed.data.resolution_note?.trim() || null;
  } else {
    // Re-opened or in progress: clear blocked reason
    updates.blocked_reason = null;
  }

  const { error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", parsed.data.task_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/employee/tasks");
  return { success: true };
}

/**
 * Adds a comment to a task thread.
 */
export async function addTaskCommentAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  const rawData = {
    task_id: formData.get("task_id"),
    body: formData.get("body"),
  };

  const parsed = AddTaskCommentSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { error } = await supabase.from("task_comments").insert({
    task_id: parsed.data.task_id,
    author_id: user.id,
    body: parsed.data.body,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/employee/tasks");
  return { success: true };
}
