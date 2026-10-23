export type VariationStatus = "proposed" | "approved" | "rejected";
export type PaymentMode = "bank_transfer" | "cheque" | "cash" | "upi" | "other";

export interface ProjectCommercial {
  id: string;
  project_id: string;
  contract_value_excl_gst: number;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VariationOrder {
  id: string;
  project_id: string;
  title: string;
  amount_excl_gst: number;
  status: VariationStatus;
  approved_by?: string | null;
  approved_on?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentMilestone {
  id: string;
  project_id: string;
  label: string;
  amount_excl_gst: number;
  expected_date: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  project_id: string;
  payment_milestone_id?: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount_excl_gst: number;
  gst_amount: number;
  is_cancelled: boolean;
  note?: string | null;
  created_at: string;
  updated_at: string;
  // Joins/attachments
  payment_milestone?: {
    id: string;
    label: string;
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

export interface ReceiptItem {
  id: string;
  project_id: string;
  invoice_id?: string | null;
  receipt_date: string;
  amount_received: number;
  tds_amount: number;
  mode: PaymentMode;
  reference?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  invoice?: {
    id: string;
    invoice_number: string;
  } | null;
}

export interface ProjectBillingData {
  projectId: string;
  projectCode: string;
  projectName: string;
  customerName?: string | null;
  commercials: ProjectCommercial | null;
  variations: VariationOrder[];
  milestones: PaymentMilestone[];
  invoices: InvoiceItem[];
  receipts: ReceiptItem[];
  // Calculated figures (Rules F1 - F5)
  revisedContractValuePaise: number;
  isCompletenessMatch: boolean;
  completenessDifferencePaise: number;
  completenessMessage?: string;
  unallocatedAdvancesPaise: number;
  totalInvoicedPaise: number;
  totalSettledPaise: number;
  totalOutstandingPaise: number;
  totalOverduePaise: number;
}

export interface CollectionsProjectSummary {
  projectId: string;
  projectCode: string;
  projectName: string;
  customerName: string;
  totalInvoicedPaise: number;
  totalSettledPaise: number;
  totalOutstandingPaise: number;
  totalOverduePaise: number;
  unallocatedAdvancesPaise: number;
  invoicesCount: number;
  overdueInvoicesCount: number;
}

export interface CollectionsOverviewData {
  metrics: {
    totalReceivablePaise: number;
    totalOverduePaise: number;
    totalAdvancesPaise: number;
    currentPaise: number;
    bucket1_30Paise: number;
    bucket31_60Paise: number;
    bucket61_90Paise: number;
    bucketOver90Paise: number;
  };
  projects: CollectionsProjectSummary[];
  overdueInvoices: Array<{
    invoiceId: string;
    invoiceNumber: string;
    projectId: string;
    projectCode: string;
    projectName: string;
    customerName: string;
    invoiceDate: string;
    dueDate: string;
    daysOverdue: number;
    totalPaise: number;
    settledPaise: number;
    outstandingPaise: number;
  }>;
  unallocatedAdvances: Array<{
    receiptId: string;
    projectId: string;
    projectCode: string;
    projectName: string;
    receiptDate: string;
    amountReceivedPaise: number;
    mode: PaymentMode;
    reference?: string | null;
  }>;
}

export interface InvoiceExportRow {
  invoice_number: string;
  project_code: string;
  project_name: string;
  milestone: string;
  invoice_date: string;
  due_date: string;
  amount_excl_gst: string;
  gst_amount: string;
  total_amount: string;
  settled_amount: string;
  outstanding_amount: string;
  status: string;
  note: string;
}

export interface ReceiptExportRow {
  receipt_date: string;
  project_code: string;
  project_name: string;
  invoice_number: string;
  amount_received: string;
  tds_amount: string;
  total_settlement: string;
  mode: PaymentMode;
  reference: string;
  note: string;
}

export interface BillingExportData {
  invoiceRows: InvoiceExportRow[];
  receiptRows: ReceiptExportRow[];
}
