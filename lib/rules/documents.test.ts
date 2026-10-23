import { describe, expect, it } from "vitest";
import {
  canUserAccessDocument,
  getDrawingAgeDays,
  isDocumentRestricted,
  isDrawingPendingApproval,
  DocumentRuleInput,
} from "./documents";

describe("Rule R5: Drawing Approvals & Age", () => {
  const referenceDate = new Date("2026-10-18T12:00:00Z");

  it("identifies drawing with pending review status", () => {
    const doc: DocumentRuleInput = {
      category: "drawing",
      reviewStatus: "pending",
      createdAt: "2026-10-10",
    };
    expect(isDrawingPendingApproval(doc)).toBe(true);
  });

  it("does not flag approved, rejected, or superseded drawings as pending", () => {
    expect(
      isDrawingPendingApproval({
        category: "drawing",
        reviewStatus: "approved",
        createdAt: "2026-10-10",
      })
    ).toBe(false);

    expect(
      isDrawingPendingApproval({
        category: "drawing",
        reviewStatus: "superseded",
        createdAt: "2026-10-10",
      })
    ).toBe(false);
  });

  it("computes drawing age in calendar days", () => {
    const doc: DocumentRuleInput = {
      category: "drawing",
      reviewStatus: "pending",
      createdAt: "2026-10-13T00:00:00Z",
    };
    // From 2026-10-13 to 2026-10-18 = 5 days
    expect(getDrawingAgeDays(doc, referenceDate)).toBe(5);
  });
});

describe("Rule R8: Restricted Documents Access Matrix", () => {
  it("identifies restricted categories (contract, invoice, bill)", () => {
    expect(isDocumentRestricted("contract")).toBe(true);
    expect(isDocumentRestricted("invoice")).toBe(true);
    expect(isDocumentRestricted("bill")).toBe(true);
    expect(isDocumentRestricted("drawing")).toBe(false);
    expect(isDocumentRestricted("site_photo")).toBe(false);
  });

  it("allows Director and Accounts full access to restricted documents", () => {
    expect(canUserAccessDocument("contract", ["director"], false)).toBe(true);
    expect(canUserAccessDocument("invoice", ["accounts"], false)).toBe(true);
    expect(canUserAccessDocument("bill", ["accounts"], true)).toBe(true);
  });

  it("STRICTLY BLOCKS Site Engineers and Sales from restricted documents", () => {
    expect(canUserAccessDocument("contract", ["site_engineer"], true)).toBe(false);
    expect(canUserAccessDocument("invoice", ["site_engineer"], true)).toBe(false);
    expect(canUserAccessDocument("bill", ["sales"], true)).toBe(false);
  });

  it("allows Purchase and assigned PM to access purchase_order", () => {
    expect(canUserAccessDocument("purchase_order", ["purchase"], false)).toBe(true);
    expect(canUserAccessDocument("purchase_order", ["project_manager"], true)).toBe(true);
    expect(canUserAccessDocument("purchase_order", ["project_manager"], false)).toBe(false);
    expect(canUserAccessDocument("purchase_order", ["site_engineer"], true)).toBe(false);
  });

  it("allows assigned project members to access general drawings and site photos", () => {
    expect(canUserAccessDocument("drawing", ["site_engineer"], true)).toBe(true);
    expect(canUserAccessDocument("drawing", ["site_engineer"], false)).toBe(false);
    expect(canUserAccessDocument("site_photo", ["sales"], true)).toBe(true);
  });
});
