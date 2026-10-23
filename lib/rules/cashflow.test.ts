import { describe, it, expect } from "vitest";
import {
  computeCashOnHand,
  computeCashProjection,
  BankBalanceEntry,
  CashInvoiceItem,
  CashMilestoneItem,
  CashBillItem,
  CompanyCashItemInput,
  CommittedOrderInput,
} from "./cashflow";

describe("Rule F11: Cash on Hand", () => {
  const mockToday = "2026-10-18";

  it("returns zero and null as_of_date when no balance entries exist", () => {
    const result = computeCashOnHand([], mockToday);
    expect(result.total_cash_on_hand_paise).toBe(0);
    expect(result.as_of_date).toBeNull();
    expect(result.is_stale).toBe(false);
    expect(result.stale_warning).toBeNull();
    expect(result.accounts).toHaveLength(0);
  });

  it("handles two accounts with different dates, picks latest entry per account, and shows oldest date as total as-of date (Edge Case 1)", () => {
    const entries: BankBalanceEntry[] = [
      {
        account_label: "HDFC Current",
        balance: 100000, // old entry
        as_of_date: "2026-10-10",
      },
      {
        account_label: "HDFC Current",
        balance: 500000, // latest entry for HDFC
        as_of_date: "2026-10-16",
      },
      {
        account_label: "SBI Cash Credit",
        balance: 300000, // latest entry for SBI
        as_of_date: "2026-10-14",
      },
    ];

    const result = computeCashOnHand(entries, mockToday);

    // Sum of latest entries: 5,00,000 + 3,00,000 = 8,00,000 INR = 80,000,000 paise
    expect(result.total_cash_on_hand_paise).toBe(80000000);
    // Oldest date among latest accounts: "2026-10-14" (SBI) < "2026-10-16" (HDFC)
    expect(result.as_of_date).toBe("2026-10-14");
    // Days since 2026-10-14 to 2026-10-18 = 4 days <= 7 days -> not stale
    expect(result.is_stale).toBe(false);
    expect(result.stale_warning).toBeNull();
    expect(result.accounts).toHaveLength(2);
  });

  it("flags stale balance when any account's latest entry is older than 7 days (Edge Case 2)", () => {
    const entries: BankBalanceEntry[] = [
      {
        account_label: "HDFC Current",
        balance: 400000,
        as_of_date: "2026-10-17", // 1 day ago
      },
      {
        account_label: "SBI Cash Credit",
        balance: 200000,
        as_of_date: "2026-10-09", // 9 days ago (> 7 days)
      },
    ];

    const result = computeCashOnHand(entries, mockToday);

    expect(result.total_cash_on_hand_paise).toBe(60000000);
    expect(result.as_of_date).toBe("2026-10-09");
    expect(result.is_stale).toBe(true);
    expect(result.stale_warning).toBe("Stale: update balances");

    const sbiAccount = result.accounts.find(
      (a) => a.account_label === "SBI Cash Credit"
    );
    expect(sbiAccount?.is_stale).toBe(true);
    expect(sbiAccount?.age_days).toBe(9);

    const hdfcAccount = result.accounts.find(
      (a) => a.account_label === "HDFC Current"
    );
    expect(hdfcAccount?.is_stale).toBe(false);
    expect(hdfcAccount?.age_days).toBe(1);
  });
});

describe("Rule F12: Cash Flow Projection", () => {
  const mockToday = "2026-10-18";

  it("places overdue payable in 'Due now' bucket (Edge Case 3)", () => {
    const bank_balances: BankBalanceEntry[] = [
      { account_label: "Main Account", balance: 500000, as_of_date: "2026-10-18" },
    ];

    const bills: CashBillItem[] = [
      {
        id: "b1",
        bill_number: "BILL-OVERDUE",
        amount_incl_gst: 150000,
        total_paid_incl_tds: 50000,
        due_date: "2026-10-10", // 8 days overdue
      },
    ];

    const result = computeCashProjection({
      bank_balances,
      invoices: [],
      payment_milestones: [],
      bills,
      company_cash_items: [],
      currentDate: mockToday,
    });

    const dueNow = result.buckets.due_now;
    // Outstanding = 150,000 - 50,000 = 100,000 INR = 10,000,000 paise
    expect(dueNow.bills_paise).toBe(10000000);
    expect(dueNow.total_outflows_paise).toBe(10000000);
    // Running balance drops from 500,000 to 400,000
    expect(dueNow.running_balance_paise).toBe(40000000);
  });

  it("excludes overdue receivables from projection buckets and records them separately (Edge Case 4)", () => {
    const bank_balances: BankBalanceEntry[] = [
      { account_label: "Main Account", balance: 100000, as_of_date: "2026-10-18" },
    ];

    const invoices: CashInvoiceItem[] = [
      {
        id: "inv-overdue",
        invoice_number: "INV-OD",
        amount_incl_gst: 250000,
        total_received_incl_tds: 0,
        due_date: "2026-10-10", // Overdue receivable!
      },
      {
        id: "inv-future",
        invoice_number: "INV-FUT",
        amount_incl_gst: 300000,
        total_received_incl_tds: 0,
        due_date: "2026-10-22", // Within 0 to 7 days
      },
    ];

    const result = computeCashProjection({
      bank_balances,
      invoices,
      payment_milestones: [],
      bills: [],
      company_cash_items: [],
      currentDate: mockToday,
    });

    // Overdue receivables line contains 250,000 INR = 25,000,000 paise
    expect(result.overdue_receivables_paise).toBe(25000000);
    // Due now bucket has ZERO inflows because overdue receivables are excluded
    expect(result.buckets.due_now.invoices_paise).toBe(0);
    expect(result.buckets.due_now.total_inflows_paise).toBe(0);

    // Future invoice in 0-7 days is counted
    expect(result.buckets.days_0_to_7.invoices_paise).toBe(30000000);
  });

  it("counts milestone not yet invoiced once, but skips already invoiced milestones (Edge Case 5)", () => {
    const bank_balances: BankBalanceEntry[] = [
      { account_label: "Main Account", balance: 50000, as_of_date: "2026-10-18" },
    ];

    const milestones: CashMilestoneItem[] = [
      {
        id: "ms-uninvoiced",
        label: "Fabrication Milestone",
        amount_excl_gst: 400000,
        is_invoiced: false,
        status: "pending",
        expected_date: "2026-10-24", // Within 0 to 7 days
      },
      {
        id: "ms-already-invoiced",
        label: "Advance Milestone (Already Invoiced)",
        amount_excl_gst: 200000,
        is_invoiced: true, // Should be omitted so not double-counted with invoices
        status: "pending",
        expected_date: "2026-10-24",
      },
    ];

    const result = computeCashProjection({
      bank_balances,
      invoices: [],
      payment_milestones: milestones,
      bills: [],
      company_cash_items: [],
      currentDate: mockToday,
    });

    const bucket0to7 = result.buckets.days_0_to_7;
    // Only ms-uninvoiced is counted: 400,000 INR = 40,000,000 paise
    expect(bucket0to7.milestones_paise).toBe(40000000);
    expect(bucket0to7.total_inflows_paise).toBe(40000000);
  });

  it("shows committed-not-billed as an informational line strictly excluded from net cash (Edge Case 6)", () => {
    const bank_balances: BankBalanceEntry[] = [
      { account_label: "Main Account", balance: 100000, as_of_date: "2026-10-18" },
    ];

    const committed_orders: CommittedOrderInput[] = [
      {
        id: "order-1",
        order_number: "PO-001",
        amount_excl_gst: 500000,
        billed_amount_excl_gst: 200000, // Remaining committed = 300,000
        expected_delivery_date: "2026-10-22",
        fulfilment_status: "ordered",
      },
    ];

    const result = computeCashProjection({
      bank_balances,
      invoices: [],
      payment_milestones: [],
      bills: [],
      company_cash_items: [],
      committed_orders,
      currentDate: mockToday,
    });

    // Total committed not billed = 300,000 INR = 30,000,000 paise
    expect(result.total_committed_not_billed_paise).toBe(30000000);
    expect(result.buckets.days_0_to_7.committed_not_billed_paise).toBe(30000000);

    // But net cash and running balance MUST NOT be affected by committed-not-billed
    expect(result.buckets.days_0_to_7.total_outflows_paise).toBe(0);
    expect(result.buckets.days_0_to_7.net_cash_paise).toBe(0);
    expect(result.buckets.days_0_to_7.running_balance_paise).toBe(10000000); // untouched starting cash
  });

  it("detects shortfall in bucket 3 (8 to 30 days) and raises projected cash shortfall alert (Edge Case 7)", () => {
    const bank_balances: BankBalanceEntry[] = [
      { account_label: "HDFC Current", balance: 200000, as_of_date: "2026-10-18" },
    ];

    // Outflow in Bucket 3: 5,00,000 (e.g. GST or vendor payment on 2026-11-05 = 18 days away)
    const company_cash_items: CompanyCashItemInput[] = [
      {
        id: "cash-item-1",
        direction: "outflow",
        category: "Statutory",
        description: "GST Payment",
        amount: 500000,
        expected_date: "2026-11-05", // 18 days from today (falls in days_8_to_30)
        status: "planned",
      },
    ];

    const result = computeCashProjection({
      bank_balances,
      invoices: [],
      payment_milestones: [],
      bills: [],
      company_cash_items,
      currentDate: mockToday,
    });

    const bucket8to30 = result.buckets.days_8_to_30;
    // Starting balance 200,000 - outflow 500,000 = -300,000 (-30,000,000 paise)
    expect(bucket8to30.running_balance_paise).toBe(-30000000);
    expect(bucket8to30.is_shortfall).toBe(true);

    // Alert raised because bucket 3 is within 30 days
    expect(result.has_projected_shortfall).toBe(true);
    expect(result.shortfall_bucket).toBe("days_8_to_30");
    expect(result.shortfall_amount_paise).toBe(30000000);
    expect(result.shortfall_message).toContain("8 to 30 days");
  });

  it("does not trigger 30-day shortfall alert if deficit occurs only after 60 days", () => {
    const bank_balances: BankBalanceEntry[] = [
      { account_label: "HDFC Current", balance: 200000, as_of_date: "2026-10-18" },
    ];

    const company_cash_items: CompanyCashItemInput[] = [
      {
        id: "cash-item-late",
        direction: "outflow",
        category: "Equipment",
        description: "Crane Purchase",
        amount: 500000,
        expected_date: "2026-12-25", // 68 days away (falls in days_61_to_90)
        status: "planned",
      },
    ];

    const result = computeCashProjection({
      bank_balances,
      invoices: [],
      payment_milestones: [],
      bills: [],
      company_cash_items,
      currentDate: mockToday,
    });

    // Buckets 1, 2, 3 have positive balances
    expect(result.buckets.due_now.running_balance_paise).toBe(20000000);
    expect(result.buckets.days_0_to_7.running_balance_paise).toBe(20000000);
    expect(result.buckets.days_8_to_30.running_balance_paise).toBe(20000000);

    // Shortfall occurs in bucket 5, but Rule F12 says alert is raised if it drops below zero within 30 days
    expect(result.buckets.days_61_to_90.is_shortfall).toBe(true);
    expect(result.has_projected_shortfall).toBe(false);
  });
});
