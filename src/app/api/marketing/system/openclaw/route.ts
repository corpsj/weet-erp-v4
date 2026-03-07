import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";

type OpenClawAgent = {
  id: string;
  model: string;
};

type OpenClawStatus = {
  status: "online" | "offline";
  agents: OpenClawAgent[];
  skillsCount: number;
  lastChecked: string;
};

type OpenClawResponse = {
  data: OpenClawStatus;
};

export async function GET(): Promise<Response> {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const gatewayUrl = "http://127.0.0.1:18789/health";
    let status: "online" | "offline" = "offline";
    let agents: OpenClawAgent[] = [];
    let skillsCount = 0;

    try {
      const response = await fetch(gatewayUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        status = "online";

        // Parse agents from response
        if (data.agents && Array.isArray(data.agents)) {
          agents = data.agents.map(
            (agent: { id: string; model: string }) => ({
              id: agent.id,
              model: agent.model,
            })
          );
        }

        // Parse skills count from response
        if (typeof data.skillsCount === "number") {
          skillsCount = data.skillsCount;
        }
      }
    } catch {
      // Gateway unreachable or timeout
      status = "offline";
      agents = [];
      skillsCount = 0;
    }

    const result: OpenClawResponse = {
      data: {
        status,
        agents,
        skillsCount,
        lastChecked: new Date().toISOString(),
      },
    };

    const response = ok(result.data);
    response.headers.set("Cache-Control", "s-maxage=30");
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
