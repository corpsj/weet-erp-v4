"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { BankTransaction } from "@/types/bank-transaction";

export function useBankTransactions() {
  return useQuery({
    queryKey: ["bank-transactions"],
    staleTime: 1000 * 30,
    queryFn: async (): Promise<BankTransaction[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bank_transactions")
        .select(
          "id, transaction_date, type, amount, description, bank_name, account_number, balance_after, category, relation_id, created_by, created_at, updated_at",
        )
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error("입출금 내역을 불러오지 못했습니다.");
      }

      return (data ?? []).map((item) => ({
        ...item,
        amount: Number(item.amount),
        balance_after: item.balance_after === null ? null : Number(item.balance_after),
      })) as BankTransaction[];
    },
  });
}
