import { z } from "zod";

export type EnquiryStatus = "open" | "quoted" | "won" | "lost";
export type FollowupKind = "call" | "meeting" | "site_visit" | "message" | "other";
export type QuotationStatus = "draft" | "sent" | "negotiating" | "accepted" | "rejected" | "expired";

// -----------------------------------------------------------------------------
// Zod Schemas for Validation
// -----------------------------------------------------------------------------

export const CreateCustomerSchema = z.object({
  name: z.string().min(2, "Customer or company name is required").max(200),
  contact_person: z.string().max(100).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.extend({
  id: z.string().uuid("Invalid customer ID"),
  is_archived: z.boolean().optional(),
});

export const CreateEnquirySchema = z.object({
  customer_id: z.string().uuid("Customer selection is required"),
  title: z.string().min(2, "Enquiry title or project requirement is required").max(200),
  requirement: z.string().max(2000).optional().nullable(),
  expected_value_excl_gst: z.coerce.number().min(0, "Expected value must be positive").default(0),
  source_id: z.string().uuid("Invalid lead source").optional().nullable().or(z.literal("")),
  assigned_to: z.string().uuid("Invalid salesperson").optional().nullable().or(z.literal("")),
  next_followup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional().nullable().or(z.literal("")),
  meeting_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Invalid meeting time").optional().nullable().or(z.literal("")),
});

export const BookMeetingSchema = z.object({
  id: z.string().uuid("Invalid enquiry ID"),
  meeting_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Meeting date and time are required"),
  assigned_to: z.string().uuid("Invalid salesperson").optional().nullable().or(z.literal("")),
});

export const UpdateEnquirySchema = CreateEnquirySchema.extend({
  id: z.string().uuid("Invalid enquiry ID"),
  status: z.enum(["open", "quoted", "won", "lost"]).optional(),
});

export const MarkEnquiryLostSchema = z.object({
  enquiry_id: z.string().uuid("Invalid enquiry ID"),
  lost_reason_id: z.string().uuid("A lost reason is strictly required per Rule S5"),
  lost_note: z.string().max(1000).optional().nullable(),
});

export const QuickLogFollowupSchema = z.object({
  enquiry_id: z.string().uuid("Please select an enquiry"),
  kind: z.enum(["call", "meeting", "site_visit", "message", "other"], {
    message: "Follow-up kind is required",
  }),
  followup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  attendees: z.string().max(200).optional().nullable(),
  note: z.string().max(1000, "Notes cannot exceed 1000 characters").optional().nullable(),
  next_followup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional().nullable().or(z.literal("")),
});

export const CreateQuotationSchema = z.object({
  enquiry_id: z.string().uuid("Enquiry selection is required"),
  amount_excl_gst: z.coerce.number().min(0.01, "Quotation amount must be greater than zero"),
  validity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional().nullable().or(z.literal("")),
  notes: z.string().max(1000).optional().nullable(),
  version: z.coerce.number().int().min(1).default(1),
  status: z.enum(["draft", "sent", "negotiating", "accepted", "rejected", "expired"]).default("draft"),
});

export const UpdateQuotationStatusSchema = z.object({
  quotation_id: z.string().uuid("Invalid quotation ID"),
  status: z.enum(["draft", "sent", "negotiating", "accepted", "rejected", "expired"]),
  validity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
  notes: z.string().max(1000).optional().nullable(),
});

export const ConvertQuotationToProjectSchema = z.object({
  quotation_id: z.string().uuid("Quotation ID is required"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().split("T")[0]),
  planned_completion_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
});

export const ManageLeadSourceSchema = z.object({
  name: z.string().min(2, "Lead source name is required").max(100),
  is_active: z.boolean().default(true),
});

export const ManageLostReasonSchema = z.object({
  name: z.string().min(2, "Lost reason name is required").max(100),
  is_active: z.boolean().default(true),
});

// -----------------------------------------------------------------------------
// TypeScript Data Interfaces
// -----------------------------------------------------------------------------

export interface LeadSourceItem {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface LostReasonItem {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface CustomerItem {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  enquiries_count?: number;
}

export interface EnquiryFollowupItem {
  id: string;
  enquiry_id: string;
  kind: FollowupKind;
  followup_date: string;
  attendees: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  creator?: {
    id: string;
    full_name: string;
  } | null;
}

export interface QuotationItem {
  id: string;
  enquiry_id: string;
  quote_number: string;
  version: number;
  amount_excl_gst: number; // numeric
  validity_date: string | null;
  status: QuotationStatus;
  sent_at: string | null;
  accepted_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    full_name: string;
  } | null;
  enquiry?: {
    id: string;
    title: string;
    status: string;
    customer_id?: string;
    project_id?: string | null;
    customer?: {
      id: string;
      name: string;
      contact_person?: string | null;
      phone?: string | null;
    } | null;
  } | null;
  document?: {
    id: string;
    title: string;
    storage_path: string;
  } | null;
}

export interface EnquiryItem {
  id: string;
  customer_id: string;
  title: string;
  requirement: string | null;
  expected_value_excl_gst: number;
  source_id: string | null;
  assigned_to: string | null;
  status: EnquiryStatus;
  lost_reason_id: string | null;
  lost_note: string | null;
  next_followup_date: string | null;
  meeting_at: string | null;
  won_at: string | null;
  lost_at: string | null;
  project_id: string | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer?: CustomerItem | null;
  source?: LeadSourceItem | null;
  lost_reason?: LostReasonItem | null;
  assigned_person?: {
    id: string;
    full_name: string;
  } | null;
  followups?: EnquiryFollowupItem[];
  quotations?: QuotationItem[];
  project?: {
    id: string;
    code: string;
    name: string;
  } | null;
  is_followup_due?: boolean;
}
