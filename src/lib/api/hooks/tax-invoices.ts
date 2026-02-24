"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TaxInvoice } from "@/types/tax-invoice";

export function useTaxInvoices() {
  return useQuery({
    queryKey: ["tax-invoices"],
    staleTime: 1000 * 30,
    queryFn: async (): Promise<TaxInvoice[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tax_invoices")
        .select(
          "id, type, issue_date, supplier_name, supplier_biz_no, receiver_name, receiver_biz_no, supply_amount, tax_amount, total_amount, description, status, created_by, created_at, updated_at",
        )
        .order("issue_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error("세금계산서 목록을 불러오지 못했습니다.");
      }

      return (data ?? []).map((invoice) => ({
        ...invoice,
        supplier_biz_no: invoice.supplier_biz_no ?? "",
        receiver_biz_no: invoice.receiver_biz_no ?? "",
        supply_amount: Number(invoice.supply_amount),
        tax_amount: Number(invoice.tax_amount),
        total_amount: Number(invoice.total_amount),
      })) as TaxInvoice[];
    },
  });
}
