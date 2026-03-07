import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";
import type { MarketingOverview } from "@/types/marketing";

type LeadPlatformRow = {
  platform: string;
};

type LeadActivityRow = {
  id: string;
  action_type: string | null;
  details: Record<string, unknown> | null;
  performed_at: string;
};

type ProposalActivityRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

type ContentActivityRow = {
  id: string;
  title: string | null;
  published_at: string | null;
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

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalLeads, error: leadsCountError },
      { count: pendingProposals, error: proposalsCountError },
      { count: publishedContent, error: contentCountError },
      { data: leadPlatforms, error: leadPlatformsError },
      { count: leadsThisWeek, error: leadsThisWeekError },
      { count: leadsLastWeek, error: leadsLastWeekError },
      { count: proposalsThisWeek, error: proposalsThisWeekError },
      { count: proposalsLastWeek, error: proposalsLastWeekError },
      { count: contentThisWeek, error: contentThisWeekError },
      { count: contentLastWeek, error: contentLastWeekError },
      { data: leadActivities, error: leadActivitiesError },
      { data: proposalActivities, error: proposalActivitiesError },
      { data: contentActivities, error: contentActivitiesError },
    ] = await Promise.all([
      supabase.from("marketing_leads").select("id", { count: "exact", head: true }),
      supabase.from("marketing_proposals").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("marketing_contents").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("marketing_leads").select("platform"),
      supabase.from("marketing_leads").select("id", { count: "exact", head: true }).gt("created_at", sevenDaysAgo),
      supabase
        .from("marketing_leads")
        .select("id", { count: "exact", head: true })
        .lte("created_at", sevenDaysAgo)
        .gt("created_at", fourteenDaysAgo),
      supabase
        .from("marketing_proposals")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .gt("created_at", sevenDaysAgo),
      supabase
        .from("marketing_proposals")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .lte("created_at", sevenDaysAgo)
        .gt("created_at", fourteenDaysAgo),
      supabase
        .from("marketing_contents")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .gt("created_at", sevenDaysAgo),
      supabase
        .from("marketing_contents")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .lte("created_at", sevenDaysAgo)
        .gt("created_at", fourteenDaysAgo),
      supabase
        .from("marketing_lead_actions")
        .select("id, action_type, details, performed_at")
        .order("performed_at", { ascending: false })
        .limit(2),
      supabase
        .from("marketing_proposals")
        .select("id, title, status, created_at")
        .in("status", ["approved", "rejected"])
        .order("created_at", { ascending: false })
        .limit(2),
      supabase
        .from("marketing_contents")
        .select("id, title, published_at, created_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(1),
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

    if (leadsThisWeekError) {
      throw leadsThisWeekError;
    }

    if (leadsLastWeekError) {
      throw leadsLastWeekError;
    }

    if (proposalsThisWeekError) {
      throw proposalsThisWeekError;
    }

    if (proposalsLastWeekError) {
      throw proposalsLastWeekError;
    }

    if (contentThisWeekError) {
      throw contentThisWeekError;
    }

    if (contentLastWeekError) {
      throw contentLastWeekError;
    }

    if (leadActivitiesError) {
      throw leadActivitiesError;
    }

    if (proposalActivitiesError) {
      throw proposalActivitiesError;
    }

    if (contentActivitiesError) {
      throw contentActivitiesError;
    }

    const channelStats = ((leadPlatforms ?? []) as LeadPlatformRow[]).reduce<Record<string, number>>((acc, lead) => {
      const key = lead.platform;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const recentActivity = [
      ...((leadActivities ?? []) as LeadActivityRow[]).map((activity) => ({
        id: activity.id,
        type: "lead_created" as const,
        title: typeof activity.details?.title === "string"
          ? activity.details.title
          : activity.action_type ?? "리드 활동 발생",
        createdAt: activity.performed_at,
      })),
      ...((proposalActivities ?? []) as ProposalActivityRow[]).map((proposal) => ({
        id: proposal.id,
        type: proposal.status === "approved" ? ("proposal_approved" as const) : ("proposal_rejected" as const),
        title: proposal.title,
        createdAt: proposal.created_at,
      })),
      ...((contentActivities ?? []) as ContentActivityRow[]).map((content) => ({
        id: content.id,
        type: "content_published" as const,
        title: content.title ?? "제목 없는 콘텐츠",
        createdAt: content.published_at ?? content.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    const overview: MarketingOverview = {
      totalLeads: totalLeads ?? 0,
      pendingProposals: pendingProposals ?? 0,
      publishedContent: publishedContent ?? 0,
      channelStats,
      trends: {
        leadsChange: (leadsThisWeek ?? 0) - (leadsLastWeek ?? 0),
        proposalsChange: (proposalsThisWeek ?? 0) - (proposalsLastWeek ?? 0),
        contentChange: (contentThisWeek ?? 0) - (contentLastWeek ?? 0),
      },
      recentActivity,
    };

    return ok(overview);
  } catch (error) {
    return toErrorResponse(error);
  }
}
