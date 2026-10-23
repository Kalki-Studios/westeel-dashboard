"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

import type { User } from "@supabase/supabase-js";

type BillingAuthResult =
  | { authorized: false; isDirector: false; isAccounts: false; user: null; error: string }
  | { authorized: true; isDirector: boolean; isAccounts: boolean; user: User; error: null };

// Helper: Check if user has director or accounts role
async function checkBillingAuth(supabase: Awaited<ReturnType<typeof createClient>>): Promise<BillingAuthResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false, isDirector: false, isAccounts: false, user: null, error: "Authentication required" };
  }

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roleList = (roles || []).map((r: { role: string }) => r.role);
  const isDirector = roleList.includes("director");
  const isAccounts = roleList.includes("accounts");

  if (!isDirector && !isAccounts) {
    return { authorized: false, isDirector: false, isAccounts: false, user: null, error: "Unauthorized: only Director or Accounts may access billing" };
  }

  return { authorized: true, isDirector, isAccounts, user, error: null };
}

// 1. Update Project Commercials (Director Only)
const UpdateCommercialsSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  contractValueExclGst: z.coerce.number().min(0, "Contract value must be non-negative"),
});

export async function updateProjectCommercialsAction(projectId: string, contractValueExclGst: number) {
  const supabase = await createClient();
  const auth = await checkBillingAuth(supabase);
  if (!auth.authorized || !auth.isDirector) {
    return { error: "Unauthorized: Only the Director can edit contract values (Section 5)" };
  }

  const parsed = UpdateCommercialsSchema.safeParse({ projectId, contractValueExclGst });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { error } = await supabase
    .from("project_commercials")
    .upsert(
      {
        project_id: parsed.data.projectId,
        contract_value_excl_gst: parsed.data.contractValueExclGst,
        updated_by: auth.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" }
    );

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/x9admin/projects/${projectId}`);
  revalidatePath("/x9admin/collections");
  revalidatePath("/x9admin");
  return { success: true };
}

// 2. Create Variation Order (Director Only)
const CreateVariationSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1, "Variation title is required"),
  amountExclGst: z.coerce.number(), // can be negative for deductions
  status: z.enum(["proposed", "approved", "rejected"]).default("proposed"),
  note: z.string().optional().nullable(),
});

export async function createVariationOrderAction(formData: FormData) {
  const supabase = await createClient();
  const auth = await checkBillingAuth(supabase);
  if (!auth.authorized || !auth.isDirector) {
    return { error: "Unauthorized: Only the Director can manage variations" };
  }

  const raw = {
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    amountExclGst: formData.get("amountExclGst"),
    status: formData.get("status") || "proposed",
    note: formData.get("note") || null,
  };

  const parsed = CreateVariationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const isApproved = parsed.data.status === "approved";
  const { error } = await supabase.from("variation_orders").insert({
    project_id: parsed.data.projectId,
    title: parsed.data.title,
    amount_excl_gst: parsed.data.amountExclGst,
    status: parsed.data.status,
    approved_by: isApproved ? auth.user.id : null,
    approved_on: isApproved ? new Date().toISOString().slice(0, 10) : null,
    note: parsed.data.note,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/x9admin/projects/${parsed.data.projectId}`);
  revalidatePath("/x9admin/collections");
  revalidatePath("/x9admin");
  return { success: true };
}

// 3. Update Variation Status (Director Only)
const UpdateVariationStatusSchema = z.object({
  variationId: z.string().uuid(),
  projectId: z.string().uuid(),
  status: z.enum(["proposed", "approved", "rejected"]),
  note: z.string().optional().nullable(),
});

export async function updateVariationStatusAction(
  variationId: string,
  projectId: string,
  status: "proposed" | "approved" | "rejected",
  note?: string | null
) {
  const supabase = await createClient();
  const auth = await checkBillingAuth(supabase);
  if (!auth.authorized || !auth.isDirector) {
    return { error: "Unauthorized: Only Director can approve or reject variations" };
  }

  const parsed = UpdateVariationStatusSchema.safeParse({ variationId, projectId, status, note });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const isApproved = status === "approved";
  const { error } = await supabase
    .from("variation_orders")
    .update({
      status,
      approved_by: isApproved ? auth.user.id : null,
      approved_on: isApproved ? new Date().toISOString().slice(0, 10) : null,
      note: note || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", variationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/x9admin/projects/${projectId}`);
  revalidatePath("/x9admin/collections");
  revalidatePath("/x9admin");
  return { success: true };
}

// 4. Create Payment Milestone (Director or Accounts)
const CreateMilestoneSchema = z.object({
  projectId: z.string().uuid(),
  label: z.string().min(1, "Milestone label is required"),
  amountExclGst: z.coerce.number().min(0, "Amount must be non-negative"),
  expectedDate: z.string().min(10, "Expected date is required"),
  position: z.coerce.number().default(1),
});

export async function createPaymentMilestoneAction(formData: FormData) {
  const supabase = await createClient();
  const auth = await checkBillingAuth(supabase);
  if (!auth.authorized) {
    return { error: auth.error };
  }

  const raw = {
    projectId: formData.get("projectId"),
    label: formData.get("label"),
    amountExclGst: formData.get("amountExclGst"),
    expectedDate: formData.get("expectedDate"),
    position: formData.get("position") || 1,
  };

  const parsed = CreateMilestoneSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { error } = await supabase.from("payment_milestones").insert({
    project_id: parsed.data.projectId,
    label: parsed.data.label,
    amount_excl_gst: parsed.data.amountExclGst,
    expected_date: parsed.data.expectedDate,
    position: parsed.data.position,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/x9admin/projects/${parsed.data.projectId}`);
  revalidatePath("/x9admin/collections");
  return { success: true };
}

// 5. Update Payment Milestone (Director or Accounts)
export async function updatePaymentMilestoneAction(
  milestoneId: string,
  projectId: string,
  label: string,
  amountExclGst: number,
  expectedDate: string,
  position: number
) {
  const supabase = await createClient();
  const auth = await checkBillingAuth(supabase);
  if (!auth.authorized) {
    return { error: auth.error };
  }

  const { error } = await supabase
    .from("payment_milestones")
    .update({
      label,
      amount_excl_gst: amountExclGst,
      expected_date: expectedDate,
      position,
      updated_at: new Date().toISOString(),
    })
    .eq("id", milestoneId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/x9admin/projects/${projectId}`);
  revalidatePath("/x9admin/collections");
  return { success: true };
}

// 6. Delete Payment Milestone (Director or Accounts)
export async function deletePaymentMilestoneAction(milestoneId: string, projectId: string) {
  const supabase = await createClient();
  const auth = await checkBillingAuth(supabase);
  if (!auth.authorized) {
    return { error: auth.error };
  }

  const { error } = await supabase
    .from("payment_milestones")
    .delete()
    .eq("id", milestoneId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/x9admin/projects/${projectId}`);
  revalidatePath("/x9admin/collections");
  return { success: true };
}

// 7. Create Invoice (Director or Accounts)
const CreateInvoiceSchema = z.object({
  projectId: z.string().uuid(),
  paymentMilestoneId: z.string().uuid().optional().nullable(),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.string().min(10, "Invoice date is required"),
  dueDate: z.string().min(10, "Due date is required"),
  amountExclGst: z.coerce.number().min(0, "Amount must be non-negative"),
  gstAmount: z.coerce.number().min(0, "GST must be non-negative").default(0),
  note: z.string().optional().nullable(),
});

export async function createInvoiceAction(formData: FormData) {
  const supabase = await createClient();
  const auth = await checkBillingAuth(supabase);
  if (!auth.authorized) {
    return { error: auth.error };
  }

  const rawMilestoneId = formData.get("paymentMilestoneId");
  const raw = {
    projectId: formData.get("projectId"),
    paymentMilestoneId: rawMilestoneId && rawMilestoneId !== "" ? rawMilestoneId : null,
    invoiceNumber: formData.get("invoiceNumber"),
    invoiceDate: formData.get("invoiceDate"),
    dueDate: formData.get("dueDate"),
    amountExclGst: formData.get("amountExclGst"),
    gstAmount: formData.get("gstAmount") || 0,
    note: formData.get("note") || null,
  };

  const parsed = CreateInvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { data: inserted, error } = await supabase.from("invoices").insert({
    project_id: parsed.data.projectId,
    payment_milestone_id: parsed.data.paymentMilestoneId,
    invoice_number: parsed.data.invoiceNumber,
    invoice_date: parsed.data.invoiceDate,
    due_date: parsed.data.dueDate,
    amount_excl_gst: parsed.data.amountExclGst,
    gst_amount: parsed.data.gstAmount,
    note: parsed.data.note,
  }).select("id").single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/x9admin/projects/${parsed.data.projectId}`);
  revalidatePath("/x9admin/collections");
  revalidatePath("/x9admin");
  revalidatePath("/employee");
  return { success: true, invoiceId: inserted.id };
}

// 8. Cancel Invoice (Rule F13: Financial records are never deleted)
export async function cancelInvoiceAction(invoiceId: string, projectId: string) {
  const supabase = await createClient();
  const auth = await checkBillingAuth(supabase);
  if (!auth.authorized) {
    return { error: auth.error };
  }

  const { error } = await supabase
    .from("invoices")
    .update({
      is_cancelled: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/x9admin/projects/${projectId}`);
  revalidatePath("/x9admin/collections");
  revalidatePath("/x9admin");
  revalidatePath("/employee");
  return { success: true };
}

// 9. Create Receipt (Director or Accounts)
const CreateReceiptSchema = z.object({
  projectId: z.string().uuid(),
  invoiceId: z.string().uuid().optional().nullable(),
  receiptDate: z.string().min(10, "Receipt date is required"),
  amountReceived: z.coerce.number().min(0.01, "Amount received must be positive"),
  tdsAmount: z.coerce.number().min(0, "TDS cannot be negative").default(0),
  mode: z.enum(["bank_transfer", "cheque", "cash", "upi", "other"]).default("bank_transfer"),
  reference: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export async function createReceiptAction(formData: FormData) {
  const supabase = await createClient();
  const auth = await checkBillingAuth(supabase);
  if (!auth.authorized) {
    return { error: auth.error };
  }

  const rawInvoiceId = formData.get("invoiceId");
  const raw = {
    projectId: formData.get("projectId"),
    invoiceId: rawInvoiceId && rawInvoiceId !== "" ? rawInvoiceId : null,
    receiptDate: formData.get("receiptDate"),
    amountReceived: formData.get("amountReceived"),
    tdsAmount: formData.get("tdsAmount") || 0,
    mode: formData.get("mode") || "bank_transfer",
    reference: formData.get("reference") || null,
    note: formData.get("note") || null,
  };

  const parsed = CreateReceiptSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { error } = await supabase.from("receipts").insert({
    project_id: parsed.data.projectId,
    invoice_id: parsed.data.invoiceId,
    receipt_date: parsed.data.receiptDate,
    amount_received: parsed.data.amountReceived,
    tds_amount: parsed.data.tdsAmount,
    mode: parsed.data.mode,
    reference: parsed.data.reference,
    note: parsed.data.note,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/x9admin/projects/${parsed.data.projectId}`);
  revalidatePath("/x9admin/collections");
  revalidatePath("/x9admin");
  revalidatePath("/employee");
  return { success: true };
}

// 10. Allocate Receipt (Rule F3: Allocate Advance to an Invoice)
export async function allocateReceiptAction(
  receiptId: string,
  invoiceId: string,
  projectId: string
) {
  const supabase = await createClient();
  const auth = await checkBillingAuth(supabase);
  if (!auth.authorized) {
    return { error: auth.error };
  }

  const { error } = await supabase
    .from("receipts")
    .update({
      invoice_id: invoiceId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", receiptId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/x9admin/projects/${projectId}`);
  revalidatePath("/x9admin/collections");
  revalidatePath("/x9admin");
  revalidatePath("/employee");
  return { success: true };
}

// 11. Update Receipt (Rule F13: Correct receipts by editing, audited)
export async function updateReceiptAction(
  receiptId: string,
  projectId: string,
  data: {
    receiptDate: string;
    amountReceived: number;
    tdsAmount: number;
    mode: "bank_transfer" | "cheque" | "cash" | "upi" | "other";
    reference?: string | null;
    note?: string | null;
  }
) {
  const supabase = await createClient();
  const auth = await checkBillingAuth(supabase);
  if (!auth.authorized) {
    return { error: auth.error };
  }

  const { error } = await supabase
    .from("receipts")
    .update({
      receipt_date: data.receiptDate,
      amount_received: data.amountReceived,
      tds_amount: data.tdsAmount,
      mode: data.mode,
      reference: data.reference || null,
      note: data.note || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", receiptId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/x9admin/projects/${projectId}`);
  revalidatePath("/x9admin/collections");
  revalidatePath("/x9admin");
  revalidatePath("/employee");
  return { success: true };
}
