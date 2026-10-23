import Link from "next/link";
import Image from "next/image";
import { logoutAction } from "@/lib/auth/actions";
import { MfaEnrollmentBanner } from "./mfa-enrollment-banner";
import {
  LayoutDashboard,
  Building2,
  CheckSquare,
  ClipboardList,
  FileText,
  ShoppingBag,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  IndianRupee,
  TrendingUp,
  Users,
  Settings,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  {
    category: "Status & Operations",
    accent: "text-blue-600",
    items: [
      { label: "Overview", href: "/x9admin", icon: LayoutDashboard },
      { label: "Projects", href: "/x9admin/projects", icon: Building2 },
      { label: "Tasks & Issues", href: "/x9admin/tasks", icon: CheckSquare },
      { label: "Site Reports", href: "/x9admin/site-reports", icon: ClipboardList },
      { label: "Documents", href: "/x9admin/documents", icon: FileText },
      { label: "Vendor Orders", href: "/x9admin/orders", icon: ShoppingBag },
      { label: "Alerts", href: "/x9admin/alerts", icon: AlertTriangle },
    ],
  },
  {
    category: "Finance & Cash",
    accent: "text-orange-600",
    items: [
      { label: "Collections", href: "/x9admin/collections", icon: ArrowDownRight },
      { label: "Payables", href: "/x9admin/payables", icon: ArrowUpRight },
      { label: "Cash Flow", href: "/x9admin/cashflow", icon: IndianRupee },
    ],
  },
  {
    category: "Sales Tracker",
    accent: "text-blue-600",
    items: [
      { label: "Sales Tracker", href: "/x9admin/sales", icon: TrendingUp },
    ],
  },
  {
    category: "System & Governance",
    accent: "text-slate-500",
    items: [
      { label: "Employees", href: "/x9admin/employees", icon: Users },
      { label: "Settings", href: "/x9admin/settings", icon: Settings },
      { label: "Audit Log", href: "/x9admin/audit", icon: ShieldCheck },
    ],
  },
];

import { Suspense } from "react";
import { connection } from "next/server";
import { createAdminPortalClient as createClient } from "@/lib/supabase/server-admin";
import { DirectorGate } from "./director-gate";
import { checkDirectorMfaStatus } from "@/lib/auth/actions";
import { getSiteFlags } from "@/lib/settings/flags";
import { Loader2 } from "lucide-react";
import { AdminBreadcrumbs } from "./admin-breadcrumbs";
import { AppShell, DockLink } from "@/components/app-shell";


async function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  await connection();
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    flags,
  ] = await Promise.all([supabase.auth.getUser(), getSiteFlags()]);

  const mfaOff = !!flags.mfaOffUntil;
  let isDirector = false;
  let isAal2Verified = false;
  let mfaEnrolled = false;

  if (user) {
    const [{ data: roles }, { data: aal }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    isDirector = (roles || []).some((r) => r.role === "director");

    if (isDirector) {
      const required = aal?.nextLevel === "aal2";
      // Not enrolled: let them through to the setup screen below; dashboard stays locked.
      // Developer switch "2FA off": neither the code check nor the setup lock applies.
      mfaEnrolled = required || mfaOff;
      isAal2Verified = !required || aal?.currentLevel === "aal2" || mfaOff;
    }
  }

  if (!user || !isDirector || !isAal2Verified) {
    const hasActiveMfa = await checkDirectorMfaStatus();
    return <DirectorGate hasActiveMfa={hasActiveMfa} />;
  }

  if (!mfaEnrolled) {
    return (
      <div className="min-h-dvh glass-canvas flex flex-col items-center justify-center gap-4 p-4">
        <div className="w-full max-w-xl space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-slate-900">Set up two-factor login</h1>
            <p className="text-sm text-slate-700">
              The dashboard stays locked until Google Authenticator is paired.
            </p>
          </div>
          <MfaEnrollmentBanner />
          <form action={logoutAction} className="text-center">
            <button type="submit" className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer">
              Sign Out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      sidebar={
      <aside className="w-full glass-sidebar rounded-2xl flex flex-col overflow-hidden h-full">
        {/* Brand Header */}
        <div className="h-18 border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <Link href="/x9admin" className="flex items-center gap-3 group">
            <Image
              src="/westeel-logo-cropped.png"
              alt="Westeel Logo"
              width={110}
              height={40}
              className="h-8 w-auto object-contain group-hover:opacity-80 transition-opacity"
              priority
            />
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 text-sm">
          {NAV_ITEMS.map((group) => (
            <div key={group.category} className="space-y-1">
              <div className="px-2 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900 block">
                  {group.category}
                </span>
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
        <div className="p-3.5 border-t border-slate-100 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-700 font-semibold text-[11px]">Director</span>
            </div>
          </div>
        </div>
      </aside>
      }
      dock={
        <>
          <DockLink href="/x9admin" label="Overview" exact><LayoutDashboard className="w-5 h-5" /></DockLink>
          <DockLink href="/x9admin/employees" label="Employees"><Users className="w-5 h-5" /></DockLink>
          <DockLink href="/x9admin/settings" label="Settings"><Settings className="w-5 h-5" /></DockLink>
        </>
      }
      header={<AdminBreadcrumbs />}
      actions={
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-xs px-3 md:px-4 py-2 md:py-1.5 rounded-lg btn-spatial-glass transition cursor-pointer font-bold text-black"
          >
            Sign Out
          </button>
        </form>
      }
    >
      {mfaOff && (
        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs">
          Developer mode: Google Authenticator is switched off. Turn it back on in Settings → Developer.
        </div>
      )}
      {!mfaOff && <MfaEnrollmentBanner />}
      {children}
    </AppShell>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh glass-canvas flex items-center justify-center text-slate-400 gap-3 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span>Loading Dashboard...</span>
        </div>
      }
    >
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
