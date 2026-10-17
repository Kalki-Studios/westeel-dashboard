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
} from "lucide-react";

const EMPLOYEE_MODULES = [
  {
    category: "General",
    items: [
      { label: "My Work", href: "/employee", icon: Briefcase },
      { label: "My Tasks", href: "/employee/tasks", icon: CheckSquare },
      { label: "Raise an Issue", href: "/employee/raise-issue", icon: AlertCircle },
    ],
  },
  {
    category: "Site Engineer",
    items: [
      { label: "Daily Site Report", href: "/employee/site-report", icon: Camera },
      { label: "My Submitted Reports", href: "/employee/my-reports", icon: FileText },
    ],
  },
  {
    category: "Sales Quick-Log",
    items: [
      { label: "Quick-Log (Call/Visit)", href: "/employee/quick-log", icon: PhoneCall },
      { label: "My Enquiries", href: "/employee/enquiries", icon: FileText },
    ],
  },
  {
    category: "Accounts",
    items: [
      { label: "Invoices & Receipts", href: "/employee/invoices", icon: Receipt },
      { label: "Bills & Payments", href: "/employee/bills", icon: FileText },
    ],
  },
  {
    category: "Purchase & PM",
    items: [
      { label: "Vendor Orders", href: "/employee/vendor-orders", icon: Truck },
      { label: "Review Site Reports", href: "/employee/review-reports", icon: UserCheck },
    ],
  },
];

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-medium">
            Staff Session
          </span>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/30 p-3 shrink-0">
          <div className="space-y-4">
            {EMPLOYEE_MODULES.map((group) => (
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
