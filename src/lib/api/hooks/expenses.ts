"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseClaim, ExpenseReceipt } from "@/types/expense";

export function useExpenseClaims() {
  return useQuery({
    queryKey: ["expense-claims"],
    staleTime: 1000 * 30,
    queryFn: async (): Promise<ExpenseClaim[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("expense_claims")
        .select("id, title, amount, used_date, category, memo, status, created_by, created_at, updated_at")
        .order("used_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error("경비 목록을 불러오지 못했습니다.");
      }

      return (data ?? []).map((expense) => ({
        ...expense,
        amount: Number(expense.amount),
      })) as ExpenseClaim[];
    },
  });
}

export function useExpenseReceipts(expenseId?: string) {
  return useQuery({
    queryKey: ["expense-receipts", expenseId ?? "all"],
    queryFn: async (): Promise<ExpenseReceipt[]> => {
      const supabase = createClient();
      let query = supabase
        .from("expense_receipts")
        .select("id, expense_id, file_path, file_name, created_at")
        .order("created_at", { ascending: false });

      if (expenseId) {
        query = query.eq("expense_id", expenseId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error("영수증 목록을 불러오지 못했습니다.");
      }

      return (data ?? []).map((receipt) => ({
        ...receipt,
        file_name: receipt.file_name ?? "영수증",
      })) as ExpenseReceipt[];
    },
  });
}
