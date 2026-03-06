"use client";

import React from "react";
import Link from "next/link";
import { Users, Lightbulb, FileText, Radio } from "lucide-react";
import {
  useMarketingOverview,
  useMarketingLeads,
  useMarketingProposals,
} from "@/lib/api/hooks/marketing";
import { MetricCard } from "@/components/modules/marketing/metric-card";
import { LeadTable } from "@/components/modules/marketing/lead-table";
import { ProposalCard } from "@/components/modules/marketing/proposal-card";

export default function MarketingOverviewPage() {
  const { data: overview, isLoading: isOverviewLoading } = useMarketingOverview();
  const { data: leads, isLoading: isLeadsLoading } = useMarketingLeads();
  const { data: proposals, isLoading: isProposalsLoading } = useMarketingProposals();

  const isLoading = isOverviewLoading || isLeadsLoading || isProposalsLoading;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-8 bg-[#1a1a1a] rounded w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-[#141414] rounded-md border border-[#2a2a2a]" />
          ))}
        </div>
        <div className="h-64 bg-[#141414] rounded-md border border-[#2a2a2a]" />
      </div>
    );
  }

  const recentLeads = leads?.slice(0, 3) || [];
  const recentProposals = proposals?.slice(0, 3) || [];
  const activeChannels = Object.keys(overview?.channelStats || {}).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#ffffff] tracking-tight mb-2">대시보드 개요</h1>
        <p className="text-[#9a9a9a]">WEET Director의 현재 마케팅 현황입니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="총 리드" value={overview?.totalLeads ?? 0} icon={Users} />
        <MetricCard title="대기 중 제안" value={overview?.pendingProposals ?? 0} icon={Lightbulb} />
        <MetricCard title="발행된 콘텐츠" value={overview?.publishedContent ?? 0} icon={FileText} />
        <MetricCard title="활성 채널" value={activeChannels} icon={Radio} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#ffffff]">최근 제안</h2>
            <Link href="/marketing/proposals" className="text-sm font-medium text-[#9a9a9a] hover:text-[#ffffff] transition-colors">
              전체보기 →
            </Link>
          </div>
          <div className="grid gap-4">
            {recentProposals.length === 0 ? (
              <div className="bg-[#141414] rounded-md border border-[#2a2a2a] p-8 text-center text-[#9a9a9a]">
                제안 내역이 없습니다.
              </div>
            ) : (
              recentProposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onApprove={() => {}}
                  onReject={() => {}}
                />
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#ffffff]">최근 리드</h2>
            <Link href="/marketing/leads" className="text-sm font-medium text-[#9a9a9a] hover:text-[#ffffff] transition-colors">
              전체보기 →
            </Link>
          </div>
          <LeadTable leads={recentLeads} />
        </div>
      </div>
    </div>
  );
}