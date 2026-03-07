"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useMarketingSignals,
  useTriggerSignalCollection,
  useSignalReport,
  type SignalReportData,
} from "@/lib/api/hooks/marketing";
import { ModuleShell } from "@/components/layout/module-shell";
import { SignalTimeline, type Signal } from "@/components/modules/marketing/signal-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { RefreshCw, TrendingUp, Flame, FileBarChart, Loader2 } from "lucide-react";

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
      title="시장 트렌드"
      description="Market Radar가 감지한 업계 동향과 트렌드입니다."
      breadcrumb={[{ label: "마케팅", href: "/marketing" }, { label: "트렌드" }]}
    >
      <SignalsContent />
    </ModuleShell>
  );
}

function SignalsContent() {
  const [urgencyFilter, setUrgencyFilter] = useState<string | undefined>(undefined);
  const [reportOpen, setReportOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useMarketingSignals();
  const signalCollect = useTriggerSignalCollection();
  const report = useSignalReport();

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
        <Button
          variant="outline"
          size="sm"
          disabled={signalCollect.isPending}
          onClick={() =>
            signalCollect.mutate(undefined, {
              onSuccess: () => toast.success("시그널 수집이 요청되었습니다."),
              onError: (err) => toast.error(err.message),
            })
          }
        >
          {signalCollect.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-4 w-4" />
          )}
          {signalCollect.isPending ? "수집 요청 중..." : "수동 수집"}
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
          ) : isError ? (
            <Card className="mt-4 p-6">
              <p className="text-sm text-[var(--color-danger)]">시장 트렌드 데이터를 불러오지 못했습니다.</p>
              <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
                다시 시도
              </Button>
            </Card>
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
            <h2 className="text-lg font-bold text-[#ffffff]">트렌드 분석 요약</h2>
            <p className="text-sm text-[#9a9a9a] leading-relaxed">
              총 {signals.length}건 · 긴급 {criticalCount}건 · 높음 {highCount}건
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={report.isFetching}
              onClick={() => {
                void report.refetch();
                setReportOpen(true);
              }}
            >
              {report.isFetching ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <FileBarChart className="mr-1 h-4 w-4" />
              )}
              상세 보고서
            </Button>
            <SignalReportModal
              open={reportOpen}
              onClose={() => setReportOpen(false)}
              data={report.data}
              isLoading={report.isFetching}
            />
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

const TYPE_LABELS: Record<string, string> = {
  demand: "수요",
  trend: "트렌드",
  policy: "정책",
  competitor: "경쟁사",
};

const SOURCE_LABELS_MAP: Record<string, string> = {
  naver_news: "네이버 뉴스",
  naver_blog: "네이버 블로그",
  naver_cafe: "네이버 카페",
  google_trends: "구글 트렌드",
  youtube: "유튜브",
};

const URGENCY_LABELS_MAP: Record<string, string> = {
  critical: "긴급",
  high: "높음",
  medium: "보통",
  low: "낮음",
};

function SignalReportModal({
  open,
  onClose,
  data,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  data: SignalReportData | undefined;
  isLoading: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="시그널 상세 보고서">
      {isLoading || !data ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#9a9a9a]" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] p-4">
            <p className="text-sm text-[#9a9a9a]">총 시그널 수</p>
            <p className="text-2xl font-bold text-[#ffffff]">{data.total}건</p>
          </div>

          <ReportSection title="유형별 분포" entries={data.by_type} labels={TYPE_LABELS} />
          <ReportSection title="출처별 분포" entries={data.by_source} labels={SOURCE_LABELS_MAP} />
          <ReportSection title="긴급도별 분포" entries={data.by_urgency} labels={URGENCY_LABELS_MAP} />

          {data.top_keywords.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#ffffff] mb-2">상위 키워드</h3>
              <div className="flex flex-wrap gap-2">
                {data.top_keywords.map((kw) => (
                  <Badge
                    key={kw.keyword}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-[#d4d4d4]"
                  >
                    {kw.keyword}
                    <span className="text-[#9a9a9a]">({kw.count})</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function ReportSection({
  title,
  entries,
  labels,
}: {
  title: string;
  entries: Record<string, number>;
  labels: Record<string, string>;
}) {
  const sorted = Object.entries(entries).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;
  const max = sorted[0][1];

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#ffffff] mb-2">{title}</h3>
      <div className="space-y-1.5">
        {sorted.map(([key, count]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-[#9a9a9a] text-right">
              {labels[key] ?? key}
            </span>
            <div className="flex-1 h-2 rounded-full bg-[#1a1a1a]">
              <div
                className="h-2 rounded-full bg-[#e5e5e5]"
                style={{ width: `${max > 0 ? (count / max) * 100 : 0}%` }}
              />
            </div>
            <span className="w-8 text-xs text-[#9a9a9a] text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
