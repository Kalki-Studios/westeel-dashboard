import { isBefore, parseISO, startOfDay } from "date-fns";

export type TaskStatus = "open" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskKind = "task" | "issue";

export interface TaskRuleInput {
  status: TaskStatus;
  dueDate?: string | null;
}

/**
 * Rule R3: Overdue task.
 * A task is overdue if its status is NOT `done` AND `due_date < today`.
 */
export function isTaskOverdue(
  task: TaskRuleInput,
  currentDate: Date = new Date()
): boolean {
  if (task.status === "done" || !task.dueDate) {
    return false;
  }

  const today = startOfDay(currentDate);
  const due = startOfDay(parseISO(task.dueDate));

  return isBefore(due, today);
}

/**
 * Rule R3: Blocked task.
 * A `blocked` task is always flagged as a separate alert signal.
 */
export function isTaskBlocked(task: TaskRuleInput): boolean {
  return task.status === "blocked";
}

/**
 * Evaluates full status health for a task.
 */
export function getTaskHealth(
  task: TaskRuleInput,
  currentDate: Date = new Date()
): {
  isOverdue: boolean;
  isBlocked: boolean;
  statusText: "done" | "blocked" | "overdue" | "on_track";
} {
  if (task.status === "done") {
    return { isOverdue: false, isBlocked: false, statusText: "done" };
  }

  const blocked = isTaskBlocked(task);
  const overdue = isTaskOverdue(task, currentDate);

  if (blocked) {
    return { isOverdue: overdue, isBlocked: true, statusText: "blocked" };
  }

  if (overdue) {
    return { isOverdue: true, isBlocked: false, statusText: "overdue" };
  }

  return { isOverdue: false, isBlocked: false, statusText: "on_track" };
}
