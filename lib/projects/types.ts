import { z } from "zod";
import { AppRole } from "@/lib/auth/types";

export const PROJECT_STATUSES = ["active", "on_hold", "closed", "cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const MILESTONE_STATUSES = ["pending", "done"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const DELAY_REASONS = [
  "weather",
  "client_site_not_ready",
  "material_delay",
  "drawings_pending",
  "labour_shortage",
  "payment_delay",
  "other",
] as const;
export type DelayReason = (typeof DELAY_REASONS)[number];

export const DELAY_REASON_LABELS: Record<DelayReason, string> = {
  weather: "Adverse Weather",
  client_site_not_ready: "Client Site Not Ready",
  material_delay: "Material / Supply Delay",
  drawings_pending: "Drawings / Approvals Pending",
  labour_shortage: "Labour / Erection Shortage",
  payment_delay: "Payment / Financial Hold",
  other: "Other Reason",
};

export interface ProjectStage {
  id: string;
  position: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  member_role: AppRole;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  };
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  stage_id: string | null;
  title: string;
  planned_date: string | null;
  actual_date: string | null;
  status: MilestoneStatus;
  delay_reason: DelayReason | null;
  delay_note: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  stage?: ProjectStage | null;
}

export interface ProjectDetail {
  id: string;
  code: string;
  name: string;
  customer_id: string | null;
  quotation_id: string | null;
  site_location: string;
  site_contact_name: string | null;
  site_contact_phone: string | null;
  current_stage_id: string | null;
  start_date: string;
  planned_completion_date: string;
  actual_completion_date: string | null;
  status: ProjectStatus;
  notes: string | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  current_stage?: ProjectStage | null;
  milestones?: ProjectMilestone[];
  members?: ProjectMember[];
}

export const CreateProjectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  site_location: z.string().min(2, "Site location is required"),
  site_contact_name: z.string().optional().nullable(),
  site_contact_phone: z.string().optional().nullable(),
  current_stage_id: z.string().uuid("Invalid stage ID").optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  planned_completion_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Planned completion date must be YYYY-MM-DD"),
  notes: z.string().optional().nullable(),
});

export const UpdateProjectStageSchema = z.object({
  project_id: z.string().uuid("Invalid project ID"),
  stage_id: z.string().uuid("Invalid stage ID"),
});

export const CreateMilestoneSchema = z.object({
  project_id: z.string().uuid("Invalid project ID"),
  stage_id: z.string().uuid("Invalid stage ID").optional().nullable(),
  title: z.string().min(1, "Milestone title is required"),
  planned_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Planned date must be YYYY-MM-DD")
    .optional()
    .nullable()
    .or(z.literal("")),
  position: z.number().int().optional().default(0),
});

export const UpdateMilestoneSchema = z.object({
  milestone_id: z.string().uuid("Invalid milestone ID"),
  project_id: z.string().uuid("Invalid project ID"),
  title: z.string().min(1, "Milestone title is required"),
  planned_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Planned date must be YYYY-MM-DD")
    .optional()
    .nullable()
    .or(z.literal("")),
  actual_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Actual date must be YYYY-MM-DD")
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.enum(MILESTONE_STATUSES),
  delay_reason: z.enum(DELAY_REASONS).optional().nullable().or(z.literal("")),
  delay_note: z.string().optional().nullable(),
});

export const AssignMemberSchema = z.object({
  project_id: z.string().uuid("Invalid project ID"),
  user_id: z.string().uuid("Invalid user ID"),
  member_role: z.enum([
    "director",
    "site_engineer",
    "project_manager",
    "accounts",
    "purchase",
    "sales",
  ]),
});

export const RemoveMemberSchema = z.object({
  project_id: z.string().uuid("Invalid project ID"),
  user_id: z.string().uuid("Invalid user ID"),
});
