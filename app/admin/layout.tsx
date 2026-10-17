import Link from "next/link";
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
  Building,
} from "lucide-react";

const NAV_ITEMS = [
  {
    category: "Priority 1: Status & Delays",
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
    category: "Priority 2: Finance & Cash",
    items: [
      { label: "Collections", href: "/x9admin/collections", icon: ArrowDownRight },
      { label: "Payables", href: "/x9admin/payables", icon: ArrowUpRight },
      { label: "Cash Flow", href: "/x9admin/cashflow", icon: IndianRupee },
    ],
  },
  {
    category: "Priority 3: Sales Tracker",
    items: [
      { label: "Sales Tracker", href: "/x9admin/sales", icon: TrendingUp },
    ],
  },
  {
    category: "System & Governance",
    items: [
      { label: "Employees", href: "/x9admin/employees", icon: Users },
      { label: "Settings", href: "/x9admin/settings", icon: Settings },
      { label: "Audit Log", href: "/x9admin/audit", icon: ShieldCheck },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/70 backdrop-blur-sm flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold tracking-tight text-sm text-slate-100 leading-none">
                WESTEEL
              </div>
              <div className="text-[10px] text-slate-400 font-mono tracking-wider mt-0.5">
                DIRECTOR PORTAL
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            V1
          </span>
        </div>

        {/* Navigation Modules */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 text-sm">
          {NAV_ITEMS.map((group) => (
            <div key={group.category} className="space-y-1">
              <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {group.category}
              </div>
              <div className="space-y-0.5 pt-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors text-xs font-medium"
                    >
                      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Role Switch */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-300 font-medium">Director</span>
            </div>
            <Link
              href="/employee"
              className="text-[11px] text-amber-400 hover:text-amber-300 underline font-mono"
            >
              Employee View →
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-800 bg-slate-900/40 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Director</span>
            <span>/</span>
            <span className="text-slate-200 font-medium">Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-slate-800/80 border border-slate-700 text-slate-300 font-mono">
              IST (UTC+5:30)
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                Sign Out
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          <MfaEnrollmentBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
