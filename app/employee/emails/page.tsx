import { Mail, Clock, Shield } from "lucide-react";

export default function EmployeeEmailsPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200/80 text-orange-600 shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  Emails & Inquiries
                </h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Placeholder Container */}
      <div className="p-12 text-center rounded-2xl glass-panel space-y-4 max-w-lg mx-auto mt-8">
        <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center mx-auto text-orange-600 shadow-xs">
          <Mail className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">Email System Coming Soon</h2>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full chip-blue text-[11px] font-semibold text-blue-900">
          <Clock className="w-3.5 h-3.5" />
          <span>Email Integration Inactive</span>
        </div>
      </div>
    </div>
  );
}
