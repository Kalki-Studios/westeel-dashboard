import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { createEmployeePortalClient as createClient } from "@/lib/supabase/server-employee";
import { employeeLogoutAction as logoutAction } from "@/lib/auth/employee-actions";
import { EmployeeLoginGate } from "./employee-login-gate";
import { AppShell } from "@/components/app-shell";
import { UnderConstruction } from "@/components/under-construction";
import { getSiteFlags } from "@/lib/settings/flags";
import {
  CheckSquare,
  AlertCircle,
  Briefcase,
  Camera,
  FileText,
  PhoneCall,
  Receipt,
  Truck,
  UserCheck,
  LogOut,
  ChevronRight,
  TrendingUp,
  Mail,
  Loader2,
} from "lucide-react";

const MODULE_GROUPS = [
  {
    category: "General",
    roles: ["general"],
    items: [
      { label: "My Work", href: "/employee", icon: Briefcase },
      { label: "My Tasks", href: "/employee/tasks", icon: CheckSquare },
      { label: "Raise an Issue", href: "/employee/raise-issue", icon: AlertCircle },
      { label: "Emails", href: "/employee/emails", icon: Mail },
    ],
  },
  {
    category: "Site Engineer",
    roles: ["site_engineer", "director"],
    items: [
      { label: "Daily Site Report", href: "/employee/site-report", icon: Camera },
      { label: "My Submitted Reports", href: "/employee/my-reports", icon: FileText },
      { label: "Project Drawings", href: "/employee/drawings", icon: FileText },
    ],
  },
  {
    category: "Sales Quick-Log",
    roles: ["sales", "director"],
    items: [
      { label: "Quick-Log (Call/Visit)", href: "/employee/quick-log", icon: PhoneCall },
      { label: "My Enquiries", href: "/employee/enquiries", icon: FileText },
      { label: "My Tracker Numbers", href: "/employee/enquiries?tab=tracker", icon: TrendingUp },
    ],
  },
  {
    category: "Accounts",
    roles: ["accounts", "director"],
    items: [
      { label: "Invoices & Receipts", href: "/employee/invoices", icon: Receipt },
      { label: "Bills & Payments", href: "/employee/bills", icon: FileText },
      { label: "Bank Balances", href: "/employee/bank-balances", icon: Receipt },
    ],
  },
  {
    category: "Purchase & PM",
    roles: ["project_manager", "purchase", "director"],
    items: [
      { label: "Vendor Orders", href: "/employee/vendor-orders", icon: Truck },
      { label: "Review Site Reports", href: "/employee/review-reports", icon: UserCheck },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  director: "Director",
  project_manager: "Project Manager",
  sales: "Sales Executive",
  sales_lead: "Sales: Lead Generation",
  sales_field: "Sales: Field Visits",
  accounts: "Accounts & Billing",
  site_engineer: "Site Engineer",
  purchase: "Purchase Officer",
};

async function EmployeeLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  if ((await getSiteFlags()).underConstruction) return <UnderConstruction />;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <EmployeeLoginGate />;
  }

  // Verify active status
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, designation, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return (
      <EmployeeLoginGate initialError="Your employee account is deactivated. Contact the director." />
    );
  }

  // Fetch roles
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = (userRoles || []).map((r) => r.role as string);

  // Filter visible module groups according to employee roles
  const visibleGroups = MODULE_GROUPS.filter((g) =>
    g.roles.includes("general") || g.roles.some((r) => roles.includes(r))
  );

  const primaryRole = roles[0] || "staff";
  const roleDisplayLabel =
    profile.designation || ROLE_LABELS[primaryRole] || "Operations";

  return (
    <AppShell
      sidebar={
      <aside className="w-full glass-sidebar rounded-2xl flex flex-col overflow-hidden h-full">
        {/* Brand Header */}
        <div className="h-18 border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <Link href="/employee" className="flex items-center gap-3 group">
            <Image
              src="/westeel-logo-cropped.png"
              alt="Westeel Logo"
              width={100}
              height={35}
              className="h-7 w-auto object-contain group-hover:opacity-80 transition-opacity"
              priority
            />
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 text-sm">
          {visibleGroups.map((group) => (
            <div key={group.category} className="space-y-1">
              <div className="px-2 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-900 block">
                {group.category}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center justify-between px-3 py-3 md:py-2.5 rounded-xl text-slate-800 hover:text-black hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all text-xs font-semibold"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-slate-600 group-hover:text-blue-600 transition-colors shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-100 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <div className="truncate">
              <p className="text-slate-900 font-bold text-xs truncate">
                {profile.full_name || "Employee"}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {roleDisplayLabel}
              </p>
            </div>
          </div>
        </div>
      </aside>
      }
      header={
        <div className="flex items-center gap-2 text-sm text-slate-800 font-medium min-w-0">
          <span className="text-slate-800 font-semibold hidden sm:inline">Field Operations</span>
          <span className="text-slate-400 hidden sm:inline">/</span>
          <span className="text-black font-bold truncate">{roleDisplayLabel}</span>
        </div>
      }
      actions={
        <>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full chip-blue text-xs font-bold text-blue-950">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            <span>{profile.full_name || roleDisplayLabel}</span>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign Out of Portal"
              aria-label="Sign Out"
              className="flex items-center gap-1.5 px-3.5 py-2 md:py-1.5 rounded-lg btn-spatial-glass text-xs transition cursor-pointer font-bold text-black"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </form>
        </>
      }
    >
      {children}
    </AppShell>
  );
}

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh glass-canvas flex items-center justify-center text-slate-400 gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
          <span>Loading Workspace...</span>
        </div>
      }
    >
      <EmployeeLayoutContent>{children}</EmployeeLayoutContent>
    </Suspense>
  );
}
