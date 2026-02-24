"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionError, actionSuccess, type ActionResult } from "@/lib/api/action-result";
import { getActionContext } from "@/lib/api/actions/shared";
import type { BankTransactionInput } from "@/types/bank-transaction";

const typeSchema = z.enum(["deposit", "withdrawal"]);

const transactionSchema = z.object({
  transaction_date: z.string().min(1, "거래일을 입력해주세요."),
  type: typeSchema,
  amount: z.number().nonnegative("금액은 0 이상이어야 합니다."),
  description: z.string().max(6000, "내역이 너무 깁니다.").optional(),
  bank_name: z.string().max(120, "은행명이 너무 깁니다.").optional(),
  account_number: z.string().max(120, "계좌번호가 너무 깁니다.").optional(),
  balance_after: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  relation_id: z.string().uuid().nullable().optional(),
});

export async function createBankTransaction(input: BankTransactionInput): Promise<ActionResult<{ id: string }>> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase, user } = await getActionContext();
    const { data, error } = await supabase
      .from("bank_transactions")
      .insert({
        transaction_date: parsed.data.transaction_date,
        type: parsed.data.type,
        amount: parsed.data.amount,
        description: parsed.data.description?.trim() || null,
        bank_name: parsed.data.bank_name?.trim() || null,
        account_number: parsed.data.account_number?.trim() || null,
        balance_after: parsed.data.balance_after ?? null,
        category: parsed.data.category ?? null,
        relation_id: parsed.data.relation_id ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      return actionError("입출금 내역 등록에 실패했습니다.");
    }

    revalidatePath("/bank-transactions");
    revalidatePath("/hub");
    return actionSuccess({ id: data.id });
  } catch {
    return actionError("입출금 내역 등록 중 오류가 발생했습니다.");
  }
}

export async function updateBankTransaction(transactionId: string, input: BankTransactionInput): Promise<ActionResult> {
  if (!transactionId) {
    return actionError("수정할 내역을 찾을 수 없습니다.");
  }

  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase
      .from("bank_transactions")
      .update({
        transaction_date: parsed.data.transaction_date,
        type: parsed.data.type,
        amount: parsed.data.amount,
        description: parsed.data.description?.trim() || null,
        bank_name: parsed.data.bank_name?.trim() || null,
        account_number: parsed.data.account_number?.trim() || null,
        balance_after: parsed.data.balance_after ?? null,
        category: parsed.data.category ?? null,
        relation_id: parsed.data.relation_id ?? null,
      })
      .eq("id", transactionId);

    if (error) {
      return actionError("입출금 내역 수정에 실패했습니다.");
    }

    revalidatePath("/bank-transactions");
    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("입출금 내역 수정 중 오류가 발생했습니다.");
  }
}

export async function deleteBankTransaction(transactionId: string): Promise<ActionResult> {
  if (!transactionId) {
    return actionError("삭제할 내역을 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("bank_transactions").delete().eq("id", transactionId);

    if (error) {
      return actionError("입출금 내역 삭제에 실패했습니다.");
    }

    revalidatePath("/bank-transactions");
    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("입출금 내역 삭제 중 오류가 발생했습니다.");
  }
}

