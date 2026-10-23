import { describe, it, expect } from "vitest";
import {
  isMeetingFollowup,
  shouldTransitionEnquiryToQuoted,
  validateEnquiryLost,
  isEnquiryInOpenPipeline,
  isFollowupDue,
  evaluateQuotationValidity,
  canConvertQuotationToProject,
  getPeriodDateRange,
  computeSalesTrackerMetrics,
  toIstDateString,
  SalesTrackerEnquiryInput,
} from "./sales";

describe("Sales Rules Engine (Rules S1 to S5, S10, S11, S12)", () => {
  describe("Rule S2 / Assumption A14: Meeting Follow-up Identification", () => {
    it("recognizes meeting and site_visit as attended meetings", () => {
      expect(isMeetingFollowup("meeting")).toBe(true);
      expect(isMeetingFollowup("site_visit")).toBe(true);
    });

    it("does not count call, message, or other as meetings", () => {
      expect(isMeetingFollowup("call")).toBe(false);
      expect(isMeetingFollowup("message")).toBe(false);
      expect(isMeetingFollowup("other")).toBe(false);
    });
  });

  describe("Rule S3: Quotation Sent Transitions Enquiry to Quoted", () => {
    it("transitions an open enquiry to quoted when quotation is sent", () => {
      expect(shouldTransitionEnquiryToQuoted("open", "sent")).toBe(true);
    });

    it("does not transition if quotation is still draft", () => {
      expect(shouldTransitionEnquiryToQuoted("open", "draft")).toBe(false);
    });

    it("does not transition if enquiry is already quoted, won, or lost", () => {
      expect(shouldTransitionEnquiryToQuoted("quoted", "sent")).toBe(false);
      expect(shouldTransitionEnquiryToQuoted("won", "sent")).toBe(false);
      expect(shouldTransitionEnquiryToQuoted("lost", "sent")).toBe(false);
    });
  });

  describe("Rule S5: Lost Enquiry Requires Reason", () => {
    it("validates when a non-empty lost_reason_id is provided", () => {
      const res = validateEnquiryLost("reason-uuid-1234");
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("rejects when lost_reason_id is missing or whitespace", () => {
      const resNull = validateEnquiryLost(null);
      expect(resNull.valid).toBe(false);
      expect(resNull.error).toContain("Rule S5");

      const resEmpty = validateEnquiryLost("  ");
      expect(resEmpty.valid).toBe(false);
      expect(resEmpty.error).toContain("Rule S5");
    });
  });

  describe("Rule S10: Open Pipeline & Due Follow-ups", () => {
    it("correctly identifies enquiries in open pipeline", () => {
      expect(isEnquiryInOpenPipeline("open")).toBe(true);
      expect(isEnquiryInOpenPipeline("quoted")).toBe(true);
      expect(isEnquiryInOpenPipeline("won")).toBe(false);
      expect(isEnquiryInOpenPipeline("lost")).toBe(false);
    });

    it("flags follow-up as due when date is today or past in IST", () => {
      const today = "2026-10-19";

      // Due today
      expect(isFollowupDue({ status: "open", next_followup_date: "2026-10-19" }, today)).toBe(true);
      // Overdue
      expect(isFollowupDue({ status: "quoted", next_followup_date: "2026-10-15" }, today)).toBe(true);
      // Future
      expect(isFollowupDue({ status: "open", next_followup_date: "2026-10-25" }, today)).toBe(false);
      // No date
      expect(isFollowupDue({ status: "open", next_followup_date: null }, today)).toBe(false);
      // Won or lost enquiry does not count as due follow-up
      expect(isFollowupDue({ status: "won", next_followup_date: "2026-10-15" }, today)).toBe(false);
      expect(isFollowupDue({ status: "lost", next_followup_date: "2026-10-15" }, today)).toBe(false);
    });
  });

  describe("Rule S11: Quotation Validity Passed & Expiry Warning", () => {
    const today = "2026-10-19";

    it("detects expired quotation when validity date has passed for sent/negotiating quotes", () => {
      const expiredSent = evaluateQuotationValidity(
        { status: "sent", validity_date: "2026-10-15" },
        today
      );
      expect(expiredSent.isPassed).toBe(true);
      expect(expiredSent.isExpiringSoon).toBe(false);
      expect(expiredSent.daysRemaining).toBeLessThan(0);

      const expiredNegotiating = evaluateQuotationValidity(
        { status: "negotiating", validity_date: "2026-10-18" },
        today
      );
      expect(expiredNegotiating.isPassed).toBe(true);
    });

    it("raises proactive warning when validity expires within 7 days", () => {
      const expiringSoon = evaluateQuotationValidity(
        { status: "sent", validity_date: "2026-10-23" },
        today
      );
      expect(expiringSoon.isPassed).toBe(false);
      expect(expiringSoon.isExpiringSoon).toBe(true);
      expect(expiringSoon.daysRemaining).toBe(4);
    });

    it("does not alert when quotation validity is well into the future", () => {
      const future = evaluateQuotationValidity(
        { status: "sent", validity_date: "2026-11-15" },
        today
      );
      expect(future.isPassed).toBe(false);
      expect(future.isExpiringSoon).toBe(false);
    });

    it("never alerts on inactive quotation statuses (draft, accepted, rejected, expired)", () => {
      const draft = evaluateQuotationValidity(
        { status: "draft", validity_date: "2026-10-10" },
        today
      );
      expect(draft.isPassed).toBe(false);

      const accepted = evaluateQuotationValidity(
        { status: "accepted", validity_date: "2026-10-10" },
        today
      );
      expect(accepted.isPassed).toBe(false);
    });
  });

  describe("Rule S12: Quotation to Project Conversion", () => {
    it("allows conversion only when quotation status is accepted", () => {
      const accepted = canConvertQuotationToProject({ status: "accepted" }, false);
      expect(accepted.allowed).toBe(true);
    });

    it("blocks conversion when quotation is in draft, sent, negotiating, or rejected status", () => {
      expect(canConvertQuotationToProject({ status: "draft" }, false).allowed).toBe(false);
      expect(canConvertQuotationToProject({ status: "sent" }, false).allowed).toBe(false);
      expect(canConvertQuotationToProject({ status: "negotiating" }, false).allowed).toBe(false);
      expect(canConvertQuotationToProject({ status: "rejected" }, false).allowed).toBe(false);
    });

    it("strictly blocks double conversion of an already converted quotation", () => {
      const doubleConv = canConvertQuotationToProject({ status: "accepted" }, true);
      expect(doubleConv.allowed).toBe(false);
      expect(doubleConv.reason).toContain("already been converted");
    });
  });

  describe("Task T14: Sales Tracker Rules (S6 to S10)", () => {
    describe("Rule S6: Period Presets & Indian FY Boundary Edge Cases", () => {
      it("accurately handles FY boundary on 31 March and 1 April in IST", () => {
        // Edge Case 1: 31 March 2026 (Last day of FY 2025-26)
        const march31 = new Date("2026-03-31T10:00:00Z");
        const rangeMarch31ThisFy = getPeriodDateRange("this_fy", march31);
        expect(rangeMarch31ThisFy.startDate).toBe("2025-04-01");
        expect(rangeMarch31ThisFy.endDate).toBe("2026-03-31");
        expect(rangeMarch31ThisFy.label).toBe("FY 2025-26");

        const rangeMarch31LastFy = getPeriodDateRange("last_fy", march31);
        expect(rangeMarch31LastFy.startDate).toBe("2024-04-01");
        expect(rangeMarch31LastFy.endDate).toBe("2025-03-31");
        expect(rangeMarch31LastFy.label).toBe("FY 2024-25");

        // Edge Case 2: 1 April 2026 (First day of FY 2026-27)
        const april1 = new Date("2026-04-01T10:00:00Z");
        const rangeApril1ThisFy = getPeriodDateRange("this_fy", april1);
        expect(rangeApril1ThisFy.startDate).toBe("2026-04-01");
        expect(rangeApril1ThisFy.endDate).toBe("2027-03-31");
        expect(rangeApril1ThisFy.label).toBe("FY 2026-27");

        const rangeApril1LastFy = getPeriodDateRange("last_fy", april1);
        expect(rangeApril1LastFy.startDate).toBe("2025-04-01");
        expect(rangeApril1LastFy.endDate).toBe("2026-03-31");
        expect(rangeApril1LastFy.label).toBe("FY 2025-26");
      });

      it("correctly computes This Month, Last Month, and This Quarter", () => {
        const refDate = new Date("2026-10-19T10:00:00Z"); // October 2026 (Q3)

        const thisMonth = getPeriodDateRange("this_month", refDate);
        expect(thisMonth.startDate).toBe("2026-10-01");
        expect(thisMonth.endDate).toBe("2026-10-31");

        const lastMonth = getPeriodDateRange("last_month", refDate);
        expect(lastMonth.startDate).toBe("2026-09-01");
        expect(lastMonth.endDate).toBe("2026-09-30");

        const thisQuarter = getPeriodDateRange("this_quarter", refDate);
        expect(thisQuarter.startDate).toBe("2026-10-01");
        expect(thisQuarter.endDate).toBe("2026-12-31");
        expect(thisQuarter.label).toContain("Q3");
      });
    });

    describe("Rule S7: Activity Block vs Cohort Funnel Distinction", () => {
      it("correctly differentiates a lead created in one period and won in another", () => {
        // Fixture:
        // Lead L1 created in September 2026 (2026-09-10) and won in October 2026 (2026-10-15)
        // with win amount Rs 50,00,000.
        const enquiries: SalesTrackerEnquiryInput[] = [
          {
            id: "enq-l1",
            title: "Steel Warehouse Shed",
            customer_id: "c1",
            status: "won",
            expected_value_excl_gst: 5000000,
            created_at: "2026-09-10T11:00:00Z",
            won_at: "2026-10-15T15:00:00Z",
            quotations: [
              {
                id: "q1",
                quote_number: "WQ-2026-001",
                version: 1,
                amount_excl_gst: 5000000,
                status: "accepted",
                sent_at: "2026-09-20T10:00:00Z",
                accepted_at: "2026-10-15T14:00:00Z",
              },
            ],
          },
        ];

        // 1. Evaluate for September 2026
        const septRange = { startDate: "2026-09-01", endDate: "2026-09-30", label: "Sep 2026" };
        const septMetrics = computeSalesTrackerMetrics(enquiries, septRange, "2026-10-19");

        // September Activity: Lead was received in Sept, quoted in Sept, but NOT finalised in Sept
        expect(septMetrics.activity.leads_received).toBe(1);
        expect(septMetrics.activity.enquiries_quoted).toBe(1);
        expect(septMetrics.activity.projects_finalised).toBe(0);
        expect(septMetrics.activity.total_win_value).toBe(0);

        // September Cohort Funnel: L1 belongs to September's cohort
        expect(septMetrics.funnel.cohort_size).toBe(1);
        expect(septMetrics.funnel.quoted.count).toBe(1);
        expect(septMetrics.funnel.won.count).toBe(1); // L1's eventual status is won

        // 2. Evaluate for October 2026
        const octRange = { startDate: "2026-10-01", endDate: "2026-10-31", label: "Oct 2026" };
        const octMetrics = computeSalesTrackerMetrics(enquiries, octRange, "2026-10-19");

        // October Activity: Lead was NOT received in Oct, but WAS finalised in Oct!
        expect(octMetrics.activity.leads_received).toBe(0);
        expect(octMetrics.activity.enquiries_quoted).toBe(0);
        expect(octMetrics.activity.projects_finalised).toBe(1);
        expect(octMetrics.activity.total_win_value).toBe(5000000);

        // October Cohort Funnel: L1 was NOT created in Oct, so October cohort is empty (N = 0)
        expect(octMetrics.funnel.cohort_size).toBe(0);
        expect(octMetrics.funnel.leads_received.count).toBe(0);
      });
    });

    describe("Rule S7.2: Cohort Funnel Multiplicity & Small-Sample Notes", () => {
      it("flags small-sample note when cohort size N < 5, and clears it when N >= 5", () => {
        const octRange = { startDate: "2026-10-01", endDate: "2026-10-31", label: "Oct 2026" };

        // Test with 4 leads (N < 5)
        const fourLeads: SalesTrackerEnquiryInput[] = Array.from({ length: 4 }).map((_, i) => ({
          id: `enq-${i}`,
          title: `Enquiry ${i}`,
          customer_id: `c-${i}`,
          status: "open",
          expected_value_excl_gst: 1000000,
          created_at: `2026-10-0${i + 1}T10:00:00Z`,
        }));

        const resFour = computeSalesTrackerMetrics(fourLeads, octRange, "2026-10-19");
        expect(resFour.funnel.cohort_size).toBe(4);
        expect(resFour.funnel.is_small_sample).toBe(true);
        expect(resFour.funnel.small_sample_note).toContain("Small sample");
        expect(resFour.funnel.leads_received.display_text).toBe("4 of 4 (100%)");

        // Test with 5 leads (N >= 5)
        const fiveLeads: SalesTrackerEnquiryInput[] = [
          ...fourLeads,
          {
            id: "enq-5",
            title: "Enquiry 5",
            customer_id: "c-5",
            status: "open",
            expected_value_excl_gst: 1000000,
            created_at: "2026-10-05T10:00:00Z",
          },
        ];

        const resFive = computeSalesTrackerMetrics(fiveLeads, octRange, "2026-10-19");
        expect(resFive.funnel.cohort_size).toBe(5);
        expect(resFive.funnel.is_small_sample).toBe(false);
        expect(resFive.funnel.small_sample_note).toBeNull();
      });

      it("counts a lead with two meetings as one lead with a meeting in funnel, but two meetings held in activity", () => {
        const octRange = { startDate: "2026-10-01", endDate: "2026-10-31", label: "Oct 2026" };

        const enquiryWithTwoMeetings: SalesTrackerEnquiryInput[] = [
          {
            id: "enq-meetings",
            title: "Factory Shed",
            customer_id: "c1",
            status: "open",
            expected_value_excl_gst: 2000000,
            created_at: "2026-10-02T10:00:00Z",
            followups: [
              { id: "f1", kind: "meeting", followup_date: "2026-10-05" },
              { id: "f2", kind: "site_visit", followup_date: "2026-10-12" }, // site_visit is meeting per S2
              { id: "f3", kind: "call", followup_date: "2026-10-14" }, // call is not a meeting
            ],
          },
        ];

        const metrics = computeSalesTrackerMetrics(enquiryWithTwoMeetings, octRange, "2026-10-19");

        // Activity: Two meetings were held in the period
        expect(metrics.activity.meetings_held).toBe(2);

        // Funnel: Exactly one lead in the cohort had at least one meeting
        expect(metrics.funnel.with_meeting.count).toBe(1);
        expect(metrics.funnel.with_meeting.display_text).toBe("1 of 1 (100%)");
      });

      it("counts a quotation with several versions as once quoted", () => {
        const octRange = { startDate: "2026-10-01", endDate: "2026-10-31", label: "Oct 2026" };

        const enquiryMultiVersionQuote: SalesTrackerEnquiryInput[] = [
          {
            id: "enq-quotes",
            title: "Commercial PEB",
            customer_id: "c1",
            status: "quoted",
            expected_value_excl_gst: 3500000,
            created_at: "2026-10-03T10:00:00Z",
            quotations: [
              {
                id: "q1",
                quote_number: "WQ-2026-010-v1",
                version: 1,
                amount_excl_gst: 3500000,
                status: "sent",
                sent_at: "2026-10-05T10:00:00Z",
              },
              {
                id: "q2",
                quote_number: "WQ-2026-010-v2",
                version: 2,
                amount_excl_gst: 3800000,
                status: "sent",
                sent_at: "2026-10-10T10:00:00Z",
              },
              {
                id: "q3",
                quote_number: "WQ-2026-010-v3",
                version: 3,
                amount_excl_gst: 3900000,
                status: "negotiating",
                sent_at: "2026-10-15T10:00:00Z",
              },
            ],
          },
        ];

        const metrics = computeSalesTrackerMetrics(enquiryMultiVersionQuote, octRange, "2026-10-19");

        // Activity: Enquiries quoted = 1 (not 3)
        expect(metrics.activity.enquiries_quoted).toBe(1);
        // Latest sent version v3 amount is used: Rs 39,00,000
        expect(metrics.activity.quotation_value_sent).toBe(3900000);

        // Funnel: Quoted count = 1
        expect(metrics.funnel.quoted.count).toBe(1);
        expect(metrics.funnel.quoted.display_text).toBe("1 of 1 (100%)");
      });
    });

    describe("Rule S8: Average Sales Cycle Calculation", () => {
      it("computes exact average days to close for wins in the period", () => {
        const octRange = { startDate: "2026-10-01", endDate: "2026-10-31", label: "Oct 2026" };

        const wins: SalesTrackerEnquiryInput[] = [
          {
            id: "win-1",
            title: "Quick Deal",
            customer_id: "c1",
            status: "won",
            expected_value_excl_gst: 1000000,
            created_at: "2026-10-01T10:00:00Z",
            won_at: "2026-10-11T10:00:00Z", // 10 days
          },
          {
            id: "win-2",
            title: "Longer Deal",
            customer_id: "c2",
            status: "won",
            expected_value_excl_gst: 2000000,
            created_at: "2026-09-11T10:00:00Z",
            won_at: "2026-10-11T10:00:00Z", // 30 days
          },
        ];

        const metrics = computeSalesTrackerMetrics(wins, octRange, "2026-10-19");

        expect(metrics.activity.projects_finalised).toBe(2);
        // Average: (10 + 30) / 2 = 20.0 days
        expect(metrics.average_sales_cycle_days).toBe(20.0);
        expect(metrics.finalised_projects).toHaveLength(2);
      });

      it("returns null when no wins occur in the period", () => {
        const octRange = { startDate: "2026-10-01", endDate: "2026-10-31", label: "Oct 2026" };
        const metrics = computeSalesTrackerMetrics([], octRange, "2026-10-19");

        expect(metrics.activity.projects_finalised).toBe(0);
        expect(metrics.average_sales_cycle_days).toBeNull();
      });
    });
  });
});

