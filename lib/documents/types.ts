import { z } from "zod";
import { DocCategory, DrawingReviewStatus } from "@/lib/rules/documents";

export type { DocCategory, DrawingReviewStatus };

export const DOC_CATEGORIES = [
  "contract",
  "quotation",
  "drawing",
  "customer_approval",
  "purchase_order",
  "invoice",
  "bill",
  "delivery_document",
  "site_photo",
  "inspection",
  "handover",
  "other",
] as const;

export const DRAWING_REVIEW_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "superseded",
] as const;

export interface DocumentItem {
  id: string;
  project_id: string | null;
  category: DocCategory;
  title: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  version_no: number;
  review_status: DrawingReviewStatus | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  supersedes_id: string | null;
  uploaded_by: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  project?: {
    id: string;
    code: string;
    name: string;
  } | null;
  uploader?: {
    id: string;
    full_name: string;
    email?: string;
    phone?: string | null;
  } | null;
  reviewer?: {
    id: string;
    full_name: string;
    email?: string;
    phone?: string | null;
  } | null;
  is_pending_review?: boolean;
  drawing_age_days?: number;
}

export const UploadDocumentSchema = z.object({
  project_id: z.string().uuid("Invalid project ID").optional().nullable().or(z.literal("")),
  category: z.enum(DOC_CATEGORIES),
  title: z.string().min(2, "Document title is required"),
  supersedes_id: z.string().uuid("Invalid supersedes ID").optional().nullable().or(z.literal("")),
  invoice_id: z.string().uuid("Invalid invoice ID").optional().nullable().or(z.literal("")),
  vendor_order_id: z.string().uuid("Invalid vendor order ID").optional().nullable().or(z.literal("")),
  bill_id: z.string().uuid("Invalid bill ID").optional().nullable().or(z.literal("")),
});

export const ReviewDrawingSchema = z.object({
  document_id: z.string().uuid("Invalid document ID"),
  review_status: z.enum(["approved", "rejected"]),
  review_note: z.string().optional().nullable(),
});
