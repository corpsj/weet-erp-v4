import { NextRequest } from "next/server";
import { loginSchema } from "@/lib/api/schemas";
import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const parsed = loginSchema.safeParse(payload);

    if (!parsed.success) {
      throw new ApiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.");
    }

    const supabase = await createRouteClient();
    const email = `${parsed.data.username}@we-et.com`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.password,
    });

    if (error || !data.user) {
      throw new ApiError("UNAUTHORIZED", "아이디 또는 비밀번호가 올바르지 않습니다.");
    }

    return ok({
      id: data.user.id,
      email,
      username: parsed.data.username,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
