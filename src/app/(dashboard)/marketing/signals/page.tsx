"use client";

import { toast } from "sonner";
import { useMarketingSignals } from "@/lib/api/hooks";
import { SignalTimeline, type Signal } from "@/components/modules/marketing/signal-timeline";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, TrendingUp, Flame } from "lucide-react";

const TREND_KEYWORDS = ["AI 마케팅", "초개인화", "로컬 비즈니스", "자동화", "당근마켓 광고", "인스타그램 릴스", "B2B 영업"];

export default function SignalsPage() {
  const { data, isLoading } = useMarketingSignals();

  const signals = (data ?? []).filter(
    (s): s is Signal => s.title !== null && s.summary !== null,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#ffffff] tracking-tight">시장 신호</h1>
          <p className="text-[#9a9a9a] mt-1">Market Radar가 감지한 업계 동향과 신호입니다.</p>
        </div>
        <button
          type="button"
          className="px-4 py-2 bg-[#141414] border border-[#2a2a2a] text-[#d4d4d4] font-medium rounded-lg text-sm hover:bg-[#1a1a1a] flex items-center gap-2 transition-colors"
          onClick={() => toast.info("이 기능은 준비 중입니다.")}
        >
          <RefreshCw className="w-4 h-4" /> 수동 수집
        </button>
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
            <SignalTimeline signals={signals} />
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-[#141414] rounded-md border border-[#2a2a2a] p-6">
            <h2 className="text-lg font-bold text-[#ffffff] mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#9a9a9a]" /> 트렌드 키워드
            </h2>
            <div className="flex flex-wrap gap-2">
              {TREND_KEYWORDS.map((keyword, i) => (
                <Badge
                  key={keyword}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-[#d4d4d4]"
                >
                  {i < 3 && <Flame className="w-3.5 h-3.5" />}
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>

          <div className="bg-[#141414] rounded-md border border-[#2a2a2a] p-6">
            <h2 className="text-lg font-bold text-[#ffffff] mb-2">신호 분석 요약</h2>
            <p className="text-[#9a9a9a] text-sm mb-4 leading-relaxed">
              최근 24시간 동안 &apos;AI 마케팅&apos; 관련 신호가 급증하고 있습니다. 특히 B2B SaaS 기업들의 자동화 솔루션 도입 문의가 늘고 있는 추세입니다.
            </p>
            <button
              type="button"
              className="w-full py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#d4d4d4] rounded-lg text-sm font-medium transition-colors border border-[#2a2a2a]"
              onClick={() => toast.info("이 기능은 준비 중입니다.")}
            >
              상세 보고서 생성
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
