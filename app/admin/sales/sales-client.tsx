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
  QuotationStatus,
} from "@/lib/sales/types";
import {
  createCustomerAction,
  createEnquiryAction,
  markEnquiryLostAction,
  quickLogFollowupAction,
  createQuotationAction,
  updateQuotationStatusAction,
  convertQuotationToProjectAction,
} from "@/lib/sales/actions";
import { SalesAlertItem } from "@/lib/sales/queries";
import { downloadCsvInBrowser } from "@/lib/billing/csv";
import { evaluateQuotationValidity, isFollowupDue, mapEnquiryRecordToTrackerInput } from "@/lib/rules/sales";
import { getIstDateString } from "@/lib/rules/alerts";
import { SalesTrackerView } from "@/components/sales/sales-tracker-view";
import {
  TrendingUp,
  Users,
  FileText,
  PhoneCall,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Download,
  Plus,
  Search,
  Filter,
  X,
  Loader2,
  Building2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Clock,
  Briefcase,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

interface SalesWorkspaceClientProps {
  initialEnquiries: EnquiryItem[];
  initialQuotations: QuotationItem[];
  initialCustomers: CustomerItem[];
  leadSources: LeadSourceItem[];
  lostReasons: LostReasonItem[];
  salespeople: { id: string; full_name: string }[];
  salesAlerts: SalesAlertItem[];
}

export function SalesWorkspaceClient({
  initialEnquiries,
  initialQuotations,
  initialCustomers,
  leadSources,
  lostReasons,
  salespeople,
  salesAlerts,
}: SalesWorkspaceClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const todayIst = getIstDateString();

  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "enquiries" || tabParam === "quotations" || tabParam === "customers"
      ? tabParam
      : "tracker";

  // Active top-level tab
  const [activeTab, setActiveTab] = useState<"tracker" | "enquiries" | "quotations" | "customers">(initialTab);

  // Mapped tracker inputs for Sales Tracker engine
  const trackerEnquiries = useMemo(() => {
    return initialEnquiries.map(mapEnquiryRecordToTrackerInput);
  }, [initialEnquiries]);

  // Filtering states - Enquiries
  const [enquirySearch, setEnquirySearch] = useState("");
  const [enquiryStatusFilter, setEnquiryStatusFilter] = useState<string>("all");
  const [enquirySalespersonFilter, setEnquirySalespersonFilter] = useState<string>("all");
  const [enquirySourceFilter, setEnquirySourceFilter] = useState<string>("all");
  const [expandedEnquiryId, setExpandedEnquiryId] = useState<string | null>(null);

  // Filtering states - Quotations
  const [quotationSearch, setQuotationSearch] = useState("");
  const [quotationStatusFilter, setQuotationStatusFilter] = useState<string>("all");

  // Filtering states - Customers
  const [customerSearch, setCustomerSearch] = useState("");

  // Modals state
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [selectedEnquiryForQuickLog, setSelectedEnquiryForQuickLog] = useState<EnquiryItem | null>(null);

  const [isNewEnquiryOpen, setIsNewEnquiryOpen] = useState(false);
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [isNewQuotationOpen, setIsNewQuotationOpen] = useState(false);
  const [selectedEnquiryForQuotation, setSelectedEnquiryForQuotation] = useState<EnquiryItem | null>(null);

  const [isMarkLostOpen, setIsMarkLostOpen] = useState(false);
  const [selectedEnquiryForLost, setSelectedEnquiryForLost] = useState<EnquiryItem | null>(null);

  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [selectedQuotationForConvert, setSelectedQuotationForConvert] = useState<QuotationItem | null>(null);

  // Status message state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Helper formatting for currency
  const formatRupees = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // KPI Calculations
  const openOrQuotedEnquiries = initialEnquiries.filter(
    (e) => e.status === "open" || e.status === "quoted"
  );
  const openPipelineValue = openOrQuotedEnquiries.reduce(
    (sum, e) => sum + (Number(e.expected_value_excl_gst) || 0),
    0
  );
  const dueFollowupsCount = initialEnquiries.filter(
    (e) => (e.status === "open" || e.status === "quoted") && isFollowupDue(e, todayIst)
  ).length;

  const activeQuotations = initialQuotations.filter(
    (q) => q.status === "sent" || q.status === "negotiating"
  );
  const activeQuotationsValue = activeQuotations.reduce(
    (sum, q) => sum + (Number(q.amount_excl_gst) || 0),
    0
  );

  const expiredQuotationsCount = initialQuotations.filter((q) => {
    const val = evaluateQuotationValidity(q, todayIst);
    return val.isPassed;
  }).length;

  // Filtered enquiries
  const filteredEnquiries = initialEnquiries.filter((e) => {
    if (enquiryStatusFilter !== "all" && e.status !== enquiryStatusFilter) return false;
    if (enquirySalespersonFilter !== "all" && e.assigned_to !== enquirySalespersonFilter) return false;
    if (enquirySourceFilter !== "all" && e.source_id !== enquirySourceFilter) return false;
    if (enquirySearch.trim()) {
      const q = enquirySearch.toLowerCase();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchCustomer = e.customer?.name?.toLowerCase().includes(q);
      const matchContact = e.customer?.contact_person?.toLowerCase().includes(q);
      const matchPhone = e.customer?.phone?.toLowerCase().includes(q);
      if (!matchTitle && !matchCustomer && !matchContact && !matchPhone) return false;
    }
    return true;
  });

  // Filtered quotations
  const filteredQuotations = initialQuotations.filter((q) => {
    if (quotationStatusFilter !== "all" && q.status !== quotationStatusFilter) return false;
    if (quotationSearch.trim()) {
      const s = quotationSearch.toLowerCase();
      const matchNumber = q.quote_number.toLowerCase().includes(s);
      const matchEnquiry = q.enquiry?.title?.toLowerCase().includes(s);
      const matchCustomer = q.enquiry?.customer?.name?.toLowerCase().includes(s);
      if (!matchNumber && !matchEnquiry && !matchCustomer) return false;
    }
    return true;
  });

  // Filtered customers
  const filteredCustomers = initialCustomers.filter((c) => {
    if (!customerSearch.trim()) return true;
    const s = customerSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      (c.contact_person && c.contact_person.toLowerCase().includes(s)) ||
      (c.phone && c.phone.includes(s)) ||
      (c.email && c.email.toLowerCase().includes(s))
    );
  });

  // Export Enquiries CSV Handler
  const handleExportCsv = () => {
    const headers = [
      "Enquiry Title",
      "Customer",
      "Contact Person",
      "Phone",
      "Expected Value (Ex-GST)",
      "Status",
      "Lead Source",
      "Assigned Salesperson",
      "Next Follow-up Date",
      "Lost Reason",
      "Lost Note",
      "Created Date",
    ];

    const rows = filteredEnquiries.map((e) => [
      e.title,
      e.customer?.name || "",
      e.customer?.contact_person || "",
      e.customer?.phone || "",
      e.expected_value_excl_gst,
      e.status,
      e.source?.name || "",
      e.assigned_person?.full_name || "",
      e.next_followup_date || "",
      e.lost_reason?.name || "",
      e.lost_note || "",
      e.created_at ? e.created_at.split("T")[0] : "",
    ]);

    const escapeCsv = (str: string | number) => {
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const csvContent = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\r\n");

    downloadCsvInBrowser(`westeel-enquiries-${todayIst}.csv`, csvContent);
  };

  // Quick action: Open Quick-Log for specific enquiry
  const openQuickLogFor = (enquiry: EnquiryItem) => {
    setSelectedEnquiryForQuickLog(enquiry);
    setIsQuickLogOpen(true);
  };

  // Quick action: Open Quotation for specific enquiry
  const openQuotationFor = (enquiry: EnquiryItem) => {
    setSelectedEnquiryForQuotation(enquiry);
    setIsNewQuotationOpen(true);
  };

  // Quick action: Open Mark Lost for specific enquiry
  const openMarkLostFor = (enquiry: EnquiryItem) => {
    setSelectedEnquiryForLost(enquiry);
    setIsMarkLostOpen(true);
  };

  // Quick action: Open Convert for specific quotation
  const openConvertFor = (quotation: QuotationItem) => {
    setSelectedQuotationForConvert(quotation);
    setIsConvertOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Sales Pipeline
              </h1>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </button>
          <button
            onClick={() => {
              setSelectedEnquiryForQuickLog(null);
              setIsQuickLogOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 flex items-center gap-1.5 shadow-sm transition"
          >
            <PhoneCall className="w-3.5 h-3.5 text-orange-600" />
            Quick-Log Follow-up
          </button>
          <button
            onClick={() => setIsNewCustomerOpen(true)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-sm transition"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            + Customer
          </button>
          <button
            onClick={() => setIsNewEnquiryOpen(true)}
            className="px-4 py-2 text-xs font-semibold rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-md shadow-blue-600/25 transition"
          >
            <Plus className="w-4 h-4" />
            New Enquiry
          </button>
        </div>
      </div>

      {/* Global Alerts / Feedback banner */}
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

      {/* Sales Alerts Banner (Rule S10 & S11) */}
      {salesAlerts.length > 0 && (
        <div className="glass-panel p-4 rounded-2xl border-orange-200 bg-orange-50/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-orange-900">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <span>Active Sales Alerts ({salesAlerts.length})</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {salesAlerts.map((a) => (
              <div
                key={a.id}
                className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
                  a.severity === "critical"
                    ? "bg-red-50 border-red-200 text-red-900"
                    : a.severity === "high"
                    ? "bg-orange-50 border-orange-200 text-orange-900"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
              >
                <div>
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-[11px] opacity-85 mt-0.5">{a.description}</div>
                </div>
                <div className="mt-2 text-[10px] opacity-75 font-mono flex items-center justify-between">
                  <span>Due: {a.date}</span>
                  <span className="uppercase font-bold">{a.kind.replace("_", " ")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Open Pipeline (Rule S10) */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Open Pipeline</span>
            <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              {openOrQuotedEnquiries.length} enquiries
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {formatRupees(openPipelineValue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Status in Open or Quoted
          </div>
        </div>

        {/* Card 2: Follow-ups Due (Rule S10) */}
        <div
          className={`glass-panel p-5 rounded-2xl flex flex-col justify-between ${
            dueFollowupsCount > 0 ? "border-orange-300 bg-orange-50/20" : ""
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Follow-ups Due Today</span>
            {dueFollowupsCount > 0 ? (
              <span className="font-mono text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200 font-bold">
                {dueFollowupsCount} due
              </span>
            ) : (
              <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                All clear
              </span>
            )}
          </div>
          <div
            className={`text-2xl font-bold font-mono mt-2 ${
              dueFollowupsCount > 0 ? "text-orange-600" : "text-slate-900"
            }`}
          >
            {dueFollowupsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            next_followup_date &le; today
          </div>
        </div>

        {/* Card 3: Active Quotations */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Active Quotations</span>
            <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
              {activeQuotations.length} sent
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {formatRupees(activeQuotationsValue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Sent / Negotiating status
          </div>
        </div>

        {/* Card 4: Quotation Validity Passed (Rule S11) */}
        <div
          className={`glass-panel p-5 rounded-2xl flex flex-col justify-between ${
            expiredQuotationsCount > 0 ? "border-red-300 bg-red-50/20" : ""
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Validity Expired</span>
            {expiredQuotationsCount > 0 ? (
              <span className="font-mono text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-200 font-bold">
                {expiredQuotationsCount} expired
              </span>
            ) : (
              <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                0 expired
              </span>
            )}
          </div>
          <div
            className={`text-2xl font-bold font-mono mt-2 ${
              expiredQuotationsCount > 0 ? "text-red-600" : "text-slate-900"
            }`}
          >
            {expiredQuotationsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Alert only, status retained
          </div>
        </div>
      </div>

      {/* 3. Tabbed Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("tracker")}
          className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition ${
            activeTab === "tracker"
              ? "bg-orange-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Sales Tracker</span>
        </button>

        <button
          onClick={() => setActiveTab("enquiries")}
          className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition ${
            activeTab === "enquiries"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Enquiries &amp; Pipeline</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "enquiries" ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-700"
            }`}
          >
            {initialEnquiries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("quotations")}
          className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition ${
            activeTab === "quotations"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Quotation Register</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "quotations" ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-700"
            }`}
          >
            {initialQuotations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("customers")}
          className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition ${
            activeTab === "customers"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customers Directory</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "customers" ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-700"
            }`}
          >
            {initialCustomers.length}
          </span>
        </button>
      </div>

      {/* 4. TAB 0: SALES TRACKER DASHBOARD (S6 to S10) */}
      {activeTab === "tracker" && (
        <SalesTrackerView
          enquiries={trackerEnquiries}
          isDirector={true}
          title="Director Sales Tracker"
        />
      )}

      {/* 5. TAB 1: ENQUIRIES & PIPELINE */}
      {activeTab === "enquiries" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search enquiry, customer, phone..."
                  value={enquirySearch}
                  onChange={(e) => setEnquirySearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-white"
                />
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {["all", "open", "quoted", "won", "lost"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setEnquiryStatusFilter(st)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg capitalize transition ${
                      enquiryStatusFilter === st
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Salesperson filter */}
              <select
                value={enquirySalespersonFilter}
                onChange={(e) => setEnquirySalespersonFilter(e.target.value)}
                className="text-xs py-1.5 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Salespeople</option>
                {salespeople.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.full_name}
                  </option>
                ))}
              </select>

              {/* Lead Source filter */}
              <select
                value={enquirySourceFilter}
                onChange={(e) => setEnquirySourceFilter(e.target.value)}
                className="text-xs py-1.5 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Sources</option>
                {leadSources.map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 font-mono">
              Showing {filteredEnquiries.length} of {initialEnquiries.length}
            </div>
          </div>

          {/* Enquiries Table */}
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Enquiry &amp; Customer</th>
                    <th className="py-3 px-3">Source</th>
                    <th className="py-3 px-3">Salesperson</th>
                    <th className="py-3 px-3">Expected Value</th>
                    <th className="py-3 px-3">Next Follow-up</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEnquiries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No enquiries match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredEnquiries.map((enq) => {
                      const isExpanded = expandedEnquiryId === enq.id;
                      const isDue = isFollowupDue(enq, todayIst);
                      const isPast =
                        enq.next_followup_date && enq.next_followup_date < todayIst;

                      return (
                        <tr
                          key={enq.id}
                          className="hover:bg-slate-50/50 transition-colors group"
                        >
                          {/* Title & Customer */}
                          <td className="py-3 px-4">
                            <div className="flex items-start gap-2">
                              <button
                                onClick={() =>
                                  setExpandedEnquiryId(isExpanded ? null : enq.id)
                                }
                                className="mt-0.5 text-slate-400 hover:text-slate-600"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                              <div>
                                <div className="font-semibold text-slate-900 group-hover:text-blue-700 transition">
                                  {enq.title}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span className="font-medium text-slate-700">
                                    {enq.customer?.name || "Unnamed Customer"}
                                  </span>
                                  {enq.customer?.contact_person && (
                                    <>
                                      <span>•</span>
                                      <span>{enq.customer.contact_person}</span>
                                    </>
                                  )}
                                  {enq.customer?.phone && (
                                    <>
                                      <span>•</span>
                                      <span className="font-mono">{enq.customer.phone}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Source */}
                          <td className="py-3 px-3 text-slate-600">
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 border border-slate-200">
                              {enq.source?.name || "Direct"}
                            </span>
                          </td>

                          {/* Salesperson */}
                          <td className="py-3 px-3 text-slate-700 font-medium">
                            {enq.assigned_person?.full_name || "Unassigned"}
                          </td>

                          {/* Expected Value */}
                          <td className="py-3 px-3 font-mono font-semibold text-slate-900">
                            {formatRupees(enq.expected_value_excl_gst)}
                          </td>

                          {/* Next Follow-up */}
                          <td className="py-3 px-3">
                            {enq.next_followup_date ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
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
                              <span className="text-slate-400 text-[10px] italic">
                                Not scheduled
                              </span>
                            )}
                          </td>

                          {/* Status */}
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
                            {enq.status === "lost" && enq.lost_reason && (
                              <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[120px]">
                                {enq.lost_reason.name}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Quick Log Followup */}
                              <button
                                onClick={() => openQuickLogFor(enq)}
                                title="Quick-Log Follow-up (<10s)"
                                className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 flex items-center gap-1 transition"
                              >
                                <PhoneCall className="w-3 h-3" />
                                <span>Log</span>
                              </button>

                              {/* Create Quotation (if not won/lost) */}
                              {enq.status !== "won" && enq.status !== "lost" && (
                                <button
                                  onClick={() => openQuotationFor(enq)}
                                  title="Issue Quotation"
                                  className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1 transition"
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>Quote</span>
                                </button>
                              )}

                              {/* Mark Lost (Rule S5) */}
                              {enq.status !== "won" && enq.status !== "lost" && (
                                <button
                                  onClick={() => openMarkLostFor(enq)}
                                  title="Mark Enquiry as Lost"
                                  className="px-2 py-1 text-[11px] font-semibold rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition"
                                >
                                  Lost
                                </button>
                              )}

                              {/* Converted Project link if won */}
                              {enq.status === "won" && enq.project_id && (
                                <Link
                                  href={`/x9admin/projects/${enq.project_id}`}
                                  className="px-2 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1 hover:bg-emerald-100 transition"
                                >
                                  <span>Project</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
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

      {/* 5. TAB 2: QUOTATIONS REGISTER */}
      {activeTab === "quotations" && (
        <div className="space-y-4">
          {/* Quotations Filter Bar */}
          <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search quote #, enquiry, customer..."
                  value={quotationSearch}
                  onChange={(e) => setQuotationSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-white"
                />
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {["all", "draft", "sent", "negotiating", "accepted", "rejected", "superseded"].map(
                  (st) => (
                    <button
                      key={st}
                      onClick={() => setQuotationStatusFilter(st)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg capitalize transition ${
                        quotationStatusFilter === st
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {st}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="text-xs text-slate-500 font-mono">
              Showing {filteredQuotations.length} of {initialQuotations.length} quotes
            </div>
          </div>

          {/* Quotations Table */}
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Quote Number</th>
                    <th className="py-3 px-3">Enquiry &amp; Customer</th>
                    <th className="py-3 px-3">Amount (Ex-GST)</th>
                    <th className="py-3 px-3">Sent / Accepted</th>
                    <th className="py-3 px-3">Validity &amp; Status</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQuotations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No quotations found.
                      </td>
                    </tr>
                  ) : (
                    filteredQuotations.map((q) => {
                      const validity = evaluateQuotationValidity(q, todayIst);
                      const isConvertible =
                        q.status === "accepted" &&
                        (!q.enquiry?.project_id && !initialEnquiries.find(e => e.id === q.enquiry_id)?.project_id);

                      return (
                        <tr key={q.id} className="hover:bg-slate-50/50 transition">
                          {/* Quote Number & Version */}
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-blue-700">
                              {q.quote_number}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Version {q.version}
                            </div>
                          </td>

                          {/* Enquiry & Customer */}
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900">
                              {q.enquiry?.title || "Enquiry"}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {q.enquiry?.customer?.name || "Customer"}
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            {formatRupees(q.amount_excl_gst)}
                          </td>

                          {/* Sent / Accepted */}
                          <td className="py-3 px-3 text-[11px] text-slate-600">
                            {q.sent_at ? (
                              <div>
                                <span className="text-slate-400">Sent:</span>{" "}
                                <span className="font-mono">{q.sent_at.split("T")[0]}</span>
                              </div>
                            ) : (
                              <div className="text-slate-400 italic">Not sent</div>
                            )}
                            {q.accepted_at && (
                              <div className="text-emerald-700 font-medium mt-0.5">
                                <span className="text-emerald-500">Acc:</span>{" "}
                                <span className="font-mono">{q.accepted_at.split("T")[0]}</span>
                              </div>
                            )}
                          </td>

                          {/* Validity Date & S11 */}
                          <td className="py-3 px-3">
                            <div className="font-mono text-[11px] text-slate-700">
                              {q.validity_date || "None"}
                            </div>
                            {validity.isPassed && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded mt-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Expired
                              </span>
                            )}
                            {validity.isExpiringSoon && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.2 rounded mt-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {validity.daysRemaining}d left
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                q.status === "accepted"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : q.status === "sent"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : q.status === "negotiating"
                                  ? "bg-orange-50 text-orange-700 border-orange-200"
                                  : q.status === "rejected"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-slate-100 text-slate-700 border-slate-300"
                              }`}
                            >
                              {q.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Change status actions */}
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
                                  disabled={isPending}
                                  className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition"
                                >
                                  Send Quote
                                </button>
                              )}

                              {(q.status === "sent" || q.status === "negotiating") && (
                                <button
                                  onClick={async () => {
                                    startTransition(async () => {
                                      const fd = new FormData();
                                      fd.append("quotation_id", q.id);
                                      fd.append("status", "accepted");
                                      const res = await updateQuotationStatusAction(null, fd);
                                      if (res.error) setErrorMsg(res.error);
                                      else {
                                        setSuccessMsg(`Quotation ${q.quote_number} marked as Accepted`);
                                        router.refresh();
                                      }
                                    });
                                  }}
                                  disabled={isPending}
                                  className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                                >
                                  Mark Accepted
                                </button>
                              )}

                              {/* Rule S12 Conversion button */}
                              {isConvertible && (
                                <button
                                  onClick={() => openConvertFor(q)}
                                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1 transition"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Convert</span>
                                </button>
                              )}

                              {/* Already Converted indicator */}
                              {q.status === "accepted" && !isConvertible && (
                                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  Converted
                                </span>
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

      {/* 6. TAB 3: CUSTOMERS DIRECTORY */}
      {activeTab === "customers" && (
        <div className="space-y-4">
          {/* Customers Filter & Add Bar */}
          <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[260px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by company name, contact, phone, email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-white"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-mono">
                {filteredCustomers.length} registered customers
              </span>
              <button
                onClick={() => setIsNewCustomerOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-md shadow-blue-600/25 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Customer
              </button>
            </div>
          </div>

          {/* Customers Table */}
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-3">Contact Person</th>
                    <th className="py-3 px-3">Phone &amp; Email</th>
                    <th className="py-3 px-3">Address</th>
                    <th className="py-3 px-3 text-center">Enquiries</th>
                    <th className="py-3 px-4 text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No customers found. Click &quot;Add Customer&quot; to create one.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {c.name}
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          {c.contact_person || "-"}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                          <div>{c.phone || "-"}</div>
                          <div className="text-slate-400 text-[10px]">{c.email || ""}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-500 max-w-[200px] truncate">
                          {c.address || "-"}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-mono">
                            {c.enquiries_count || 0}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-500">
                          {c.created_at ? c.created_at.split("T")[0] : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS
      ========================================================================= */}

      {/* 1. QUICK-LOG MODAL (Designed for < 10 seconds on mobile) */}
      {isQuickLogOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Quick-Log Follow-up
                  </h3>
                </div>
              </div>
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
                  if (res.error) {
                    setErrorMsg(res.error);
                  } else {
                    setSuccessMsg("Follow-up logged successfully!");
                    setIsQuickLogOpen(false);
                    router.refresh();
                  }
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              {/* Enquiry Selection */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Enquiry *
                </label>
                <select
                  name="enquiry_id"
                  defaultValue={selectedEnquiryForQuickLog?.id || ""}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="" disabled>
                    Select an enquiry...
                  </option>
                  {initialEnquiries.map((enq) => (
                    <option key={enq.id} value={enq.id}>
                      {enq.title} — {enq.customer?.name || "Customer"} ({enq.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Follow-up Kind (One-tap radio buttons) */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">
                  Follow-up Type *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { kind: "call", label: "Phone Call", icon: PhoneCall },
                    { kind: "meeting", label: "Meeting", icon: Users },
                    { kind: "site_visit", label: "Site Visit", icon: Building2 },
                    { kind: "note", label: "General Note", icon: FileText },
                  ].map((item) => (
                    <label
                      key={item.kind}
                      className="cursor-pointer border border-slate-200 rounded-xl p-2.5 text-center flex flex-col items-center gap-1 hover:border-blue-400 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50/50 has-[:checked]:text-blue-700 transition"
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

              {/* Summary / Notes */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Summary / Discussion Notes *
                </label>
                <textarea
                  name="summary"
                  required
                  rows={3}
                  placeholder="e.g. Discussed PEB truss structure and revised column spacing. Client requested updated drawing."
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Follow-up Date */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Activity Date
                  </label>
                  <input
                    type="date"
                    name="followup_date"
                    defaultValue={todayIst}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>

                {/* Next Follow-up Date */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Next Follow-up Due
                  </label>
                  <input
                    type="date"
                    name="next_followup_date"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Attendees (Optional) */}
              <div>
                <label className="block text-slate-500 font-medium mb-1">
                  Attendees (optional)
                </label>
                <input
                  type="text"
                  name="attendees"
                  placeholder="e.g. Mr. Sharma (Plant Head), Rajesh (Westeel)"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickLogOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Log (&lt;10s)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. NEW ENQUIRY MODAL */}
      {isNewEnquiryOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    New Sales Enquiry (Lead)
                  </h3>
                </div>
              </div>
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
                  if (res.error) {
                    setErrorMsg(res.error);
                  } else {
                    setSuccessMsg("Enquiry created successfully!");
                    setIsNewEnquiryOpen(false);
                    router.refresh();
                  }
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              {/* Customer select */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Customer / Client *
                </label>
                <select
                  name="customer_id"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="" disabled selected>
                    Select an existing customer...
                  </option>
                  {initialCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.contact_person ? `(${c.contact_person})` : ""}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-slate-400 mt-1">
                  Don&apos;t see customer? Close this and click &quot;+ Customer&quot; above.
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Enquiry Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. PEB Warehouse Shed 12,000 sq ft - Durgapur"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Expected Value */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Expected Value (₹ Ex-GST)
                  </label>
                  <input
                    type="number"
                    name="expected_value_excl_gst"
                    defaultValue={0}
                    min={0}
                    step={1000}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>

                {/* Lead Source */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Lead Source
                  </label>
                  <select
                    name="source_id"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500"
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

              <div className="grid grid-cols-2 gap-3">
                {/* Assigned Salesperson */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Assigned Salesperson
                  </label>
                  <select
                    name="assigned_to"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {salespeople.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Next Followup Date */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Next Follow-up Date
                  </label>
                  <input
                    type="date"
                    name="next_followup_date"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Requirement Notes */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Scope &amp; Requirement Details
                </label>
                <textarea
                  name="requirement"
                  rows={2}
                  placeholder="Height 7m, clear span 24m, insulated roof sheet, crane provision 5T."
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewEnquiryOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Enquiry</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. NEW CUSTOMER MODAL */}
      {isNewCustomerOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    New Customer Record
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setIsNewCustomerOpen(false)}
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
                  const res = await createCustomerAction(null, formData);
                  if (res.error) {
                    setErrorMsg(res.error);
                  } else {
                    setSuccessMsg("Customer added successfully!");
                    setIsNewCustomerOpen(false);
                    router.refresh();
                  }
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Company / Organization Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Acme Logistics Pvt Ltd"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  name="contact_person"
                  placeholder="e.g. Ramesh Patel (Director)"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="+91 98765 43210"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    placeholder="contact@acme.com"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Billing / Office Address
                </label>
                <textarea
                  name="address"
                  rows={2}
                  placeholder="Plot 42, GIDC Estate, Ahmedabad, Gujarat"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewCustomerOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Customer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. NEW QUOTATION MODAL */}
      {isNewQuotationOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Issue Quotation (WQ-YYYY-NNN)
                  </h3>
                </div>
              </div>
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
                  if (res.error) {
                    setErrorMsg(res.error);
                  } else {
                    setSuccessMsg(`Quotation ${res.quoteNumber || ""} created successfully!`);
                    setIsNewQuotationOpen(false);
                    router.refresh();
                  }
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Enquiry *
                </label>
                <select
                  name="enquiry_id"
                  defaultValue={selectedEnquiryForQuotation?.id || ""}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="" disabled>
                    Select enquiry...
                  </option>
                  {initialEnquiries.map((enq) => (
                    <option key={enq.id} value={enq.id}>
                      {enq.title} — {enq.customer?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Quoted Amount (₹ Ex-GST) *
                  </label>
                  <input
                    type="number"
                    name="amount_excl_gst"
                    defaultValue={selectedEnquiryForQuotation?.expected_value_excl_gst || 0}
                    required
                    min={0}
                    step={1000}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Version Number
                  </label>
                  <input
                    type="number"
                    name="version"
                    defaultValue={1}
                    min={1}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-xs"
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
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500"
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
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-xs"
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
                  placeholder="Includes structural frame, purlins, anchor bolts, and transport up to 100km."
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewQuotationOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Generate Quotation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MARK LOST MODAL (Rule S5: Requires lost_reason_id) */}
      {isMarkLostOpen && selectedEnquiryForLost && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 text-red-600 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Mark Enquiry as Lost
                  </h3>
                </div>
              </div>
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
                  if (res.error) {
                    setErrorMsg(res.error);
                  } else {
                    setSuccessMsg("Enquiry marked as Lost.");
                    setIsMarkLostOpen(false);
                    router.refresh();
                  }
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              <input type="hidden" name="enquiry_id" value={selectedEnquiryForLost.id} />

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">Enquiry</div>
                <div className="font-semibold text-slate-900">{selectedEnquiryForLost.title}</div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Client: {selectedEnquiryForLost.customer?.name}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Lost Reason *
                </label>
                <select
                  name="lost_reason_id"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-red-500"
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
                  Additional Details / Feedback
                </label>
                <textarea
                  name="lost_note"
                  rows={3}
                  placeholder="e.g. Competitor quoted 8% lower on PEB steel tonnage. Client decided to proceed with them."
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-red-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMarkLostOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Lost</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. CONVERT QUOTATION TO PROJECT MODAL (Rule S12) */}
      {isConvertOpen && selectedQuotationForConvert && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Convert Quotation to Project
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setIsConvertOpen(false)}
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
                  const res = await convertQuotationToProjectAction(null, formData);
                  if (res.error) {
                    setErrorMsg(res.error);
                  } else {
                    setSuccessMsg(
                      `Successfully converted! Project ${res.projectCode || ""} created with matching contract value.`
                    );
                    setIsConvertOpen(false);
                    router.refresh();
                  }
                });
              }}
              className="p-5 space-y-4 text-xs"
            >
              <input
                type="hidden"
                name="quotation_id"
                value={selectedQuotationForConvert.id}
              />

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-[11px]">Quotation Number:</span>
                  <span className="font-mono font-bold text-blue-700">
                    {selectedQuotationForConvert.quote_number}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-[11px]">Enquiry:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedQuotationForConvert.enquiry?.title}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-[11px]">Client:</span>
                  <span className="font-medium text-slate-800">
                    {selectedQuotationForConvert.enquiry?.customer?.name}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-700 font-semibold">Contract Value (Ex-GST):</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    {formatRupees(selectedQuotationForConvert.amount_excl_gst)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Project Start Date *
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    defaultValue={todayIst}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Planned Completion Date
                  </label>
                  <input
                    type="date"
                    name="planned_completion_date"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 text-blue-800 text-[11px] leading-relaxed">
                <strong>On conversion:</strong>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  <li>Creates project at Stage 2 Contract confirmation.</li>
                  <li>Initializes commercials with exact ex-GST quotation value.</li>
                  <li>Sets enquiry status to Won with won_at timestamp.</li>
                  <li>Double conversion is strictly blocked. No retyping needed.</li>
                </ul>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsConvertOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Execute Conversion</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
