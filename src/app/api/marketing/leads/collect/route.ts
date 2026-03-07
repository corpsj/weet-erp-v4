import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";

const SETTINGS_KEY = "lead_collection_requested";

export async function POST() {
  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("marketing_settings")
      .upsert({
        key: SETTINGS_KEY,
        value: { requested: true, requested_at: now, requested_by: user.id },
      });

    if (error) throw error;

    return ok({ requested: true, requested_at: now });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function GET() {
  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");

    const { data, error } = await supabase
      .from("marketing_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    const value = data?.value as { requested?: boolean; requested_at?: string } | null;

    return ok({
      requested: value?.requested ?? false,
      requested_at: value?.requested_at ?? null,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
