"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Check,
  FileText,
  Lightbulb,
  Radio,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ModuleShell } from "@/components/layout/module-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/modules/marketing/metric-card";
import { LeadTable } from "@/components/modules/marketing/lead-table";
import { ProposalCard } from "@/components/modules/marketing/proposal-card";
import {
  useApproveProposal,
  useMarketingDailyMetrics,
  useMarketingLeads,
  useMarketingOverview,
  useMarketingProposals,
  useRejectProposal,
} from "@/lib/api/hooks/marketing";
import { markMenuAsRead } from "@/lib/api/actions/hub";
import { formatDate, formatMonthDay, getRelativeTime } from "@/lib/utils/format";
import { JOURNEY_STAGE_LABELS } from "@/types/marketing";

const PIPELINE_STAGE_IDS = [
  "awareness",
  "interest",
  "consideration",
  "decision",
  "conversion",
  "retention",
] as const;

type MetricType = "leadsCollected" | "proposalsMade" | "contentsPublished";

const METRIC_LABELS: Record<MetricType, string> = {
  leadsCollected: "리드 수집",
  proposalsMade: "제안 생성",
  contentsPublished: "콘텐츠 발행",
};

export default function MarketingOverviewPage() {
  return (
    <ModuleShell
      title="마케팅 개요"
      description="WEET Director의 현재 마케팅 현황입니다."
      breadcrumb={[{ label: "마케팅" }, { label: "개요" }]}
    >
      <MarketingOverviewContent />
    </ModuleShell>
  );
}

function MarketingOverviewContent() {
  const [activeMetric, setActiveMetric] = useState<MetricType>("leadsCollected");
  const {
    data: overview,
    isLoading: isOverviewLoading,
    isError: isOverviewError,
    refetch: refetchOverview,
  } = useMarketingOverview();
  const {
    data: leads,
    isLoading: isLeadsLoading,
    isError: isLeadsError,
    refetch: refetchLeads,
  } = useMarketingLeads();
  const {
    data: proposals,
    isLoading: isProposalsLoading,
    isError: isProposalsError,
    refetch: refetchProposals,
  } = useMarketingProposals();
  const {
    data: dailyMetrics,
    isLoading: isMetricsLoading,
    isError: isMetricsError,
    refetch: refetchMetrics,
  } = useMarketingDailyMetrics();
  const approveProposal = useApproveProposal();
  const rejectProposal = useRejectProposal();

  useEffect(() => {
    void markMenuAsRead("marketing");
  }, []);

  const isLoading =
    isOverviewLoading || isLeadsLoading || isProposalsLoading || isMetricsLoading;
  const isError = isOverviewError || isLeadsError || isProposalsError || isMetricsError;

  const refetchAll = () => {
    void refetchOverview();
    void refetchLeads();
    void refetchProposals();
    void refetchMetrics();
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="h-28 rounded-md border border-[#2a2a2a] bg-[#141414]"
            />
          ))}
        </div>
        <div className="h-64 rounded-md border border-[#2a2a2a] bg-[#141414]" />
        <div className="h-64 rounded-md border border-[#2a2a2a] bg-[#141414]" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="mt-4 p-6">
        <p className="text-sm text-[var(--color-danger)]">마케팅 데이터를 불러오지 못했습니다.</p>
        <Button className="mt-3" variant="outline" onClick={refetchAll}>
          다시 시도
        </Button>
      </Card>
    );
  }

  const safeOverview = overview ?? {
    totalLeads: 0,
    pendingProposals: 0,
    publishedContent: 0,
    channelStats: {},
    trends: {
      leadsChange: 0,
      proposalsChange: 0,
      contentChange: 0,
    },
    recentActivity: [],
  };
  const allLeads = leads ?? [];
  const allProposals = proposals ?? [];
  const recentLeads = allLeads.slice(0, 5);
  const recentProposals = allProposals.slice(0, 3);
  const activeChannels = Object.keys(safeOverview.channelStats).length;

  const sortedDailyMetrics = [...(dailyMetrics ?? [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);
  const maxMetricValue = Math.max(...sortedDailyMetrics.map((item) => item[activeMetric]), 0);

  const stageCounts = PIPELINE_STAGE_IDS.map((stageId) => {
    const count = allLeads.filter((lead) => lead.journeyStage === stageId).length;
    return {
      id: stageId,
      label: JOURNEY_STAGE_LABELS[stageId] ?? stageId,
      count,
    };
  });
  const maxStageCount = Math.max(...stageCounts.map((stage) => stage.count), 0);

  function handleApprove(id: string) {
    approveProposal.mutate(id, {
      onSuccess: () => toast.success("제안이 승인되었습니다."),
      onError: () => toast.error("승인에 실패했습니다."),
    });
  }

  function handleReject(id: string) {
    if (rejectProposal.isPending) return;
    rejectProposal.mutate(
      { id, reason: "관리자 거부" },
      {
        onSuccess: () => toast.success("제안이 거부되었습니다."),
        onError: () => toast.error("거부에 실패했습니다."),
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="총 리드"
          value={safeOverview.totalLeads}
          icon={Users}
          change={safeOverview.trends.leadsChange}
        />
        <MetricCard
          title="대기 중 제안"
          value={safeOverview.pendingProposals}
          icon={Lightbulb}
          change={safeOverview.trends.proposalsChange}
        />
        <MetricCard
          title="발행된 콘텐츠"
          value={safeOverview.publishedContent}
          icon={FileText}
          change={safeOverview.trends.contentChange}
        />
        <MetricCard title="활성 채널" value={activeChannels} icon={Radio} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#ffffff]">일일 추이</h2>
            <div className="flex items-center gap-2">
              {(Object.entries(METRIC_LABELS) as [MetricType, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveMetric(key)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    activeMetric === key
                      ? "bg-[#1a1a1a] text-[#ffffff]"
                      : "text-[#9a9a9a] hover:text-[#d4d4d4]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {sortedDailyMetrics.length === 0 ? (
            <div className="rounded-md border border-[#2a2a2a] bg-[#0a0a0a] p-8 text-center text-[#9a9a9a]">
              아직 수집된 데이터가 없습니다
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex min-w-[640px] items-end gap-2 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] p-4">
                {sortedDailyMetrics.map((metric) => {
                  const metricValue = metric[activeMetric];
                  const heightRatio = maxMetricValue === 0 ? 0 : metricValue / maxMetricValue;
                  const barHeight = Math.max(8, Math.round(heightRatio * 140));

                  return (
                    <div key={metric.id} className="flex flex-1 flex-col items-center gap-2">
                      <span className="text-xs text-[#d4d4d4]">{metricValue}</span>
                      <div className="flex h-36 w-full items-end rounded bg-[#141414] px-1">
                        <div
                          className="w-full rounded-t bg-[#e5e5e5]"
                          style={{ height: `${barHeight}px` }}
                          title={`${formatDate(metric.date)} · ${metricValue}건`}
                        />
                      </div>
                      <span className="text-[11px] text-[#9a9a9a]">
                        {formatMonthDay(metric.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-[#9a9a9a]">Y축: 건수 / X축: 날짜</p>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold text-[#ffffff]">리드 파이프라인</h2>
          <div className="space-y-3">
            {stageCounts.map((stage) => {
              const widthRatio =
                maxStageCount === 0 ? 0 : Math.round((stage.count / maxStageCount) * 100);
              return (
                <div key={stage.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#d4d4d4]">{stage.label}</span>
                    <span className="font-mono text-[#9a9a9a]">{stage.count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#1a1a1a]">
                    <div
                      className="h-2 rounded-full bg-[#e5e5e5]"
                      style={{ width: `${Math.max(widthRatio, stage.count > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-bold text-[#ffffff]">최근 활동</h2>
        {safeOverview.recentActivity.length === 0 ? (
          <p className="rounded-md border border-[#2a2a2a] bg-[#0a0a0a] p-6 text-center text-[#9a9a9a]">
            최근 활동이 없습니다
          </p>
        ) : (
          <ul className="space-y-2">
            {safeOverview.recentActivity.map((activity) => {
              const Icon =
                activity.type === "lead_created"
                  ? Users
                  : activity.type === "proposal_approved"
                    ? Check
                    : activity.type === "proposal_rejected"
                      ? X
                      : FileText;
              return (
                <li
                  key={activity.id}
                  className="flex items-center justify-between rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-[#9a9a9a]" />
                    <span className="text-sm text-[#ffffff]">{activity.title}</span>
                  </div>
                  <span className="text-xs text-[#9a9a9a]">
                    {getRelativeTime(activity.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#ffffff]">최근 제안</h2>
            <Link
              href="/marketing/proposals"
              className="text-sm font-medium text-[#9a9a9a] transition-colors hover:text-[#ffffff]"
            >
              전체보기
            </Link>
          </div>
          {recentProposals.length === 0 ? (
            <div className="rounded-md border border-[#2a2a2a] bg-[#0a0a0a] p-8 text-center text-[#9a9a9a]">
              제안 내역이 없습니다.
            </div>
          ) : (
            <div className="grid gap-4">
              {recentProposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#ffffff]">최근 리드</h2>
            <Link
              href="/marketing/leads"
              className="text-sm font-medium text-[#9a9a9a] transition-colors hover:text-[#ffffff]"
            >
              전체보기
            </Link>
          </div>
          <LeadTable leads={recentLeads} />
        </Card>
      </div>
    </div>
  );
}
