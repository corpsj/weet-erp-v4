"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionError, actionSuccess, type ActionResult } from "@/lib/api/action-result";
import { getActionContext } from "@/lib/api/actions/shared";
import { decryptWithIv, encryptWithIv } from "@/lib/utils/encryption";
import type { VaultEntryInput } from "@/types/vault";

const vaultSchema = z.object({
  site_name: z.string().trim().min(1, "사이트명을 입력해주세요.").max(160, "사이트명이 너무 깁니다."),
  url: z
    .string()
    .trim()
    .max(500, "URL이 너무 깁니다.")
    .optional()
    .refine((value) => !value || /^https?:\/\//i.test(value), "URL은 http:// 또는 https:// 형식이어야 합니다."),
  username: z.string().trim().min(1, "아이디를 입력해주세요.").max(240, "아이디가 너무 깁니다."),
  password: z.string().min(1, "비밀번호를 입력해주세요.").max(2000, "비밀번호가 너무 깁니다.").optional(),
  memo: z.string().max(6000, "메모가 너무 깁니다.").optional(),
});

export async function createVaultEntry(input: VaultEntryInput): Promise<ActionResult<{ id: string }>> {
  const parsed = vaultSchema.safeParse(input);
  if (!parsed.success || !parsed.data.password) {
    return actionError(parsed.error?.issues[0]?.message ?? "비밀번호를 입력해주세요.");
  }

  try {
    const { supabase, user } = await getActionContext();
    const encrypted = encryptWithIv(parsed.data.password);

    const { data, error } = await supabase
      .from("vault_entries")
      .insert({
        site_name: parsed.data.site_name,
        url: parsed.data.url?.trim() || null,
        username: parsed.data.username,
        password_encrypted: encrypted.ciphertext,
        iv: encrypted.iv,
        memo: parsed.data.memo?.trim() || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      return actionError("계정 정보를 저장하지 못했습니다.");
    }

    revalidatePath("/vault");
    return actionSuccess({ id: data.id });
  } catch {
    return actionError("계정 저장 중 오류가 발생했습니다.");
  }
}

export async function updateVaultEntry(entryId: string, input: VaultEntryInput): Promise<ActionResult> {
  if (!entryId) {
    return actionError("수정할 계정을 찾을 수 없습니다.");
  }

  const parsed = vaultSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase } = await getActionContext();
    let passwordPayload: { password_encrypted: string; iv: string } | null = null;

    if (parsed.data.password) {
      const encrypted = encryptWithIv(parsed.data.password);
      passwordPayload = {
        password_encrypted: encrypted.ciphertext,
        iv: encrypted.iv,
      };
    }

    const { error } = await supabase
      .from("vault_entries")
      .update({
        site_name: parsed.data.site_name,
        url: parsed.data.url?.trim() || null,
        username: parsed.data.username,
        memo: parsed.data.memo?.trim() || null,
        ...(passwordPayload ?? {}),
      })
      .eq("id", entryId);

    if (error) {
      return actionError("계정 정보를 수정하지 못했습니다.");
    }

    revalidatePath("/vault");
    return actionSuccess(undefined);
  } catch {
    return actionError("계정 수정 중 오류가 발생했습니다.");
  }
}

export async function deleteVaultEntry(entryId: string): Promise<ActionResult> {
  if (!entryId) {
    return actionError("삭제할 계정을 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("vault_entries").delete().eq("id", entryId);
    if (error) {
      return actionError("계정 삭제에 실패했습니다.");
    }

    revalidatePath("/vault");
    return actionSuccess(undefined);
  } catch {
    return actionError("계정 삭제 중 오류가 발생했습니다.");
  }
}

export async function revealVaultPassword(entryId: string): Promise<ActionResult<{ password: string }>> {
  if (!entryId) {
    return actionError("비밀번호를 확인할 계정을 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { data, error } = await supabase
      .from("vault_entries")
      .select("password_encrypted, iv")
      .eq("id", entryId)
      .single();

    if (error || !data?.password_encrypted || !data.iv) {
      return actionError("비밀번호 정보를 찾지 못했습니다.");
    }

    const password = decryptWithIv(data.password_encrypted, data.iv);
    return actionSuccess({ password });
  } catch {
    return actionError("비밀번호 복호화에 실패했습니다.");
  }
}
