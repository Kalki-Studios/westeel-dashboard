import { differenceInDays, parseISO } from "date-fns";
import { isProjectDelayed, ProjectMilestoneItem, ProjectRuleInput } from "./projects";
import { isTaskOverdue, isTaskBlocked, TaskStatus } from "./tasks";
import { isDrawingPendingApproval, getDrawingAgeDays, DrawingReviewStatus, DocCategory } from "./documents";
import { findMissingSiteReportDates } from "./site-reports";
import { formatPaise, rupeesToPaise } from "../money";
import { isVendorOrderLate } from "./costs";

export type AlertSeverity = "critical" | "high" | "warning" | "info";

export type AlertType =
  | "delayed_project"
  | "overdue_task"
  | "blocked_task"
  | "pending_drawing"
  | "missing_site_report"
  | "overdue_receivable"
  | "invoice_to_raise"
  | "late_vendor_order"
  | "overdue_payable"
  | "cost_overrun"
  | "cash_shortfall"
  | "stale_bank_balance"
  | "sales_followup_due"
  | "quotation_validity_passed";

export interface AlertItem {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  age_days: number;
  project_id?: string | null;
  project_code?: string | null;
  project_name?: string | null;
  assigned_person?: string | null;
  source_url: string;
  created_at: string;
}

export interface ProjectAlertInput {
  id: string;
  code: string;
  name: string;
  status: string;
  planned_completion_date: string;
  stage_position?: number | null;
  milestones: Array<{
    id: string;
    title: string;
    plannedDate?: string | null;
    actualDate?: string | null;
    status: string;
    delayReason?: string | null;
    delayNote?: string | null;
  }>;
  existing_report_dates?: string[];
}

export interface TaskAlertInput {
  id: string;
  title: string;
  kind: "task" | "issue";
  status: string;
  due_date?: string | null;
  blocked_reason?: string | null;
  project_id?: string | null;
  project_code?: string | null;
  project_name?: string | null;
  assignee_name?: string | null;
  created_at: string;
}

export interface DrawingAlertInput {
  id: string;
  title: string;
  category: DocCategory;
  review_status?: DrawingReviewStatus | null;
  version_no: number;
  project_id?: string | null;
  project_code?: string | null;
  project_name?: string | null;
  created_at: string;
}

export interface Priority1AlertsInput {
  projects: ProjectAlertInput[];
  tasks: TaskAlertInput[];
  drawings: DrawingAlertInput[];
}

export interface InvoiceAlertInput {
  id: string;
  invoice_number: string;
  project_id: string;
  project_code: string;
  project_name: string;
  due_date: string;
  is_cancelled: boolean;
  outstanding_paise: number;
}

export interface PaymentMilestoneAlertInput {
  id: string;
  label: string;
  project_id: string;
  project_code: string;
  project_name: string;
  expected_date: string;
  amount_excl_gst: number;
  has_active_invoice: boolean;
}

export interface BillingAlertsInput {
  invoices: InvoiceAlertInput[];
  milestones: PaymentMilestoneAlertInput[];
}

/**
 * Returns YYYY-MM-DD string in Asia/Kolkata timezone.
 * Handles edge cases like midnight IST.
 */
export function getIstDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Rule R11: Computes Priority 1 live alerts on read.
 * Generates alerts for:
 * 1. Blocked Tasks / Issues (Critical) per R3
 * 2. Overdue Tasks (High) per R3
 * 3. Delayed Projects (High) per R1
 * 4. Missing Site Reports (High) per R4
 * 5. Pending Drawing Approvals (Warning) per R5
 *
 * Every alert contains: type, severity, project, age, assigned person, and clickable source URL.
 */
export function computePriority1Alerts(
  input: Priority1AlertsInput,
  currentDate: Date = new Date()
): AlertItem[] {
  const alerts: AlertItem[] = [];
  const todayIstStr = getIstDateString(currentDate);
  const todayRef = parseISO(todayIstStr);

  // 1. Tasks: Blocked & Issues (Critical) per R3
  for (const task of input.tasks) {
    if (isTaskBlocked({ status: task.status as TaskStatus })) {
      const taskDate = task.created_at ? parseISO(task.created_at.split("T")[0]) : todayRef;
      const ageDays = Math.max(0, differenceInDays(todayRef, taskDate));

      alerts.push({
        id: `alert-blocked-${task.id}`,
        type: "blocked_task",
        severity: "critical",
        title: task.kind === "issue" ? `Issue Blocked: ${task.title}` : `Task Blocked: ${task.title}`,
        description: task.blocked_reason
          ? `Reason: ${task.blocked_reason}`
          : "Work is halted awaiting resolution.",
        age_days: ageDays,
        project_id: task.project_id,
        project_code: task.project_code,
        project_name: task.project_name,
        assigned_person: task.assignee_name || "Unassigned",
        source_url: "/x9admin/tasks",
        created_at: task.created_at,
      });
    }
  }

  // 2. Tasks: Overdue Tasks (High) per R3
  for (const task of input.tasks) {
    if (isTaskOverdue({ status: task.status as TaskStatus, dueDate: task.due_date }, currentDate)) {
      const dueDate = task.due_date ? parseISO(task.due_date) : todayRef;
      const ageDays = Math.max(1, differenceInDays(todayRef, dueDate));

      alerts.push({
        id: `alert-overdue-${task.id}`,
        type: "overdue_task",
        severity: "high",
        title: `Overdue Task: ${task.title}`,
        description: `Due date was ${task.due_date} (${ageDays} day${ageDays === 1 ? "" : "s"} overdue).`,
        age_days: ageDays,
        project_id: task.project_id,
        project_code: task.project_code,
        project_name: task.project_name,
        assigned_person: task.assignee_name || "Unassigned",
        source_url: "/x9admin/tasks",
        created_at: task.created_at,
      });
    }
  }

  // 3. Projects: Delayed Projects (High) per R1
  for (const project of input.projects) {
    const milestonesForRule: ProjectMilestoneItem[] = project.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      plannedDate: m.plannedDate,
      actualDate: m.actualDate,
      status: m.status as ProjectMilestoneItem["status"],
      delayReason: m.delayReason as ProjectMilestoneItem["delayReason"],
      delayNote: m.delayNote,
    }));

    const delayCheck = isProjectDelayed(
      {
        status: project.status as ProjectRuleInput["status"],
        plannedCompletionDate: project.planned_completion_date,
        milestones: milestonesForRule,
      },
      currentDate
    );

    if (delayCheck.isDelayed) {
      let ageDays = 0;
      if (delayCheck.reason === "project_overdue" && project.planned_completion_date) {
        ageDays = Math.max(1, differenceInDays(todayRef, parseISO(project.planned_completion_date)));
      } else {
        // Milestone overdue age
        const overdueMilestones = project.milestones.filter(
          (m) => m.status === "pending" && m.plannedDate && parseISO(m.plannedDate) < todayRef
        );
        if (overdueMilestones.length > 0) {
          const oldest = overdueMilestones.sort(
            (a, b) => new Date(a.plannedDate!).getTime() - new Date(b.plannedDate!).getTime()
          )[0];
          ageDays = Math.max(1, differenceInDays(todayRef, parseISO(oldest.plannedDate!)));
        }
      }

      alerts.push({
        id: `alert-project-delayed-${project.id}`,
        type: "delayed_project",
        severity: "high",
        title: `Project Delayed: ${project.code}`,
        description:
          delayCheck.reason === "project_overdue"
            ? `Planned completion was ${project.planned_completion_date}. Overdue by ${ageDays} days.`
            : `One or more critical project milestones are overdue (${ageDays} days delayed).`,
        age_days: ageDays,
        project_id: project.id,
        project_code: project.code,
        project_name: project.name,
        source_url: `/x9admin/projects/${project.id}`,
        created_at: new Date().toISOString(),
      });
    }
  }

  // 4. Missing Site Reports per R4 (High)
  for (const project of input.projects) {
    const missingDates = findMissingSiteReportDates(
      {
        status: project.status,
        stagePosition: project.stage_position,
        existingReportDates: project.existing_report_dates || [],
      },
      currentDate
    );

    for (const missingDate of missingDates) {
      const missingParsed = parseISO(missingDate);
      const ageDays = Math.max(1, differenceInDays(todayRef, missingParsed));

      alerts.push({
        id: `alert-missing-report-${project.id}-${missingDate}`,
        type: "missing_site_report",
        severity: "high",
        title: `Missing Site Report: ${project.code}`,
        description: `No daily site report submitted for ${missingDate} (Stage ${project.stage_position ?? "-"}).`,
        age_days: ageDays,
        project_id: project.id,
        project_code: project.code,
        project_name: project.name,
        source_url: `/x9admin/site-reports?projectId=${project.id}`,
        created_at: new Date().toISOString(),
      });
    }
  }

  // 5. Drawings: Pending Review per R5 (Warning / High if > 3 days)
  for (const drawing of input.drawings) {
    if (
      isDrawingPendingApproval({
        category: drawing.category,
        reviewStatus: drawing.review_status,
        createdAt: drawing.created_at,
      })
    ) {
      const ageDays = getDrawingAgeDays(
        {
          category: drawing.category,
          reviewStatus: drawing.review_status,
          createdAt: drawing.created_at,
        },
        currentDate
      );

      alerts.push({
        id: `alert-pending-drawing-${drawing.id}`,
        type: "pending_drawing",
        severity: ageDays >= 3 ? "high" : "warning",
        title: `Drawing Pending Approval: ${drawing.title}`,
        description: `Revision v${drawing.version_no} awaiting review by Director or PM (${ageDays} day${ageDays === 1 ? "" : "s"} old).`,
        age_days: ageDays,
        project_id: drawing.project_id,
        project_code: drawing.project_code,
        project_name: drawing.project_name,
        source_url: "/x9admin/documents",
        created_at: drawing.created_at,
      });
    }
  }

  // Sort alerts: Critical first, then High, then Warning, then by age descending
  const severityRank: Record<AlertSeverity, number> = {
    critical: 0,
    high: 1,
    warning: 2,
    info: 3,
  };

  return alerts.sort((a, b) => {
    if (severityRank[a.severity] !== severityRank[b.severity]) {
      return severityRank[a.severity] - severityRank[b.severity];
    }
    return b.age_days - a.age_days;
  });
}

/**
 * Computes Priority 2 Billing and Collections alerts live on read:
 * 1. Overdue Receivables per Rule F4 (Critical if >30 days, High if 1-30 days)
 * 2. Milestones with expected_date within 7 days without an active linked invoice per Rule F5
 */
export function computeBillingAlerts(
  input: BillingAlertsInput,
  currentDate: Date = new Date()
): AlertItem[] {
  const alerts: AlertItem[] = [];
  const todayIstStr = getIstDateString(currentDate);
  const todayRef = parseISO(todayIstStr);

  // 1. Overdue Receivables per Rule F4
  for (const inv of input.invoices) {
    if (inv.is_cancelled || inv.outstanding_paise <= 0) continue;

    const due = parseISO(inv.due_date);
    const diff = differenceInDays(todayRef, due);

    if (diff > 0) {
      alerts.push({
        id: `alert-overdue-receivable-${inv.id}`,
        type: "overdue_receivable",
        severity: diff > 30 ? "critical" : "high",
        title: `Overdue Receivable: ${inv.invoice_number}`,
        description: `Outstanding ${formatPaise(inv.outstanding_paise)} is ${diff} day${diff === 1 ? "" : "s"} overdue (Due: ${inv.due_date}). Project: ${inv.project_code}.`,
        age_days: diff,
        project_id: inv.project_id,
        project_code: inv.project_code,
        project_name: inv.project_name,
        source_url: "/x9admin/collections",
        created_at: new Date().toISOString(),
      });
    }
  }

  // 2. Invoice to Raise per Rule F5
  for (const m of input.milestones) {
    if (m.has_active_invoice) continue;

    const expected = parseISO(m.expected_date);
    const daysUntilExpected = differenceInDays(expected, todayRef);

    // Due within 7 days (or already overdue)
    if (daysUntilExpected <= 7) {
      const isOverdue = daysUntilExpected < 0;
      const ageDays = isOverdue ? Math.abs(daysUntilExpected) : 0;

      alerts.push({
        id: `alert-invoice-to-raise-${m.id}`,
        type: "invoice_to_raise",
        severity: isOverdue ? "high" : "warning",
        title: `Invoice to Raise: ${m.label}`,
        description: `Payment milestone of ${formatPaise(rupeesToPaise(m.amount_excl_gst))} expected on ${m.expected_date} (${isOverdue ? `${ageDays} days overdue` : `due in ${daysUntilExpected} days`}) has no invoice raised.`,
        age_days: ageDays,
        project_id: m.project_id,
        project_code: m.project_code,
        project_name: m.project_name,
        source_url: `/x9admin/projects/${m.project_id}?tab=billing`,
        created_at: new Date().toISOString(),
      });
    }
  }

  const severityRank: Record<AlertSeverity, number> = {
    critical: 0,
    high: 1,
    warning: 2,
    info: 3,
  };

  return alerts.sort((a, b) => {
    if (severityRank[a.severity] !== severityRank[b.severity]) {
      return severityRank[a.severity] - severityRank[b.severity];
    }
    return b.age_days - a.age_days;
  });
}

export interface CostAlertsInput {
  vendorOrders: Array<{
    id: string;
    project_id: string;
    project_code: string;
    project_name: string;
    vendor_name: string;
    description: string;
    expected_delivery_date: string;
    fulfilment_status: "ordered" | "in_progress" | "partially_fulfilled" | "fulfilled" | "issue" | "cancelled";
  }>;
  bills: Array<{
    id: string;
    project_id: string;
    project_code: string;
    project_name: string;
    vendor_name: string;
    bill_number: string;
    due_date: string;
    outstanding_paise: number;
    is_cancelled: boolean;
  }>;
  projectsOverrun?: Array<{
    project_id: string;
    project_code: string;
    project_name: string;
    budget_paise: number;
    forecast_cost_paise: number;
    overrun_paise: number;
    category_name?: string;
  }>;
}

/**
 * Computes Priority 2 Vendor Orders, Payables, and Cost Overrun alerts live on read:
 * 1. Late or in trouble vendor orders per Rule R9
 * 2. Overdue payables per Rule F7 (Critical if >30 days, High if 1-30 days)
 * 3. Cost overruns per Rule F10
 */
export function computeCostAlerts(
  input: CostAlertsInput,
  currentDate: Date = new Date()
): AlertItem[] {
  const alerts: AlertItem[] = [];
  const todayIstStr = getIstDateString(currentDate);
  const todayRef = parseISO(todayIstStr);

  // 1. Late or troubled vendor orders (Rule R9)
  for (const ord of input.vendorOrders) {
    const lateCheck = isVendorOrderLate(ord, todayIstStr);
    if (lateCheck.isTrouble) {
      const ageDays = Math.max(1, lateCheck.daysLate || 1);
      const isLate = lateCheck.isLate;

      alerts.push({
        id: `alert-late-order-${ord.id}`,
        type: "late_vendor_order",
        severity: isLate && ageDays >= 7 ? "critical" : isLate ? "high" : "warning",
        title: `${isLate ? "Late Vendor Order" : "Vendor Order Issue"}: ${ord.vendor_name}`,
        description: `Order "${ord.description}" for ${ord.project_code} (${ord.project_name}) is ${
          isLate ? `${ageDays} day${ageDays === 1 ? "" : "s"} overdue` : "flagged with issue"
        } (Expected: ${ord.expected_delivery_date}).`,
        age_days: ageDays,
        project_id: ord.project_id,
        project_code: ord.project_code,
        project_name: ord.project_name,
        source_url: `/x9admin/projects/${ord.project_id}?tab=orders`,
        created_at: new Date().toISOString(),
      });
    }
  }

  // 2. Overdue Payables (Rule F7)
  for (const bill of input.bills) {
    if (bill.is_cancelled || bill.outstanding_paise <= 0) continue;

    const due = parseISO(bill.due_date);
    const diff = differenceInDays(todayRef, due);

    if (diff > 0) {
      alerts.push({
        id: `alert-overdue-payable-${bill.id}`,
        type: "overdue_payable",
        severity: diff > 30 ? "critical" : "high",
        title: `Overdue Payable: ${bill.vendor_name} (${bill.bill_number})`,
        description: `Vendor bill of ${formatPaise(bill.outstanding_paise)} for ${bill.project_code} is ${diff} day${
          diff === 1 ? "" : "s"
        } overdue (Due: ${bill.due_date}).`,
        age_days: diff,
        project_id: bill.project_id,
        project_code: bill.project_code,
        project_name: bill.project_name,
        source_url: `/x9admin/payables`,
        created_at: new Date().toISOString(),
      });
    }
  }

  // 3. Cost Overruns (Rule F10)
  for (const overrun of input.projectsOverrun || []) {
    if (overrun.overrun_paise <= 0) continue;

    alerts.push({
      id: `alert-cost-overrun-${overrun.project_id}-${overrun.category_name || "total"}`,
      type: "cost_overrun",
      severity: overrun.overrun_paise > 10000000 ? "high" : "warning",
      title: `Cost Overrun: ${overrun.project_code}`,
      description: `Forecast cost (${formatPaise(overrun.forecast_cost_paise)}) exceeds budget (${formatPaise(
        overrun.budget_paise
      )}) by ${formatPaise(overrun.overrun_paise)}${
        overrun.category_name ? ` in category "${overrun.category_name}"` : ""
      }.`,
      age_days: 1,
      project_id: overrun.project_id,
      project_code: overrun.project_code,
      project_name: overrun.project_name,
      source_url: `/x9admin/projects/${overrun.project_id}?tab=profitability`,
      created_at: new Date().toISOString(),
    });
  }

  const severityRank: Record<AlertSeverity, number> = {
    critical: 0,
    high: 1,
    warning: 2,
    info: 3,
  };

  return alerts.sort((a, b) => {
    if (severityRank[a.severity] !== severityRank[b.severity]) {
      return severityRank[a.severity] - severityRank[b.severity];
    }
    return b.age_days - a.age_days;
  });
}

export interface CashFlowAlertsInput {
  has_projected_shortfall: boolean;
  shortfall_bucket?: string;
  shortfall_amount_paise?: number;
  shortfall_message?: string;
  is_stale: boolean;
  stale_warning?: string | null;
  as_of_date?: string | null;
}

export function computeCashFlowAlerts(input: CashFlowAlertsInput): AlertItem[] {
  const alerts: AlertItem[] = [];

  if (input.has_projected_shortfall) {
    alerts.push({
      id: `alert-cash-shortfall`,
      type: "cash_shortfall",
      severity: "critical",
      title: "Projected Cash Shortfall",
      description:
        input.shortfall_message ||
        "Projected cash deficit detected within 30 days.",
      age_days: 0,
      source_url: "/x9admin/cashflow",
      created_at: new Date().toISOString(),
    });
  }

  if (input.is_stale) {
    alerts.push({
      id: `alert-stale-bank-balance`,
      type: "stale_bank_balance",
      severity: "warning",
      title: "Stale Bank Balances",
      description: `Bank balance entries are older than 7 days${
        input.as_of_date ? ` (as of ${input.as_of_date})` : ""
      }. Please update account balances.`,
      age_days: 7,
      source_url: "/x9admin/cashflow",
      created_at: new Date().toISOString(),
    });
  }

  return alerts;
}

export interface SalesAlertsInput {
  enquiries: Array<{
    id: string;
    title: string;
    status: string;
    next_followup_date?: string | null;
    customer_name?: string | null;
    assigned_name?: string | null;
  }>;
  quotations: Array<{
    id: string;
    quote_number: string;
    status: string;
    validity_date?: string | null;
    enquiry_id: string;
    enquiry_title?: string | null;
  }>;
}

export function computeSalesAlerts(
  input: SalesAlertsInput,
  currentDate: Date = new Date()
): AlertItem[] {
  const alerts: AlertItem[] = [];
  const todayStr = getIstDateString(currentDate);

  // S10: Follow-up due (next_followup_date <= today)
  for (const enq of input.enquiries) {
    if ((enq.status === "open" || enq.status === "quoted") && enq.next_followup_date) {
      if (enq.next_followup_date <= todayStr) {
        const isOverdue = enq.next_followup_date < todayStr;
        const ageDays = isOverdue
          ? Math.max(1, differenceInDays(currentDate, parseISO(enq.next_followup_date)))
          : 0;

        alerts.push({
          id: `alert-followup-${enq.id}`,
          type: "sales_followup_due",
          severity: isOverdue ? "critical" : "warning",
          title: isOverdue ? `Follow-up Overdue: ${enq.title}` : `Follow-up Due: ${enq.title}`,
          description: `Customer: ${enq.customer_name || "Unknown"} • Assigned: ${
            enq.assigned_name || "Unassigned"
          }${isOverdue ? ` • Overdue by ${ageDays} days` : " • Scheduled for today"}`,
          age_days: ageDays,
          assigned_person: enq.assigned_name || null,
          source_url: "/x9admin/sales",
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  // S11: Quotation validity passed (status in sent/negotiating and validity_date < today)
  for (const q of input.quotations) {
    if (
      (q.status === "sent" || q.status === "negotiating") &&
      q.validity_date &&
      q.validity_date < todayStr
    ) {
      const ageDays = Math.max(1, differenceInDays(currentDate, parseISO(q.validity_date)));
      alerts.push({
        id: `alert-quotation-validity-${q.id}`,
        type: "quotation_validity_passed",
        severity: "critical",
        title: `Quotation Validity Expired (S11): ${q.quote_number}`,
        description: `Quotation for "${q.enquiry_title || "Enquiry"}" passed validity date on ${
          q.validity_date
        } (${ageDays} days ago). Status retained per Rule S11.`,
        age_days: ageDays,
        source_url: "/x9admin/sales",
        created_at: new Date().toISOString(),
      });
    }
  }

  return alerts;
}

/**
 * Combined live alerts across all priorities (P1, P2, and P3 Sales).
 */
export function computeLiveAlerts(
  p1Input: Priority1AlertsInput,
  billingInput?: BillingAlertsInput,
  costInput?: CostAlertsInput,
  cashflowInput?: CashFlowAlertsInput,
  currentDateOrSalesInput?: Date | SalesAlertsInput,
  maybeSalesInput?: SalesAlertsInput
): AlertItem[] {
  let currentDate = new Date();
  let salesInput: SalesAlertsInput | undefined = undefined;

  if (currentDateOrSalesInput instanceof Date) {
    currentDate = currentDateOrSalesInput;
    salesInput = maybeSalesInput;
  } else if (currentDateOrSalesInput && typeof currentDateOrSalesInput === "object") {
    salesInput = currentDateOrSalesInput as SalesAlertsInput;
  }

  const p1Alerts = computePriority1Alerts(p1Input, currentDate);
  const p2BillingAlerts = billingInput ? computeBillingAlerts(billingInput, currentDate) : [];
  const p2CostAlerts = costInput ? computeCostAlerts(costInput, currentDate) : [];
  const p2CashflowAlerts = cashflowInput ? computeCashFlowAlerts(cashflowInput) : [];
  const p3SalesAlerts = salesInput ? computeSalesAlerts(salesInput, currentDate) : [];

  const combined = [
    ...p1Alerts,
    ...p2BillingAlerts,
    ...p2CostAlerts,
    ...p2CashflowAlerts,
    ...p3SalesAlerts,
  ];

  const severityRank: Record<AlertSeverity, number> = {
    critical: 0,
    high: 1,
    warning: 2,
    info: 3,
  };

  return combined.sort((a, b) => {
    if (severityRank[a.severity] !== severityRank[b.severity]) {
      return severityRank[a.severity] - severityRank[b.severity];
    }
    return b.age_days - a.age_days;
  });
}


