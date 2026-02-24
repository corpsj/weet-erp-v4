"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionError, actionSuccess, type ActionResult } from "@/lib/api/action-result";
import { getActionContext } from "@/lib/api/actions/shared";
import { decryptWithIv, encryptWithIv } from "@/lib/utils/encryption";
import { hashInviteCode } from "@/lib/utils/invite-code";

const profileSchema = z.object({
  display_name: z.string().trim().min(1, "이름을 입력해주세요.").max(80, "이름이 너무 깁니다."),
  job_title: z.string().trim().max(120, "직함이 너무 깁니다.").optional(),
  bio: z.string().max(1000, "소개가 너무 깁니다.").optional(),
  profile_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "프로필 색상을 확인해주세요."),
});

const inviteCodeSchema = z.object({
  max_uses: z.number().int().positive("최대 사용 횟수는 1 이상이어야 합니다.").nullable().optional(),
  expires_at: z
    .string()
    .nullable()
    .optional()
    .refine((value) => !value || Number.isFinite(new Date(value).getTime()), "만료일 형식이 올바르지 않습니다."),
  memo: z.string().max(300, "메모가 너무 깁니다.").optional(),
});

const aiModelSchema = z.object({
  model: z.string().trim().min(1, "AI 모델을 선택해주세요."),
});

async function resolveRole(userId: string) {
  const { supabase } = await getActionContext();
  const { data } = await supabase.from("app_users").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin" ? "admin" : "user";
}

async function ensureAdmin(userId: string) {
  const role = await resolveRole(userId);
  if (role !== "admin") {
    throw new Error("관리자 권한이 필요합니다.");
  }
}

function generateInviteCode(length = 8) {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += charset[bytes[i] % charset.length];
  }
  return code;
}

export async function updateMyProfile(input: z.infer<typeof profileSchema>): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase, user } = await getActionContext();
    const { error } = await supabase
      .from("app_users")
      .update({
        display_name: parsed.data.display_name,
        job_title: parsed.data.job_title?.trim() || null,
        bio: parsed.data.bio?.trim() || null,
        profile_color: parsed.data.profile_color,
      })
      .eq("id", user.id);

    if (error) {
      return actionError("프로필 저장에 실패했습니다.");
    }

    revalidatePath("/settings");
    return actionSuccess(undefined);
  } catch {
    return actionError("프로필 저장 중 오류가 발생했습니다.");
  }
}

export async function createInviteCode(input: z.infer<typeof inviteCodeSchema>): Promise<ActionResult<{ id: string; code: string }>> {
  const parsed = inviteCodeSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase, user } = await getActionContext();
    await ensureAdmin(user.id);

    const code = generateInviteCode(8);
    const encrypted = encryptWithIv(code);
    const { data, error } = await supabase
      .from("signup_invite_codes")
      .insert({
        code_hash: hashInviteCode(code),
        code_encrypted: encrypted.ciphertext,
        iv: encrypted.iv,
        max_uses: parsed.data.max_uses ?? null,
        expires_at: parsed.data.expires_at ?? null,
        memo: parsed.data.memo?.trim() || null,
        is_active: true,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      return actionError("초대코드 생성에 실패했습니다.");
    }

    revalidatePath("/settings");
    return actionSuccess({ id: data.id, code });
  } catch (error) {
    if (error instanceof Error && error.message === "관리자 권한이 필요합니다.") {
      return actionError(error.message);
    }
    return actionError("초대코드 생성 중 오류가 발생했습니다.");
  }
}

export async function toggleInviteCodeActive(inviteCodeId: string, isActive: boolean): Promise<ActionResult> {
  if (!inviteCodeId) {
    return actionError("대상 초대코드를 찾을 수 없습니다.");
  }

  try {
    const { supabase, user } = await getActionContext();
    await ensureAdmin(user.id);

    const { error } = await supabase.from("signup_invite_codes").update({ is_active: isActive }).eq("id", inviteCodeId);
    if (error) {
      return actionError("초대코드 상태 변경에 실패했습니다.");
    }

    revalidatePath("/settings");
    return actionSuccess(undefined);
  } catch (error) {
    if (error instanceof Error && error.message === "관리자 권한이 필요합니다.") {
      return actionError(error.message);
    }
    return actionError("초대코드 상태 변경 중 오류가 발생했습니다.");
  }
}

export async function revealInviteCode(inviteCodeId: string): Promise<ActionResult<{ code: string }>> {
  if (!inviteCodeId) {
    return actionError("조회할 초대코드를 찾을 수 없습니다.");
  }

  try {
    const { supabase, user } = await getActionContext();
    await ensureAdmin(user.id);

    const { data, error } = await supabase
      .from("signup_invite_codes")
      .select("code_encrypted, iv")
      .eq("id", inviteCodeId)
      .single();

    if (error || !data?.code_encrypted || !data.iv) {
      return actionError("초대코드를 찾지 못했습니다.");
    }

    const code = decryptWithIv(data.code_encrypted, data.iv);
    return actionSuccess({ code });
  } catch (error) {
    if (error instanceof Error && error.message === "관리자 권한이 필요합니다.") {
      return actionError(error.message);
    }
    return actionError("초대코드 복호화에 실패했습니다.");
  }
}

export async function saveAiModelSetting(input: z.infer<typeof aiModelSchema>): Promise<ActionResult> {
  const parsed = aiModelSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase, user } = await getActionContext();
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: "ai_model",
        value: { model: parsed.data.model },
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

    if (error) {
      return actionError("AI 모델 저장에 실패했습니다.");
    }

    revalidatePath("/settings");
    revalidatePath("/utilities");
    return actionSuccess(undefined);
  } catch {
    return actionError("AI 모델 저장 중 오류가 발생했습니다.");
  }
}
