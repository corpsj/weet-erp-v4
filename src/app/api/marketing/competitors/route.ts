import type { NextRequest } from "next/server";
import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";
import type { Competitor } from "@/types/marketing";

const SETTINGS_KEY = "instagram_competitors";

async function getCompetitors(
  supabase: Awaited<ReturnType<typeof createRouteClient>>,
): Promise<Competitor[]> {
  const { data, error } = await supabase
    .from("marketing_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (!data?.value) return [];
  return (data.value as Competitor[]) ?? [];
}

async function saveCompetitors(
  supabase: Awaited<ReturnType<typeof createRouteClient>>,
  competitors: Competitor[],
): Promise<void> {
  const { error } = await supabase
    .from("marketing_settings")
    .upsert({ key: SETTINGS_KEY, value: competitors });

  if (error) throw error;
}

export async function GET() {
  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");

    const competitors = await getCompetitors(supabase);
    return ok(competitors);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");

    const body = (await request.json()) as { username: string; displayName?: string; notes?: string };
    if (!body.username?.trim()) {
      throw new ApiError("VALIDATION_ERROR", "사용자 이름은 필수입니다.");
    }

    const username = body.username.trim().toLowerCase().replace(/^@/, "");
    const competitors = await getCompetitors(supabase);

    if (competitors.some((c) => c.username === username)) {
      throw new ApiError("CONFLICT", "이미 등록된 경쟁업체입니다.");
    }

    const newCompetitor: Competitor = {
      username,
      displayName: body.displayName?.trim() || "",
      notes: body.notes?.trim() || "",
      isActive: true,
      addedAt: new Date().toISOString(),
    };

    competitors.push(newCompetitor);
    await saveCompetitors(supabase, competitors);
    return ok(newCompetitor);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");

    const body = (await request.json()) as {
      username: string;
      displayName?: string;
      notes?: string;
      isActive?: boolean;
    };
    if (!body.username?.trim()) {
      throw new ApiError("VALIDATION_ERROR", "사용자 이름은 필수입니다.");
    }

    const username = body.username.trim().toLowerCase().replace(/^@/, "");
    const competitors = await getCompetitors(supabase);
    const index = competitors.findIndex((c) => c.username === username);

    if (index === -1) {
      throw new ApiError("NOT_FOUND", "등록되지 않은 경쟁업체입니다.");
    }

    competitors[index] = {
      ...competitors[index],
      displayName: body.displayName?.trim() ?? competitors[index].displayName,
      notes: body.notes?.trim() ?? competitors[index].notes,
      isActive: body.isActive ?? competitors[index].isActive,
    };

    await saveCompetitors(supabase, competitors);
    return ok(competitors[index]);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");

    const { username } = (await request.json()) as { username: string };
    if (!username?.trim()) {
      throw new ApiError("VALIDATION_ERROR", "사용자 이름은 필수입니다.");
    }

    const target = username.trim().toLowerCase().replace(/^@/, "");
    const competitors = await getCompetitors(supabase);
    const filtered = competitors.filter((c) => c.username !== target);

    if (filtered.length === competitors.length) {
      throw new ApiError("NOT_FOUND", "등록되지 않은 경쟁업체입니다.");
    }

    await saveCompetitors(supabase, filtered);
    return ok({ deleted: target });
  } catch (error) {
    return toErrorResponse(error);
  }
}
