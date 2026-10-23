import { z } from "zod";
import { DELAY_REASONS } from "@/lib/projects/types";

export const SITE_REPORT_STATUSES = [
  "submitted",
  "correction_required",
  "reviewed",
] as const;

export type SiteReportStatus = (typeof SITE_REPORT_STATUSES)[number];

export interface SiteReportPhoto {
  id: string;
  storage_path: string;
  title: string;
  mime_type: string;
  size_bytes: number;
  download_url?: string;
}

export interface SiteReportItem {
  id: string;
  project_id: string;
  report_date: string;
  submitted_by: string;
  work_completed: string;
  progress_note: string | null;
  milestone_id: string | null;
  own_headcount: number;
  subcontractor_headcount: number;
  materials_received: string | null;
  materials_required: string | null;
  problems_delays: string | null;
  delay_reason: (typeof DELAY_REASONS)[number] | null;
  action_required: string | null;
  responsible_party: string | null;
  status: SiteReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  project?: {
    id: string;
    code: string;
    name: string;
    site_location: string;
  } | null;
  submitter?: {
    id: string;
    full_name: string;
    email?: string;
  } | null;
  reviewer?: {
    id: string;
    full_name: string;
  } | null;
  milestone?: {
    id: string;
    title: string;
  } | null;
  photos?: SiteReportPhoto[];
}

export const CreateSiteReportSchema = z.object({
  project_id: z.string().uuid("Please select a project"),
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid report date"),
  work_completed: z.string().min(5, "Work completed description is required"),
  progress_note: z.string().optional().nullable(),
  milestone_id: z.string().uuid().optional().nullable().or(z.literal("")),
  own_headcount: z.coerce.number().int().min(0, "Headcount cannot be negative").default(0),
  subcontractor_headcount: z.coerce.number().int().min(0, "Headcount cannot be negative").default(0),
  materials_received: z.string().optional().nullable(),
  materials_required: z.string().optional().nullable(),
  problems_delays: z.string().optional().nullable(),
  delay_reason: z.enum(DELAY_REASONS).optional().nullable().or(z.literal("")),
  action_required: z.string().optional().nullable(),
  responsible_party: z.string().optional().nullable(),
});

export const ReviewSiteReportSchema = z.object({
  report_id: z.string().uuid("Invalid report ID"),
  decision: z.enum(["reviewed", "correction_required"]),
  review_note: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.decision === "correction_required" && (!data.review_note || data.review_note.trim().length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: "A review note is required when requesting a correction",
    path: ["review_note"],
  }
);
