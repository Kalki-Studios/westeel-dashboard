"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EnquiryItem, FollowupKind } from "@/lib/sales/types";
import { quickLogFollowupAction } from "@/lib/sales/actions";
import { getIstDateString } from "@/lib/rules/alerts";
import {
  PhoneCall,
  Users,
  Building2,
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  ArrowRight,
  Clock,
} from "lucide-react";

interface EmployeeQuickLogClientProps {
  enquiries: EnquiryItem[];
}

export function EmployeeQuickLogClient({ enquiries }: EmployeeQuickLogClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const todayIst = getIstDateString();

  const [selectedEnquiryId, setSelectedEnquiryId] = useState<string>("");
  const [enquirySearch, setEnquirySearch] = useState<string>("");
  const [kind, setKind] = useState<FollowupKind>("call");
  const [summary, setSummary] = useState<string>("");
  const [followupDate, setFollowupDate] = useState<string>(todayIst);
  const [nextFollowupDate, setNextFollowupDate] = useState<string>("");
  const [attendees, setAttendees] = useState<string>("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter enquiries for fast searching
  const filteredEnquiries = enquiries.filter((e) => {
    if (!enquirySearch.trim()) return true;
    const q = enquirySearch.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      (e.customer?.name && e.customer.name.toLowerCase().includes(q)) ||
      (e.customer?.phone && e.customer.phone.includes(q))
    );
  });

  const selectedEnquiry = enquiries.find((e) => e.id === selectedEnquiryId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiryId) {
      setErrorMsg("Please select an enquiry");
      return;
    }
    if (!summary.trim()) {
      setErrorMsg("Please enter discussion summary");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append("enquiry_id", selectedEnquiryId);
    formData.append("kind", kind);
    formData.append("summary", summary.trim());
    formData.append("followup_date", followupDate);
    if (nextFollowupDate) formData.append("next_followup_date", nextFollowupDate);
    if (attendees.trim()) formData.append("attendees", attendees.trim());

    startTransition(async () => {
      const res = await quickLogFollowupAction(null, formData);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(
          `Logged ${kind.replace("_", " ")} for "${selectedEnquiry?.title || "enquiry"}" in <10s!`
        );
        // Reset form for next fast log
        setSummary("");
        setNextFollowupDate("");
        setAttendees("");
        router.refresh();
      }
    });
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Quick-Log Follow-up
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
          <Clock className="w-3.5 h-3.5 text-orange-600" />
          <span>&lt; 10s goal</span>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Fast Form */}
      <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-2xl space-y-5">
        {/* Step 1: Fast Enquiry Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-900 mb-1.5">
            1. Select Enquiry *
          </label>
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, customer, phone..."
              value={enquirySearch}
              onChange={(e) => setEnquirySearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={selectedEnquiryId}
            onChange={(e) => setSelectedEnquiryId(e.target.value)}
            required
            className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500"
          >
            <option value="" disabled>
              Select enquiry ({filteredEnquiries.length} available)...
            </option>
            {filteredEnquiries.map((enq) => (
              <option key={enq.id} value={enq.id}>
                {enq.title} — {enq.customer?.name} ({enq.status})
              </option>
            ))}
          </select>

          {selectedEnquiry && (
            <div className="mt-2 p-2.5 rounded-xl bg-blue-50/50 border border-blue-200 text-xs text-blue-900 flex justify-between items-center">
              <div>
                <span className="font-semibold">{selectedEnquiry.customer?.name}</span>
                {selectedEnquiry.customer?.phone && (
                  <span className="text-slate-500 ml-2 font-mono">
                    {selectedEnquiry.customer.phone}
                  </span>
                )}
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white border border-blue-200">
                {selectedEnquiry.status}
              </span>
            </div>
          )}
        </div>

        {/* Step 2: One-Tap Type Buttons */}
        <div>
          <label className="block text-xs font-bold text-slate-900 mb-1.5">
            2. Follow-up Type *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: "call", label: "Phone Call", icon: PhoneCall },
              { id: "meeting", label: "Meeting", icon: Users },
              { id: "site_visit", label: "Site Visit", icon: Building2 },
              { id: "note", label: "Note", icon: FileText },
            ].map((btn) => (
              <button
                type="button"
                key={btn.id}
                onClick={() => setKind(btn.id as FollowupKind)}
                className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-bold transition ${
                  kind === btn.id
                    ? "bg-orange-500 text-white border-orange-600 shadow-md shadow-orange-500/20"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <btn.icon className="w-5 h-5" />
                <span className="text-[11px]">{btn.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: Discussion Summary */}
        <div>
          <label className="block text-xs font-bold text-slate-900 mb-1.5">
            3. Summary / What happened? *
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            required
            placeholder="Discussed PEB truss structure, customer agreed on budget, requested site visit..."
            className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-orange-500 resize-none"
          />
        </div>

        {/* Step 4: Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5">
              Activity Date
            </label>
            <input
              type="date"
              value={followupDate}
              onChange={(e) => setFollowupDate(e.target.value)}
              required
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5">
              Next Follow-up Due (Optional)
            </label>
            <input
              type="date"
              value={nextFollowupDate}
              onChange={(e) => setNextFollowupDate(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Optional Attendees */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Attendees (Optional)
          </label>
          <input
            type="text"
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
            placeholder="e.g. Ramesh Patel (Owner), Anil (Site Engg)"
            className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isPending || !selectedEnquiryId || !summary.trim()}
            className="w-full py-3.5 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Save Log in &lt;10s</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
