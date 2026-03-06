import type { NextRequest } from "next/server";
import type { MarketSignal } from "@/types/marketing";
import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";

type MarketingSignalRow = {
  id: string;
  source: string;
  signal_type: string | null;
  title: string | null;
  summary: string | null;
  urgency: string;
  sentiment: string | null;
  keywords: unknown;
  url: string | null;
  collected_at: string;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const urgency = request.nextUrl.searchParams.get("urgency");

    let query = supabase.from("marketing_signals").select("*");

    if (urgency) {
      query = query.eq("urgency", urgency);
    }

    const { data, error } = await query.order("collected_at", { ascending: false });

    if (error) {
      throw new ApiError("INTERNAL_ERROR", "마케팅 시그널을 불러오지 못했습니다.", error.message);
    }

    const signals: MarketSignal[] = (data ?? []).map((row: MarketingSignalRow) => ({
      id: row.id,
      source: row.source,
      signalType: row.signal_type,
      title: row.title,
      summary: row.summary,
      urgency: row.urgency,
      sentiment: row.sentiment,
      keywords: Array.isArray(row.keywords)
        ? row.keywords.filter((keyword): keyword is string => typeof keyword === "string")
        : [],
      url: row.url,
      collectedAt: row.collected_at,
    }));

    return ok(signals);
  } catch (error) {
    return toErrorResponse(error);
  }
}
