/**
 * Westeel Cash Flow Types
 * Tasks: T12 (Priority 2 Block, followed by GATE G2)
 * Rules: F11 (Cash on Hand), F12 (Cash Projection), F13 (Audit / Non-deletion)
 */

import {
  BankBalanceEntry,
  CashOnHandResult,
  CashProjectionResult,
  ProjectionBucketKey,
  ProjectionBucketSummary,
  CompanyCashItemInput,
} from "../rules/cashflow";

export type CashDirection = "inflow" | "outflow";
export type CashItemStatus = "planned" | "done" | "cancelled";

export interface BankBalance extends BankBalanceEntry {
  id: string;
  note: string | null;
  recorded_by: string | null;
  recorded_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyCashItem extends CompanyCashItemInput {
  id: string;
  recurring_group_id: string | null;
  created_by: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashFlowOverviewSummary {
  cash_on_hand_paise: number;
  as_of_date: string | null;
  is_stale: boolean;
  stale_warning: string | null;
  projected_30d_cash_paise: number;
  has_projected_shortfall: boolean;
  shortfall_bucket?: ProjectionBucketKey;
  shortfall_amount_paise?: number;
  shortfall_message?: string;
  overdue_receivables_paise: number;
  overdue_payables_paise: number;
}

export interface CashFlowWorkspaceData {
  cashOnHand: CashOnHandResult;
  projection: CashProjectionResult;
  bankBalances: BankBalance[];
  companyCashItems: CompanyCashItem[];
  distinctAccountLabels: string[];
  userRoles: {
    isDirector: boolean;
    isAccounts: boolean;
  };
}

export interface CreateBankBalanceDTO {
  account_label: string;
  balance: number;
  as_of_date: string;
  note?: string | null;
}

export interface CreateCompanyCashItemDTO {
  direction: CashDirection;
  category: string;
  description: string;
  amount: number;
  expected_date: string;
  repeat_months?: number; // 1 to 24 (generates N rows at creation)
}

export interface UpdateCompanyCashItemStatusDTO {
  id: string;
  status: CashItemStatus;
}
