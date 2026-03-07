"use client";

import { ModuleShell } from "@/components/layout/module-shell";
import { useSystemStatus } from "@/lib/api/hooks/marketing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/format";
import { Play, Zap } from "lucide-react";

export default function SystemPage() {
  return (
    <ModuleShell
      title="시스템 상태"
      description="서버 및 API 연결 상태를 확인하고 제어합니다."
      breadcrumb={[{ label: "마케팅", href: "/marketing" }, { label: "시스템" }]}
    >
      <SystemContent />
    </ModuleShell>
  );
}

function SystemContent() {
  const { data: status, isLoading, isError, refetch } = useSystemStatus();

  const schedulerRunning = status?.scheduler.running ?? false;
  const ollamaConnected = status?.ollama.connected ?? false;
  const naverUsed = status?.naverQuota.used ?? 0;
  const naverLimit = status?.naverQuota.limit ?? 25000;
  const naverPct = naverLimit > 0 ? (naverUsed / naverLimit) * 100 : 0;
  const schedulerLastRun = status?.scheduler.lastRun
    ? formatDate(status.scheduler.lastRun)
    : "데이터 없음";
  const schedulerNextRun = status?.scheduler.nextRun
    ? formatDate(status.scheduler.nextRun)
    : "데이터 없음";
  const naverResetAt = status?.naverQuota.resetAt
    ? formatDate(status.naverQuota.resetAt)
    : "데이터 없음";

  return (
    <div className="space-y-8">
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-[#141414] rounded-md border border-[#2a2a2a] p-6 h-40" />
          ))}
        </div>
      ) : isError ? (
        <Card className="mt-4 p-6">
          <p className="text-sm text-[var(--color-danger)]">시스템 상태 데이터를 불러오지 못했습니다.</p>
          <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
            다시 시도
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="flex h-48 flex-col justify-between">
            <div className="flex justify-between items-start">
              <h3 className="font-medium text-[#9a9a9a]">스케줄러</h3>
              <span className={`w-3 h-3 rounded-full ${schedulerRunning ? "bg-green-500" : "bg-red-500"}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#ffffff]">
                {schedulerRunning ? "실행 중" : "중지됨"}
              </p>
              <p className="text-sm text-[#9a9a9a] mt-1">백그라운드 수집 작업</p>
              <p className="text-xs text-[#9a9a9a] mt-2">마지막 실행: {schedulerLastRun}</p>
              <p className="text-xs text-[#9a9a9a]">다음 실행: {schedulerNextRun}</p>
            </div>
            <p className="text-xs text-[#9a9a9a]">Python 스케줄러 연결 시 실시간 표시</p>
          </Card>

          <Card className="flex h-48 flex-col justify-between">
            <div className="flex justify-between items-start">
              <h3 className="font-medium text-[#9a9a9a]">Ollama API</h3>
              <Badge tone={ollamaConnected ? "brand" : "danger"}>
                {ollamaConnected ? "ONLINE" : "OFFLINE"}
              </Badge>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#ffffff]">로컬 AI 연결</p>
              <p className="text-sm text-[#9a9a9a] mt-1">{status?.ollama.model ?? "llama3.2"}</p>
            </div>
            <p className="text-xs text-[#9a9a9a]">Python 스케줄러 연결 시 실시간 표시</p>
          </Card>

          <Card className="flex h-48 flex-col justify-between">
            <div className="flex justify-between items-start">
              <h3 className="font-medium text-[#9a9a9a]">Naver API</h3>
              <span className="text-xs text-[#9a9a9a]">{naverUsed}/{naverLimit}</span>
            </div>
            <div>
              <div className="w-full bg-[#1a1a1a] rounded-full h-2.5 mb-2">
                <div
                  className="bg-[#e5e5e5] h-2.5 rounded-full"
                  style={{ width: `${Math.min(naverPct, 100)}%` }}
                />
              </div>
              <p className="text-sm text-[#9a9a9a]">일일 할당량 사용률</p>
              <p className="text-xs text-[#9a9a9a] mt-2">리셋 예정: {naverResetAt}</p>
            </div>
            <p className="text-xs text-[#9a9a9a]">Python 스케줄러 연결 시 실시간 표시</p>
          </Card>
        </div>
      )}

      <div className="bg-[#141414] rounded-md border border-[#2a2a2a] overflow-hidden">
        <div className="p-6 border-b border-[#2a2a2a]">
          <h2 className="text-lg font-bold text-[#ffffff]">수동 제어</h2>
          <p className="text-sm text-[#9a9a9a] mt-1">스케줄러와 관계없이 작업을 강제로 실행합니다.</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            variant="outline"
            disabled
            className="h-auto justify-between rounded-md border border-[#2a2a2a] bg-[#141414] p-4 text-left opacity-50"
          >
            <div>
              <h3 className="font-bold text-[#ffffff]">Market Radar 실행 (곧 출시)</h3>
              <p className="text-sm text-[#9a9a9a] mt-1">신규 신호 및 리드 수집을 즉시 시작합니다.</p>
            </div>
            <Play className="h-5 w-5 text-[#9a9a9a]" />
          </Button>
          <Button
            variant="outline"
            disabled
            className="h-auto justify-between rounded-md border border-[#2a2a2a] bg-[#141414] p-4 text-left opacity-50"
          >
            <div>
              <h3 className="font-bold text-[#ffffff]">제안 수동 생성 (곧 출시)</h3>
              <p className="text-sm text-[#9a9a9a] mt-1">수집된 데이터를 바탕으로 AI 제안을 강제 생성합니다.</p>
            </div>
            <Zap className="h-5 w-5 text-[#9a9a9a]" />
          </Button>
        </div>
      </div>
    </div>
  );
}
