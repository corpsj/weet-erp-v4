"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api/client";
import type {
  MarketingOverview,
  MarketingLead,
  MarketingProposal,
  MarketingContent,
  MarketSignal,
  DailyMetric,
  SystemStatus,
  LeadFilters,
} from "@/types/marketing";

export function useMarketingOverview() {
  return useQuery({
    queryKey: ["marketing", "overview"],
    queryFn: () => fetchApi<MarketingOverview>("/api/marketing/overview"),
    staleTime: 1000 * 60,
  });
}

export function useMarketingLeads(filters?: LeadFilters) {
  return useQuery({
    queryKey: ["marketing", "leads", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.scoreMin !== undefined)
        params.set("score_min", String(filters.scoreMin));
      if (filters?.persona) params.set("persona", filters.persona);
      if (filters?.stage) params.set("stage", filters.stage);
      const queryString = params.toString();
      return fetchApi<MarketingLead[]>(
        `/api/marketing/leads${queryString ? `?${queryString}` : ""}`,
      );
    },
    staleTime: 1000 * 30,
  });
}

export function useMarketingProposals(status?: string) {
  return useQuery({
    queryKey: ["marketing", "proposals", status],
    queryFn: () =>
      fetchApi<MarketingProposal[]>(
        `/api/marketing/proposals${status ? `?status=${status}` : ""}`,
      ),
    staleTime: 1000 * 30,
  });
}

export function useMarketingContent(channel?: string) {
  return useQuery({
    queryKey: ["marketing", "content", channel],
    queryFn: () =>
      fetchApi<MarketingContent[]>(
        `/api/marketing/content${channel ? `?channel=${channel}` : ""}`,
      ),
    staleTime: 1000 * 30,
  });
}

export function useMarketingSignals() {
  return useQuery({
    queryKey: ["marketing", "signals"],
    queryFn: () => fetchApi<MarketSignal[]>("/api/marketing/signals"),
    staleTime: 1000 * 60,
  });
}

export function useMarketingDailyMetrics() {
  return useQuery({
    queryKey: ["marketing", "daily-metrics"],
    queryFn: () => fetchApi<DailyMetric[]>("/api/marketing/daily-metrics"),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSystemStatus() {
  return useQuery({
    queryKey: ["marketing", "system-status"],
    queryFn: () => fetchApi<SystemStatus>("/api/marketing/system/status"),
    staleTime: 1000 * 30,
  });
}

export function useApproveProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchApi<MarketingProposal>(`/api/marketing/proposals/${id}/approve`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "proposals"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "overview"] });
    },
  });
}

export function useRejectProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      fetchApi<MarketingProposal>(`/api/marketing/proposals/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "proposals"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "overview"] });
    },
  });
}
