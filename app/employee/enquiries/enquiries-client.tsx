"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CustomerItem,
  EnquiryItem,
  QuotationItem,
  LeadSourceItem,
  LostReasonItem,
  FollowupKind,
} from "@/lib/sales/types";
import {
  createEnquiryAction,
  bookMeetingAction,
  markEnquiryLostAction,
  quickLogFollowupAction,
  createQuotationAction,
  updateQuotationStatusAction,
} from "@/lib/sales/actions";
import { evaluateQuotationValidity, isFollowupDue, mapEnquiryRecordToTrackerInput } from "@/lib/rules/sales";
import { getIstDateString } from "@/lib/rules/alerts";
import { formatMeeting } from "@/lib/sales/meeting";
import { SalesTrackerView } from "@/components/sales/sales-tracker-view";
import {
  TrendingUp,
  FileText,
  PhoneCall,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  X,
  Loader2,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  Briefcase,
  AlertCircle,
  Users,
} from "lucide-react";

interface EmployeeEnquiriesClientProps {
  enquiries: EnquiryItem[];
  quotations: QuotationItem[];
  customers: CustomerItem[];
  leadSources: LeadSourceItem[];
  lostReasons: LostReasonItem[];
  /** lead = only adds leads, field = only visits/closes, both = unrestricted */
  mode: "lead" | "field" | "both";
  fieldStaff: { id: string; full_name: string }[];
}

export function EmployeeEnquiriesClient({
  enquiries,
  quotations,
  customers,
  leadSources,
  lostReasons,
  mode,
  fieldStaff,
}: EmployeeEnquiriesClientProps) {
  const canAddLeads = mode !== "field";
  const canClose = mode !== "lead";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const todayIst = getIstDateString();

  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "quotations" || tabParam === "tracker" ? tabParam : "enquiries";

  const [activeTab, setActiveTab] = useState<"enquiries" | "quotations" | "tracker">(initialTab);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedEnquiryId, setExpandedEnquiryId] = useState<string | null>(null);

  const trackerEnquiries = useMemo(() => {
    return enquiries.map(mapEnquiryRecordToTrackerInput);
  }, [enquiries]);

  // Modals state
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [selectedEnquiryForQuickLog, setSelectedEnquiryForQuickLog] = useState<EnquiryItem | null>(null);

  const [isNewEnquiryOpen, setIsNewEnquiryOpen] = useState(false);
  const [meetingFor, setMeetingFor] = useState<EnquiryItem | null>(null);
  const [isNewQuotationOpen, setIsNewQuotationOpen] = useState(false);
  const [selectedEnquiryForQuotation, setSelectedEnquiryForQuotation] = useState<EnquiryItem | null>(null);

  const [isMarkLostOpen, setIsMarkLostOpen] = useState(false);
  const [selectedEnquiryForLost, setSelectedEnquiryForLost] = useState<EnquiryItem | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const formatRupees = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // KPIs
  const openEnquiries = enquiries.filter((e) => e.status === "open" || e.status === "quoted");
  const pipelineValue = openEnquiries.reduce(
    (sum, e) => sum + (Number(e.expected_value_excl_gst) || 0),
    0
  );
  const dueFollowupsCount = enquiries.filter(
    (e) => (e.status === "open" || e.status === "quoted") && isFollowupDue(e, todayIst)
  ).length;

  const filteredEnquiries = enquiries.filter((e) => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchCustomer = e.customer?.name?.toLowerCase().includes(q);
      const matchContact = e.customer?.contact_person?.toLowerCase().includes(q);
      if (!matchTitle && !matchCustomer && !matchContact) return false;
    }
    return true;
  });

  const filteredQuotations = quotations.filter((q) => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      const matchNum = q.quote_number.toLowerCase().includes(s);
      const matchTitle = q.enquiry?.title?.toLowerCase().includes(s);
      if (!matchNum && !matchTitle) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              My Sales Enquiries &amp; Quotations
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/employee/quick-log"
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 flex items-center gap-1.5 shadow-sm transition"
          >
            <PhoneCall className="w-3.5 h-3.5 text-orange-600" />
            <span>Quick-Log (&lt;10s)</span>
          </Link>
          {canAddLeads && <button
            onClick={() => setIsNewEnquiryOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Enquiry</span>
          </button>}
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-500 font-medium">My Active Pipeline</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {formatRupees(pipelineValue)}
            </div>
            <div className="text-[10px] text-slate-400">{openEnquiries.length} deals</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold">
            ₹
          </div>
        </div>

        <div
          className={`glass-panel p-4 rounded-xl flex items-center justify-between ${
            dueFollowupsCount > 0 ? "border-orange-300 bg-orange-50/20" : ""
          }`}
        >
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Follow-ups Due Today</div>
            <div
              className={`text-xl font-bold font-mono mt-1 ${
                dueFollowupsCount > 0 ? "text-orange-600" : "text-slate-900"
              }`}
            >
              {dueFollowupsCount}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-500 font-medium">My Quotations</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {quotations.length}
            </div>
            <div className="text-[10px] text-slate-400">
              {quotations.filter((q) => q.status === "sent").length} active
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <FileText className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => {
            setActiveTab("enquiries");
            setStatusFilter("all");
          }}
          className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition ${
            activeTab === "enquiries"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>My Enquiries ({enquiries.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("quotations");
            setStatusFilter("all");
          }}
          className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition ${
            activeTab === "quotations"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>My Quotations ({quotations.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("tracker");
            setStatusFilter("all");
          }}
          className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition ${
            activeTab === "tracker"
              ? "bg-orange-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>My Tracker Numbers</span>
        </button>
      </div>

      {/* Sales Tracker Numbers View (Rule S13) */}
      {activeTab === "tracker" && (
        <SalesTrackerView
          enquiries={trackerEnquiries}
          isDirector={false}
          title="My Sales Tracker Numbers"
        />
      )}

      {/* Enquiries View */}
      {activeTab === "enquiries" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="glass-panel p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search enquiry, customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {["all", "open", "quoted", "won", "lost"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg capitalize transition ${
                    statusFilter === st
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Title &amp; Customer</th>
                    <th className="py-3 px-3">Expected Value</th>
                    <th className="py-3 px-3">Next Follow-up</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEnquiries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        No enquiries found in this view.
                      </td>
                    </tr>
                  ) : (
                    filteredEnquiries.map((enq) => {
                      const isDue = isFollowupDue(enq, todayIst);
                      const isPast =
                        enq.next_followup_date && enq.next_followup_date < todayIst;

                      return (
                        <tr key={enq.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{enq.title}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {enq.customer?.name}
                              {enq.customer?.phone && (
                                <span className="ml-2 font-mono text-slate-400">
                                  {enq.customer.phone}
                                </span>
                              )}
                            </div>
                            {enq.meeting_at && (
                              <div className="text-[11px] text-blue-700 mt-0.5">
                                Meeting: {formatMeeting(enq.meeting_at)}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 font-mono font-semibold text-slate-900">
                            {formatRupees(enq.expected_value_excl_gst)}
                          </td>

                          <td className="py-3 px-3">
                            {enq.next_followup_date ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                                  isPast
                                    ? "bg-red-50 text-red-700 border-red-200 font-bold"
                                    : isDue
                                    ? "bg-orange-50 text-orange-700 border-orange-200 font-bold"
                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                }`}
                              >
                                <Calendar className="w-3 h-3" />
                                {enq.next_followup_date}
                                {isPast && " (Overdue)"}
                                {isDue && !isPast && " (Today)"}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px] italic">-</span>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                enq.status === "won"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : enq.status === "quoted"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : enq.status === "lost"
                                  ? "bg-slate-100 text-slate-600 border-slate-300"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {enq.status}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {mode !== "field" && enq.status === "open" && (
                                <button
                                  onClick={() => setMeetingFor(enq)}
                                  className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                                >
                                  {enq.meeting_at ? "Reschedule" : "Book meeting"}
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedEnquiryForQuickLog(enq);
                                  setIsQuickLogOpen(true);
                                }}
                                className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 flex items-center gap-1"
                              >
                                <PhoneCall className="w-3 h-3" />
                                <span>Log</span>
                              </button>

                              {canClose && enq.status !== "won" && enq.status !== "lost" && (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedEnquiryForQuotation(enq);
                                      setIsNewQuotationOpen(true);
                                    }}
                                    className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                                  >
                                    Quote
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedEnquiryForLost(enq);
                                      setIsMarkLostOpen(true);
                                    }}
                                    className="px-2 py-1 text-[11px] text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                                  >
                                    Lost
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Quotations View */}
      {activeTab === "quotations" && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Quote Number</th>
                  <th className="py-3 px-3">Enquiry</th>
                  <th className="py-3 px-3">Amount (Ex-GST)</th>
                  <th className="py-3 px-3">Validity</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      No quotations recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredQuotations.map((q) => {
                    const validity = evaluateQuotationValidity(q, todayIst);

                    return (
                      <tr key={q.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-blue-700">
                          {q.quote_number}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-900">
                          {q.enquiry?.title}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {formatRupees(q.amount_excl_gst)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono text-[11px] text-slate-700">
                            {q.validity_date || "-"}
                          </div>
                          {validity.isPassed && (
                            <span className="text-[10px] font-bold text-red-600">Expired</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              q.status === "accepted"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : q.status === "sent"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-slate-100 text-slate-700 border-slate-300"
                            }`}
                          >
                            {q.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {q.status === "draft" && (
                            <button
                              onClick={async () => {
                                startTransition(async () => {
                                  const fd = new FormData();
                                  fd.append("quotation_id", q.id);
                                  fd.append("status", "sent");
                                  const res = await updateQuotationStatusAction(null, fd);
                                  if (res.error) setErrorMsg(res.error);
                                  else {
                                    setSuccessMsg(`Quotation ${q.quote_number} marked as Sent`);
                                    router.refresh();
                                  }
                                });
                              }}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              Send Quote
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QUICK LOG MODAL */}
      {isQuickLogOpen && selectedEnquiryForQuickLog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-sm">
                Quick-Log for {selectedEnquiryForQuickLog.title}
              </h3>
              <button
                onClick={() => setIsQuickLogOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErrorMsg(null);
                const formData = new FormData(e.currentTarget);
                startTransition(async () => {
                  const res = await quickLogFollowupAction(null, formData);
                  if (res.error) setErrorMsg(res.error);
                  else {
                    setSuccessMsg("Follow-up logged successfully!");
                    setIsQuickLogOpen(false);
                    router.refresh();
                  }
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              <input
                type="hidden"
                name="enquiry_id"
                value={selectedEnquiryForQuickLog.id}
              />

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Type *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { kind: "call", label: "Call", icon: PhoneCall },
                    { kind: "meeting", label: "Meeting", icon: Users },
                    { kind: "site_visit", label: "Site Visit", icon: Building2 },
                    { kind: "note", label: "Note", icon: FileText },
                  ].map((item) => (
                    <label
                      key={item.kind}
                      className="cursor-pointer border border-slate-200 rounded-xl p-2 text-center flex flex-col items-center gap-1 hover:border-blue-400 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50/50 has-[:checked]:text-blue-700 transition"
                    >
                      <input
                        type="radio"
                        name="kind"
                        value={item.kind}
                        defaultChecked={item.kind === "call"}
                        className="sr-only"
                      />
                      <item.icon className="w-4 h-4" />
                      <span className="font-semibold text-[11px]">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Summary *
                </label>
                <textarea
                  name="summary"
                  required
                  rows={3}
                  placeholder="Details of call or meeting..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    name="followup_date"
                    defaultValue={todayIst}
                    required
                    className="w-full p-2 rounded-xl border border-slate-200 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Next Due
                  </label>
                  <input
                    type="date"
                    name="next_followup_date"
                    className="w-full p-2 rounded-xl border border-slate-200 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">
                  Attendees (optional)
                </label>
                <input
                  type="text"
                  name="attendees"
                  placeholder="e.g. Client director"
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickLogOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-1.5"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Log (&lt;10s)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOOK MEETING MODAL */}
      {meetingFor && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Book meeting: {meetingFor.title}</h3>
              <button onClick={() => setMeetingFor(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setErrorMsg(null);
                const formData = new FormData(e.currentTarget);
                startTransition(async () => {
                  const res = await bookMeetingAction(null, formData);
                  if (res.error) setErrorMsg(res.error);
                  else {
                    setSuccessMsg("Meeting booked");
                    setMeetingFor(null);
                    router.refresh();
                  }
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              <input type="hidden" name="id" value={meetingFor.id} />
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Meeting date and time *</label>
                <input
                  name="meeting_at"
                  type="datetime-local"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                />
              </div>
              {fieldStaff.length > 0 && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Field salesperson *</label>
                  <select
                    name="assigned_to"
                    required
                    defaultValue={meetingFor.assigned_to ?? ""}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="" disabled>
                      Select...
                    </option>
                    {fieldStaff.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setMeetingFor(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW ENQUIRY MODAL */}
      {isNewEnquiryOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-sm">Create New Enquiry</h3>
              <button
                onClick={() => setIsNewEnquiryOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErrorMsg(null);
                const formData = new FormData(e.currentTarget);
                startTransition(async () => {
                  const res = await createEnquiryAction(null, formData);
                  if (res.error) setErrorMsg(res.error);
                  else {
                    setSuccessMsg("Enquiry created successfully!");
                    setIsNewEnquiryOpen(false);
                    router.refresh();
                  }
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              {mode === "lead" && fieldStaff.length > 0 && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Assign to field salesperson *
                  </label>
                  <select
                    name="assigned_to"
                    required
                    defaultValue=""
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="" disabled>
                      Select...
                    </option>
                    {fieldStaff.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Meeting booked for</label>
                <input
                  name="meeting_at"
                  type="datetime-local"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Customer *
                </label>
                <select
                  name="customer_id"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="" disabled selected>
                    Select customer...
                  </option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.contact_person ? `(${c.contact_person})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Enquiry Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. PEB Godown Shed 8000 sq ft"
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Expected Value (Ex-GST)
                  </label>
                  <input
                    type="number"
                    name="expected_value_excl_gst"
                    defaultValue={0}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Lead Source
                  </label>
                  <select
                    name="source_id"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="">Direct / None</option>
                    {leadSources.map((src) => (
                      <option key={src.id} value={src.id}>
                        {src.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Next Follow-up Due
                </label>
                <input
                  type="date"
                  name="next_followup_date"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewEnquiryOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Enquiry</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW QUOTATION MODAL */}
      {isNewQuotationOpen && selectedEnquiryForQuotation && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-sm">
                Issue Quotation for {selectedEnquiryForQuotation.title}
              </h3>
              <button
                onClick={() => setIsNewQuotationOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErrorMsg(null);
                const formData = new FormData(e.currentTarget);
                startTransition(async () => {
                  const res = await createQuotationAction(null, formData);
                  if (res.error) setErrorMsg(res.error);
                  else {
                    setSuccessMsg(`Quotation ${res.quoteNumber || ""} generated!`);
                    setIsNewQuotationOpen(false);
                    router.refresh();
                  }
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              <input
                type="hidden"
                name="enquiry_id"
                value={selectedEnquiryForQuotation.id}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Amount (₹ Ex-GST) *
                  </label>
                  <input
                    type="number"
                    name="amount_excl_gst"
                    defaultValue={selectedEnquiryForQuotation.expected_value_excl_gst}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Version
                  </label>
                  <input
                    type="number"
                    name="version"
                    defaultValue={1}
                    min={1}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Initial Status
                  </label>
                  <select
                    name="status"
                    defaultValue="sent"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent to Client</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Validity Date
                  </label>
                  <input
                    type="date"
                    name="validity_date"
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Notes / Technical Inclusions
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Includes structural frame, purlins, sheeting..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewQuotationOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Generate Quote</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MARK LOST MODAL (Rule S5) */}
      {isMarkLostOpen && selectedEnquiryForLost && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-sm">
                Mark Lost
              </h3>
              <button
                onClick={() => setIsMarkLostOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErrorMsg(null);
                const formData = new FormData(e.currentTarget);
                startTransition(async () => {
                  const res = await markEnquiryLostAction(null, formData);
                  if (res.error) setErrorMsg(res.error);
                  else {
                    setSuccessMsg("Enquiry marked as Lost.");
                    setIsMarkLostOpen(false);
                    router.refresh();
                  }
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              <input
                type="hidden"
                name="enquiry_id"
                value={selectedEnquiryForLost.id}
              />

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-900">{selectedEnquiryForLost.title}</div>
                <div className="text-[11px] text-slate-500">{selectedEnquiryForLost.customer?.name}</div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Lost Reason *
                </label>
                <select
                  name="lost_reason_id"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="" disabled selected>
                    Select reason...
                  </option>
                  {lostReasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Lost Notes
                </label>
                <textarea
                  name="lost_note"
                  rows={2}
                  placeholder="Details on why deal was lost..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMarkLostOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Lost</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
