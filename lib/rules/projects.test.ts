import { describe, expect, it } from "vitest";
import { formatMilestoneProgress, isProjectDelayed, ProjectMilestoneItem, ProjectRuleInput } from "./projects";

describe("Rule R1: isProjectDelayed", () => {
  const referenceDate = new Date("2026-10-18T12:00:00Z");

  it("returns not delayed when active project is on schedule with future dates", () => {
    const project: ProjectRuleInput = {
      status: "active",
      plannedCompletionDate: "2026-11-01",
      milestones: [
        {
          id: "m1",
          title: "Foundation",
          status: "pending",
          plannedDate: "2026-10-25",
        },
      ],
    };

    const result = isProjectDelayed(project, referenceDate);
    expect(result.isDelayed).toBe(false);
  });

  it("flags delayed when planned_completion_date is in the past for active project", () => {
    const project: ProjectRuleInput = {
      status: "active",
      plannedCompletionDate: "2026-10-10",
      milestones: [],
    };

    const result = isProjectDelayed(project, referenceDate);
    expect(result.isDelayed).toBe(true);
    expect(result.reason).toBe("project_overdue");
  });

  it("flags delayed when at least one pending milestone is overdue even if project completion date is in the future", () => {
    const project: ProjectRuleInput = {
      status: "active",
      plannedCompletionDate: "2026-12-31",
      milestones: [
        {
          id: "m1",
          title: "Drawing Approval",
          status: "done",
          plannedDate: "2026-10-01",
        },
        {
          id: "m2",
          title: "Procurement",
          status: "pending",
          plannedDate: "2026-10-15", // Overdue relative to 2026-10-18
        },
      ],
    };

    const result = isProjectDelayed(project, referenceDate);
    expect(result.isDelayed).toBe(true);
    expect(result.reason).toBe("milestone_overdue");
  });

  it("does not flag delayed if overdue milestone is marked done", () => {
    const project: ProjectRuleInput = {
      status: "active",
      plannedCompletionDate: "2026-12-31",
      milestones: [
        {
          id: "m1",
          title: "Procurement",
          status: "done",
          plannedDate: "2026-10-15",
          actualDate: "2026-10-16",
        },
      ],
    };

    const result = isProjectDelayed(project, referenceDate);
    expect(result.isDelayed).toBe(false);
  });

  it("does not flag delayed when milestone planned_date is empty (date missing)", () => {
    const project: ProjectRuleInput = {
      status: "active",
      plannedCompletionDate: "2026-12-31",
      milestones: [
        {
          id: "m1",
          title: "Inspection",
          status: "pending",
          plannedDate: null,
        },
      ],
    };

    const result = isProjectDelayed(project, referenceDate);
    expect(result.isDelayed).toBe(false);
  });

  it("never flags non-active projects (on_hold, closed, cancelled) as delayed even if overdue", () => {
    const onHoldProject: ProjectRuleInput = {
      status: "on_hold",
      plannedCompletionDate: "2026-01-01",
      milestones: [
        {
          id: "m1",
          title: "Erection",
          status: "pending",
          plannedDate: "2026-01-10",
        },
      ],
    };
    expect(isProjectDelayed(onHoldProject, referenceDate).isDelayed).toBe(false);

    const closedProject: ProjectRuleInput = {
      status: "closed",
      plannedCompletionDate: "2026-01-01",
    };
    expect(isProjectDelayed(closedProject, referenceDate).isDelayed).toBe(false);

    const cancelledProject: ProjectRuleInput = {
      status: "cancelled",
      plannedCompletionDate: "2026-01-01",
    };
    expect(isProjectDelayed(cancelledProject, referenceDate).isDelayed).toBe(false);
  });

  it("treats milestone planned for today as on schedule (not delayed)", () => {
    const project: ProjectRuleInput = {
      status: "active",
      plannedCompletionDate: "2026-10-20",
      milestones: [
        {
          id: "m1",
          title: "Delivery today",
          status: "pending",
          plannedDate: "2026-10-18",
        },
      ],
    };

    const result = isProjectDelayed(project, referenceDate);
    expect(result.isDelayed).toBe(false);
  });
});

describe("Rule R2: formatMilestoneProgress", () => {
  it("formats zero milestones correctly", () => {
    expect(formatMilestoneProgress([])).toBe("0 of 0 milestones done");
  });

  it("formats partially completed milestones in 'X of Y milestones done' format", () => {
    const milestones: ProjectMilestoneItem[] = [
      { id: "1", title: "M1", status: "done" },
      { id: "2", title: "M2", status: "pending" },
      { id: "3", title: "M3", status: "pending" },
    ];
    const output = formatMilestoneProgress(milestones);
    expect(output).toBe("1 of 3 milestones done");
    expect(output).not.toContain("%");
  });

  it("formats all completed milestones correctly", () => {
    const milestones: ProjectMilestoneItem[] = [
      { id: "1", title: "M1", status: "done" },
      { id: "2", title: "M2", status: "done" },
    ];
    const output = formatMilestoneProgress(milestones);
    expect(output).toBe("2 of 2 milestones done");
    expect(output).not.toContain("%");
  });

  it("strictly prohibits percentage formatting per Rule R2", () => {
    const milestones: ProjectMilestoneItem[] = [
      { id: "1", title: "M1", status: "done" },
      { id: "2", title: "M2", status: "done" },
      { id: "3", title: "M3", status: "pending" },
      { id: "4", title: "M4", status: "pending" },
    ];
    const output = formatMilestoneProgress(milestones);
    expect(output).toBe("2 of 4 milestones done");
    // Ensure no percentage sign or float exists
    expect(output).not.toMatch(/%/);
    expect(output).not.toMatch(/50/);
  });
});
