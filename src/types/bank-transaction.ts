export type BankTransactionType = "deposit" | "withdrawal";

export type BankTransactionCategory = "매출" | "매입" | "급여" | "임대료" | "공과금" | "자재비" | "기타";

export const BANK_TRANSACTION_TYPES: BankTransactionType[] = ["deposit", "withdrawal"];
export const BANK_TRANSACTION_CATEGORIES: BankTransactionCategory[] = ["매출", "매입", "급여", "임대료", "공과금", "자재비", "기타"];

export type BankTransaction = {
  id: string;
  transaction_date: string;
  type: BankTransactionType;
  amount: number;
  description: string | null;
  bank_name: string | null;
  account_number: string | null;
  balance_after: number | null;
  category: BankTransactionCategory | null;
  relation_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type BankTransactionInput = {
  transaction_date: string;
  type: BankTransactionType;
  amount: number;
  description?: string;
  bank_name?: string;
  account_number?: string;
  balance_after?: number | null;
  category?: BankTransactionCategory | null;
  relation_id?: string | null;
};
