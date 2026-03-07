"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ModuleShell } from "@/components/layout/module-shell";
import {
  useSystemStatus,
  useOpenClawStatus,
  useCompetitors,
  useAddCompetitor,
  useUpdateCompetitor,
  useDeleteCompetitor,
  useLeadCollectionStatus,
  useTriggerLeadCollection,
} from "@/lib/api/hooks/marketing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils/format";
import type { Competitor } from "@/types/marketing";
import { Bot, Check, Pencil, Play, Plus, Trash2, X, Zap } from "lucide-react";

export default function SystemPage() {
  return (
    <ModuleShell
      title="운영 현황"
      description="자동화 서비스 상태를 확인하고 제어합니다."
      breadcrumb={[{ label: "마케팅", href: "/marketing" }, { label: "운영 현황" }]}
    >
      <SystemContent />
    </ModuleShell>
  );
}

function SystemContent() {
  const { data: status, isLoading, isError, refetch } = useSystemStatus();
  const { data: openclawStatus, isLoading: isOpenClawLoading } = useOpenClawStatus();

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse bg-[#141414] rounded-md border border-[#2a2a2a] p-6 h-40" />
          ))}
        </div>
      ) : isError ? (
        <Card className="mt-4 p-6">
          <p className="text-sm text-[var(--color-danger)]">운영 현황 데이터를 불러오지 못했습니다.</p>
          <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
            다시 시도
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
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
              <h3 className="font-medium text-[#9a9a9a]">LMStudio</h3>
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

          <Card className="flex h-48 flex-col justify-between">
            <div className="flex justify-between items-start">
              <h3 className="font-medium text-[#9a9a9a]">OpenClaw Agent</h3>
              {isOpenClawLoading ? (
                <div className="h-5 w-16 animate-pulse bg-[#1a1a1a] rounded-full" />
              ) : (
                <Badge tone={openclawStatus?.status === "online" ? "brand" : "danger"}>
                  {openclawStatus?.status === "online" ? "ONLINE" : "OFFLINE"}
                </Badge>
              )}
            </div>
            <div>
              <p className="text-2xl font-bold text-[#ffffff]">
                <Bot className="inline-block h-6 w-6 mr-1 -mt-1" />
                마케팅 자동화
              </p>
              <p className="text-sm text-[#9a9a9a] mt-1">
                에이전트 {openclawStatus?.agents?.length ?? 0}개 · 스킬 {openclawStatus?.skillsCount ?? 0}개
              </p>
            </div>
            <p className="text-xs text-[#9a9a9a]">
              {openclawStatus?.lastChecked
                ? `마지막 확인: ${formatDate(openclawStatus.lastChecked)}`
                : "상태 확인 중..."}
            </p>
          </Card>
        </div>
      )}

      <div className="bg-[#141414] rounded-md border border-[#2a2a2a] overflow-hidden">
        <div className="p-6 border-b border-[#2a2a2a]">
          <h2 className="text-lg font-bold text-[#ffffff]">수동 제어</h2>
          <p className="text-sm text-[#9a9a9a] mt-1">스케줄러와 관계없이 작업을 강제로 실행합니다.</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <LeadCollectionTrigger />
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

      <CompetitorSection />
    </div>
  );
}

function LeadCollectionTrigger() {
  const { data: status } = useLeadCollectionStatus();
  const trigger = useTriggerLeadCollection();

  const isRequested = status?.requested ?? false;
  const requestedAt = status?.requested_at;

  function handleTrigger() {
    trigger.mutate(undefined, {
      onSuccess: () => toast.success("잠재고객 수집이 예약되었습니다. 다음 스케줄러 실행 시 수집됩니다."),
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <Button
      variant="outline"
      onClick={handleTrigger}
      disabled={trigger.isPending || isRequested}
      className={`h-auto justify-between rounded-md border border-[#2a2a2a] bg-[#141414] p-4 text-left ${
        isRequested ? "opacity-50" : ""
      }`}
    >
      <div>
        <h3 className="font-bold text-[#ffffff]">
          {trigger.isPending
            ? "요청 중..."
            : isRequested
              ? "수집 대기 중"
              : "잠재고객 수집 시작"}
        </h3>
        <p className="text-sm text-[#9a9a9a] mt-1">
          {isRequested && requestedAt
            ? `요청 시각: ${formatDate(requestedAt)}`
            : "등록된 경쟁업체에서 잠재고객을 즉시 수집합니다."}
        </p>
      </div>
      <Play className="h-5 w-5 text-[#9a9a9a]" />
    </Button>
  );
}

function CompetitorSection() {
  const { data: competitors, isLoading, isError, refetch } = useCompetitors();
  const addCompetitor = useAddCompetitor();
  const updateCompetitor = useUpdateCompetitor();
  const deleteCompetitor = useDeleteCompetitor();

  const [showAddForm, setShowAddForm] = useState(false);
  const [addUsername, setAddUsername] = useState("");
  const [addDisplayName, setAddDisplayName] = useState("");
  const [addNotes, setAddNotes] = useState("");

  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [confirmDeleteUsername, setConfirmDeleteUsername] = useState<string | null>(null);

  function handleAdd() {
    if (!addUsername.trim()) return;
    addCompetitor.mutate(
      { username: addUsername.trim(), displayName: addDisplayName.trim(), notes: addNotes.trim() },
      {
        onSuccess: () => {
          toast.success(`@${addUsername.trim()} 등록 완료`);
          setAddUsername("");
          setAddDisplayName("");
          setAddNotes("");
          setShowAddForm(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function startEdit(c: Competitor) {
    setEditingUsername(c.username);
    setEditDisplayName(c.displayName);
    setEditNotes(c.notes);
  }

  function handleSaveEdit(username: string) {
    updateCompetitor.mutate(
      { username, displayName: editDisplayName.trim(), notes: editNotes.trim() },
      {
        onSuccess: () => {
          toast.success("수정 완료");
          setEditingUsername(null);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function handleToggleActive(c: Competitor) {
    updateCompetitor.mutate(
      { username: c.username, isActive: !c.isActive },
      {
        onSuccess: () => toast.success(c.isActive ? "비활성화됨" : "활성화됨"),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function handleDelete(username: string) {
    if (confirmDeleteUsername !== username) {
      setConfirmDeleteUsername(username);
      return;
    }
    deleteCompetitor.mutate(username, {
      onSuccess: () => {
        toast.success(`@${username} 삭제 완료`);
        setConfirmDeleteUsername(null);
      },
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div className="bg-[#141414] rounded-md border border-[#2a2a2a] overflow-hidden">
      <div className="p-6 border-b border-[#2a2a2a] flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#ffffff]">경쟁업체 관리</h2>
          <p className="text-sm text-[#9a9a9a] mt-1">
            인스타그램 경쟁업체 계정을 관리합니다. 등록된 계정에서 잠재고객을 수집합니다.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus className="mr-1 h-4 w-4" /> 추가
        </Button>
      </div>

      {showAddForm && (
        <div className="p-6 border-b border-[#2a2a2a] bg-[#0a0a0a]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
              placeholder="인스타그램 아이디 (필수)"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Input
              value={addDisplayName}
              onChange={(e) => setAddDisplayName(e.target.value)}
              placeholder="표시 이름 (선택)"
            />
            <Input
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              placeholder="메모 (선택)"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!addUsername.trim() || addCompetitor.isPending}
            >
              {addCompetitor.isPending ? "등록 중..." : "등록"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setAddUsername("");
                setAddDisplayName("");
                setAddNotes("");
              }}
            >
              취소
            </Button>
          </div>
        </div>
      )}

      <div className="p-6">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded bg-[#1a1a1a]" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--color-danger)]">경쟁업체 목록을 불러오지 못했습니다.</p>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => void refetch()}>
              다시 시도
            </Button>
          </div>
        ) : !competitors || competitors.length === 0 ? (
          <div className="text-center py-8 rounded-md border border-[#2a2a2a] bg-[#0a0a0a]">
            <p className="text-sm text-[#9a9a9a]">등록된 경쟁업체가 없습니다.</p>
            <p className="text-xs text-[#9a9a9a] mt-1">위 &quot;추가&quot; 버튼으로 경쟁업체를 등록하세요.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {competitors.map((c) => (
              <div
                key={c.username}
                className="flex items-center gap-4 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-4 py-3"
              >
                {editingUsername === c.username ? (
                  <>
                    <span className="text-sm font-medium text-[#ffffff] w-40 shrink-0">@{c.username}</span>
                    <Input
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      placeholder="표시 이름"
                      className="h-8 text-sm flex-1"
                    />
                    <Input
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="메모"
                      className="h-8 text-sm flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(c.username)}
                      disabled={updateCompetitor.isPending}
                      className="rounded p-1.5 text-green-400 hover:bg-[#1a1a1a] transition-colors"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingUsername(null)}
                      className="rounded p-1.5 text-[#9a9a9a] hover:bg-[#1a1a1a] transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(c)}
                      className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                        c.isActive ? "bg-green-500" : "bg-[#9a9a9a]"
                      }`}
                      title={c.isActive ? "활성 (클릭하여 비활성화)" : "비활성 (클릭하여 활성화)"}
                    />
                    <span className="text-sm font-medium text-[#ffffff] w-40 shrink-0">
                      @{c.username}
                    </span>
                    <span className="text-sm text-[#d4d4d4] flex-1 truncate">
                      {c.displayName || ""}
                    </span>
                    <span className="text-xs text-[#9a9a9a] flex-1 truncate">
                      {c.notes || ""}
                    </span>
                    <span className="text-xs text-[#9a9a9a] shrink-0 hidden lg:block">
                      {formatDate(c.addedAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="rounded p-1.5 text-[#9a9a9a] hover:bg-[#1a1a1a] hover:text-[#ffffff] transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.username)}
                      className={`rounded p-1.5 transition-colors ${
                        confirmDeleteUsername === c.username
                          ? "bg-red-500/20 text-red-400"
                          : "text-[#9a9a9a] hover:bg-[#1a1a1a] hover:text-red-400"
                      }`}
                      title={confirmDeleteUsername === c.username ? "한번 더 클릭하면 삭제됩니다" : "삭제"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
