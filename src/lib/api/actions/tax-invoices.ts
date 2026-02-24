"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionError, actionSuccess, type ActionResult } from "@/lib/api/action-result";
import { getActionContext } from "@/lib/api/actions/shared";
import type { TaxInvoiceInput, TaxInvoiceStatus } from "@/types/tax-invoice";

const typeSchema = z.enum(["sales", "purchase"]);
const statusSchema = z.enum(["issued", "cancelled"]);
const invoiceIdSchema = z.string().trim().min(1, "세금계산서 식별자가 필요합니다.");

const taxInvoiceSchema = z.object({
  type: typeSchema,
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "발행일 형식이 올바르지 않습니다."),
  supplier_name: z.string().trim().min(1, "공급자명을 입력해주세요.").max(120),
  supplier_biz_no: z.string().trim().max(32).optional(),
  receiver_name: z.string().trim().min(1, "공급받는자를 입력해주세요.").max(120),
  receiver_biz_no: z.string().trim().max(32).optional(),
  supply_amount: z.number().nonnegative("공급가액은 0 이상이어야 합니다."),
  tax_amount: z.number().nonnegative("세액은 0 이상이어야 합니다."),
  total_amount: z.number().nonnegative("합계는 0 이상이어야 합니다."),
  description: z.string().max(6000, "비고가 너무 깁니다.").optional(),
  status: statusSchema.optional(),
}).refine((data) => data.total_amount === data.supply_amount + data.tax_amount, {
  path: ["total_amount"],
  message: "합계액은 공급가액 + 세액과 일치해야 합니다.",
});

function normalizePayload(input: z.infer<typeof taxInvoiceSchema>) {
  return {
    type: input.type,
    issue_date: input.issue_date,
    supplier_name: input.supplier_name,
    supplier_biz_no: input.supplier_biz_no?.trim() || null,
    receiver_name: input.receiver_name,
    receiver_biz_no: input.receiver_biz_no?.trim() || null,
    supply_amount: input.supply_amount,
    tax_amount: input.tax_amount,
    total_amount: input.total_amount,
    description: input.description?.trim() || null,
    status: input.status ?? "issued",
  };
}

function revalidateTaxInvoicePaths() {
  revalidatePath("/tax-invoices");
  revalidatePath("/hub");
}

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
        ...normalizePayload(parsed.data),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      return actionError("세금계산서 등록에 실패했습니다.");
    }

    revalidateTaxInvoicePaths();
    return actionSuccess({ id: data.id });
  } catch {
    return actionError("세금계산서 등록 중 오류가 발생했습니다.");
  }
}

export async function updateTaxInvoice(invoiceId: string, input: TaxInvoiceInput): Promise<ActionResult> {
  const parsedId = invoiceIdSchema.safeParse(invoiceId);
  if (!parsedId.success) {
    return actionError(parsedId.error.issues[0]?.message ?? "수정할 세금계산서를 찾을 수 없습니다.");
  }

  const parsed = taxInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase
      .from("tax_invoices")
      .update(normalizePayload(parsed.data))
      .eq("id", parsedId.data);

    if (error) {
      return actionError("세금계산서 수정에 실패했습니다.");
    }

    revalidateTaxInvoicePaths();
    return actionSuccess(undefined);
  } catch {
    return actionError("세금계산서 수정 중 오류가 발생했습니다.");
  }
}

export async function updateTaxInvoiceStatus(invoiceId: string, status: TaxInvoiceStatus): Promise<ActionResult> {
  const parsedId = invoiceIdSchema.safeParse(invoiceId);
  if (!parsedId.success) {
    return actionError(parsedId.error.issues[0]?.message ?? "상태를 변경할 세금계산서를 찾을 수 없습니다.");
  }
  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return actionError(parsedStatus.error.issues[0]?.message ?? "유효하지 않은 상태값입니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("tax_invoices").update({ status: parsedStatus.data }).eq("id", parsedId.data);
    if (error) {
      return actionError("상태 변경에 실패했습니다.");
    }

    revalidateTaxInvoicePaths();
    return actionSuccess(undefined);
  } catch {
    return actionError("상태 변경 중 오류가 발생했습니다.");
  }
}

export async function deleteTaxInvoice(invoiceId: string): Promise<ActionResult> {
  const parsedId = invoiceIdSchema.safeParse(invoiceId);
  if (!parsedId.success) {
    return actionError(parsedId.error.issues[0]?.message ?? "삭제할 세금계산서를 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("tax_invoices").delete().eq("id", parsedId.data);

    if (error) {
      return actionError("세금계산서 삭제에 실패했습니다.");
    }

    revalidateTaxInvoicePaths();
    return actionSuccess(undefined);
  } catch {
    return actionError("세금계산서 삭제 중 오류가 발생했습니다.");
  }
}
