import {
  CostCategoryInput,
  BudgetLineInput,
  VendorOrderInput,
  BillInput,
  BillPaymentInput,
  CategoryCostForecast,
  ProjectCostSummary,
  PayablesAgingBuckets,
} from "../rules/costs";

export type OrderKind = "material" | "fabrication" | "subcontract" | "service";
export type FulfilmentStatus = "ordered" | "in_progress" | "partially_fulfilled" | "fulfilled" | "issue" | "cancelled";
export type BillType = "supplier_bill" | "subcontractor_bill" | "direct_expense";
export type PaymentMode = "bank_transfer" | "cheque" | "cash" | "upi" | "other";

export interface CostCategory extends CostCategoryInput {
  created_at: string;
  updated_at: string;
}

export interface BudgetLine extends BudgetLineInput {
  id: string;
  created_at: string;
  updated_at: string;
  cost_categories?: {
    id: string;
    name: string;
  } | null;
}

export interface VendorOrderItem extends VendorOrderInput {
  kind: OrderKind;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  cost_categories?: {
    id: string;
    name: string;
  } | null;
  profiles?: {
    full_name: string;
  } | null;
  documents?: Array<{
    id: string;
    title: string;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
  }>;
}

export interface BillItem extends BillInput {
  bill_type: BillType;
  created_at: string;
  updated_at: string;
  cost_categories?: {
    id: string;
    name: string;
  } | null;
  vendor_orders?: {
    id: string;
    description: string;
    amount_excl_gst: number;
  } | null;
  documents?: Array<{
    id: string;
    title: string;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
  }>;
}

export interface BillPaymentItem extends BillPaymentInput {
  mode: PaymentMode;
  created_at: string;
  updated_at: string;
}

export interface ProjectCostsData {
  projectId: string;
  projectCode: string;
  projectName: string;
  categories: CostCategory[];
  budgetLines: BudgetLine[];
  orders: VendorOrderItem[];
  bills: BillItem[];
  payments: BillPaymentItem[];
  summary: ProjectCostSummary;
}

export interface PayablesProjectSummary {
  projectId: string;
  projectCode: string;
  projectName: string;
  totalBilledPaise: number;
  totalSettledPaise: number;
  totalOutstandingPaise: number;
  totalOverduePaise: number;
  billsCount: number;
  overdueBillsCount: number;
}

export interface PayablesOverviewData {
  metrics: PayablesAgingBuckets;
  projects: PayablesProjectSummary[];
  overdueBills: Array<{
    billId: string;
    billNumber: string;
    projectId: string;
    projectCode: string;
    projectName: string;
    vendorName: string;
    billDate: string;
    dueDate: string;
    daysOverdue: number;
    totalPaise: number;
    settledPaise: number;
    outstandingPaise: number;
  }>;
  upcomingBills: Array<{
    billId: string;
    billNumber: string;
    projectId: string;
    projectCode: string;
    projectName: string;
    vendorName: string;
    billDate: string;
    dueDate: string;
    daysUntilDue: number;
    totalPaise: number;
    settledPaise: number;
    outstandingPaise: number;
  }>;
  recentPayments: Array<{
    paymentId: string;
    billId: string;
    billNumber: string;
    projectId: string;
    projectCode: string;
    projectName: string;
    vendorName: string;
    paymentDate: string;
    amountPaidPaise: number;
    tdsAmountPaise: number;
    mode: PaymentMode;
    reference?: string | null;
  }>;
}

export interface BillExportRow {
  bill_number: string;
  project_code: string;
  project_name: string;
  category: string;
  vendor_name: string;
  order_desc: string;
  bill_type: string;
  bill_date: string;
  due_date: string;
  amount_excl_gst: string;
  gst_amount: string;
  total_amount: string;
  settled_amount: string;
  outstanding_amount: string;
  status: string;
  note: string;
}

export interface CostSummaryExportRow {
  category: string;
  budget_excl_gst: string;
  committed_excl_gst: string;
  billed_excl_gst: string;
  paid_cash: string;
  remaining_committed: string;
  uncommitted_budget: string;
  forecast_cost: string;
  status: string;
  overrun_amount: string;
}

export interface BillsExportData {
  billRows: BillExportRow[];
  paymentRows: Array<{
    payment_date: string;
    project_code: string;
    project_name: string;
    bill_number: string;
    vendor_name: string;
    amount_paid: string;
    tds_amount: string;
    mode: string;
    reference: string;
    note: string;
  }>;
}

export {
  type CategoryCostForecast,
  type ProjectCostSummary,
  type PayablesAgingBuckets,
};
