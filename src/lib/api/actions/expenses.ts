"use server";

import { randomUUID } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionError, actionSuccess, type ActionResult } from "@/lib/api/action-result";
import { getActionContext } from "@/lib/api/actions/shared";
import type { ExpenseClaimInput, ExpenseStatus } from "@/types/expense";

const RECEIPTS_BUCKET = "receipts";

const categorySchema = z.enum(["식비", "교통비", "사무용품", "현장 경비", "기타"]);
const statusSchema = z.enum(["unpaid", "paid"]);

const expenseSchema = z.object({
  title: z.string().trim().min(1, "경비 제목을 입력해주세요.").max(160, "경비 제목이 너무 깁니다."),
  amount: z.number().nonnegative("금액은 0 이상이어야 합니다."),
  used_date: z.string().date("사용일 형식이 올바르지 않습니다."),
  category: categorySchema,
  memo: z.string().max(6000, "메모가 너무 깁니다.").optional(),
  status: statusSchema.optional(),
});

export async function createExpenseClaim(input: ExpenseClaimInput): Promise<ActionResult<{ id: string }>> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase, user } = await getActionContext();
    const { data, error } = await supabase
      .from("expense_claims")
      .insert({
        title: parsed.data.title,
        amount: parsed.data.amount,
        used_date: parsed.data.used_date,
        category: parsed.data.category,
        memo: parsed.data.memo?.trim() || null,
        status: parsed.data.status ?? "unpaid",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      return actionError("경비 등록에 실패했습니다.");
    }

    revalidatePath("/expenses");
    revalidatePath("/hub");
    return actionSuccess({ id: data.id });
  } catch {
    return actionError("경비 등록 중 오류가 발생했습니다.");
  }
}

export async function updateExpenseClaim(expenseId: string, input: ExpenseClaimInput): Promise<ActionResult> {
  if (!expenseId) {
    return actionError("수정할 경비를 찾을 수 없습니다.");
  }

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase
      .from("expense_claims")
      .update({
        title: parsed.data.title,
        amount: parsed.data.amount,
        used_date: parsed.data.used_date,
        category: parsed.data.category,
        memo: parsed.data.memo?.trim() || null,
        status: parsed.data.status ?? "unpaid",
      })
      .eq("id", expenseId);

    if (error) {
      return actionError("경비 수정에 실패했습니다.");
    }

    revalidatePath("/expenses");
    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("경비 수정 중 오류가 발생했습니다.");
  }
}

export async function toggleExpenseStatus(expenseId: string, status: ExpenseStatus): Promise<ActionResult> {
  if (!expenseId) {
    return actionError("상태를 변경할 경비를 찾을 수 없습니다.");
  }
  if (!statusSchema.safeParse(status).success) {
    return actionError("유효하지 않은 상태값입니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("expense_claims").update({ status }).eq("id", expenseId);

    if (error) {
      return actionError("경비 상태 변경에 실패했습니다.");
    }

    revalidatePath("/expenses");
    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("경비 상태 변경 중 오류가 발생했습니다.");
  }
}

export async function deleteExpenseClaim(expenseId: string): Promise<ActionResult> {
  if (!expenseId) {
    return actionError("삭제할 경비를 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { data: receipts } = await supabase.from("expense_receipts").select("file_path").eq("expense_id", expenseId);
    if (receipts && receipts.length > 0) {
      await supabase.storage
        .from(RECEIPTS_BUCKET)
        .remove(receipts.map((receipt) => receipt.file_path).filter(Boolean));
    }

    const { error } = await supabase.from("expense_claims").delete().eq("id", expenseId);

    if (error) {
      return actionError("경비 삭제에 실패했습니다.");
    }

    revalidatePath("/expenses");
    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("경비 삭제 중 오류가 발생했습니다.");
  }
}

export async function uploadExpenseReceipt(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const expenseId = String(formData.get("expenseId") ?? "");
  const file = formData.get("file");

  if (!expenseId || !(file instanceof File)) {
    return actionError("영수증 업로드 요청이 올바르지 않습니다.");
  }

  try {
    const { supabase, user } = await getActionContext();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${user.id}/${expenseId}/${Date.now()}-${randomUUID()}-${safeName}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage.from(RECEIPTS_BUCKET).upload(filePath, Buffer.from(arrayBuffer), {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

    if (uploadError) {
      return actionError("영수증 파일 업로드에 실패했습니다.");
    }

    const { data, error: insertError } = await supabase
      .from("expense_receipts")
      .insert({
        expense_id: expenseId,
        file_path: filePath,
        file_name: file.name,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertError || !data) {
      await supabase.storage.from(RECEIPTS_BUCKET).remove([filePath]);
      return actionError("영수증 정보 저장에 실패했습니다.");
    }

    revalidatePath("/expenses");
    return actionSuccess({ id: data.id });
  } catch {
    return actionError("영수증 업로드 중 오류가 발생했습니다.");
  }
}

export async function deleteExpenseReceipt(receiptId: string): Promise<ActionResult> {
  if (!receiptId) {
    return actionError("삭제할 영수증을 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { data } = await supabase
      .from("expense_receipts")
      .select("file_path")
      .eq("id", receiptId)
      .single();

    const { error } = await supabase.from("expense_receipts").delete().eq("id", receiptId);
    if (error) {
      return actionError("영수증 삭제에 실패했습니다.");
    }

    if (data?.file_path) {
      await supabase.storage.from(RECEIPTS_BUCKET).remove([data.file_path]);
    }

    revalidatePath("/expenses");
    return actionSuccess(undefined);
  } catch {
    return actionError("영수증 삭제 중 오류가 발생했습니다.");
  }
}

export async function getExpenseReceiptSignedUrl(receiptId: string): Promise<ActionResult<{ url: string }>> {
  if (!receiptId) {
    return actionError("영수증을 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { data } = await supabase
      .from("expense_receipts")
      .select("file_path")
      .eq("id", receiptId)
      .single();

    if (!data?.file_path) {
      return actionError("영수증 경로를 찾을 수 없습니다.");
    }

    const { data: signed, error } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(data.file_path, 60 * 5);
    if (error || !signed?.signedUrl) {
      return actionError("영수증 미리보기 링크 생성에 실패했습니다.");
    }

    return actionSuccess({ url: signed.signedUrl });
  } catch {
    return actionError("영수증 링크 생성 중 오류가 발생했습니다.");
  }
}

