export type ExpenseStatus = "unpaid" | "paid";

export type ExpenseCategory = "식비" | "교통비" | "사무용품" | "현장 경비" | "기타";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ["식비", "교통비", "사무용품", "현장 경비", "기타"];

export type ExpenseClaim = {
  id: string;
  title: string;
  amount: number;
  used_date: string;
  category: ExpenseCategory;
  memo: string | null;
  status: ExpenseStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ExpenseReceipt = {
  id: string;
  expense_id: string;
  file_path: string;
  file_name: string;
  created_at: string;
};

export type ExpenseClaimInput = {
  title: string;
  amount: number;
  used_date: string;
  category: ExpenseCategory;
  memo?: string;
  status?: ExpenseStatus;
};
