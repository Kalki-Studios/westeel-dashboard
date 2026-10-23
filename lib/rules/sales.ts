/**
 * Westeel Dashboard - Sales Rules Engine (Rules S1 to S5, S10, S11, S12, S13)
 * Priority 3: Sales Tracker & Pipeline
 * All amounts handled in integer paise / numeric(14,2) without floating point imprecision.
 * All date checks standardized on Asia/Kolkata (IST).
 */

export interface SalesEnquiryLike {
  id: string;
  status: "open" | "quoted" | "won" | "lost";
  expected_value_excl_gst: number; // in paise or rupees (numeric)
  next_followup_date?: string | null;
  lost_reason_id?: string | null;
  lost_at?: string | null;
  won_at?: string | null;
  created_at: string;
}

export interface QuotationLike {
  id: string;
  enquiry_id: string;
  quote_number: string;
  version: number;
  amount_excl_gst: number;
  status: "draft" | "sent" | "negotiating" | "accepted" | "rejected" | "expired";
  validity_date?: string | null;
  sent_at?: string | null;
  accepted_at?: string | null;
}

export interface FollowupLike {
  id: string;
  enquiry_id: string;
  kind: "call" | "meeting" | "site_visit" | "message" | "other";
  followup_date: string;
  attendees?: string | null;
  note?: string | null;
}

/**
 * Rule S2 / Assumption A14: Meeting Detection
 * "Meeting" means a follow-up of kind 'meeting' or 'site_visit' logged by sales.
 */
export function isMeetingFollowup(kind: string): boolean {
  return kind === "meeting" || kind === "site_visit";
}

/**
 * Rule S3: Quoted status and lifecycle
 * An enquiry is quoted if it has at least one quotation with sent_at set.
 * Setting a quotation to 'sent' sets sent_at and transitions enquiry from 'open' to 'quoted'.
 */
export function shouldTransitionEnquiryToQuoted(
  currentEnquiryStatus: "open" | "quoted" | "won" | "lost",
  quotationStatus: "draft" | "sent" | "negotiating" | "accepted" | "rejected" | "expired"
): boolean {
  return currentEnquiryStatus === "open" && quotationStatus === "sent";
}

/**
 * Rule S5: Lost validation
 * Marking an enquiry as lost strictly requires a lost_reason_id.
 */
export function validateEnquiryLost(lostReasonId: string | null | undefined): {
  valid: boolean;
  error?: string;
} {
  if (!lostReasonId || lostReasonId.trim() === "") {
    return {
      valid: false,
      error: "Rule S5: A lost reason is strictly required when marking an enquiry as lost",
    };
  }
  return { valid: true };
}

/**
 * Rule S10: Open Pipeline & Follow-ups Due
 * Open pipeline = enquiries with status 'open' or 'quoted'.
 * Follow-up due = next_followup_date <= today (IST).
 */
export function isEnquiryInOpenPipeline(status: string): boolean {
  return status === "open" || status === "quoted";
}

export function isFollowupDue(
  enquiry: Pick<SalesEnquiryLike, "status" | "next_followup_date">,
  todayIst: string
): boolean {
  if (!isEnquiryInOpenPipeline(enquiry.status)) {
    return false;
  }
  if (!enquiry.next_followup_date) {
    return false;
  }
  return enquiry.next_followup_date <= todayIst;
}

/**
 * Rule S11: Quotation Validity Check & Expiry Alert
 * Condition: status is 'sent' or 'negotiating' AND validity_date < today (IST).
 * Alert only; never automatically changes status.
 * Also detects if validity is within 7 days for proactive warning.
 */
export interface QuotationValidityStatus {
  isPassed: boolean;
  isExpiringSoon: boolean;
  daysRemaining?: number;
}

export function evaluateQuotationValidity(
  quote: Pick<QuotationLike, "status" | "validity_date">,
  todayIst: string
): QuotationValidityStatus {
  // S11 applies only to active quotes in 'sent' or 'negotiating'
  if (quote.status !== "sent" && quote.status !== "negotiating") {
    return { isPassed: false, isExpiringSoon: false };
  }

  if (!quote.validity_date) {
    return { isPassed: false, isExpiringSoon: false };
  }

  const today = new Date(todayIst);
  const validity = new Date(quote.validity_date);

  const diffTime = validity.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { isPassed: true, isExpiringSoon: false, daysRemaining: diffDays };
  }

  if (diffDays >= 0 && diffDays <= 7) {
    return { isPassed: false, isExpiringSoon: true, daysRemaining: diffDays };
  }

  return { isPassed: false, isExpiringSoon: false, daysRemaining: diffDays };
}

/**
 * Rule S12: Quotation to Project Conversion Readiness
 * Allowed only when quotation status is 'accepted'.
 * Prevents double conversion.
 */
export function canConvertQuotationToProject(
  quote: Pick<QuotationLike, "status">,
  alreadyConverted: boolean
): { allowed: boolean; reason?: string } {
  if (alreadyConverted) {
    return {
      allowed: false,
      reason: "Rule S12: This quotation has already been converted to a project",
    };
  }

  if (quote.status !== "accepted") {
    return {
      allowed: false,
      reason: `Rule S12: Quotation status must be 'accepted' before project conversion (current: '${quote.status}')`,
    };
  }

  return { allowed: true };
}

/**
 * ============================================================================
 * Task T14: Sales Tracker Functions (Rules S6, S7, S8, S9, S10)
 * ============================================================================
 */

export type SalesPeriodPreset =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_fy"
  | "last_fy"
  | "custom";

export interface SalesDateRange {
  startDate: string; // YYYY-MM-DD (IST)
  endDate: string;   // YYYY-MM-DD (IST)
  label: string;
}

export interface SalesTrackerEnquiryInput {
  id: string;
  title: string;
  customer_id: string;
  customer_name?: string | null;
  status: "open" | "quoted" | "won" | "lost";
  expected_value_excl_gst: number;
  source_id?: string | null;
  source_name?: string | null;
  assigned_to?: string | null;
  assigned_name?: string | null;
  next_followup_date?: string | null;
  lost_reason_id?: string | null;
  lost_reason_name?: string | null;
  lost_note?: string | null;
  lost_at?: string | null;
  won_at?: string | null;
  created_at: string;
  project_id?: string | null;
  project_code?: string | null;
  project_name?: string | null;
  // Follow-ups linked to enquiry
  followups?: Array<{
    id: string;
    kind: string; // "call" | "meeting" | "site_visit" | ...
    followup_date: string; // YYYY-MM-DD
  }>;
  // Quotations linked to enquiry
  quotations?: Array<{
    id: string;
    quote_number: string;
    version: number;
    amount_excl_gst: number;
    status: string; // "draft" | "sent" | "negotiating" | "accepted" | "rejected" | "expired"
    validity_date?: string | null;
    sent_at?: string | null;
    accepted_at?: string | null;
    created_at?: string;
  }>;
}

/**
 * Helper to convert any ISO timestamp or date string to YYYY-MM-DD in Asia/Kolkata timezone.
 */
export function toIstDateString(isoString: string | null | undefined): string | null {
  if (!isoString) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
    return isoString;
  }
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return null;
  }
}

/**
 * Rule S6: Period presets in IST (Asia/Kolkata)
 * Presets: This month, Last month, This quarter, This FY, Last FY, Custom range.
 * Indian Financial Year: April 1 to March 31.
 */
export function getPeriodDateRange(
  preset: SalesPeriodPreset,
  referenceDate: Date = new Date(),
  customStart?: string,
  customEnd?: string
): SalesDateRange {
  const refIst = toIstDateString(referenceDate.toISOString()) || "2026-10-19";
  const [refYearStr, refMonthStr] = refIst.split("-");
  const year = parseInt(refYearStr, 10);
  const month = parseInt(refMonthStr, 10); // 1 to 12

  switch (preset) {
    case "this_month": {
      const start = `${refYearStr}-${refMonthStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${refYearStr}-${refMonthStr}-${String(lastDay).padStart(2, "0")}`;
      return {
        startDate: start,
        endDate: end,
        label: "This Month",
      };
    }
    case "last_month": {
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevMonthStr = String(prevMonth).padStart(2, "0");
      const lastDay = new Date(prevYear, prevMonth, 0).getDate();
      return {
        startDate: `${prevYear}-${prevMonthStr}-01`,
        endDate: `${prevYear}-${prevMonthStr}-${String(lastDay).padStart(2, "0")}`,
        label: "Last Month",
      };
    }
    case "this_quarter": {
      // Indian FY Quarters: Q1 (Apr-Jun), Q2 (Jul-Sep), Q3 (Oct-Dec), Q4 (Jan-Mar)
      if (month >= 4 && month <= 6) {
        return { startDate: `${year}-04-01`, endDate: `${year}-06-30`, label: "This Quarter (Q1)" };
      } else if (month >= 7 && month <= 9) {
        return { startDate: `${year}-07-01`, endDate: `${year}-09-30`, label: "This Quarter (Q2)" };
      } else if (month >= 10 && month <= 12) {
        return { startDate: `${year}-10-01`, endDate: `${year}-12-31`, label: "This Quarter (Q3)" };
      } else {
        const lastDayFeb = new Date(year, 2, 0).getDate();
        return { startDate: `${year}-01-01`, endDate: `${year}-03-31`, label: "This Quarter (Q4)" };
      }
    }
    case "this_fy": {
      // Boundary check: March 31 vs April 1
      if (month >= 4) {
        return {
          startDate: `${year}-04-01`,
          endDate: `${year + 1}-03-31`,
          label: `FY ${year}-${String(year + 1).slice(2)}`,
        };
      } else {
        return {
          startDate: `${year - 1}-04-01`,
          endDate: `${year}-03-31`,
          label: `FY ${year - 1}-${String(year).slice(2)}`,
        };
      }
    }
    case "last_fy": {
      if (month >= 4) {
        return {
          startDate: `${year - 1}-04-01`,
          endDate: `${year}-03-31`,
          label: `FY ${year - 1}-${String(year).slice(2)}`,
        };
      } else {
        return {
          startDate: `${year - 2}-04-01`,
          endDate: `${year - 1}-03-31`,
          label: `FY ${year - 2}-${String(year - 1).slice(2)}`,
        };
      }
    }
    case "custom": {
      return {
        startDate: customStart || refIst,
        endDate: customEnd || refIst,
        label: "Custom Range",
      };
    }
  }
}

export interface FunnelStep {
  label: string;
  count: number;
  total: number;
  percentage: number;
  display_text: string; // "n of N (x%)"
}

export interface CohortFunnelResult {
  cohort_size: number;
  is_small_sample: boolean;
  small_sample_note: string | null;
  leads_received: FunnelStep;
  with_meeting: FunnelStep;
  quoted: FunnelStep;
  won: FunnelStep;
  lost: FunnelStep;
  still_open: FunnelStep;
}

export interface ActivityBlockResult {
  leads_received: number;
  meetings_held: number;
  enquiries_quoted: number;
  quotation_value_sent: number; // ex-GST
  projects_finalised: number;
  total_win_value: number; // ex-GST
  leads_lost: number;
}

export interface SalespersonBreakdownItem {
  salesperson_id: string;
  salesperson_name: string;
  leads_received: number;
  meetings_held: number;
  enquiries_quoted: number;
  projects_won: number;
  win_value: number; // ex-GST
}

export interface LeadSourceBreakdownItem {
  source_id: string;
  source_name: string;
  leads_count: number;
  won_count: number;
  lost_count: number;
  win_rate_percent: number;
}

export interface LostReasonBreakdownItem {
  reason_id: string;
  reason_name: string;
  count: number;
  percentage_of_lost: number;
}

export interface FinalisedProjectItem {
  enquiry_id: string;
  enquiry_title: string;
  customer_name: string;
  won_at: string;
  win_value: number; // ex-GST
  salesperson_name: string;
  project_id?: string | null;
  project_code?: string | null;
  sales_cycle_days: number;
}

export interface SalesTrackerResult {
  date_range: SalesDateRange;
  activity: ActivityBlockResult;
  funnel: CohortFunnelResult;
  average_sales_cycle_days: number | null;
  sales_cycle_sample_count: number;
  breakdown_by_salesperson: SalespersonBreakdownItem[];
  breakdown_by_source: LeadSourceBreakdownItem[];
  breakdown_by_lost_reason: LostReasonBreakdownItem[];
  open_pipeline_count: number;
  open_pipeline_value: number;
  followups_due_count: number;
  finalised_projects: FinalisedProjectItem[];
}

function formatFunnelStep(label: string, count: number, total: number): FunnelStep {
  const percentage = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
  return {
    label,
    count,
    total,
    percentage,
    display_text: `${count} of ${total} (${percentage}%)`,
  };
}

/**
 * Computes difference in whole calendar days between two ISO date strings in IST.
 */
function getDaysDifference(startIso: string, endIso: string): number {
  const startStr = toIstDateString(startIso);
  const endStr = toIstDateString(endIso);
  if (!startStr || !endStr) return 0;

  const d1 = new Date(startStr);
  const d2 = new Date(endStr);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Main Pure Engine: Computes complete Sales Tracker Metrics per Rules S6 to S10.
 */
export function computeSalesTrackerMetrics(
  enquiries: SalesTrackerEnquiryInput[],
  dateRange: SalesDateRange,
  todayIst: string
): SalesTrackerResult {
  const { startDate, endDate } = dateRange;

  // --------------------------------------------------------------------------
  // 1. Activity Block in the Period (Rule S7.1)
  // --------------------------------------------------------------------------
  // Leads received: created in period
  let activityLeadsReceived = 0;
  // Meetings held: followups of meeting or site_visit in period
  let activityMeetingsHeld = 0;
  // Enquiries quoted: count of distinct enquiries whose first sent_at is in period
  let activityEnquiriesQuoted = 0;
  // Quotation value sent: latest sent quotation version per enquiry in period
  let activityQuotationValueSent = 0;
  // Projects finalised: won_at in period
  let activityProjectsFinalised = 0;
  let activityTotalWinValue = 0;
  // Leads lost: lost_at in period
  let activityLeadsLost = 0;

  // Finalised projects collection for table and cycle time
  const finalisedProjects: FinalisedProjectItem[] = [];
  let totalCycleDays = 0;

  for (const enq of enquiries) {
    const createdDate = toIstDateString(enq.created_at);
    if (createdDate && createdDate >= startDate && createdDate <= endDate) {
      activityLeadsReceived++;
    }

    // Follow-ups meetings held in period
    if (enq.followups) {
      for (const fu of enq.followups) {
        if (isMeetingFollowup(fu.kind)) {
          const fuDate = toIstDateString(fu.followup_date);
          if (fuDate && fuDate >= startDate && fuDate <= endDate) {
            activityMeetingsHeld++;
          }
        }
      }
    }

    // Quotations activity
    if (enq.quotations && enq.quotations.length > 0) {
      // Find all quotations sent for this enquiry
      const sentQuotes = enq.quotations.filter(
        (q) => q.sent_at !== null || q.status === "sent" || q.status === "negotiating" || q.status === "accepted"
      );

      if (sentQuotes.length > 0) {
        // Find earliest sent date among all quotes for this enquiry
        const sentDates = sentQuotes
          .map((q) => toIstDateString(q.sent_at || q.created_at))
          .filter((d): d is string => d !== null)
          .sort();

        const firstSentDate = sentDates[0];
        if (firstSentDate && firstSentDate >= startDate && firstSentDate <= endDate) {
          activityEnquiriesQuoted++;
        }

        // Quotation value sent: latest sent version sent in period
        const quotesSentInPeriod = sentQuotes.filter((q) => {
          const qSentDate = toIstDateString(q.sent_at || q.created_at);
          return qSentDate && qSentDate >= startDate && qSentDate <= endDate;
        });

        if (quotesSentInPeriod.length > 0) {
          // Sort by version descending to get latest version sent in this period
          quotesSentInPeriod.sort((a, b) => b.version - a.version);
          activityQuotationValueSent += Number(quotesSentInPeriod[0].amount_excl_gst) || 0;
        }
      }
    }

    // Projects finalised (Won in period)
    if (enq.status === "won" && enq.won_at) {
      const wonDate = toIstDateString(enq.won_at);
      if (wonDate && wonDate >= startDate && wonDate <= endDate) {
        activityProjectsFinalised++;

        // Determine win value: accepted quotation amount ex-GST
        const acceptedQuote = enq.quotations?.find((q) => q.status === "accepted");
        const winAmount = acceptedQuote
          ? Number(acceptedQuote.amount_excl_gst) || 0
          : Number(enq.expected_value_excl_gst) || 0;

        activityTotalWinValue += winAmount;

        const cycleDays = getDaysDifference(enq.created_at, enq.won_at);
        totalCycleDays += cycleDays;

        finalisedProjects.push({
          enquiry_id: enq.id,
          enquiry_title: enq.title,
          customer_name: enq.customer_name || "Customer",
          won_at: wonDate,
          win_value: winAmount,
          salesperson_name: enq.assigned_name || "Unassigned",
          project_id: enq.project_id || null,
          project_code: enq.project_code || null,
          sales_cycle_days: cycleDays,
        });
      }
    }

    // Leads lost in period
    if (enq.status === "lost" && enq.lost_at) {
      const lostDate = toIstDateString(enq.lost_at);
      if (lostDate && lostDate >= startDate && lostDate <= endDate) {
        activityLeadsLost++;
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. Cohort Funnel for Leads Received in the Period (Rule S7.2)
  // --------------------------------------------------------------------------
  const cohortLeads = enquiries.filter((e) => {
    const cDate = toIstDateString(e.created_at);
    return cDate && cDate >= startDate && cDate <= endDate;
  });

  const cohortTotal = cohortLeads.length;
  const isSmallSample = cohortTotal < 5;
  const smallSampleNote = isSmallSample ? "Small sample (N < 5)" : null;

  let cohortWithMeeting = 0;
  let cohortQuoted = 0;
  let cohortWon = 0;
  let cohortLost = 0;
  let cohortStillOpen = 0;

  for (const enq of cohortLeads) {
    // 1. With at least one meeting (Rule S2: meeting or site_visit)
    const hasMeeting = (enq.followups || []).some((fu) => isMeetingFollowup(fu.kind));
    if (hasMeeting) cohortWithMeeting++;

    // 2. Quoted (at least one quotation sent, multiple versions count once)
    const isQuoted = (enq.quotations || []).some(
      (q) => q.sent_at !== null || q.status === "sent" || q.status === "negotiating" || q.status === "accepted"
    );
    if (isQuoted) cohortQuoted++;

    // 3. Status outcomes
    if (enq.status === "won") {
      cohortWon++;
    } else if (enq.status === "lost") {
      cohortLost++;
    } else if (enq.status === "open" || enq.status === "quoted") {
      cohortStillOpen++;
    }
  }

  const funnel: CohortFunnelResult = {
    cohort_size: cohortTotal,
    is_small_sample: isSmallSample,
    small_sample_note: smallSampleNote,
    leads_received: formatFunnelStep("Leads Received", cohortTotal, cohortTotal),
    with_meeting: formatFunnelStep("With at Least 1 Meeting", cohortWithMeeting, cohortTotal),
    quoted: formatFunnelStep("Quoted", cohortQuoted, cohortTotal),
    won: formatFunnelStep("Won", cohortWon, cohortTotal),
    lost: formatFunnelStep("Lost", cohortLost, cohortTotal),
    still_open: formatFunnelStep("Still Open", cohortStillOpen, cohortTotal),
  };

  // --------------------------------------------------------------------------
  // 3. Average Sales Cycle (Rule S8)
  // --------------------------------------------------------------------------
  const averageSalesCycle =
    activityProjectsFinalised > 0
      ? Math.round((totalCycleDays / activityProjectsFinalised) * 10) / 10
      : null;

  // --------------------------------------------------------------------------
  // 4. Breakdowns for the Selected Period (Rule S9)
  // --------------------------------------------------------------------------
  // 4a. By Salesperson
  const spMap = new Map<string, SalespersonBreakdownItem>();
  for (const enq of enquiries) {
    const spId = enq.assigned_to || "__unassigned__";
    const spName = enq.assigned_name || "Unassigned";

    if (!spMap.has(spId)) {
      spMap.set(spId, {
        salesperson_id: spId,
        salesperson_name: spName,
        leads_received: 0,
        meetings_held: 0,
        enquiries_quoted: 0,
        projects_won: 0,
        win_value: 0,
      });
    }
    const item = spMap.get(spId)!;

    // Leads received in period
    const createdDate = toIstDateString(enq.created_at);
    if (createdDate && createdDate >= startDate && createdDate <= endDate) {
      item.leads_received++;
    }

    // Meetings held in period
    if (enq.followups) {
      for (const fu of enq.followups) {
        if (isMeetingFollowup(fu.kind)) {
          const fuDate = toIstDateString(fu.followup_date);
          if (fuDate && fuDate >= startDate && fuDate <= endDate) {
            item.meetings_held++;
          }
        }
      }
    }

    // Quoted in period
    if (enq.quotations && enq.quotations.length > 0) {
      const sentQuotes = enq.quotations.filter(
        (q) => q.sent_at !== null || q.status === "sent" || q.status === "negotiating" || q.status === "accepted"
      );
      if (sentQuotes.length > 0) {
        const sentDates = sentQuotes
          .map((q) => toIstDateString(q.sent_at || q.created_at))
          .filter((d): d is string => d !== null)
          .sort();
        const firstSent = sentDates[0];
        if (firstSent && firstSent >= startDate && firstSent <= endDate) {
          item.enquiries_quoted++;
        }
      }
    }

    // Won in period
    if (enq.status === "won" && enq.won_at) {
      const wonDate = toIstDateString(enq.won_at);
      if (wonDate && wonDate >= startDate && wonDate <= endDate) {
        item.projects_won++;
        const acceptedQuote = enq.quotations?.find((q) => q.status === "accepted");
        const winAmount = acceptedQuote
          ? Number(acceptedQuote.amount_excl_gst) || 0
          : Number(enq.expected_value_excl_gst) || 0;
        item.win_value += winAmount;
      }
    }
  }

  const breakdownBySalesperson = Array.from(spMap.values()).filter(
    (sp) => sp.leads_received > 0 || sp.meetings_held > 0 || sp.enquiries_quoted > 0 || sp.projects_won > 0
  );

  // 4b. By Lead Source (for leads received in period)
  const sourceMap = new Map<string, { id: string; name: string; leads: number; won: number; lost: number }>();
  for (const enq of cohortLeads) {
    const srcId = enq.source_id || "__direct__";
    const srcName = enq.source_name || "Direct / None";

    if (!sourceMap.has(srcId)) {
      sourceMap.set(srcId, { id: srcId, name: srcName, leads: 0, won: 0, lost: 0 });
    }
    const sItem = sourceMap.get(srcId)!;
    sItem.leads++;
    if (enq.status === "won") sItem.won++;
    if (enq.status === "lost") sItem.lost++;
  }

  const breakdownBySource: LeadSourceBreakdownItem[] = Array.from(sourceMap.values()).map((s) => ({
    source_id: s.id,
    source_name: s.name,
    leads_count: s.leads,
    won_count: s.won,
    lost_count: s.lost,
    win_rate_percent: s.leads > 0 ? Math.round((s.won / s.leads) * 1000) / 10 : 0,
  }));

  // 4c. By Lost Reason (for leads lost in period)
  const reasonMap = new Map<string, { id: string; name: string; count: number }>();
  let totalPeriodLost = 0;
  for (const enq of enquiries) {
    if (enq.status === "lost" && enq.lost_at) {
      const lostDate = toIstDateString(enq.lost_at);
      if (lostDate && lostDate >= startDate && lostDate <= endDate) {
        totalPeriodLost++;
        const rId = enq.lost_reason_id || "__unknown__";
        const rName = enq.lost_reason_name || "Unspecified Reason";
        if (!reasonMap.has(rId)) {
          reasonMap.set(rId, { id: rId, name: rName, count: 0 });
        }
        reasonMap.get(rId)!.count++;
      }
    }
  }

  const breakdownByLostReason: LostReasonBreakdownItem[] = Array.from(reasonMap.values()).map((r) => ({
    reason_id: r.id,
    reason_name: r.name,
    count: r.count,
    percentage_of_lost: totalPeriodLost > 0 ? Math.round((r.count / totalPeriodLost) * 1000) / 10 : 0,
  }));

  // --------------------------------------------------------------------------
  // 5. Open Pipeline & Follow-ups Due (Rule S10)
  // --------------------------------------------------------------------------
  let openPipelineCount = 0;
  let openPipelineValue = 0;
  let followupsDueCount = 0;

  for (const enq of enquiries) {
    if (isEnquiryInOpenPipeline(enq.status)) {
      openPipelineCount++;
      openPipelineValue += Number(enq.expected_value_excl_gst) || 0;

      if (isFollowupDue(enq, todayIst)) {
        followupsDueCount++;
      }
    }
  }

  return {
    date_range: dateRange,
    activity: {
      leads_received: activityLeadsReceived,
      meetings_held: activityMeetingsHeld,
      enquiries_quoted: activityEnquiriesQuoted,
      quotation_value_sent: activityQuotationValueSent,
      projects_finalised: activityProjectsFinalised,
      total_win_value: activityTotalWinValue,
      leads_lost: activityLeadsLost,
    },
    funnel,
    average_sales_cycle_days: averageSalesCycle,
    sales_cycle_sample_count: activityProjectsFinalised,
    breakdown_by_salesperson: breakdownBySalesperson,
    breakdown_by_source: breakdownBySource,
    breakdown_by_lost_reason: breakdownByLostReason,
    open_pipeline_count: openPipelineCount,
    open_pipeline_value: openPipelineValue,
    followups_due_count: followupsDueCount,
    finalised_projects: finalisedProjects.sort((a, b) => b.won_at.localeCompare(a.won_at)),
  };
}

/**
 * Universal mapper from an enquiry record (with relations) into SalesTrackerEnquiryInput.
 */
export function mapEnquiryRecordToTrackerInput(e: {
  id: string;
  title: string;
  customer_id: string;
  status: "open" | "quoted" | "won" | "lost";
  expected_value_excl_gst?: number | null;
  source_id?: string | null;
  assigned_to?: string | null;
  next_followup_date?: string | null;
  lost_reason_id?: string | null;
  lost_note?: string | null;
  lost_at?: string | null;
  won_at?: string | null;
  created_at: string;
  project_id?: string | null;
  customer?: { name?: string | null } | null;
  source?: { name?: string | null } | null;
  lost_reason?: { name?: string | null } | null;
  assigned_person?: { full_name?: string | null } | null;
  project?: { code?: string | null; name?: string | null } | null;
  followups?: Array<{
    id: string;
    kind: string;
    followup_date: string;
  }> | null;
  quotations?: Array<{
    id: string;
    quote_number: string;
    version: number;
    amount_excl_gst: number;
    status: string;
    validity_date?: string | null;
    sent_at?: string | null;
    accepted_at?: string | null;
    created_at?: string;
  }> | null;
}): SalesTrackerEnquiryInput {
  return {
    id: e.id,
    title: e.title,
    customer_id: e.customer_id,
    customer_name: e.customer?.name || null,
    status: e.status,
    expected_value_excl_gst: Number(e.expected_value_excl_gst) || 0,
    source_id: e.source_id,
    source_name: e.source?.name || null,
    assigned_to: e.assigned_to,
    assigned_name: e.assigned_person?.full_name || null,
    next_followup_date: e.next_followup_date,
    lost_reason_id: e.lost_reason_id,
    lost_reason_name: e.lost_reason?.name || null,
    lost_note: e.lost_note,
    lost_at: e.lost_at,
    won_at: e.won_at,
    created_at: e.created_at,
    project_id: e.project_id,
    project_code: e.project?.code || null,
    project_name: e.project?.name || null,
    followups: e.followups || [],
    quotations: e.quotations || [],
  };
}


