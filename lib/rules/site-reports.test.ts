import { describe, expect, it } from "vitest";
import {
  findMissingSiteReportDates,
  getLastNWorkingDays,
  isStageEligibleForSiteReport,
  isWorkingDay,
  isSiteReportEditableBySubmitter,
  getResubmissionStatus,
  SiteReportRuleInput,
} from "./site-reports";

describe("Rule R4: Working-Day Logic (Assumption A1: Mon to Sat, Sunday off)", () => {
  it("correctly identifies working days (Mon-Sat) and non-working days (Sun)", () => {
    // 2026-10-18 is Sunday
    expect(isWorkingDay(new Date("2026-10-18T12:00:00Z"))).toBe(false);
    // 2026-10-19 is Monday
    expect(isWorkingDay(new Date("2026-10-19T12:00:00Z"))).toBe(true);
    // 2026-10-24 is Saturday
    expect(isWorkingDay(new Date("2026-10-24T12:00:00Z"))).toBe(true);
  });

  it("calculates last 3 completed working days when today is Sunday (skips Sunday)", () => {
    // Reference date: Sunday, 2026-10-18
    const days = getLastNWorkingDays(new Date("2026-10-18T12:00:00Z"), 3);
    // Saturday 17th, Friday 16th, Thursday 15th
    expect(days).toEqual(["2026-10-17", "2026-10-16", "2026-10-15"]);
  });

  it("calculates last 3 completed working days when today is Monday (skips Sunday)", () => {
    // Reference date: Monday, 2026-10-19
    const days = getLastNWorkingDays(new Date("2026-10-19T12:00:00Z"), 3);
    // Sunday 18th is skipped; should return Sat 17th, Fri 16th, Thu 15th
    expect(days).toEqual(["2026-10-17", "2026-10-16", "2026-10-15"]);
  });

  it("calculates last 3 completed working days when today is Tuesday (skips Sunday)", () => {
    // Reference date: Tuesday, 2026-10-20
    const days = getLastNWorkingDays(new Date("2026-10-20T12:00:00Z"), 3);
    // Monday 19th, Sunday 18th skipped, Saturday 17th, Friday 16th
    expect(days).toEqual(["2026-10-19", "2026-10-17", "2026-10-16"]);
  });
});

describe("Rule R4: Stage Eligibility and Missing Report Detection", () => {
  it("only considers stages 6, 7, and 8 eligible for daily site reports", () => {
    expect(isStageEligibleForSiteReport(1)).toBe(false); // Enquiry
    expect(isStageEligibleForSiteReport(5)).toBe(false); // Dispatch
    expect(isStageEligibleForSiteReport(6)).toBe(true);  // Site readiness
    expect(isStageEligibleForSiteReport(7)).toBe(true);  // Erection and installation
    expect(isStageEligibleForSiteReport(8)).toBe(true);  // Inspection & defect
    expect(isStageEligibleForSiteReport(9)).toBe(false); // Handover
  });

  it("does not report missing reports for inactive projects", () => {
    const input: SiteReportRuleInput = {
      status: "completed",
      stagePosition: 7,
      existingReportDates: [],
    };
    const missing = findMissingSiteReportDates(input, new Date("2026-10-20T12:00:00Z"));
    expect(missing).toEqual([]);
  });

  it("does not report missing reports for stages outside 6, 7, 8", () => {
    const input: SiteReportRuleInput = {
      status: "active",
      stagePosition: 3, // Engineering
      existingReportDates: [],
    };
    const missing = findMissingSiteReportDates(input, new Date("2026-10-20T12:00:00Z"));
    expect(missing).toEqual([]);
  });

  it("returns missing dates when reports are missing for eligible stages", () => {
    // Tuesday 2026-10-20 expects: 2026-10-19, 2026-10-17, 2026-10-16
    const input: SiteReportRuleInput = {
      status: "active",
      stagePosition: 7, // Erection
      existingReportDates: ["2026-10-19"], // 17th and 16th missing!
    };
    const missing = findMissingSiteReportDates(input, new Date("2026-10-20T12:00:00Z"));
    expect(missing).toEqual(["2026-10-17", "2026-10-16"]);
  });

  it("returns empty array when all 3 previous working days have reports", () => {
    const input: SiteReportRuleInput = {
      status: "active",
      stagePosition: 7,
      existingReportDates: ["2026-10-19", "2026-10-17", "2026-10-16"],
    };
    const missing = findMissingSiteReportDates(input, new Date("2026-10-20T12:00:00Z"));
    expect(missing).toEqual([]);
  });
});

describe("Rule R6: Site Report Lifecycle", () => {
  it("allows submitter editing when submitted or correction_required", () => {
    expect(isSiteReportEditableBySubmitter("submitted")).toBe(true);
    expect(isSiteReportEditableBySubmitter("correction_required")).toBe(true);
  });

  it("locks report when status is reviewed", () => {
    expect(isSiteReportEditableBySubmitter("reviewed")).toBe(false);
  });

  it("sets status back to submitted upon resubmission", () => {
    expect(getResubmissionStatus()).toBe("submitted");
  });
});
