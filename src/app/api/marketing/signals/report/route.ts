import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";

type SignalRow = {
  signal_type: string | null;
  source: string;
  urgency: string;
  keywords: string[] | null;
};

export async function GET() {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const { data: signals, error } = await supabase
      .from("marketing_signals")
      .select("signal_type, source, urgency, keywords");

    if (error) throw error;

    const rows = (signals ?? []) as SignalRow[];
    const total = rows.length;

    const by_type: Record<string, number> = {};
    const by_source: Record<string, number> = {};
    const by_urgency: Record<string, number> = {};
    const keywordCount: Record<string, number> = {};

    for (const row of rows) {
      const t = row.signal_type ?? "unknown";
      by_type[t] = (by_type[t] ?? 0) + 1;

      by_source[row.source] = (by_source[row.source] ?? 0) + 1;

      by_urgency[row.urgency] = (by_urgency[row.urgency] ?? 0) + 1;

      if (row.keywords) {
        for (const kw of row.keywords) {
          keywordCount[kw] = (keywordCount[kw] ?? 0) + 1;
        }
      }
    }

    const top_keywords = Object.entries(keywordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([keyword, count]) => ({ keyword, count }));

    return ok({ total, by_type, by_source, by_urgency, top_keywords });
  } catch (error) {
    return toErrorResponse(error);
  }
}
