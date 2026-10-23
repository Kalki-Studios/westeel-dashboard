import { describe, expect, it } from "vitest";
import {
  computePriority1Alerts,
  computeBillingAlerts,
  computeCashFlowAlerts,
  computeSalesAlerts,
  computeLiveAlerts,
  getIstDateString,
  Priority1AlertsInput,
} from "./alerts";

describe("Rule R11: Alerts Engine & IST Edge Cases", () => {
  it("accurately computes IST date string across midnight boundary", () => {
    // 2026-10-17T18:29:59Z is 23:59:59 on Oct 17 in IST (UTC+5:30)
    const beforeMidnightUtc = new Date("2026-10-17T18:29:59Z");
    expect(getIstDateString(beforeMidnightUtc)).toBe("2026-10-17");

    // 2026-10-17T18:30:00Z is 00:00:00 on Oct 18 in IST (UTC+5:30)
    const atMidnightUtc = new Date("2026-10-17T18:30:00Z");
    expect(getIstDateString(atMidnightUtc)).toBe("2026-10-18");
  });

  it("handles Sunday edge case without generating false Sunday missing reports", () => {
    // Reference: Sunday, Oct 18, 2026
    const sundayRef = new Date("2026-10-18T10:00:00Z");
    const input: Priority1AlertsInput = {
      projects: [
        {
          id: "p1",
          code: "WB-2026-P1",
          name: "Test Erection Proj",
          status: "active",
          stage_position: 7, // Erection
          planned_completion_date: "2026-11-30",
          milestones: [],
          // Sat 17, Fri 16, Thu 15 are reported
          existing_report_dates: ["2026-10-17", "2026-10-16", "2026-10-15"],
        },
      ],
      tasks: [],
      drawings: [],
    };

    const alerts = computePriority1Alerts(input, sundayRef);
    // Sunday does not expect a report, and past 3 completed days (Sat, Fri, Thu) are reported
    const missingAlerts = alerts.filter((a) => a.type === "missing_site_report");
    expect(missingAlerts).toHaveLength(0);
  });

  it("creates critical alert for blocked task or issue", () => {
    const input: Priority1AlertsInput = {
      projects: [],
      tasks: [
        {
          id: "t1",
          title: "Anchor Bolt Foundation Delivery",
          kind: "task",
          status: "blocked",
          blocked_reason: "Civil contractor foundation not ready",
          project_code: "WB-2026-001",
          assignee_name: "Ramesh Sharma",
          created_at: "2026-10-15T00:00:00Z",
        },
      ],
      drawings: [],
    };

    const alerts = computePriority1Alerts(input, new Date("2026-10-18T12:00:00Z"));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[0].type).toBe("blocked_task");
    expect(alerts[0].title).toContain("Anchor Bolt Foundation Delivery");
    expect(alerts[0].description).toContain("Civil contractor foundation not ready");
    expect(alerts[0].source_url).toBe("/x9admin/tasks");
  });

  it("creates high severity alert for overdue task", () => {
    const input: Priority1AlertsInput = {
      projects: [],
      tasks: [
        {
          id: "t2",
          title: "Verify Rafter Weld Quality",
          kind: "task",
          status: "in_progress",
          due_date: "2026-10-15",
          project_code: "WB-2026-002",
          assignee_name: "Amit Patel",
          created_at: "2026-10-10T00:00:00Z",
        },
      ],
      drawings: [],
    };

    // Reference: Oct 18, 2026 (3 days overdue)
    const alerts = computePriority1Alerts(input, new Date("2026-10-18T12:00:00Z"));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("high");
    expect(alerts[0].type).toBe("overdue_task");
    expect(alerts[0].age_days).toBe(3);
  });

  it("creates high severity alert for delayed project", () => {
    const input: Priority1AlertsInput = {
      projects: [
        {
          id: "p2",
          code: "WB-2026-003",
          name: "Warehouse Construction",
          status: "active",
          planned_completion_date: "2026-10-10", // Overdue completion date!
          stage_position: 7,
          milestones: [],
          existing_report_dates: ["2026-10-17", "2026-10-16", "2026-10-15"],
        },
      ],
      tasks: [],
      drawings: [],
    };

    const alerts = computePriority1Alerts(input, new Date("2026-10-18T12:00:00Z"));
    const delayedAlert = alerts.find((a) => a.type === "delayed_project");
    expect(delayedAlert).toBeDefined();
    expect(delayedAlert?.severity).toBe("high");
    expect(delayedAlert?.project_code).toBe("WB-2026-003");
  });

  it("creates warning/high alert for pending drawing approvals with age in days", () => {
    const input: Priority1AlertsInput = {
      projects: [],
      tasks: [],
      drawings: [
        {
          id: "d1",
          title: "Portal Frame GA Drawing",
          category: "drawing",
          review_status: "pending",
          version_no: 2,
          project_code: "WB-2026-004",
          created_at: "2026-10-13T00:00:00Z", // 5 days old
        },
      ],
    };

    const alerts = computePriority1Alerts(input, new Date("2026-10-18T12:00:00Z"));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("pending_drawing");
    expect(alerts[0].age_days).toBe(5);
    expect(alerts[0].severity).toBe("high"); // age >= 3 days escalates to high
  });

  it("sorts alerts by critical severity first, then high, then warning", () => {
    const input: Priority1AlertsInput = {
      projects: [],
      tasks: [
        {
          id: "t_overdue",
          title: "Overdue Task",
          kind: "task",
          status: "in_progress",
          due_date: "2026-10-15",
          created_at: "2026-10-10T00:00:00Z",
        },
        {
          id: "t_blocked",
          title: "Blocked Task",
          kind: "task",
          status: "blocked",
          blocked_reason: "Crane broke down",
          created_at: "2026-10-16T00:00:00Z",
        },
      ],
      drawings: [
        {
          id: "d_new",
          title: "Fresh Drawing",
          category: "drawing",
          review_status: "pending",
          version_no: 1,
          created_at: "2026-10-18T00:00:00Z", // 0 days old -> warning
        },
      ],
    };

    const alerts = computePriority1Alerts(input, new Date("2026-10-18T12:00:00Z"));
    expect(alerts).toHaveLength(3);
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[1].severity).toBe("high");
    expect(alerts[2].severity).toBe("warning");
  });

  it("returns empty array for clean empty input without throwing errors", () => {
    const alerts = computePriority1Alerts({ projects: [], tasks: [], drawings: [] });
    expect(alerts).toEqual([]);
  });

  it("computes overdue_receivable and invoice_to_raise alerts properly", () => {
    const todayRef = new Date("2026-10-18T10:00:00Z");

    const billingInput = {
      invoices: [
        {
          id: "inv-1",
          invoice_number: "INV-2026-101",
          project_id: "p1",
          project_code: "WB-P1",
          project_name: "Project 1",
          due_date: "2026-10-01", // 17 days overdue
          is_cancelled: false,
          outstanding_paise: 50000000, // ₹5L
        },
        {
          id: "inv-cancelled",
          invoice_number: "INV-CANC",
          project_id: "p1",
          project_code: "WB-P1",
          project_name: "Project 1",
          due_date: "2026-09-01",
          is_cancelled: true,
          outstanding_paise: 10000000,
        },
      ],
      milestones: [
        {
          id: "m1",
          label: "Advance 20%",
          project_id: "p1",
          project_code: "WB-P1",
          project_name: "Project 1",
          expected_date: "2026-10-22", // 4 days away
          amount_excl_gst: 1000000,
          has_active_invoice: false,
        },
        {
          id: "m2",
          label: "Structure 30%",
          project_id: "p1",
          project_code: "WB-P1",
          project_name: "Project 1",
          expected_date: "2026-10-20",
          amount_excl_gst: 1500000,
          has_active_invoice: true, // already invoiced
        },
      ],
    };

    const alerts = computeBillingAlerts(billingInput, todayRef);
    expect(alerts).toHaveLength(2);

    const overdueAlert = alerts.find((a) => a.type === "overdue_receivable");
    expect(overdueAlert).toBeDefined();
    expect(overdueAlert?.title).toContain("INV-2026-101");
    expect(overdueAlert?.severity).toBe("high");

    const invoiceAlert = alerts.find((a) => a.type === "invoice_to_raise");
    expect(invoiceAlert).toBeDefined();
    expect(invoiceAlert?.title).toContain("Advance 20%");
    expect(invoiceAlert?.severity).toBe("warning");
  });

  it("generates critical alert for projected cash shortfall and warning for stale bank balances", () => {
    const cashAlerts = computeCashFlowAlerts({
      has_projected_shortfall: true,
      shortfall_bucket: "days_8_to_30",
      shortfall_amount_paise: 30000000,
      shortfall_message: "Projected cash shortfall in bucket 8 to 30 days: negative balance.",
      is_stale: true,
      stale_warning: "Stale: update balances",
      as_of_date: "2026-10-05",
    });

    expect(cashAlerts).toHaveLength(2);

    const shortfallAlert = cashAlerts.find((a) => a.type === "cash_shortfall");
    expect(shortfallAlert).toBeDefined();
    expect(shortfallAlert?.severity).toBe("critical");
    expect(shortfallAlert?.source_url).toBe("/x9admin/cashflow");

    const staleAlert = cashAlerts.find((a) => a.type === "stale_bank_balance");
    expect(staleAlert).toBeDefined();
    expect(staleAlert?.severity).toBe("warning");
    expect(staleAlert?.description).toContain("2026-10-05");

    // Also verify computeLiveAlerts incorporates it
    const liveAlerts = computeLiveAlerts(
      { projects: [], tasks: [], drawings: [] },
      undefined,
      undefined,
      {
        has_projected_shortfall: true,
        is_stale: false,
      }
    );

    expect(liveAlerts.some((a) => a.type === "cash_shortfall")).toBe(true);
  });

  it("generates critical and warning alerts for Rule S10 (follow-up due) and S11 (validity passed)", () => {
    const fixedToday = new Date("2026-10-18T10:00:00Z"); // Oct 18, 2026

    const salesAlerts = computeSalesAlerts(
      {
        enquiries: [
          {
            id: "enq-overdue",
            title: "Steel Warehouse Durgapur",
            status: "open",
            next_followup_date: "2026-10-15", // 3 days overdue
            customer_name: "Acme Logistics",
            assigned_name: "Salesperson A",
          },
          {
            id: "enq-today",
            title: "Factory Shed Asansol",
            status: "quoted",
            next_followup_date: "2026-10-18", // due today
            customer_name: "Bharat Steels",
            assigned_name: "Salesperson B",
          },
          {
            id: "enq-future",
            title: "Industrial Roof",
            status: "open",
            next_followup_date: "2026-10-25", // future - no alert
            customer_name: "Future Client",
          },
          {
            id: "enq-won",
            title: "Won Project",
            status: "won",
            next_followup_date: "2026-10-10", // won - no open alert
          },
        ],
        quotations: [
          {
            id: "q-expired",
            quote_number: "WQ-2026-001",
            status: "sent",
            validity_date: "2026-10-10", // expired
            enquiry_id: "enq-overdue",
            enquiry_title: "Steel Warehouse Durgapur",
          },
          {
            id: "q-accepted-past-validity",
            quote_number: "WQ-2026-002",
            status: "accepted", // accepted, not sent/negotiating - no expiry alert
            validity_date: "2026-10-10",
            enquiry_id: "enq-won",
          },
          {
            id: "q-valid",
            quote_number: "WQ-2026-003",
            status: "sent",
            validity_date: "2026-10-25", // valid
            enquiry_id: "enq-today",
          },
        ],
      },
      fixedToday
    );

    expect(salesAlerts).toHaveLength(3);

    // 1. Overdue enquiry (critical)
    const overdueEnqAlert = salesAlerts.find((a) => a.id === "alert-followup-enq-overdue");
    expect(overdueEnqAlert).toBeDefined();
    expect(overdueEnqAlert?.severity).toBe("critical");
    expect(overdueEnqAlert?.age_days).toBe(3);
    expect(overdueEnqAlert?.source_url).toBe("/x9admin/sales");

    // 2. Due today enquiry (warning)
    const todayEnqAlert = salesAlerts.find((a) => a.id === "alert-followup-enq-today");
    expect(todayEnqAlert).toBeDefined();
    expect(todayEnqAlert?.severity).toBe("warning");
    expect(todayEnqAlert?.age_days).toBe(0);

    // 3. Expired quotation (critical)
    const expiredQuoteAlert = salesAlerts.find((a) => a.id === "alert-quotation-validity-q-expired");
    expect(expiredQuoteAlert).toBeDefined();
    expect(expiredQuoteAlert?.severity).toBe("critical");
    expect(expiredQuoteAlert?.age_days).toBe(8);

    // Live alerts integration check
    const liveAlerts = computeLiveAlerts(
      { projects: [], tasks: [], drawings: [] },
      undefined,
      undefined,
      undefined,
      fixedToday,
      {
        enquiries: [
          {
            id: "enq-1",
            title: "Live Lead",
            status: "open",
            next_followup_date: "2026-10-15",
          },
        ],
        quotations: [],
      }
    );

    expect(liveAlerts.some((a) => a.type === "sales_followup_due")).toBe(true);
  });
});

