"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CreateCustomerSchema,
  UpdateCustomerSchema,
  CreateEnquirySchema,
  BookMeetingSchema,
  UpdateEnquirySchema,
  MarkEnquiryLostSchema,
  QuickLogFollowupSchema,
  CreateQuotationSchema,
  UpdateQuotationStatusSchema,
  ConvertQuotationToProjectSchema,
  ManageLeadSourceSchema,
  ManageLostReasonSchema,
} from "./types";
import { validateEnquiryLost, shouldTransitionEnquiryToQuoted } from "@/lib/rules/sales";

/**
 * 1. Customer Actions
 */
export async function createCustomerAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Authentication required" };

  const rawData = {
    name: formData.get("name"),
    contact_person: formData.get("contact_person") || null,
    phone: formData.get("phone") || null,
    email: formData.get("email") || null,
    address: formData.get("address") || null,
    notes: formData.get("notes") || null,
  };

  const parsed = CreateCustomerSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid customer data" };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      ...parsed.data,
      created_by: user.id,
    })
    .select("id, name")
    .single();

  if (error || !data) {
    return { error: error?.message || "Failed to create customer" };
  }

  revalidatePath("/x9admin/sales");
  revalidatePath("/employee/enquiries");
  return { success: true, customerId: data.id, customerName: data.name };
}

export async function updateCustomerAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const rawData = {
    id: formData.get("id"),
    name: formData.get("name"),
    contact_person: formData.get("contact_person") || null,
    phone: formData.get("phone") || null,
    email: formData.get("email") || null,
    address: formData.get("address") || null,
    notes: formData.get("notes") || null,
  };

  const parsed = UpdateCustomerSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid customer update" };
  }

  const { error } = await supabase
    .from("customers")
    .update({
      name: parsed.data.name,
      contact_person: parsed.data.contact_person,
      phone: parsed.data.phone,
      email: parsed.data.email,
      address: parsed.data.address,
      notes: parsed.data.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/x9admin/sales");
  revalidatePath("/employee/enquiries");
  return { success: true };
}

/**
 * 2. Enquiry Actions
 */
/** The meeting box gives "YYYY-MM-DDTHH:mm" with no zone; this business runs on IST. */
const istIso = (local: string) => `${local}:00+05:30`;

export async function createEnquiryAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Authentication required" };

  const rawData = {
    customer_id: formData.get("customer_id"),
    title: formData.get("title"),
    requirement: formData.get("requirement") || null,
    expected_value_excl_gst: formData.get("expected_value_excl_gst") || 0,
    source_id: formData.get("source_id") || null,
    assigned_to: formData.get("assigned_to") || user.id,
    next_followup_date: formData.get("next_followup_date") || null,
    meeting_at: formData.get("meeting_at") || null,
  };

  const parsed = CreateEnquirySchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { data, error } = await supabase
    .from("enquiries")
    .insert({
      customer_id: parsed.data.customer_id,
      title: parsed.data.title,
      requirement: parsed.data.requirement,
      expected_value_excl_gst: parsed.data.expected_value_excl_gst,
      source_id: parsed.data.source_id || null,
      assigned_to: parsed.data.assigned_to || user.id,
      next_followup_date: parsed.data.next_followup_date || null,
      ...(parsed.data.meeting_at ? { meeting_at: istIso(parsed.data.meeting_at) } : {}),
      status: "open",
      created_by: user.id,
    })
    .select("id, title")
    .single();

  if (error || !data) {
    return { error: error?.message || "Failed to create enquiry" };
  }

  revalidatePath("/x9admin/sales");
  revalidatePath("/employee/enquiries");
  return { success: true, enquiryId: data.id };
}

export async function updateEnquiryAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const rawData = {
    id: formData.get("id"),
    customer_id: formData.get("customer_id"),
    title: formData.get("title"),
    requirement: formData.get("requirement") || null,
    expected_value_excl_gst: formData.get("expected_value_excl_gst") || 0,
    source_id: formData.get("source_id") || null,
    assigned_to: formData.get("assigned_to") || null,
    next_followup_date: formData.get("next_followup_date") || null,
    status: formData.get("status") || "open",
  };

  const parsed = UpdateEnquirySchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { error } = await supabase
    .from("enquiries")
    .update({
      customer_id: parsed.data.customer_id,
      title: parsed.data.title,
      requirement: parsed.data.requirement,
      expected_value_excl_gst: parsed.data.expected_value_excl_gst,
      source_id: parsed.data.source_id || null,
      assigned_to: parsed.data.assigned_to || null,
      next_followup_date: parsed.data.next_followup_date || null,
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/x9admin/sales");
  revalidatePath(`/x9admin/sales/${parsed.data.id}`);
  revalidatePath("/employee/enquiries");
  return { success: true };
}

/** Lead generator confirms a client meeting and hands the lead to a field salesperson. */
export async function bookMeetingAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const parsed = BookMeetingSchema.safeParse({
    id: formData.get("id"),
    meeting_at: formData.get("meeting_at"),
    assigned_to: formData.get("assigned_to") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { error } = await supabase
    .from("enquiries")
    .update({
      meeting_at: istIso(parsed.data.meeting_at),
      ...(parsed.data.assigned_to ? { assigned_to: parsed.data.assigned_to } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/x9admin/sales");
  revalidatePath("/employee/enquiries");
  revalidatePath("/employee");
  return { success: true };
}

/**
 * Rule S5: Mark Enquiry Lost Action
 * Strictly requires a lost_reason_id.
 */
export async function markEnquiryLostAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const rawData = {
    enquiry_id: formData.get("enquiry_id"),
    lost_reason_id: formData.get("lost_reason_id"),
    lost_note: formData.get("lost_note") || null,
  };

  const parsed = MarkEnquiryLostSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Lost reason is required per Rule S5" };
  }

  const lostCheck = validateEnquiryLost(parsed.data.lost_reason_id);
  if (!lostCheck.valid) {
    return { error: lostCheck.error || "Lost reason required" };
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("enquiries")
    .update({
      status: "lost",
      lost_reason_id: parsed.data.lost_reason_id,
      lost_note: parsed.data.lost_note,
      lost_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", parsed.data.enquiry_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/x9admin/sales");
  revalidatePath(`/x9admin/sales/${parsed.data.enquiry_id}`);
  revalidatePath("/employee/enquiries");
  return { success: true };
}

/**
 * 3. Quick-Log Follow-up Action (Under 10 seconds on mobile)
 */
export async function quickLogFollowupAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Authentication required" };

  const rawData = {
    enquiry_id: formData.get("enquiry_id"),
    kind: formData.get("kind"),
    followup_date: formData.get("followup_date") || new Date().toISOString().split("T")[0],
    attendees: formData.get("attendees") || null,
    note: formData.get("note") || null,
    next_followup_date: formData.get("next_followup_date") || null,
  };

  const parsed = QuickLogFollowupSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid follow-up data" };
  }

  // 1. Insert follow-up record
  const { data: followup, error: insertErr } = await supabase
    .from("enquiry_followups")
    .insert({
      enquiry_id: parsed.data.enquiry_id,
      kind: parsed.data.kind,
      followup_date: parsed.data.followup_date,
      attendees: parsed.data.attendees,
      note: parsed.data.note,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr || !followup) {
    return { error: insertErr?.message || "Failed to log follow-up" };
  }

  // 2. Optionally update enquiry's next_followup_date
  if (parsed.data.next_followup_date) {
    await supabase
      .from("enquiries")
      .update({
        next_followup_date: parsed.data.next_followup_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.enquiry_id);
  }

  revalidatePath("/x9admin/sales");
  revalidatePath(`/x9admin/sales/${parsed.data.enquiry_id}`);
  revalidatePath("/employee/quick-log");
  revalidatePath("/employee/enquiries");
  return { success: true, followupId: followup.id };
}

/**
 * 4. Quotation Actions
 */
export async function createQuotationAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Authentication required" };

  const rawData = {
    enquiry_id: formData.get("enquiry_id"),
    amount_excl_gst: formData.get("amount_excl_gst"),
    validity_date: formData.get("validity_date") || null,
    notes: formData.get("notes") || null,
    version: formData.get("version") || 1,
    status: formData.get("status") || "draft",
  };

  const parsed = CreateQuotationSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  // Generate unique quote number via database RPC
  const { data: quoteNum, error: quoteNumErr } = await supabase.rpc("generate_quotation_number");
  if (quoteNumErr || !quoteNum) {
    return { error: quoteNumErr?.message || "Failed to generate quotation number" };
  }

  const quoteNumberWithVersion =
    parsed.data.version > 1 ? `${quoteNum}-v${parsed.data.version}` : quoteNum;

  const nowIso = new Date().toISOString();
  const isSent = parsed.data.status === "sent";

  const { data: quote, error: quoteErr } = await supabase
    .from("quotations")
    .insert({
      enquiry_id: parsed.data.enquiry_id,
      quote_number: quoteNumberWithVersion,
      version: parsed.data.version,
      amount_excl_gst: parsed.data.amount_excl_gst,
      validity_date: parsed.data.validity_date || null,
      status: parsed.data.status,
      sent_at: isSent ? nowIso : null,
      notes: parsed.data.notes,
      created_by: user.id,
    })
    .select("id, quote_number")
    .single();

  if (quoteErr || !quote) {
    return { error: quoteErr?.message || "Failed to create quotation" };
  }

  // Rule S3 check: If created directly in sent status, transition open enquiry to quoted
  if (isSent) {
    const { data: enq } = await supabase
      .from("enquiries")
      .select("status")
      .eq("id", parsed.data.enquiry_id)
      .single();

    if (enq && shouldTransitionEnquiryToQuoted(enq.status, "sent")) {
      await supabase
        .from("enquiries")
        .update({ status: "quoted", updated_at: nowIso })
        .eq("id", parsed.data.enquiry_id);
    }
  }

  revalidatePath("/x9admin/sales");
  revalidatePath(`/x9admin/sales/${parsed.data.enquiry_id}`);
  revalidatePath("/employee/enquiries");
  return { success: true, quoteId: quote.id, quoteNumber: quote.quote_number };
}

/**
 * Updates quotation status (Rule S3: sent sets sent_at and moves enquiry to quoted)
 */
export async function updateQuotationStatusAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const rawData = {
    quotation_id: formData.get("quotation_id"),
    status: formData.get("status"),
    validity_date: formData.get("validity_date") || null,
    notes: formData.get("notes") || null,
  };

  const parsed = UpdateQuotationStatusSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  // Fetch current quote
  const { data: quote, error: fetchErr } = await supabase
    .from("quotations")
    .select("id, enquiry_id, status, sent_at, accepted_at")
    .eq("id", parsed.data.quotation_id)
    .single();

  if (fetchErr || !quote) {
    return { error: "Quotation not found" };
  }

  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status: parsed.data.status,
    updated_at: nowIso,
  };

  if (parsed.data.validity_date) {
    updates.validity_date = parsed.data.validity_date;
  }
  if (parsed.data.notes !== undefined) {
    updates.notes = parsed.data.notes;
  }

  // Rule S3: Setting to sent sets sent_at
  if (parsed.data.status === "sent" && !quote.sent_at) {
    updates.sent_at = nowIso;
  }

  // Setting to accepted sets accepted_at
  if (parsed.data.status === "accepted" && !quote.accepted_at) {
    updates.accepted_at = nowIso;
  }

  const { error: updateErr } = await supabase
    .from("quotations")
    .update(updates)
    .eq("id", parsed.data.quotation_id);

  if (updateErr) {
    return { error: updateErr.message };
  }

  // Rule S3: transition enquiry from open to quoted if quotation is sent
  if (parsed.data.status === "sent") {
    const { data: enq } = await supabase
      .from("enquiries")
      .select("status")
      .eq("id", quote.enquiry_id)
      .single();

    if (enq && shouldTransitionEnquiryToQuoted(enq.status, "sent")) {
      await supabase
        .from("enquiries")
        .update({ status: "quoted", updated_at: nowIso })
        .eq("id", quote.enquiry_id);
    }
  }

  revalidatePath("/x9admin/sales");
  revalidatePath(`/x9admin/sales/${quote.enquiry_id}`);
  revalidatePath("/employee/enquiries");
  return { success: true };
}

/**
 * 5. Rule S12: Quotation to Project Conversion Action
 * Single database transaction via RPC convert_quotation_to_project.
 */
export async function convertQuotationToProjectAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const rawData = {
    quotation_id: formData.get("quotation_id"),
    start_date: formData.get("start_date") || new Date().toISOString().split("T")[0],
    planned_completion_date: formData.get("planned_completion_date") || null,
  };

  const parsed = ConvertQuotationToProjectSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  // Call PostgreSQL RPC function for atomic execution
  const { data: rpcRes, error: rpcErr } = await supabase.rpc("convert_quotation_to_project", {
    p_quotation_id: parsed.data.quotation_id,
    p_start_date: parsed.data.start_date,
    p_planned_completion_date: parsed.data.planned_completion_date || null,
  });

  if (rpcErr || !rpcRes) {
    return { error: rpcErr?.message || "Failed to convert quotation to project" };
  }

  revalidatePath("/x9admin/projects");
  revalidatePath("/x9admin/sales");
  revalidatePath("/employee/enquiries");
  return {
    success: true,
    projectId: rpcRes.project_id,
    projectCode: rpcRes.project_code,
  };
}

/**
 * 6. Lead Source & Lost Reason Settings Actions
 */
export async function createLeadSourceAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const rawData = {
    name: formData.get("name"),
    is_active: true,
  };

  const parsed = ManageLeadSourceSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid source name" };
  }

  const { error } = await supabase.from("lead_sources").insert(parsed.data);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/x9admin/settings");
  revalidatePath("/x9admin/sales");
  return { success: true };
}

export async function toggleLeadSourceAction(id: string, currentStatus: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_sources")
    .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/x9admin/settings");
  revalidatePath("/x9admin/sales");
  return { success: true };
}

export async function createLostReasonAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const rawData = {
    name: formData.get("name"),
    is_active: true,
  };

  const parsed = ManageLostReasonSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid lost reason" };
  }

  const { error } = await supabase.from("lost_reasons").insert(parsed.data);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/x9admin/settings");
  revalidatePath("/x9admin/sales");
  return { success: true };
}

export async function toggleLostReasonAction(id: string, currentStatus: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lost_reasons")
    .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/x9admin/settings");
  revalidatePath("/x9admin/sales");
  return { success: true };
}
