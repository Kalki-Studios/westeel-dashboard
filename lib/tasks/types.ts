import { z } from "zod";

export const TASK_KINDS = ["task", "issue"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ["open", "in_progress", "blocked", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: {
    id: string;
    full_name: string;
    email?: string;
    phone?: string | null;
  };
}

export interface TaskItem {
  id: string;
  project_id: string | null;
  kind: TaskKind;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  status: TaskStatus;
  blocked_reason: string | null;
  resolution_note: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  project?: {
    id: string;
    code: string;
    name: string;
  } | null;
  assignee?: {
    id: string;
    full_name: string;
    email?: string;
    phone?: string | null;
  } | null;
  creator?: {
    id: string;
    full_name: string;
    email?: string;
    phone?: string | null;
  } | null;
  comments?: TaskComment[];
  is_overdue?: boolean;
  is_blocked?: boolean;
}

export const CreateTaskSchema = z.object({
  project_id: z.string().uuid("Invalid project ID").optional().nullable().or(z.literal("")),
  kind: z.enum(TASK_KINDS).default("task"),
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD")
    .optional()
    .nullable()
    .or(z.literal("")),
  assignee_id: z.string().uuid("Invalid assignee ID").optional().nullable().or(z.literal("")),
});

export const UpdateTaskSchema = CreateTaskSchema.omit({ kind: true }).extend({
  id: z.string().uuid("Invalid task ID"),
});

export const RaiseIssueSchema = z.object({
  project_id: z.string().uuid("Project ID is required for issues"),
  title: z.string().min(2, "Issue summary must be at least 2 characters"),
  description: z.string().optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).default("high"),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export const UpdateTaskStatusSchema = z.object({
  task_id: z.string().uuid("Invalid task ID"),
  status: z.enum(TASK_STATUSES),
  blocked_reason: z.string().optional().nullable(),
  resolution_note: z.string().optional().nullable(),
});

export const AddTaskCommentSchema = z.object({
  task_id: z.string().uuid("Invalid task ID"),
  body: z.string().min(1, "Comment cannot be empty"),
});
