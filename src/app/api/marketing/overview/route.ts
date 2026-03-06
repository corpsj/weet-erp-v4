import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";
import type { MarketingOverview } from "@/types/marketing";

type LeadPlatformRow = {
  platform: string;
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

    const [{ count: totalLeads, error: leadsCountError }, { count: pendingProposals, error: proposalsCountError }, { count: publishedContent, error: contentCountError }, { data: leadPlatforms, error: leadPlatformsError }] = await Promise.all([
      supabase.from("marketing_leads").select("id", { count: "exact", head: true }),
      supabase.from("marketing_proposals").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("marketing_contents").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("marketing_leads").select("platform"),
    ]);

    if (leadsCountError) {
      throw leadsCountError;
    }

    if (proposalsCountError) {
      throw proposalsCountError;
    }

    if (contentCountError) {
      throw contentCountError;
    }

    if (leadPlatformsError) {
      throw leadPlatformsError;
    }

    const channelStats = ((leadPlatforms ?? []) as LeadPlatformRow[]).reduce<Record<string, number>>((acc, lead) => {
      const key = lead.platform;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const overview: MarketingOverview = {
      totalLeads: totalLeads ?? 0,
      pendingProposals: pendingProposals ?? 0,
      publishedContent: publishedContent ?? 0,
      channelStats,
    };

    return ok(overview);
  } catch (error) {
    return toErrorResponse(error);
  }
}
