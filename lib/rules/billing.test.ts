import { describe, it, expect } from "vitest";
import {
  computeRevisedContractValuePaise,
  computeInvoiceCalculation,
  getUnallocatedAdvances,
  computeReceivablesAging,
  checkBillingScheduleCompleteness,
  checkMilestonesForInvoicing,
  VariationOrderInput,
  PaymentMilestoneInput,
  InvoiceInput,
  ReceiptInput,
} from "./billing";
import { paiseToRupees } from "../money";

describe("Rule F1: Revised Contract Value", () => {
  it("calculates base contract value + approved variations (including negative deductions)", () => {
    const baseContract = 5000000; // ₹50 Lakhs
    const variations: VariationOrderInput[] = [
      { id: "v1", amount_excl_gst: 250000, status: "approved" }, // +2.5L
      { id: "v2", amount_excl_gst: -50000, status: "approved" }, // -50k deduction
      { id: "v3", amount_excl_gst: 400000, status: "proposed" }, // ignored
      { id: "v4", amount_excl_gst: 150000, status: "rejected" }, // ignored
    ];

    const revisedPaise = computeRevisedContractValuePaise(baseContract, variations);
    expect(paiseToRupees(revisedPaise)).toBe(5200000);
  });

  it("handles zero variations and string numbers correctly", () => {
    const revisedPaise = computeRevisedContractValuePaise("1500000.50", []);
    expect(paiseToRupees(revisedPaise)).toBe(1500000.5);
  });
});

describe("Rule F2: Invoice Total, Settled and Outstanding", () => {
  const baseInvoice: InvoiceInput = {
    id: "inv-1",
    invoice_number: "INV-2026-001",
    amount_excl_gst: 1000000, // ₹10 Lakhs
    gst_amount: 180000, // ₹1.8 Lakhs (18%)
    is_cancelled: false,
    due_date: "2026-10-10",
  };

  it("calculates total, settled, and outstanding with a partial receipt", () => {
    const receipts: ReceiptInput[] = [
      {
        id: "rec-1",
        invoice_id: "inv-1",
        amount_received: 500000, // ₹5L
        tds_amount: 0,
        receipt_date: "2026-10-05",
      },
    ];

    const calc = computeInvoiceCalculation(baseInvoice, receipts, "2026-10-18");
    expect(paiseToRupees(calc.totalPaise)).toBe(1180000); // 10L + 1.8L
    expect(paiseToRupees(calc.settledPaise)).toBe(500000);
    expect(paiseToRupees(calc.outstandingPaise)).toBe(680000);
    expect(calc.isOverdue).toBe(true);
    expect(calc.daysOverdue).toBe(8); // Oct 10 to Oct 18
  });

  it("calculates settled amount including TDS correctly", () => {
    // Total is 11,80,000.
    // Client pays 11,56,400 with 2% TDS on ex-GST (₹20,000) or total ₹23,600
    const receipts: ReceiptInput[] = [
      {
        id: "rec-1",
        invoice_id: "inv-1",
        amount_received: 1156400,
        tds_amount: 23600,
        receipt_date: "2026-10-08",
      },
    ];

    const calc = computeInvoiceCalculation(baseInvoice, receipts, "2026-10-18");
    expect(paiseToRupees(calc.settledPaise)).toBe(1180000);
    expect(calc.outstandingPaise).toBe(0);
    expect(calc.isOverdue).toBe(false);
  });

  it("completely excludes cancelled invoices from all financial figures", () => {
    const cancelledInvoice: InvoiceInput = {
      ...baseInvoice,
      is_cancelled: true,
    };
    const receipts: ReceiptInput[] = [
      {
        id: "rec-1",
        invoice_id: "inv-1",
        amount_received: 500000,
        tds_amount: 0,
        receipt_date: "2026-10-05",
      },
    ];

    const calc = computeInvoiceCalculation(cancelledInvoice, receipts, "2026-10-18");
    expect(calc.isCancelled).toBe(true);
    expect(calc.totalPaise).toBe(0);
    expect(calc.settledPaise).toBe(0);
    expect(calc.outstandingPaise).toBe(0);
    expect(calc.isOverdue).toBe(false);
  });
});

describe("Rule F3: Advances and Later Allocation", () => {
  it("identifies unallocated receipts as advances and reflects later allocation", () => {
    // Initial state: receipt has no invoice_id (advance)
    const initialReceipts: ReceiptInput[] = [
      {
        id: "rec-adv",
        invoice_id: null,
        amount_received: 300000,
        tds_amount: 0,
        receipt_date: "2026-10-01",
      },
      {
        id: "rec-normal",
        invoice_id: "inv-1",
        amount_received: 200000,
        tds_amount: 0,
        receipt_date: "2026-10-02",
      },
    ];

    const advBefore = getUnallocatedAdvances(initialReceipts);
    expect(advBefore.advances.length).toBe(1);
    expect(paiseToRupees(advBefore.totalPaise)).toBe(300000);

    // Later allocation: invoice_id is set to "inv-2"
    const updatedReceipts: ReceiptInput[] = [
      {
        ...initialReceipts[0],
        invoice_id: "inv-2",
      },
      initialReceipts[1],
    ];

    const advAfter = getUnallocatedAdvances(updatedReceipts);
    expect(advAfter.advances.length).toBe(0);
    expect(advAfter.totalPaise).toBe(0);
  });
});

describe("Rule F4: Overdue Receivables and Aging Buckets", () => {
  const today = "2026-10-18";

  it("sorts outstanding invoices into 1-30, 31-60, 61-90, and >90 days overdue buckets", () => {
    const invoices: InvoiceInput[] = [
      {
        id: "inv-current",
        invoice_number: "INV-CURR",
        amount_excl_gst: 100000,
        gst_amount: 18000,
        is_cancelled: false,
        due_date: "2026-10-25", // future -> current
      },
      {
        id: "inv-1-30",
        invoice_number: "INV-1-30",
        amount_excl_gst: 200000,
        gst_amount: 36000,
        is_cancelled: false,
        due_date: "2026-10-08", // 10 days overdue
      },
      {
        id: "inv-31-60",
        invoice_number: "INV-31-60",
        amount_excl_gst: 300000,
        gst_amount: 54000,
        is_cancelled: false,
        due_date: "2026-09-08", // 40 days overdue
      },
      {
        id: "inv-61-90",
        invoice_number: "INV-61-90",
        amount_excl_gst: 400000,
        gst_amount: 72000,
        is_cancelled: false,
        due_date: "2026-07-25", // 85 days overdue
      },
      {
        id: "inv-over-90",
        invoice_number: "INV-90",
        amount_excl_gst: 500000,
        gst_amount: 90000,
        is_cancelled: false,
        due_date: "2026-06-01", // 139 days overdue
      },
      {
        id: "inv-cancelled",
        invoice_number: "INV-CANCELLED",
        amount_excl_gst: 900000,
        gst_amount: 162000,
        is_cancelled: true,
        due_date: "2026-06-01",
      },
    ];

    const aging = computeReceivablesAging(invoices, [], today);

    expect(paiseToRupees(aging.currentPaise)).toBe(118000);
    expect(paiseToRupees(aging.bucket1_30Paise)).toBe(236000);
    expect(paiseToRupees(aging.bucket31_60Paise)).toBe(354000);
    expect(paiseToRupees(aging.bucket61_90Paise)).toBe(472000);
    expect(paiseToRupees(aging.bucketOver90Paise)).toBe(590000);
    expect(paiseToRupees(aging.totalOverduePaise)).toBe(236000 + 354000 + 472000 + 590000);
    expect(paiseToRupees(aging.totalOutstandingPaise)).toBe(
      118000 + 236000 + 354000 + 472000 + 590000
    );
  });
});

describe("Rule F5: Billing Schedule Completeness and Invoicing Alerts", () => {
  it("verifies match when milestones sum equals revised contract value", () => {
    const revisedPaise = 500000000; // ₹50 Lakhs in paise
    const milestones: PaymentMilestoneInput[] = [
      { id: "m1", label: "Advance", amount_excl_gst: 1000000, expected_date: "2026-10-01", position: 1 },
      { id: "m2", label: "Dispatch", amount_excl_gst: 2500000, expected_date: "2026-10-15", position: 2 },
      { id: "m3", label: "Erection", amount_excl_gst: 1500000, expected_date: "2026-10-30", position: 3 },
    ];

    const result = checkBillingScheduleCompleteness(revisedPaise, milestones);
    expect(result.isMatch).toBe(true);
    expect(result.differencePaise).toBe(0);
    expect(result.message).toBeUndefined();
  });

  it("reports difference message when milestone sum does not match contract value", () => {
    const revisedPaise = 500000000; // ₹50 Lakhs in paise
    const milestones: PaymentMilestoneInput[] = [
      { id: "m1", label: "Advance", amount_excl_gst: 1000000, expected_date: "2026-10-01", position: 1 },
      { id: "m2", label: "Dispatch", amount_excl_gst: 2500000, expected_date: "2026-10-15", position: 2 },
      // total is 35L, difference is 15L
    ];

    const result = checkBillingScheduleCompleteness(revisedPaise, milestones);
    expect(result.isMatch).toBe(false);
    expect(paiseToRupees(result.differencePaise)).toBe(1500000);
    expect(result.message).toContain("Billing schedule does not match contract value (difference ₹15,00,000.00)");
  });

  it("raises alert for milestones with expected_date within 7 days without an active linked invoice", () => {
    const today = "2026-10-18";
    const milestones: PaymentMilestoneInput[] = [
      {
        id: "m-due-soon",
        label: "Plinth Complete 20%",
        amount_excl_gst: 500000,
        expected_date: "2026-10-22", // 4 days away
        position: 1,
      },
      {
        id: "m-already-invoiced",
        label: "Advance 20%",
        amount_excl_gst: 500000,
        expected_date: "2026-10-19", // 1 day away
        position: 2,
      },
      {
        id: "m-cancelled-invoice",
        label: "Structure 30%",
        amount_excl_gst: 750000,
        expected_date: "2026-10-24", // 6 days away, has cancelled invoice
        position: 3,
      },
      {
        id: "m-far-future",
        label: "Handover 10%",
        amount_excl_gst: 250000,
        expected_date: "2026-11-30", // >7 days away
        position: 4,
      },
    ];

    const invoices: InvoiceInput[] = [
      {
        id: "inv-active",
        invoice_number: "INV-ACT-1",
        amount_excl_gst: 500000,
        gst_amount: 90000,
        is_cancelled: false,
        due_date: "2026-11-01",
        payment_milestone_id: "m-already-invoiced",
      },
      {
        id: "inv-canc",
        invoice_number: "INV-CANC-1",
        amount_excl_gst: 750000,
        gst_amount: 135000,
        is_cancelled: true, // Cancelled! Should NOT prevent alert
        due_date: "2026-11-01",
        payment_milestone_id: "m-cancelled-invoice",
      },
    ];

    const statuses = checkMilestonesForInvoicing(milestones, invoices, today);

    const dueSoon = statuses.find(s => s.milestoneId === "m-due-soon");
    expect(dueSoon?.isDueForInvoicingWithin7Days).toBe(true);

    const alreadyInvoiced = statuses.find(s => s.milestoneId === "m-already-invoiced");
    expect(alreadyInvoiced?.isDueForInvoicingWithin7Days).toBe(false);
    expect(alreadyInvoiced?.hasActiveInvoice).toBe(true);

    const withCancelled = statuses.find(s => s.milestoneId === "m-cancelled-invoice");
    expect(withCancelled?.isDueForInvoicingWithin7Days).toBe(true); // cancelled invoice does not count
    expect(withCancelled?.hasActiveInvoice).toBe(false);

    const farFuture = statuses.find(s => s.milestoneId === "m-far-future");
    expect(farFuture?.isDueForInvoicingWithin7Days).toBe(false);
  });
});
