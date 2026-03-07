import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";

export async function POST() {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const { data: signals, error: signalsError } = await supabase
      .from("marketing_signals")
      .select("id")
      .order("collected_at", { ascending: false })
      .limit(10);

    if (signalsError) throw signalsError;

    const { count: leadsCount, error: leadsError } = await supabase
      .from("marketing_leads")
      .select("id", { count: "exact", head: true });

    if (leadsError) throw leadsError;

    return ok({
      signals_count: signals?.length ?? 0,
      leads_count: leadsCount ?? 0,
      triggered: true,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
