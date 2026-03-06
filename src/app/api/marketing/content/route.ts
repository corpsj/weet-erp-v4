import type { NextRequest } from "next/server";
import type { MarketingContent } from "@/types/marketing";
import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";

type MarketingContentRow = {
  id: string;
  channel: string;
  title: string | null;
  body: string;
  status: string;
  engagement_metrics: Record<string, unknown> | null;
  persona_target: string | null;
  created_at: string;
  published_at: string | null;
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

    const channel = request.nextUrl.searchParams.get("channel");
    let query = supabase.from("marketing_contents").select("*");

    if (channel) {
      query = query.eq("channel", channel);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      throw new ApiError("INTERNAL_ERROR", "마케팅 콘텐츠를 불러오지 못했습니다.", error.message);
    }

    const contents: MarketingContent[] = (data ?? []).map((row: MarketingContentRow) => ({
      id: row.id,
      channel: row.channel,
      title: row.title,
      body: row.body,
      status: row.status,
      engagementMetrics: row.engagement_metrics ?? {},
      personaTarget: row.persona_target,
      createdAt: row.created_at,
      publishedAt: row.published_at,
    }));

    return ok(contents);
  } catch (error) {
    return toErrorResponse(error);
  }
}
