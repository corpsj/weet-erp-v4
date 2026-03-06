"use client";

import { toast } from "sonner";
import { useSystemStatus } from "@/lib/api/hooks/marketing";
import { Badge } from "@/components/ui/badge";
import { Play, Zap } from "lucide-react";

export default function SystemPage() {
  const { data: status, isLoading } = useSystemStatus();

  const schedulerRunning = status?.scheduler.running ?? false;
  const ollamaConnected = status?.ollama.connected ?? false;
  const naverUsed = status?.naverQuota.used ?? 0;
  const naverLimit = status?.naverQuota.limit ?? 25000;
  const naverPct = naverLimit > 0 ? (naverUsed / naverLimit) * 100 : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#ffffff] tracking-tight">시스템 상태</h1>
        <p className="text-[#9a9a9a] mt-1">서버 및 API 연결 상태를 확인하고 제어합니다.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-[#141414] rounded-md border border-[#2a2a2a] p-6 h-40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Scheduler */}
          <div className="bg-[#141414] rounded-md border border-[#2a2a2a] p-6 flex flex-col justify-between h-40">
            <div className="flex justify-between items-start">
              <h3 className="font-medium text-[#9a9a9a]">스케줄러</h3>
              <span className={`w-3 h-3 rounded-full ${schedulerRunning ? "bg-green-500" : "bg-red-500"}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#ffffff]">
                {schedulerRunning ? "실행 중" : "중지됨"}
              </p>
              <p className="text-sm text-[#9a9a9a] mt-1">백그라운드 수집 작업</p>
            </div>
          </div>

          {/* Ollama */}
          <div className="bg-[#141414] rounded-md border border-[#2a2a2a] p-6 flex flex-col justify-between h-40">
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
          </div>

          {/* Naver Quota */}
          <div className="bg-[#141414] rounded-md border border-[#2a2a2a] p-6 flex flex-col justify-between h-40">
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
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#141414] rounded-md border border-[#2a2a2a] overflow-hidden">
        <div className="p-6 border-b border-[#2a2a2a]">
          <h2 className="text-lg font-bold text-[#ffffff]">수동 제어</h2>
          <p className="text-sm text-[#9a9a9a] mt-1">스케줄러와 관계없이 작업을 강제로 실행합니다.</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            className="flex items-center justify-between bg-[#141414] border border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#1a1a1a] rounded-md p-4 text-left transition-colors group"
            onClick={() => toast.info("이 기능은 준비 중입니다.")}
          >
            <div>
              <h3 className="font-bold text-[#ffffff]">Market Radar 실행</h3>
              <p className="text-sm text-[#9a9a9a] mt-1">신규 신호 및 리드 수집을 즉시 시작합니다.</p>
            </div>
            <Play className="w-5 h-5 text-[#9a9a9a] group-hover:text-[#ffffff] transition-colors" />
          </button>
          <button
            type="button"
            className="flex items-center justify-between bg-[#141414] border border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#1a1a1a] rounded-md p-4 text-left transition-colors group"
            onClick={() => toast.info("이 기능은 준비 중입니다.")}
          >
            <div>
              <h3 className="font-bold text-[#ffffff]">제안 수동 생성</h3>
              <p className="text-sm text-[#9a9a9a] mt-1">수집된 데이터를 바탕으로 AI 제안을 강제 생성합니다.</p>
            </div>
            <Zap className="w-5 h-5 text-[#9a9a9a] group-hover:text-[#ffffff] transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
