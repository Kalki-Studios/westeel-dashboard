import { createClient } from "@/lib/supabase/server";
import {
  CustomerItem,
  EnquiryItem,
  QuotationItem,
  LeadSourceItem,
  LostReasonItem,
} from "./types";
import { isFollowupDue, evaluateQuotationValidity } from "@/lib/rules/sales";
import { getIstDateString } from "@/lib/rules/alerts";

/**
 * Fetch all lead sources (A16)
 */
export async function getLeadSources(includeInactive = false): Promise<LeadSourceItem[]> {
  const supabase = await createClient();
  let query = supabase.from("lead_sources").select("*").order("name", { ascending: true });
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data } = await query;
  return (data || []) as LeadSourceItem[];
}

/**
 * Fetch all lost reasons (A16)
 */
export async function getLostReasons(includeInactive = false): Promise<LostReasonItem[]> {
  const supabase = await createClient();
  let query = supabase.from("lost_reasons").select("*").order("name", { ascending: true });
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data } = await query;
  return (data || []) as LostReasonItem[];
}

/**
 * Fetch customers list
 */
export async function getCustomers(search?: string): Promise<CustomerItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select(`
      *,
      enquiries:enquiries(count)
    `)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (search && search.trim() !== "") {
    const s = search.trim();
    query = query.or(`name.ilike.%${s}%,contact_person.ilike.%${s}%,phone.ilike.%${s}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((c: Record<string, unknown>) => ({
    id: c.id as string,
    name: c.name as string,
    contact_person: c.contact_person as string | null,
    phone: c.phone as string | null,
    email: c.email as string | null,
    address: c.address as string | null,
    notes: c.notes as string | null,
    is_archived: c.is_archived as boolean,
    created_by: c.created_by as string | null,
    created_at: c.created_at as string,
    updated_at: c.updated_at as string,
    enquiries_count: Array.isArray(c.enquiries) && c.enquiries[0]
      ? (c.enquiries[0] as { count: number }).count
      : 0,
  }));
}

/**
 * Fetch all active sales employees for assignment dropdown
 */
export async function getSalespeople(): Promise<{ id: string; full_name: string }[]> {
  const supabase = await createClient();
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["sales", "director"]);

  if (!userRoles || userRoles.length === 0) return [];
  const userIds = Array.from(new Set(userRoles.map((ur) => ur.user_id)));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  return (profiles || []) as { id: string; full_name: string }[];
}

/**
 * Fetch enquiries with filters
 */
export async function getEnquiries(options?: {
  search?: string;
  status?: string;
  salespersonId?: string;
  sourceId?: string;
}): Promise<EnquiryItem[]> {
  const supabase = await createClient();
  const todayIst = getIstDateString();

  let query = supabase
    .from("enquiries")
    .select(`
      *,
      customer:customers(id, name, contact_person, phone, email, address),
      source:lead_sources(id, name),
      lost_reason:lost_reasons(id, name),
      assigned_person:profiles!enquiries_assigned_to_fkey(id, full_name),
      project:projects(id, code, name),
      followups:enquiry_followups(id, kind, followup_date, attendees, note, created_at),
      quotations:quotations(id, quote_number, version, amount_excl_gst, validity_date, status, sent_at, accepted_at)
    `)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (options?.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  if (options?.salespersonId && options.salespersonId !== "all") {
    query = query.eq("assigned_to", options.salespersonId);
  }

  if (options?.sourceId && options.sourceId !== "all") {
    query = query.eq("source_id", options.sourceId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  let results: EnquiryItem[] = data.map((e: Record<string, unknown>) => {
    const item = e as unknown as EnquiryItem;
    item.is_followup_due = isFollowupDue(item, todayIst);
    return item;
  });

  if (options?.search && options.search.trim() !== "") {
    const term = options.search.trim().toLowerCase();
    results = results.filter(
      (e) =>
        e.title.toLowerCase().includes(term) ||
        (e.customer?.name || "").toLowerCase().includes(term) ||
        (e.customer?.contact_person || "").toLowerCase().includes(term) ||
        (e.customer?.phone || "").toLowerCase().includes(term)
    );
  }

  return results;
}

/**
 * Fetch enquiry by ID with detailed timeline
 */
export async function getEnquiryById(id: string): Promise<EnquiryItem | null> {
  const supabase = await createClient();
  const todayIst = getIstDateString();

  const { data, error } = await supabase
    .from("enquiries")
    .select(`
      *,
      customer:customers(id, name, contact_person, phone, email, address, notes),
      source:lead_sources(id, name),
      lost_reason:lost_reasons(id, name),
      assigned_person:profiles!enquiries_assigned_to_fkey(id, full_name),
      project:projects(id, code, name),
      followups:enquiry_followups(
        id, enquiry_id, kind, followup_date, attendees, note, created_at,
        creator:profiles!enquiry_followups_created_by_fkey(id, full_name)
      ),
      quotations:quotations(
        id, enquiry_id, quote_number, version, amount_excl_gst, validity_date, status, sent_at, accepted_at, notes, created_at,
        creator:profiles!quotations_created_by_fkey(id, full_name)
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const item = data as unknown as EnquiryItem;
  item.is_followup_due = isFollowupDue(item, todayIst);

  if (item.followups) {
    item.followups.sort(
      (a, b) => new Date(b.followup_date).getTime() - new Date(a.followup_date).getTime()
    );
  }

  if (item.quotations) {
    item.quotations.sort((a, b) => b.version - a.version);
  }

  return item;
}

/**
 * Fetch all quotations with optional filters
 */
export async function getQuotations(options?: {
  enquiryId?: string;
  status?: string;
}): Promise<QuotationItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("quotations")
    .select(`
      *,
      creator:profiles!quotations_created_by_fkey(id, full_name),
      enquiry:enquiries(
        id, title, status, customer_id,
        customer:customers(id, name, contact_person, phone)
      )
    `)
    .order("created_at", { ascending: false });

  if (options?.enquiryId) {
    query = query.eq("enquiry_id", options.enquiryId);
  }

  if (options?.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  const { data } = await query;
  return (data || []) as unknown as QuotationItem[];
}

/**
 * Fetch active sales alerts per Rule S10 & S11
 */
export interface SalesAlertItem {
  id: string;
  kind: "followup_due" | "validity_passed" | "validity_expiring_soon";
  severity: "critical" | "high" | "warning";
  title: string;
  description: string;
  source_id: string;
  source_type: "enquiry" | "quotation";
  date: string;
}

export async function getSalesAlerts(): Promise<SalesAlertItem[]> {
  const todayIst = getIstDateString();
  const alerts: SalesAlertItem[] = [];

  const enquiries = await getEnquiries();
  for (const enq of enquiries) {
    if (isFollowupDue(enq, todayIst) && enq.next_followup_date) {
      const isPast = enq.next_followup_date < todayIst;
      alerts.push({
        id: `fu-${enq.id}`,
        kind: "followup_due",
        severity: isPast ? "critical" : "high",
        title: isPast ? `Follow-up Overdue: ${enq.title}` : `Follow-up Due Today: ${enq.title}`,
        description: `Customer: ${enq.customer?.name || "Unknown"} • Assigned: ${enq.assigned_person?.full_name || "Unassigned"}`,
        source_id: enq.id,
        source_type: "enquiry",
        date: enq.next_followup_date,
      });
    }

    if (enq.quotations) {
      for (const q of enq.quotations) {
        const valStatus = evaluateQuotationValidity(q, todayIst);
        if (valStatus.isPassed) {
          alerts.push({
            id: `q-exp-${q.id}`,
            kind: "validity_passed",
            severity: "critical",
            title: `Quotation Validity Expired (S11): ${q.quote_number}`,
            description: `Enquiry: ${enq.title} • Validity date was ${q.validity_date}`,
            source_id: enq.id,
            source_type: "quotation",
            date: q.validity_date || todayIst,
          });
        } else if (valStatus.isExpiringSoon && valStatus.daysRemaining !== undefined) {
          alerts.push({
            id: `q-warn-${q.id}`,
            kind: "validity_expiring_soon",
            severity: "warning",
            title: `Quotation Expiring in ${valStatus.daysRemaining} days (S11): ${q.quote_number}`,
            description: `Enquiry: ${enq.title} • Valid until ${q.validity_date}`,
            source_id: enq.id,
            source_type: "quotation",
            date: q.validity_date || todayIst,
          });
        }
      }
    }
  }

  return alerts;
}

/**
 * Generate CSV export of enquiries per Task T13
 */
export async function generateEnquiriesCsv(options?: {
  search?: string;
  status?: string;
  salespersonId?: string;
  sourceId?: string;
}): Promise<string> {
  const enquiries = await getEnquiries(options);

  const headers = [
    "Enquiry ID",
    "Title",
    "Customer Name",
    "Contact Person",
    "Phone",
    "Email",
    "Expected Value (Ex-GST)",
    "Lead Source",
    "Assigned Salesperson",
    "Status",
    "Next Follow-up Date",
    "Lost Reason",
    "Lost Note",
    "Won At",
    "Converted Project Code",
    "Created Date",
  ];

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = enquiries.map((e) => [
    e.id,
    e.title,
    e.customer?.name || "",
    e.customer?.contact_person || "",
    e.customer?.phone || "",
    e.customer?.email || "",
    e.expected_value_excl_gst,
    e.source?.name || "",
    e.assigned_person?.full_name || "",
    e.status,
    e.next_followup_date || "",
    e.lost_reason?.name || "",
    e.lost_note || "",
    e.won_at || "",
    e.project?.code || "",
    e.created_at,
  ]);

  return [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
}
