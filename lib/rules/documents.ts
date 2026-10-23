import { differenceInDays, parseISO, startOfDay } from "date-fns";
import { AppRole } from "@/lib/auth/types";

export type DocCategory =
  | "contract"
  | "quotation"
  | "drawing"
  | "customer_approval"
  | "purchase_order"
  | "invoice"
  | "bill"
  | "delivery_document"
  | "site_photo"
  | "inspection"
  | "handover"
  | "other";

export type DrawingReviewStatus = "pending" | "approved" | "rejected" | "superseded";

export interface DocumentRuleInput {
  category: DocCategory;
  reviewStatus?: DrawingReviewStatus | null;
  createdAt: string;
}

/**
 * Rule R5: Pending drawing approval.
 * Category is `drawing` with `review_status = pending`.
 */
export function isDrawingPendingApproval(doc: DocumentRuleInput): boolean {
  return doc.category === "drawing" && doc.reviewStatus === "pending";
}

/**
 * Rule R5: Drawing age in calendar days.
 */
export function getDrawingAgeDays(
  doc: DocumentRuleInput,
  currentDate: Date = new Date()
): number {
  const createdDate = startOfDay(parseISO(doc.createdAt));
  const today = startOfDay(currentDate);
  const diff = differenceInDays(today, createdDate);
  return Math.max(0, diff);
}

/**
 * Rule R8: Restricted categories (contract, invoice, bill).
 * Visible only to director and accounts.
 */
export function isDocumentRestricted(category: DocCategory): boolean {
  return category === "contract" || category === "invoice" || category === "bill";
}

/**
 * Rule R8: Evaluates if a user role can access a document of a given category.
 */
export function canUserAccessDocument(
  category: DocCategory,
  roles: AppRole[],
  isProjectMember: boolean
): boolean {
  if (roles.includes("director") || roles.includes("accounts")) {
    return true;
  }

  // Strictly restricted: contract, invoice, bill
  if (isDocumentRestricted(category)) {
    return false;
  }

  // purchase_order: visible to purchase, and assigned PMs
  if (category === "purchase_order") {
    if (roles.includes("purchase")) return true;
    if (roles.includes("project_manager") && isProjectMember) return true;
    return false;
  }

  // Other categories require assigned membership (or purchase for delivery_document)
  if (category === "delivery_document" && roles.includes("purchase")) {
    return true;
  }

  return isProjectMember;
}
