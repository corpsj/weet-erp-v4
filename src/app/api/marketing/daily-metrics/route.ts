import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";
import type { DailyMetric } from "@/types/marketing";

type DailyMetricRow = {
  id: string;
  date: string;
  leads_collected: number;
  proposals_made: number;
  proposals_approved: number;
  contents_published: number;
  created_at: string;
};

export async function GET(request: Request) {
  try {
    void request;

    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data, error } = await supabase
      .from("marketing_daily_metrics")
      .select("*")
      .order("date", { ascending: true })
      .gte("date", thirtyDaysAgo);

    if (error) {
      throw error;
    }

    const metrics: DailyMetric[] = ((data ?? []) as DailyMetricRow[]).map((row) => ({
      id: row.id,
      date: row.date,
      leadsCollected: row.leads_collected,
      proposalsMade: row.proposals_made,
      proposalsApproved: row.proposals_approved,
      contentsPublished: row.contents_published,
      createdAt: row.created_at,
    }));

    return ok(metrics);
  } catch (error) {
    return toErrorResponse(error);
  }
}
