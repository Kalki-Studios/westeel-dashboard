import { describe, expect, it } from "vitest";
import { getTaskHealth, isTaskBlocked, isTaskOverdue, TaskRuleInput } from "./tasks";

describe("Rule R3: Task Overdue and Blocked Rules", () => {
  const referenceDate = new Date("2026-10-18T12:00:00Z");

  it("identifies overdue task when status is open and due_date is in the past", () => {
    const task: TaskRuleInput = {
      status: "open",
      dueDate: "2026-10-15",
    };
    expect(isTaskOverdue(task, referenceDate)).toBe(true);
    expect(isTaskBlocked(task)).toBe(false);
    expect(getTaskHealth(task, referenceDate).statusText).toBe("overdue");
  });

  it("identifies overdue task when status is in_progress and due_date is in the past", () => {
    const task: TaskRuleInput = {
      status: "in_progress",
      dueDate: "2026-10-17",
    };
    expect(isTaskOverdue(task, referenceDate)).toBe(true);
  });

  it("does NOT flag task as overdue when status is done even if due_date is in the past", () => {
    const task: TaskRuleInput = {
      status: "done",
      dueDate: "2026-10-01",
    };
    expect(isTaskOverdue(task, referenceDate)).toBe(false);
    expect(getTaskHealth(task, referenceDate).statusText).toBe("done");
  });

  it("does NOT flag task as overdue when due_date is today", () => {
    const task: TaskRuleInput = {
      status: "open",
      dueDate: "2026-10-18",
    };
    expect(isTaskOverdue(task, referenceDate)).toBe(false);
    expect(getTaskHealth(task, referenceDate).statusText).toBe("on_track");
  });

  it("does NOT flag task as overdue when due_date is in the future", () => {
    const task: TaskRuleInput = {
      status: "open",
      dueDate: "2026-10-25",
    };
    expect(isTaskOverdue(task, referenceDate)).toBe(false);
  });

  it("does NOT flag task as overdue when due_date is missing / null", () => {
    const task: TaskRuleInput = {
      status: "open",
      dueDate: null,
    };
    expect(isTaskOverdue(task, referenceDate)).toBe(false);
    expect(getTaskHealth(task, referenceDate).statusText).toBe("on_track");
  });

  it("flags blocked task separately per Rule R3", () => {
    const task: TaskRuleInput = {
      status: "blocked",
      dueDate: "2026-10-25", // Future date
    };
    expect(isTaskBlocked(task)).toBe(true);
    expect(isTaskOverdue(task, referenceDate)).toBe(false);
    expect(getTaskHealth(task, referenceDate).statusText).toBe("blocked");
  });

  it("correctly identifies a task that is simultaneously blocked AND overdue", () => {
    const task: TaskRuleInput = {
      status: "blocked",
      dueDate: "2026-10-10", // Past date
    };
    expect(isTaskBlocked(task)).toBe(true);
    expect(isTaskOverdue(task, referenceDate)).toBe(true);
    const health = getTaskHealth(task, referenceDate);
    expect(health.isBlocked).toBe(true);
    expect(health.isOverdue).toBe(true);
    expect(health.statusText).toBe("blocked");
  });
});
