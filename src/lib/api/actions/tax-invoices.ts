"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionError, actionSuccess, type ActionResult } from "@/lib/api/action-result";
import { getActionContext } from "@/lib/api/actions/shared";
import type { TaxInvoiceInput, TaxInvoiceStatus } from "@/types/tax-invoice";

const typeSchema = z.enum(["sales", "purchase"]);
const statusSchema = z.enum(["issued", "cancelled"]);

const taxInvoiceSchema = z.object({
  type: typeSchema,
  issue_date: z.string().date("발행일 형식이 올바르지 않습니다."),
  supplier_name: z.string().trim().min(1, "공급자명을 입력해주세요.").max(120),
  supplier_biz_no: z.string().trim().max(32).optional(),
  receiver_name: z.string().trim().min(1, "공급받는자를 입력해주세요.").max(120),
  receiver_biz_no: z.string().trim().max(32).optional(),
  supply_amount: z.number().nonnegative("공급가액은 0 이상이어야 합니다."),
  tax_amount: z.number().nonnegative("세액은 0 이상이어야 합니다."),
  total_amount: z.number().nonnegative("합계는 0 이상이어야 합니다."),
  description: z.string().max(6000, "비고가 너무 깁니다.").optional(),
  status: statusSchema.optional(),
});

export async function createTaxInvoice(input: TaxInvoiceInput): Promise<ActionResult<{ id: string }>> {
  const parsed = taxInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase, user } = await getActionContext();
    const { data, error } = await supabase
      .from("tax_invoices")
      .insert({
        type: parsed.data.type,
        issue_date: parsed.data.issue_date,
        supplier_name: parsed.data.supplier_name,
        supplier_biz_no: parsed.data.supplier_biz_no?.trim() || null,
        receiver_name: parsed.data.receiver_name,
        receiver_biz_no: parsed.data.receiver_biz_no?.trim() || null,
        supply_amount: parsed.data.supply_amount,
        tax_amount: parsed.data.tax_amount,
        total_amount: parsed.data.total_amount,
        description: parsed.data.description?.trim() || null,
        status: parsed.data.status ?? "issued",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      return actionError("세금계산서 등록에 실패했습니다.");
    }

    revalidatePath("/tax-invoices");
    revalidatePath("/hub");
    return actionSuccess({ id: data.id });
  } catch {
    return actionError("세금계산서 등록 중 오류가 발생했습니다.");
  }
}

export async function updateTaxInvoice(invoiceId: string, input: TaxInvoiceInput): Promise<ActionResult> {
  if (!invoiceId) {
    return actionError("수정할 세금계산서를 찾을 수 없습니다.");
  }

  const parsed = taxInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase
      .from("tax_invoices")
      .update({
        type: parsed.data.type,
        issue_date: parsed.data.issue_date,
        supplier_name: parsed.data.supplier_name,
        supplier_biz_no: parsed.data.supplier_biz_no?.trim() || null,
        receiver_name: parsed.data.receiver_name,
        receiver_biz_no: parsed.data.receiver_biz_no?.trim() || null,
        supply_amount: parsed.data.supply_amount,
        tax_amount: parsed.data.tax_amount,
        total_amount: parsed.data.total_amount,
        description: parsed.data.description?.trim() || null,
        status: parsed.data.status ?? "issued",
      })
      .eq("id", invoiceId);

    if (error) {
      return actionError("세금계산서 수정에 실패했습니다.");
    }

    revalidatePath("/tax-invoices");
    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("세금계산서 수정 중 오류가 발생했습니다.");
  }
}

export async function updateTaxInvoiceStatus(invoiceId: string, status: TaxInvoiceStatus): Promise<ActionResult> {
  if (!invoiceId) {
    return actionError("상태를 변경할 세금계산서를 찾을 수 없습니다.");
  }
  if (!statusSchema.safeParse(status).success) {
    return actionError("유효하지 않은 상태값입니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("tax_invoices").update({ status }).eq("id", invoiceId);
    if (error) {
      return actionError("상태 변경에 실패했습니다.");
    }

    revalidatePath("/tax-invoices");
    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("상태 변경 중 오류가 발생했습니다.");
  }
}

export async function deleteTaxInvoice(invoiceId: string): Promise<ActionResult> {
  if (!invoiceId) {
    return actionError("삭제할 세금계산서를 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("tax_invoices").delete().eq("id", invoiceId);

    if (error) {
      return actionError("세금계산서 삭제에 실패했습니다.");
    }

    revalidatePath("/tax-invoices");
    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("세금계산서 삭제 중 오류가 발생했습니다.");
  }
}

