import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmployeeTable } from "./employee-table";
import { EmployeeProfile, AppRole } from "@/lib/auth/types";
import { Loader2 } from "lucide-react";

async function EmployeeContent() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  // Fetch profiles
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, phone, designation, is_active, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (profileError) {
    return (
      <div className="p-6 text-rose-400 bg-rose-950/20 border border-rose-900 rounded-lg text-xs">
        Failed to load employee profiles: {profileError.message}
      </div>
    );
  }

  // Fetch roles
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("user_id, role");

  // Fetch auth emails via admin client
  const { data: authData } = await adminSupabase.auth.admin.listUsers({
    perPage: 100,
  });

  const authUserMap = new Map((authData?.users || []).map((u) => [u.id, u.email]));

  // Build employee models
  const employees: EmployeeProfile[] = (profiles || []).map((p) => {
    const roles = (userRoles || [])
      .filter((ur) => ur.user_id === p.id)
      .map((ur) => ur.role as AppRole);

    return {
      id: p.id,
      email: authUserMap.get(p.id) || undefined,
      fullName: p.full_name,
      phone: p.phone,
      designation: p.designation,
      isActive: p.is_active,
      roles,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  });

  return <EmployeeTable initialEmployees={employees} />;
}

export default function AdminEmployeesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          <span>Loading employee directory...</span>
        </div>
      }
    >
      <EmployeeContent />
    </Suspense>
  );
}
