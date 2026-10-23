"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

type CostAuthResult =
  | { authorized: false; isDirector: false; isPurchase: false; isAccounts: false; user: null; error: string }
  | { authorized: true; isDirector: boolean; isPurchase: boolean; isAccounts: boolean; user: User; error: null };

async function checkCostAuth(supabase: Awaited<ReturnType<typeof createClient>>): Promise<CostAuthResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      isDirector: false,
      isPurchase: false,
      isAccounts: false,
      user: null,
      error: "Authentication required",
    };
  }

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roleList = (roles || []).map((r: { role: string }) => r.role);
  const isDirector = roleList.includes("director");
  const isPurchase = roleList.includes("purchase");
  const isAccounts = roleList.includes("accounts");

  if (!isDirector && !isPurchase && !isAccounts) {
    return {
      authorized: false,
      isDirector: false,
      isPurchase: false,
      isAccounts: false,
      user: null,
      error: "Unauthorized: Access restricted to Director, Purchase, or Accounts",
    };
  }

  return { authorized: true, isDirector, isPurchase, isAccounts, user, error: null };
}

// 1. Save Budget Lines (Director Only per Section 5)
const SaveBudgetLinesSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  lines: z.array(
    z.object({
      categoryId: z.string().uuid("Invalid category ID"),
      amountExclGst: z.coerce.number().min(0, "Budget amount must be non-negative"),
      note: z.string().optional().nullable(),
    })
  ),
});

export async function saveBudgetLinesAction(
  projectId: string,
  lines: Array<{ categoryId: string; amountExclGst: number; note?: string | null }>
) {
  const supabase = await createClient();
  const auth = await checkCostAuth(supabase);
  if (!auth.authorized || !auth.isDirector) {
    return { error: "Unauthorized: Only the Director can edit budget lines (Section 5)" };
  }

  const parsed = SaveBudgetLinesSchema.safeParse({ projectId, lines });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  for (const line of parsed.data.lines) {
    const { error } = await supabase.from("budget_lines").upsert(
      {
        project_id: parsed.data.projectId,
        category_id: line.categoryId,
        amount_excl_gst: line.amountExclGst,
        note: line.note || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,category_id" }
    );

    if (error) {
      return { error: error.message };
    }
  }

  revalidatePath(`/x9admin/projects/${projectId}`);
  revalidatePath("/x9admin");
  return { success: true };
}

// 2. Create Vendor Order (Director or Purchase)
const CreateVendorOrderSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  categoryId: z.string().uuid("Invalid category ID"),
  kind: z.enum(["material", "fabrication", "subcontract", "service"]),
  vendorName: z.string().min(1, "Vendor name is required"),
  description: z.string().min(1, "Order description is required"),
  amountExclGst: z.coerce.number().min(0, "Amount must be non-negative"),
  gstAmount: z.coerce.number().min(0, "GST amount must be non-negative").default(0),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid order date"),
  expectedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid expected delivery date"),
  fulfilmentStatus: z
    .enum(["ordered", "in_progress", "partially_fulfilled", "fulfilled", "issue", "cancelled"])
    .default("ordered"),
  deliveryNote: z.string().optional().nullable(),
});

export async function createVendorOrderAction(data: z.infer<typeof CreateVendorOrderSchema>) {
  const supabase = await createClient();
  const auth = await checkCostAuth(supabase);
  if (!auth.authorized || (!auth.isDirector && !auth.isPurchase)) {
    return { error: "Unauthorized: Only Director or Purchase may create vendor orders" };
  }

  const parsed = CreateVendorOrderSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { error } = await supabase.from("vendor_orders").insert({
    project_id: parsed.data.projectId,
    category_id: parsed.data.categoryId,
    kind: parsed.data.kind,
    vendor_name: parsed.data.vendorName,
    description: parsed.data.description,
    amount_excl_gst: parsed.data.amountExclGst,
    gst_amount: parsed.data.gstAmount,
    order_date: parsed.data.orderDate,
    expected_delivery_date: parsed.data.expectedDeliveryDate,
    fulfilment_status: parsed.data.fulfilmentStatus,
    delivery_note: parsed.data.deliveryNote || null,
    created_by: auth.user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/x9admin/projects/${parsed.data.projectId}`);
  revalidatePath("/x9admin/payables");
  revalidatePath("/x9admin");
  revalidatePath("/employee");
  return { success: true };
}

// 3. Update Vendor Order Status & Delivery (Director or Purchase)
const UpdateVendorOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  projectId: z.string().uuid(),
  fulfilmentStatus: z.enum(["ordered", "in_progress", "partially_fulfilled", "fulfilled", "issue", "cancelled"]),
  expectedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  deliveryNote: z.string().optional().nullable(),
});

export async function updateVendorOrderStatusAction(
  orderId: string,
  projectId: string,
  fulfilmentStatus: "ordered" | "in_progress" | "partially_fulfilled" | "fulfilled" | "issue" | "cancelled",
  expectedDeliveryDate?: string,
  deliveryNote?: string | null
) {
  const supabase = await createClient();
  const auth = await checkCostAuth(supabase);
  if (!auth.authorized || (!auth.isDirector && !auth.isPurchase)) {
    return { error: "Unauthorized: Only Director or Purchase may update vendor orders" };
  }

  const parsed = UpdateVendorOrderStatusSchema.safeParse({
    orderId,
    projectId,
    fulfilmentStatus,
    expectedDeliveryDate,
    deliveryNote,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const updatePayload: Record<string, unknown> = {
    fulfilment_status: parsed.data.fulfilmentStatus,
    delivery_note: parsed.data.deliveryNote || null,
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.expectedDeliveryDate) {
    updatePayload.expected_delivery_date = parsed.data.expectedDeliveryDate;
  }

  const { error } = await supabase
    .from("vendor_orders")
    .update(updatePayload)
    .eq("id", orderId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/x9admin/projects/${projectId}`);
  revalidatePath("/x9admin/payables");
  revalidatePath("/x9admin");
  revalidatePath("/employee");
  return { success: true };
}

// 4. Create Bill (Director or Accounts per Section 5)
const CreateBillSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  categoryId: z.string().uuid("Invalid category ID"),
  vendorOrderId: z.string().uuid().optional().nullable(),
  billType: z.enum(["supplier_bill", "subcontractor_bill", "direct_expense"]),
  vendorName: z.string().min(1, "Vendor name is required"),
  billNumber: z.string().min(1, "Bill number is required"),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid bill date"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid due date"),
  amountExclGst: z.coerce.number().min(0, "Amount must be non-negative"),
  gstAmount: z.coerce.number().min(0, "GST amount must be non-negative").default(0),
  note: z.string().optional().nullable(),
});

export async function createBillAction(data: z.infer<typeof CreateBillSchema>) {
  const supabase = await createClient();
  const auth = await checkCostAuth(supabase);
  if (!auth.authorized || (!auth.isDirector && !auth.isAccounts)) {
    return { error: "Unauthorized: Only Director or Accounts may enter bills" };
  }

  const parsed = CreateBillSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { error } = await supabase.from("bills").insert({
    project_id: parsed.data.projectId,
    category_id: parsed.data.categoryId,
    vendor_order_id: parsed.data.vendorOrderId || null,
    bill_type: parsed.data.billType,
    vendor_name: parsed.data.vendorName,
    bill_number: parsed.data.billNumber,
    bill_date: parsed.data.billDate,
    due_date: parsed.data.dueDate,
    amount_excl_gst: parsed.data.amountExclGst,
    gst_amount: parsed.data.gstAmount,
    is_cancelled: false,
    note: parsed.data.note || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/x9admin/projects/${parsed.data.projectId}`);
  revalidatePath("/x9admin/payables");
  revalidatePath("/x9admin");
  revalidatePath("/employee");
  return { success: true };
}

// 5. Cancel Bill (Rule F13: Soft delete via is_cancelled = true)
export async function cancelBillAction(billId: string, projectId: string) {
  const supabase = await createClient();
  const auth = await checkCostAuth(supabase);
  if (!auth.authorized || (!auth.isDirector && !auth.isAccounts)) {
    return { error: "Unauthorized: Only Director or Accounts may cancel bills" };
  }

  const { error } = await supabase
    .from("bills")
    .update({ is_cancelled: true, updated_at: new Date().toISOString() })
    .eq("id", billId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/x9admin/projects/${projectId}`);
  revalidatePath("/x9admin/payables");
  revalidatePath("/x9admin");
  revalidatePath("/employee");
  return { success: true };
}

// 6. Create Bill Payment (Director or Accounts per Section 5 & Rule A12)
const CreateBillPaymentSchema = z.object({
  billId: z.string().uuid("Invalid bill ID"),
  projectId: z.string().uuid("Invalid project ID"),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid payment date"),
  amountPaid: z.coerce.number().positive("Amount paid must be greater than 0"),
  tdsAmount: z.coerce.number().min(0, "TDS amount must be non-negative").default(0),
  mode: z.enum(["bank_transfer", "cheque", "cash", "upi", "other"]).default("bank_transfer"),
  reference: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export async function createBillPaymentAction(data: z.infer<typeof CreateBillPaymentSchema>) {
  const supabase = await createClient();
  const auth = await checkCostAuth(supabase);
  if (!auth.authorized || (!auth.isDirector && !auth.isAccounts)) {
    return { error: "Unauthorized: Only Director or Accounts may record bill payments" };
  }

  const parsed = CreateBillPaymentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { error } = await supabase.from("bill_payments").insert({
    bill_id: parsed.data.billId,
    payment_date: parsed.data.paymentDate,
    amount_paid: parsed.data.amountPaid,
    tds_amount: parsed.data.tdsAmount,
    mode: parsed.data.mode,
    reference: parsed.data.reference || null,
    note: parsed.data.note || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/x9admin/projects/${parsed.data.projectId}`);
  revalidatePath("/x9admin/payables");
  revalidatePath("/x9admin");
  revalidatePath("/employee");
  return { success: true };
}

// 7. Settings: Create Cost Category (Director Only)
const CreateCostCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").trim(),
});

export async function createCostCategoryAction(name: string) {
  const supabase = await createClient();
  const auth = await checkCostAuth(supabase);
  if (!auth.authorized || !auth.isDirector) {
    return { error: "Unauthorized: Only the Director can manage cost categories (Section 5)" };
  }

  const parsed = CreateCostCategorySchema.safeParse({ name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { error } = await supabase.from("cost_categories").insert({
    name: parsed.data.name,
    is_active: true,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/x9admin/settings");
  return { success: true };
}

// 8. Settings: Update Cost Category (Director Only)
const UpdateCostCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Category name is required").trim(),
  isActive: z.boolean(),
});

export async function updateCostCategoryAction(id: string, name: string, isActive: boolean) {
  const supabase = await createClient();
  const auth = await checkCostAuth(supabase);
  if (!auth.authorized || !auth.isDirector) {
    return { error: "Unauthorized: Only the Director can manage cost categories" };
  }

  const parsed = UpdateCostCategorySchema.safeParse({ id, name, isActive });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { error } = await supabase
    .from("cost_categories")
    .update({
      name: parsed.data.name,
      is_active: parsed.data.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/x9admin/settings");
  return { success: true };
}
