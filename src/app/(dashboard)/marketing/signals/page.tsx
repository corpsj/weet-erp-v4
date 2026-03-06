"use client";

import { useMemo, useState } from "react";
import { useMarketingSignals } from "@/lib/api/hooks/marketing";
import { ModuleShell } from "@/components/layout/module-shell";
import { SignalTimeline, type Signal } from "@/components/modules/marketing/signal-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, Flame } from "lucide-react";

const URGENCY_TABS = [
  { id: undefined, label: "전체" },
  { id: "critical", label: "긴급" },
  { id: "high", label: "높음" },
  { id: "medium", label: "보통" },
  { id: "low", label: "낮음" },
];

export default function SignalsPage() {
  return (
    <ModuleShell
      title="시장 신호"
      description="Market Radar가 감지한 업계 동향과 신호입니다."
      breadcrumb={[{ label: "마케팅", href: "/marketing" }, { label: "신호" }]}
    >
      <SignalsContent />
    </ModuleShell>
  );
}

function SignalsContent() {
  const [urgencyFilter, setUrgencyFilter] = useState<string | undefined>(undefined);
  const { data, isLoading } = useMarketingSignals();

  const signals = (data ?? []).filter(
    (s): s is Signal => s.title !== null && s.summary !== null,
  );

  const filteredSignals = useMemo(
    () =>
      signals.filter((signal) => !urgencyFilter || signal.urgency === urgencyFilter),
    [signals, urgencyFilter],
  );

  const trendKeywords = useMemo(() => {
    const keywordCount: Record<string, number> = {};
    signals.forEach((signal) => {
      signal.keywords.forEach((keyword) => {
        keywordCount[keyword] = (keywordCount[keyword] ?? 0) + 1;
      });
    });
    return Object.entries(keywordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword]) => keyword);
  }, [signals]);

  const criticalCount = signals.filter((signal) => signal.urgency === "critical").length;
  const highCount = signals.filter((signal) => signal.urgency === "high").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2 rounded-md border border-[#2a2a2a] bg-[#141414] p-1">
          {URGENCY_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setUrgencyFilter(tab.id)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                urgencyFilter === tab.id
                  ? "bg-[#1a1a1a] text-[#ffffff]"
                  : "text-[#9a9a9a] hover:bg-[#141414]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" disabled className="opacity-50">
          <RefreshCw className="mr-1 h-4 w-4" /> 수동 수집 (곧 출시)
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="animate-pulse bg-[#141414] rounded-md border border-[#2a2a2a] p-8 space-y-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-12 h-12 bg-[#1a1a1a] rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-[#1a1a1a] rounded w-1/4" />
                    <div className="h-4 bg-[#1a1a1a] rounded w-3/4" />
                    <div className="h-16 bg-[#1a1a1a] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <SignalTimeline signals={filteredSignals} />
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-[#141414] rounded-md border border-[#2a2a2a] p-6">
            <h2 className="text-lg font-bold text-[#ffffff] mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#9a9a9a]" /> 트렌드 키워드
            </h2>
            {trendKeywords.length === 0 ? (
              <p className="text-sm text-[#9a9a9a]">표시할 키워드가 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {trendKeywords.map((keyword, i) => (
                  <Badge
                    key={keyword}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-[#d4d4d4]"
                  >
                    {i < 3 && <Flame className="w-3.5 h-3.5" />}
                    {keyword}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#141414] rounded-md border border-[#2a2a2a] p-6 space-y-3">
            <h2 className="text-lg font-bold text-[#ffffff]">신호 분석 요약</h2>
            <p className="text-sm text-[#9a9a9a] leading-relaxed">
              총 {signals.length}건의 신호 · 긴급 {criticalCount}건 · 높음 {highCount}건
            </p>
            <Button variant="outline" size="sm" disabled className="w-full opacity-50">
              상세 보고서 (곧 출시)
            </Button>
          </div>

          <div className="bg-[#141414] rounded-md border border-[#2a2a2a] p-6">
            <h2 className="mb-3 text-sm font-semibold text-[#ffffff]">필터 결과</h2>
            <Badge tone="neutral">현재 {filteredSignals.length}건</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
