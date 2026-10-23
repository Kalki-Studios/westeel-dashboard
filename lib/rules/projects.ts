import { isBefore, parseISO, startOfDay } from "date-fns";

export interface ProjectMilestoneItem {
  id: string;
  title: string;
  plannedDate?: string | null;
  actualDate?: string | null;
  status: "pending" | "done";
  delayReason?: string | null;
  delayNote?: string | null;
}

export interface ProjectRuleInput {
  status: "active" | "on_hold" | "closed" | "cancelled";
  plannedCompletionDate: string;
  milestones?: ProjectMilestoneItem[];
}

/**
 * Rule R1: Delayed project.
 * Status is `active` AND:
 * - planned_completion_date < today
 * OR
 * - at least one milestone is `pending` with planned_date < today.
 */
export function isProjectDelayed(
  project: ProjectRuleInput,
  currentDate: Date = new Date()
): { isDelayed: boolean; reason?: "project_overdue" | "milestone_overdue" } {
  if (project.status !== "active") {
    return { isDelayed: false };
  }

  const today = startOfDay(currentDate);

  // Check project completion date
  const projectPlanned = startOfDay(parseISO(project.plannedCompletionDate));
  if (isBefore(projectPlanned, today)) {
    return { isDelayed: true, reason: "project_overdue" };
  }

  // Check milestones
  if (project.milestones && project.milestones.length > 0) {
    const hasOverdueMilestone = project.milestones.some((m) => {
      if (m.status === "pending" && m.plannedDate) {
        const milestonePlanned = startOfDay(parseISO(m.plannedDate));
        return isBefore(milestonePlanned, today);
      }
      return false;
    });

    if (hasOverdueMilestone) {
      return { isDelayed: true, reason: "milestone_overdue" };
    }
  }

  return { isDelayed: false };
}

/**
 * Rule R2: Progress display.
 * Displays "X of Y milestones done".
 * CRITICAL RULE (PROJECT_BRIEF.md R2): Never format as a percentage.
 */
export function formatMilestoneProgress(milestones: ProjectMilestoneItem[] = []): string {
  if (milestones.length === 0) {
    return "0 of 0 milestones done";
  }

  const doneCount = milestones.filter((m) => m.status === "done").length;
  const totalCount = milestones.length;

  return `${doneCount} of ${totalCount} milestones done`;
}
