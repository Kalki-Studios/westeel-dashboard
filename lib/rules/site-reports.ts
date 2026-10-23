import { format, subDays, getDay, startOfDay } from "date-fns";

export type SiteReportStatus = "submitted" | "correction_required" | "reviewed";

export interface SiteReportRuleInput {
  status: string; // project status, e.g. "active"
  stagePosition?: number | null;
  existingReportDates: string[]; // array of "YYYY-MM-DD"
}

/**
 * Checks if a day of the week is a working day.
 * Per Assumption A1: Monday (1) to Saturday (6) are working days.
 * Sunday (0) is NOT a working day.
 */
export function isWorkingDay(date: Date): boolean {
  const day = getDay(date);
  return day !== 0; // 0 is Sunday
}

/**
 * Gets the last N completed working days before referenceDate.
 * Strictly excludes referenceDate itself (as today's report is in progress until end of day).
 * Skips Sundays.
 * Returns ISO date strings formatted as "YYYY-MM-DD".
 */
export function getLastNWorkingDays(
  referenceDate: Date = new Date(),
  count: number = 3
): string[] {
  const workingDays: string[] = [];
  let checkDate = subDays(startOfDay(referenceDate), 1);

  while (workingDays.length < count) {
    if (isWorkingDay(checkDate)) {
      workingDays.push(format(checkDate, "yyyy-MM-dd"));
    }
    checkDate = subDays(checkDate, 1);
  }

  return workingDays;
}

/**
 * Rule R4 Stage Eligibility:
 * Project current stage must be one of:
 * - 6: Site readiness
 * - 7: Erection and installation
 * - 8: Inspection and defect correction
 */
export function isStageEligibleForSiteReport(stagePosition?: number | null): boolean {
  if (typeof stagePosition !== "number") return false;
  return stagePosition === 6 || stagePosition === 7 || stagePosition === 8;
}

/**
 * Rule R4: Missing site report alert computation.
 * A project is flagged if:
 * 1. project is `active`
 * 2. current stage position is in (6, 7, 8)
 * 3. for ANY of the last 3 completed working days (Mon to Sat, excluding today),
 *    no site report exists for that project and date.
 *
 * Returns the list of missing working day dates (empty if none missing).
 */
export function findMissingSiteReportDates(
  project: SiteReportRuleInput,
  referenceDate: Date = new Date()
): string[] {
  if (project.status !== "active") {
    return [];
  }

  if (!isStageEligibleForSiteReport(project.stagePosition)) {
    return [];
  }

  const expectedWorkingDays = getLastNWorkingDays(referenceDate, 3);
  const existingSet = new Set(project.existingReportDates);

  return expectedWorkingDays.filter((dateStr) => !existingSet.has(dateStr));
}

/**
 * Rule R6: Site Report Lifecycle lock check.
 * Submitter may edit while status is 'submitted' or 'correction_required'.
 * Once set to 'reviewed', the report is locked and cannot be edited by the submitter.
 */
export function isSiteReportEditableBySubmitter(status: SiteReportStatus): boolean {
  return status === "submitted" || status === "correction_required";
}

/**
 * Rule R6: Resubmission resets status back to 'submitted'.
 */
export function getResubmissionStatus(): SiteReportStatus {
  return "submitted";
}
