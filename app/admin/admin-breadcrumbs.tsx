"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTE_LABELS: Record<string, string> = {
  "/x9admin": "Executive Dashboard",
  "/x9admin/projects": "Projects",
  "/x9admin/tasks": "Tasks & Issues",
  "/x9admin/site-reports": "Site Reports",
  "/x9admin/documents": "Documents",
  "/x9admin/orders": "Vendor Orders",
  "/x9admin/alerts": "Alerts",
  "/x9admin/collections": "Collections",
  "/x9admin/payables": "Payables",
  "/x9admin/cashflow": "Cash Flow",
  "/x9admin/sales": "Sales Tracker",
  "/x9admin/employees": "Employees",
  "/x9admin/settings": "Settings",
  "/x9admin/audit": "Audit Log",
};

function formatSegment(segment: string): string {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function AdminBreadcrumbs() {
  const pathname = usePathname();

  let pageTitle = ROUTE_LABELS[pathname];

  if (!pageTitle) {
    const segments = pathname.replace(/^\/x9admin\/?/, "").split("/").filter(Boolean);
    if (segments.length > 0) {
      const parentKey = `/x9admin/${segments[0]}`;
      const parentLabel = ROUTE_LABELS[parentKey] || formatSegment(segments[0]);
      if (segments.length === 1) {
        pageTitle = parentLabel;
      } else {
        pageTitle = `${parentLabel} / ${formatSegment(segments[segments.length - 1])}`;
      }
    } else {
      pageTitle = "Executive Dashboard";
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm text-slate-800 font-medium min-w-0">
      <Link
        href="/x9admin"
        className="hidden sm:inline text-slate-800 hover:text-black hover:underline font-semibold transition"
      >
        Dashboard
      </Link>
      <span className="hidden sm:inline text-slate-400">/</span>
      <span className="text-black font-bold truncate">{pageTitle}</span>
    </div>
  );
}
