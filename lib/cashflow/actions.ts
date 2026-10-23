"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addMonths, format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

type CashAuthResult =
  | {
      authorized: false;
      isDirector: false;
      isAccounts: false;
      user: null;
      error: string;
    }
  | {
      authorized: true;
      isDirector: boolean;
      isAccounts: boolean;
      user: User;
      error: null;
    };

async function checkCashAuth(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<CashAuthResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      isDirector: false,
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
  const isAccounts = roleList.includes("accounts");

  if (!isDirector && !isAccounts) {
    return {
      authorized: false,
      isDirector: false,
      isAccounts: false,
      user: null,
      error: "Unauthorized: Access restricted to Director or Accounts",
    };
  }

  return {
    authorized: true,
    isDirector,
    isAccounts,
    user,
    error: null,
  };
}

// -----------------------------------------------------------------------------
// 1. Create Bank Balance Entry (Director or Accounts)
// -----------------------------------------------------------------------------

const CreateBankBalanceSchema = z.object({
  accountLabel: z.string().trim().min(1, "Account label is required"),
  balance: z.coerce.number().min(0, "Balance must be non-negative"),
  asOfDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "As-of date must be YYYY-MM-DD"),
  note: z.string().trim().optional().nullable(),
});

export async function createBankBalanceAction(formData: FormData) {
  try {
    const supabase = await createClient();
    const auth = await checkCashAuth(supabase);
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }

    const parsed = CreateBankBalanceSchema.safeParse({
      accountLabel: formData.get("accountLabel"),
      balance: formData.get("balance"),
      asOfDate: formData.get("asOfDate"),
      note: formData.get("note") || null,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const { error: insertError } = await supabase.from("bank_balances").insert({
      account_label: parsed.data.accountLabel,
      balance: parsed.data.balance,
      as_of_date: parsed.data.asOfDate,
      note: parsed.data.note || null,
      recorded_by: auth.user.id,
    });

    if (insertError) {
      console.error("Error creating bank balance:", insertError);
      return { success: false, error: insertError.message };
    }

    revalidatePath("/x9admin/cashflow");
    revalidatePath("/x9admin/overview");
    revalidatePath("/x9admin");
    revalidatePath("/employee/bank-balances");
    revalidatePath("/employee/bills");

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to save bank balance";
    console.error("Unexpected error in createBankBalanceAction:", err);
    return { success: false, error: errorMsg };
  }
}

// -----------------------------------------------------------------------------
// 2. Delete Bank Balance Entry (Director Only)
// -----------------------------------------------------------------------------

export async function deleteBankBalanceAction(id: string) {
  try {
    const supabase = await createClient();
    const auth = await checkCashAuth(supabase);
    if (!auth.authorized || !auth.isDirector) {
      return { success: false, error: "Only Directors can delete balance records" };
    }

    const { error } = await supabase
      .from("bank_balances")
      .delete()
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/x9admin/cashflow");
    revalidatePath("/x9admin/overview");
    revalidatePath("/x9admin");
    revalidatePath("/employee/bank-balances");

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to delete balance";
    return { success: false, error: errorMsg };
  }
}

// -----------------------------------------------------------------------------
// 3. Create Company Cash Item (Director Only, with Repeat for N Months generator)
// -----------------------------------------------------------------------------

const CreateCompanyCashItemSchema = z.object({
  direction: z.enum(["inflow", "outflow"]),
  category: z.string().trim().min(1, "Category is required"),
  description: z.string().trim().min(1, "Description is required"),
  amount: z.coerce.number().min(0, "Amount must be non-negative"),
  expectedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date must be YYYY-MM-DD"),
  repeatMonths: z.coerce
    .number()
    .int()
    .min(1, "Repeat months must be at least 1")
    .max(24, "Repeat months cannot exceed 24")
    .default(1),
});

export async function createCompanyCashItemAction(formData: FormData) {
  try {
    const supabase = await createClient();
    const auth = await checkCashAuth(supabase);
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }

    // Section 5: Company cash items are RW for Director, R for Accounts
    if (!auth.isDirector) {
      return {
        success: false,
        error: "Unauthorized: Only the Director can add or edit company cash items",
      };
    }

    const parsed = CreateCompanyCashItemSchema.safeParse({
      direction: formData.get("direction"),
      category: formData.get("category"),
      description: formData.get("description"),
      amount: formData.get("amount"),
      expectedDate: formData.get("expectedDate"),
      repeatMonths: formData.get("repeatMonths") || 1,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const {
      direction,
      category,
      description,
      amount,
      expectedDate,
      repeatMonths,
    } = parsed.data;

    // Recurring generator (Brief line 506): "form allows 'repeat for N months', which creates N rows at creation"
    const recurringGroupId = repeatMonths > 1 ? crypto.randomUUID() : null;
    const baseDate = parseISO(expectedDate);

    const rowsToInsert = [];
    for (let i = 0; i < repeatMonths; i++) {
      const itemDate = addMonths(baseDate, i);
      const formattedDate = format(itemDate, "yyyy-MM-dd");

      rowsToInsert.push({
        direction,
        category,
        description,
        amount,
        expected_date: formattedDate,
        status: "planned",
        recurring_group_id: recurringGroupId,
        created_by: auth.user.id,
      });
    }

    const { error: insertError } = await supabase
      .from("company_cash_items")
      .insert(rowsToInsert);

    if (insertError) {
      console.error("Error creating company cash items:", insertError);
      return { success: false, error: insertError.message };
    }

    revalidatePath("/x9admin/cashflow");
    revalidatePath("/x9admin/overview");
    revalidatePath("/x9admin");

    return { success: true, count: rowsToInsert.length };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create cash items";
    console.error("Unexpected error in createCompanyCashItemAction:", err);
    return { success: false, error: errorMsg };
  }
}

// -----------------------------------------------------------------------------
// 4. Update Company Cash Item Status (Director Only)
// -----------------------------------------------------------------------------

const UpdateCompanyCashItemStatusSchema = z.object({
  id: z.string().uuid("Invalid cash item ID"),
  status: z.enum(["planned", "done", "cancelled"]),
});

export async function updateCompanyCashItemStatusAction(
  id: string,
  status: "planned" | "done" | "cancelled"
) {
  try {
    const supabase = await createClient();
    const auth = await checkCashAuth(supabase);
    if (!auth.authorized || !auth.isDirector) {
      return {
        success: false,
        error: "Unauthorized: Only the Director can update company cash items",
      };
    }

    const parsed = UpdateCompanyCashItemStatusSchema.safeParse({ id, status });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const { error } = await supabase
      .from("company_cash_items")
      .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/x9admin/cashflow");
    revalidatePath("/x9admin/overview");
    revalidatePath("/x9admin");

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update status";
    return { success: false, error: errorMsg };
  }
}
