import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";

type SystemStatus = {
  scheduler: { running: boolean; lastRun: string | null; nextRun: string | null };
  ollama: { connected: boolean; model: string };
  naverQuota: { used: number; limit: number; resetAt: string | null };
};

const LMSTUDIO_URL = "http://localhost:1234/v1/models";
const HEARTBEAT_KEY = "scheduler_heartbeat";
const HEARTBEAT_STALE_MS = 10 * 60 * 1000; // 10 minutes

async function checkLMStudio(): Promise<{ connected: boolean; model: string }> {
  try {
    const res = await fetch(LMSTUDIO_URL, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { connected: false, model: "llama3.2" };

    const data = await res.json();
    const models = data?.data as { id: string }[] | undefined;
    const model = models?.[0]?.id ?? "llama3.2";
    return { connected: true, model };
  } catch {
    return { connected: false, model: "llama3.2" };
  }
}

async function checkScheduler(
  supabase: Awaited<ReturnType<typeof createRouteClient>>,
): Promise<{ running: boolean; lastRun: string | null; nextRun: string | null }> {
  try {
    const { data, error } = await supabase
      .from("marketing_settings")
      .select("value")
      .eq("key", HEARTBEAT_KEY)
      .single();

    if (error || !data?.value) {
      return { running: false, lastRun: null, nextRun: null };
    }

    const hb = data.value as {
      last_run?: string;
      next_run?: string;
      timestamp?: string;
    };

    const ts = hb.timestamp ? new Date(hb.timestamp).getTime() : 0;
    const running = Date.now() - ts < HEARTBEAT_STALE_MS;

    return {
      running,
      lastRun: hb.last_run ?? null,
      nextRun: hb.next_run ?? null,
    };
  } catch {
    return { running: false, lastRun: null, nextRun: null };
  }
}

async function checkNaverQuota(
  supabase: Awaited<ReturnType<typeof createRouteClient>>,
): Promise<{ used: number; limit: number; resetAt: string | null }> {
  const DAILY_LIMIT = 25000;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("daily_metrics")
      .select("naver_api_calls")
      .eq("date", today)
      .limit(1)
      .single();

    const used = (data?.naver_api_calls as number) ?? 0;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return { used, limit: DAILY_LIMIT, resetAt: tomorrow.toISOString() };
  } catch {
    return { used: 0, limit: DAILY_LIMIT, resetAt: null };
  }
}

export async function GET() {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const [ollama, scheduler, naverQuota] = await Promise.all([
      checkLMStudio(),
      checkScheduler(supabase),
      checkNaverQuota(supabase),
    ]);

    const status: SystemStatus = { scheduler, ollama, naverQuota };

    const response = ok(status);
    response.headers.set("Cache-Control", "s-maxage=15");
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
