"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { UtilityBill } from "@/types/utility";

function toMonth(dateValue: string) {
  return dateValue.slice(0, 7);
}

export function useUtilityBills() {
  return useQuery({
    queryKey: ["utility-bills"],
    staleTime: 1000 * 30,
    queryFn: async (): Promise<UtilityBill[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("utility_bills")
        .select("id, company_id, category, billing_month, amount, image_path, memo, processing_status, is_paid, created_by, created_at, updated_at")
        .order("billing_month", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error("공과금 목록을 불러오지 못했습니다.");
      }

      return (data ?? []).map((bill) => ({
        ...bill,
        billing_month: toMonth(bill.billing_month),
        amount: Number(bill.amount),
      })) as UtilityBill[];
    },
  });
}
