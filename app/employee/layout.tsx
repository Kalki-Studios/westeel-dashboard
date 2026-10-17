"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  CheckSquare,
  AlertCircle,
  Briefcase,
  Camera,
  FileText,
  PhoneCall,
  Receipt,
  Truck,
  Building,
  UserCheck,
  Lock,
  KeyRound,
  LogOut,
  ArrowRight,
} from "lucide-react";

type RoleKey = "site_engineer" | "sales" | "accounts" | "purchase_pm";

interface RoleConfig {
  key: RoleKey;
  label: string;
  passcodes: string[];
}

const ROLES: RoleConfig[] = [
  {
    key: "site_engineer",
    label: "Site Engineer",
    passcodes: ["site", "site2026", "site123"],
  },
  {
    key: "sales",
    label: "Sales Quick-Log",
    passcodes: ["sales", "sales2026", "sales123"],
  },
  {
    key: "accounts",
    label: "Accounts",
    passcodes: ["accounts", "accounts2026", "acc123"],
  },
  {
    key: "purchase_pm",
    label: "Purchase & PM",
    passcodes: ["purchase", "pm", "purchase2026", "pm2026"],
  },
];

const MODULE_GROUPS = [
  {
    category: "General",
    role: "general",
    items: [
      { label: "My Work", href: "/employee", icon: Briefcase },
      { label: "My Tasks", href: "/employee/tasks", icon: CheckSquare },
      { label: "Raise an Issue", href: "/employee/raise-issue", icon: AlertCircle },
    ],
  },
  {
    category: "Site Engineer",
    role: "site_engineer",
    items: [
      { label: "Daily Site Report", href: "/employee/site-report", icon: Camera },
      { label: "My Submitted Reports", href: "/employee/my-reports", icon: FileText },
    ],
  },
  {
    category: "Sales Quick-Log",
    role: "sales",
    items: [
      { label: "Quick-Log (Call/Visit)", href: "/employee/quick-log", icon: PhoneCall },
      { label: "My Enquiries", href: "/employee/enquiries", icon: FileText },
    ],
  },
  {
    category: "Accounts",
    role: "accounts",
    items: [
      { label: "Invoices & Receipts", href: "/employee/invoices", icon: Receipt },
      { label: "Bills & Payments", href: "/employee/bills", icon: FileText },
    ],
  },
  {
    category: "Purchase & PM",
    role: "purchase_pm",
    items: [
      { label: "Vendor Orders", href: "/employee/vendor-orders", icon: Truck },
      { label: "Review Site Reports", href: "/employee/review-reports", icon: UserCheck },
    ],
  },
];

const subscribeStorage = (callback: () => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

const getClientRole = (): RoleKey | null => {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem("westeel_employee_role") as RoleKey) || null;
};

const getServerRole = (): RoleKey | null => null;

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const storedRole = useSyncExternalStore(subscribeStorage, getClientRole, getServerRole);
  const [activeRole, setActiveRole] = useState<RoleKey | null>(null);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const currentRole = activeRole ?? storedRole;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanPass = passcode.trim().toLowerCase();

    const matched = ROLES.find((r) =>
      r.passcodes.some((p) => p.toLowerCase() === cleanPass)
    );

    if (matched) {
      setActiveRole(matched.key);
      try {
        localStorage.setItem("westeel_employee_role", matched.key);
      } catch {
        // Ignore storage errors in restricted contexts
      }
      setPasscode("");
    } else {
      setError("Invalid passcode. Please check with your department supervisor.");
    }
  };

  const handleLock = () => {
    try {
      localStorage.removeItem("westeel_employee_role");
    } catch {
      // Ignore storage errors
    }
    setActiveRole(null);
    setPasscode("");
    setError(null);
    window.location.reload();
  };

  // LOCKED STATE: Show Passcode Input Box
  if (!currentRole) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 text-slate-100">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-200 mx-auto shadow-inner">
              <KeyRound className="w-6 h-6 text-amber-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Employee Portal Access
            </h1>
            <p className="text-xs text-slate-400">
              Enter your department password to unlock your workspace.
            </p>
          </div>

          <form
            onSubmit={handleUnlock}
            className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-4 shadow-xl"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="passcode"
                className="text-xs font-semibold uppercase tracking-wider text-slate-300 block"
              >
                Role Password
              </label>
              <div className="relative">
                <input
                  id="passcode"
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter passcode..."
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
              </div>
            </div>

            {error && (
              <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-md px-3 py-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <span>Unlock Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 text-center">
              Roles: Site Engineer • Sales • Accounts • Purchase &amp; PM
            </div>
          </form>

          <div className="text-center">
            <Link
              href="/"
              className="text-xs text-slate-500 hover:text-slate-400 transition"
            >
              ← Back to Main Screen
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // UNLOCKED STATE: Filter sidebar to General + Matched Role Only
  const activeRoleConfig = ROLES.find((r) => r.key === currentRole);
  const visibleGroups = MODULE_GROUPS.filter(
    (g) => g.role === "general" || g.role === currentRole
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm px-4 md:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <Building className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold tracking-tight text-sm text-slate-100 leading-none">
              WESTEEL
            </div>
            <div className="text-[10px] text-slate-400 font-mono tracking-wider mt-0.5">
              EMPLOYEE PORTAL
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-200 font-medium">
              {activeRoleConfig?.label ?? "Staff"}
            </span>
          </div>

          <button
            onClick={handleLock}
            title="Lock Portal"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lock</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/30 p-3 shrink-0">
          <div className="space-y-4">
            {visibleGroups.map((group) => (
              <div key={group.category} className="space-y-1">
                <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.category}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors text-xs font-medium"
                      >
                        <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
