import { describe, it, expect } from "vitest";
import {
  computeBillCalculation,
  isVendorOrderLate,
  computeCategoryCostForecast,
  computeProjectCostSummary,
  computePayablesAging,
  VendorOrderInput,
  BillInput,
  BillPaymentInput,
  CostCategoryInput,
  BudgetLineInput,
} from "./costs";
import { rupeesToPaise, paiseToRupees } from "../money";

describe("Westeel Rules F6 to F10 & R9: Costs, Orders, Payables, Forecast", () => {
  const TODAY = "2026-10-18";

  describe("Rule F8: Four Required Worked Examples", () => {
    const catId = "cat-steel";
    const catName = "Steel and raw material";

    it("(a) budget 100, one order 60, linked bills 60 -> forecast 100", () => {
      const budgetLine: BudgetLineInput = {
        project_id: "p1",
        category_id: catId,
        amount_excl_gst: 100,
      };

      const orders: VendorOrderInput[] = [
        {
          id: "ord-1",
          project_id: "p1",
          category_id: catId,
          vendor_name: "Vendor A",
          amount_excl_gst: 60,
          expected_delivery_date: "2026-10-25",
          fulfilment_status: "ordered",
        },
      ];

      const bills: BillInput[] = [
        {
          id: "bill-1",
          project_id: "p1",
          category_id: catId,
          vendor_order_id: "ord-1",
          vendor_name: "Vendor A",
          bill_number: "B-001",
          bill_date: "2026-10-15",
          due_date: "2026-11-15",
          amount_excl_gst: 60,
          is_cancelled: false,
        },
      ];

      const res = computeCategoryCostForecast(catId, catName, budgetLine, orders, bills);

      expect(paiseToRupees(res.budgetPaise)).toBe(100);
      expect(paiseToRupees(res.committedPaise)).toBe(60);
      expect(paiseToRupees(res.billedPaise)).toBe(60);
      expect(paiseToRupees(res.remainingCommittedPaise)).toBe(0);
      expect(paiseToRupees(res.uncommittedBudgetPaise)).toBe(40); // max(0, 100 - (60 + 0)) = 40
      expect(paiseToRupees(res.forecastCostPaise)).toBe(100); // 60 + 0 + 40 = 100
      expect(res.isOverBudget).toBe(false);
      expect(res.overrunPaise).toBe(0);
    });

    it("(b) budget 100, one order 60, linked bills 70 -> forecast 110 (overrun 10)", () => {
      const budgetLine: BudgetLineInput = {
        project_id: "p1",
        category_id: catId,
        amount_excl_gst: 100,
      };

      const orders: VendorOrderInput[] = [
        {
          id: "ord-1",
          project_id: "p1",
          category_id: catId,
          vendor_name: "Vendor A",
          amount_excl_gst: 60,
          expected_delivery_date: "2026-10-25",
          fulfilment_status: "in_progress",
        },
      ];

      const bills: BillInput[] = [
        {
          id: "bill-1",
          project_id: "p1",
          category_id: catId,
          vendor_order_id: "ord-1",
          vendor_name: "Vendor A",
          bill_number: "B-002",
          bill_date: "2026-10-15",
          due_date: "2026-11-15",
          amount_excl_gst: 70, // Linked bill exceeded order
          is_cancelled: false,
        },
      ];

      const res = computeCategoryCostForecast(catId, catName, budgetLine, orders, bills);

      expect(paiseToRupees(res.budgetPaise)).toBe(100);
      expect(paiseToRupees(res.committedPaise)).toBe(60);
      expect(paiseToRupees(res.billedPaise)).toBe(70);
      expect(paiseToRupees(res.remainingCommittedPaise)).toBe(0); // max(0, 60 - 70) = 0
      expect(paiseToRupees(res.uncommittedBudgetPaise)).toBe(40); // max(0, 100 - (60 + 0)) = 40
      expect(paiseToRupees(res.forecastCostPaise)).toBe(110); // 70 + 0 + 40 = 110
      expect(res.isOverBudget).toBe(true);
      expect(paiseToRupees(res.overrunPaise)).toBe(10);
    });

    it("(c) budget 100, one order 60, linked bills 60, unlinked bills 20 -> billed 80, rem committed 0, uncommitted 20 -> forecast 100", () => {
      const budgetLine: BudgetLineInput = {
        project_id: "p1",
        category_id: catId,
        amount_excl_gst: 100,
      };

      const orders: VendorOrderInput[] = [
        {
          id: "ord-1",
          project_id: "p1",
          category_id: catId,
          vendor_name: "Vendor A",
          amount_excl_gst: 60,
          expected_delivery_date: "2026-10-25",
          fulfilment_status: "ordered",
        },
      ];

      const bills: BillInput[] = [
        {
          id: "bill-1",
          project_id: "p1",
          category_id: catId,
          vendor_order_id: "ord-1",
          vendor_name: "Vendor A",
          bill_number: "B-001",
          bill_date: "2026-10-15",
          due_date: "2026-11-15",
          amount_excl_gst: 60,
          is_cancelled: false,
        },
        {
          id: "bill-2",
          project_id: "p1",
          category_id: catId,
          vendor_order_id: null, // Unlinked direct expense bill
          vendor_name: "Direct Supplier",
          bill_number: "DIR-001",
          bill_date: "2026-10-16",
          due_date: "2026-11-16",
          amount_excl_gst: 20,
          is_cancelled: false,
        },
      ];

      const res = computeCategoryCostForecast(catId, catName, budgetLine, orders, bills);

      expect(paiseToRupees(res.budgetPaise)).toBe(100);
      expect(paiseToRupees(res.committedPaise)).toBe(60);
      expect(paiseToRupees(res.billedPaise)).toBe(80);
      expect(paiseToRupees(res.remainingCommittedPaise)).toBe(0); // max(0, 60 - 60) = 0
      expect(paiseToRupees(res.uncommittedBudgetPaise)).toBe(20); // max(0, 100 - (60 + 20)) = 20
      expect(paiseToRupees(res.forecastCostPaise)).toBe(100); // 80 + 0 + 20 = 100
      expect(res.isOverBudget).toBe(false);
      expect(res.overrunPaise).toBe(0);
    });

    it("(d) no budget, order 50, linked bills 20 -> forecast 50, flagged 'No budget'", () => {
      const budgetLine = null; // No budget line

      const orders: VendorOrderInput[] = [
        {
          id: "ord-1",
          project_id: "p1",
          category_id: catId,
          vendor_name: "Vendor B",
          amount_excl_gst: 50,
          expected_delivery_date: "2026-10-25",
          fulfilment_status: "ordered",
        },
      ];

      const bills: BillInput[] = [
        {
          id: "bill-1",
          project_id: "p1",
          category_id: catId,
          vendor_order_id: "ord-1",
          vendor_name: "Vendor B",
          bill_number: "B-003",
          bill_date: "2026-10-15",
          due_date: "2026-11-15",
          amount_excl_gst: 20,
          is_cancelled: false,
        },
      ];

      const res = computeCategoryCostForecast(catId, catName, budgetLine, orders, bills);

      expect(res.hasBudget).toBe(false);
      expect(res.budgetPaise).toBe(0);
      expect(paiseToRupees(res.committedPaise)).toBe(50);
      expect(paiseToRupees(res.billedPaise)).toBe(20);
      expect(paiseToRupees(res.remainingCommittedPaise)).toBe(30); // max(0, 50 - 20) = 30
      expect(res.uncommittedBudgetPaise).toBe(0);
      expect(paiseToRupees(res.forecastCostPaise)).toBe(50); // billed 20 + rem 30 = 50
      expect(res.isOverBudget).toBe(true); // Flagged because no budget
      expect(paiseToRupees(res.overrunPaise)).toBe(50);
    });
  });

  describe("Rule F7: Bill Calculation, TDS, and Cancelled Bills", () => {
    it("handles bill with partial payment and TDS deduction", () => {
      const bill: BillInput = {
        id: "bill-10",
        project_id: "p1",
        category_id: "cat-1",
        vendor_name: "Fabricator Inc",
        bill_number: "FAB-101",
        bill_date: "2026-10-01",
        due_date: "2026-10-25",
        amount_excl_gst: 100000, // 1 Lakh ex-GST
        gst_amount: 18000, // 18k GST = 118,000 total
        is_cancelled: false,
      };

      const payments: BillPaymentInput[] = [
        {
          id: "pay-1",
          bill_id: "bill-10",
          payment_date: "2026-10-10",
          amount_paid: 50000,
          tds_amount: 2000, // TDS deducted
        },
      ];

      const res = computeBillCalculation(bill, payments, TODAY);

      expect(paiseToRupees(res.totalPaise)).toBe(118000);
      expect(paiseToRupees(res.paidPaise)).toBe(50000);
      expect(paiseToRupees(res.tdsPaise)).toBe(2000);
      expect(paiseToRupees(res.settledPaise)).toBe(52000); // 50k paid + 2k TDS
      expect(paiseToRupees(res.outstandingPaise)).toBe(66000); // 118k - 52k = 66k
      expect(res.isOverdue).toBe(false);
    });

    it("correctly identifies overdue payable past due_date", () => {
      const bill: BillInput = {
        id: "bill-11",
        project_id: "p1",
        category_id: "cat-1",
        vendor_name: "Bolt Supplier",
        bill_number: "BOLT-50",
        bill_date: "2026-09-01",
        due_date: "2026-09-30", // Overdue by 18 days relative to 2026-10-18
        amount_excl_gst: 25000,
        gst_amount: 4500,
        is_cancelled: false,
      };

      const res = computeBillCalculation(bill, [], TODAY);

      expect(res.isOverdue).toBe(true);
      expect(res.daysOverdue).toBe(18);
      expect(paiseToRupees(res.outstandingPaise)).toBe(29500);
    });

    it("excludes cancelled bills from outstanding and settlement", () => {
      const bill: BillInput = {
        id: "bill-cancelled",
        project_id: "p1",
        category_id: "cat-1",
        vendor_name: "Wrong Vendor",
        bill_number: "CANCELLED-1",
        bill_date: "2026-09-01",
        due_date: "2026-09-15",
        amount_excl_gst: 50000,
        gst_amount: 9000,
        is_cancelled: true,
      };

      const res = computeBillCalculation(bill, [], TODAY);

      expect(res.isCancelled).toBe(true);
      expect(res.outstandingPaise).toBe(0);
      expect(res.isOverdue).toBe(false);
    });
  });

  describe("Edge Case: Order Cancelled After Billing", () => {
    it("excludes cancelled order from committed and remaining committed, treats bill as unlinked", () => {
      const catId = "cat-fab";
      const catName = "Outsourced fabrication";

      const budgetLine: BudgetLineInput = {
        project_id: "p1",
        category_id: catId,
        amount_excl_gst: 200,
      };

      // Order was cancelled
      const orders: VendorOrderInput[] = [
        {
          id: "ord-cancelled",
          project_id: "p1",
          category_id: catId,
          vendor_name: "Vendor C",
          amount_excl_gst: 150,
          expected_delivery_date: "2026-10-10",
          fulfilment_status: "cancelled", // Cancelled!
        },
      ];

      // Bill of 50 was raised before cancellation
      const bills: BillInput[] = [
        {
          id: "bill-linked-to-cancelled",
          project_id: "p1",
          category_id: catId,
          vendor_order_id: "ord-cancelled",
          vendor_name: "Vendor C",
          bill_number: "B-CANCEL-1",
          bill_date: "2026-10-05",
          due_date: "2026-11-05",
          amount_excl_gst: 50,
          is_cancelled: false, // Bill itself is legitimate
        },
      ];

      const res = computeCategoryCostForecast(catId, catName, budgetLine, orders, bills);

      expect(res.committedPaise).toBe(0); // Cancelled order excluded from committed
      expect(paiseToRupees(res.billedPaise)).toBe(50);
      expect(res.remainingCommittedPaise).toBe(0);
      // uncommitted = max(0, 200 - (0 + 50)) = 150
      expect(paiseToRupees(res.uncommittedBudgetPaise)).toBe(150);
      // forecast = billed 50 + rem 0 + uncommitted 150 = 200
      expect(paiseToRupees(res.forecastCostPaise)).toBe(200);
      expect(res.isOverBudget).toBe(false);
    });
  });

  describe("Rule F9: Forecast Profit and Margin % with Incomplete Badges", () => {
    const categories: CostCategoryInput[] = [
      { id: "c1", name: "Steel", is_active: true },
      { id: "c2", name: "Cladding", is_active: true },
    ];

    it("shows Incomplete when project has NO contract value", () => {
      const budgetLines: BudgetLineInput[] = [
        { project_id: "p1", category_id: "c1", amount_excl_gst: 500000 },
      ];

      const res = computeProjectCostSummary(
        "p1",
        categories,
        budgetLines,
        [],
        [],
        [],
        0,
        0, // Revised contract value = 0
        false // No contract value record
      );

      expect(res.isIncomplete).toBe(true);
      expect(res.incompleteReason).toBe("Missing contract value");
      expect(res.forecastProfitPaise).toBeNull();
      expect(res.marginPct).toBeNull();
    });

    it("shows Incomplete when project has NO budget lines", () => {
      const res = computeProjectCostSummary(
        "p1",
        categories,
        [], // No budget lines
        [],
        [],
        [],
        0,
        rupeesToPaise(1000000), // Contract value exists
        true
      );

      expect(res.isIncomplete).toBe(true);
      expect(res.incompleteReason).toBe("Missing budget");
      expect(res.forecastProfitPaise).toBeNull();
      expect(res.marginPct).toBeNull();
    });

    it("computes forecast profit and margin % when contract value and budget exist", () => {
      const budgetLines: BudgetLineInput[] = [
        { project_id: "p1", category_id: "c1", amount_excl_gst: 500000 },
        { project_id: "p1", category_id: "c2", amount_excl_gst: 250000 },
      ];

      const res = computeProjectCostSummary(
        "p1",
        categories,
        budgetLines,
        [],
        [],
        [],
        0,
        rupeesToPaise(1000000), // Revised contract value 10 Lakh
        true
      );

      expect(res.isIncomplete).toBe(false);
      expect(paiseToRupees(res.budgetPaise)).toBe(750000);
      expect(paiseToRupees(res.forecastCostPaise)).toBe(750000);
      expect(paiseToRupees(res.forecastProfitPaise!)).toBe(250000); // 10L - 7.5L = 2.5L
      expect(res.marginPct).toBe(25); // 25% margin
    });
  });

  describe("Rule F10: Cost Overrun Detection", () => {
    it("flags overrun if any individual category exceeds budget even if total is under budget", () => {
      const categories: CostCategoryInput[] = [
        { id: "c1", name: "Steel", is_active: true },
        { id: "c2", name: "Cladding", is_active: true },
      ];

      const budgetLines: BudgetLineInput[] = [
        { project_id: "p1", category_id: "c1", amount_excl_gst: 500000 },
        { project_id: "p1", category_id: "c2", amount_excl_gst: 500000 },
      ];

      // Steel bills 600,000 (overrun by 100k)
      const bills: BillInput[] = [
        {
          id: "b1",
          project_id: "p1",
          category_id: "c1",
          vendor_name: "Tata Steel",
          bill_number: "TS-1",
          bill_date: "2026-10-01",
          due_date: "2026-10-30",
          amount_excl_gst: 600000,
          is_cancelled: false,
        },
      ];

      const res = computeProjectCostSummary(
        "p1",
        categories,
        budgetLines,
        [],
        bills,
        [],
        0,
        rupeesToPaise(1500000),
        true
      );

      expect(res.isOverBudget).toBe(true);
      const steelCat = res.categories.find((c) => c.categoryId === "c1")!;
      expect(steelCat.isOverBudget).toBe(true);
      expect(paiseToRupees(steelCat.overrunPaise)).toBe(100000);
    });
  });

  describe("Rule R9: Late Vendor Order Detection", () => {
    it("detects overdue expected delivery date as late", () => {
      const order: VendorOrderInput = {
        id: "o1",
        project_id: "p1",
        category_id: "c1",
        vendor_name: "Delayed Steel Ltd",
        amount_excl_gst: 100000,
        expected_delivery_date: "2026-10-10", // 8 days past 2026-10-18
        fulfilment_status: "ordered",
      };

      const res = isVendorOrderLate(order, TODAY);
      expect(res.isLate).toBe(true);
      expect(res.isTrouble).toBe(true);
      expect(res.daysLate).toBe(8);
    });

    it("detects issue fulfilment status as trouble even if delivery date is future", () => {
      const order: VendorOrderInput = {
        id: "o2",
        project_id: "p1",
        category_id: "c1",
        vendor_name: "Troubled Vendor",
        amount_excl_gst: 50000,
        expected_delivery_date: "2026-10-25", // Future date
        fulfilment_status: "issue",
      };

      const res = isVendorOrderLate(order, TODAY);
      expect(res.isLate).toBe(false);
      expect(res.isIssue).toBe(true);
      expect(res.isTrouble).toBe(true);
    });

    it("ignores fulfilled and cancelled orders", () => {
      const fulfilledOrder: VendorOrderInput = {
        id: "o3",
        project_id: "p1",
        category_id: "c1",
        vendor_name: "Done Vendor",
        amount_excl_gst: 50000,
        expected_delivery_date: "2026-10-01",
        fulfilment_status: "fulfilled",
      };

      const cancelledOrder: VendorOrderInput = {
        id: "o4",
        project_id: "p1",
        category_id: "c1",
        vendor_name: "Dropped Vendor",
        amount_excl_gst: 50000,
        expected_delivery_date: "2026-10-01",
        fulfilment_status: "cancelled",
      };

      expect(isVendorOrderLate(fulfilledOrder, TODAY).isTrouble).toBe(false);
      expect(isVendorOrderLate(cancelledOrder, TODAY).isTrouble).toBe(false);
    });
  });

  describe("Payables Aging Buckets", () => {
    it("categorizes payables into aging buckets and upcoming windows", () => {
      const bills: BillInput[] = [
        {
          id: "b1",
          project_id: "p1",
          category_id: "c1",
          vendor_name: "Vendor 1",
          bill_number: "V1",
          bill_date: "2026-09-01",
          due_date: "2026-10-03", // 15 days overdue -> bucket 1-30
          amount_excl_gst: 10000,
          is_cancelled: false,
        },
        {
          id: "b2",
          project_id: "p1",
          category_id: "c1",
          vendor_name: "Vendor 2",
          bill_number: "V2",
          bill_date: "2026-08-01",
          due_date: "2026-08-30", // 49 days overdue -> bucket 31-60
          amount_excl_gst: 20000,
          is_cancelled: false,
        },
        {
          id: "b3",
          project_id: "p1",
          category_id: "c1",
          vendor_name: "Vendor 3",
          bill_number: "V3",
          bill_date: "2026-10-15",
          due_date: "2026-10-22", // Due in 4 days -> current, dueWithin7Days
          amount_excl_gst: 30000,
          is_cancelled: false,
        },
      ];

      const aging = computePayablesAging(bills, [], TODAY);

      expect(paiseToRupees(aging.totalPayablePaise)).toBe(60000);
      expect(paiseToRupees(aging.totalOverduePaise)).toBe(30000); // 10k + 20k
      expect(paiseToRupees(aging.currentPaise)).toBe(30000);
      expect(paiseToRupees(aging.bucket1_30Paise)).toBe(10000);
      expect(paiseToRupees(aging.bucket31_60Paise)).toBe(20000);
      expect(paiseToRupees(aging.dueWithin7DaysPaise)).toBe(30000);
    });
  });
});
