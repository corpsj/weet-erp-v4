import { NextRequest } from "next/server";
import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { signupSchema } from "@/lib/api/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInviteCode } from "@/lib/utils/invite-code";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const parsed = signupSchema.safeParse(payload);

    if (!parsed.success) {
      throw new ApiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.");
    }

    const { username, displayName, password, inviteCode } = parsed.data;
    const admin = createAdminClient();

    const inviteHash = hashInviteCode(inviteCode);

    const { data: invite, error: inviteError } = await admin
      .from("signup_invite_codes")
      .select("id, is_active, expires_at, use_count, max_uses")
      .eq("code_hash", inviteHash)
      .maybeSingle();

    if (inviteError) {
      throw new ApiError("INTERNAL_ERROR", "초대코드 검증 중 오류가 발생했습니다.");
    }

    if (!invite || !invite.is_active) {
      throw new ApiError("FORBIDDEN", "유효하지 않은 초대코드입니다.");
    }

    if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
      throw new ApiError("FORBIDDEN", "만료된 초대코드입니다.");
    }

    if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
      throw new ApiError("FORBIDDEN", "사용 횟수를 초과한 초대코드입니다.");
    }

    const email = `${username}@we-et.com`;
    const { data: signupData, error: signupError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: displayName,
      },
    });
    if (signupError || !signupData.user) {
      if (signupError?.message.includes("already been registered")) {
        throw new ApiError("CONFLICT", "이미 사용 중인 아이디입니다.");
      }
      throw new ApiError("INTERNAL_ERROR", "회원가입에 실패했습니다.");
    }
    const userId = signupData.user.id;

    const { error: profileError } = await admin.from("app_users").upsert({
      id: userId,
      username,
      email,
      display_name: displayName,
      role: "user",
      status: "active",
    });

    if (profileError) {
      throw new ApiError("INTERNAL_ERROR", "사용자 프로필 생성에 실패했습니다.");
    }

    const { error: inviteUpdateError } = await admin
      .from("signup_invite_codes")
      .update({
        use_count: invite.use_count + 1,
      })
      .eq("id", invite.id);

    if (inviteUpdateError) {
      throw new ApiError("INTERNAL_ERROR", "초대코드 사용 기록에 실패했습니다.");
    }

    const { error: usageError } = await admin.from("signup_invite_code_usages").insert({
      invite_code_id: invite.id,
      user_id: userId,
    });

    if (usageError) {
      throw new ApiError("INTERNAL_ERROR", "초대코드 이력 저장에 실패했습니다.");
    }

    return ok({ id: userId, username, email });
  } catch (error) {
    return toErrorResponse(error);
  }
}
