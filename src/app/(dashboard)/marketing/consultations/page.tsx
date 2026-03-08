"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ModuleShell } from "@/components/layout/module-shell";
import {
  useMarketingConsultations,
  useUpdateConsultationStatus,
} from "@/lib/api/hooks/marketing";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CONSULTATION_STATUS_LABELS,
  CONSULTATION_CHANNEL_LABELS,
} from "@/types/marketing";
import type { MarketingConsultation } from "@/types/marketing";
import { cn } from "@/lib/utils/cn";

const FILTER_TABS = [
  { id: "all", label: "전체" },
  ...Object.entries(CONSULTATION_STATUS_LABELS).map(([id, label]) => ({
    id,
    label,
  })),
];

const STATUS_BADGE_CLASSES: Record<string, string> = {
  requested: "bg-blue-500/20 text-blue-400",
  scheduled: "bg-yellow-500/20 text-yellow-400",
  completed: "bg-green-500/20 text-green-400",
  contracted: "bg-emerald-500/20 text-emerald-400",
  lost: "bg-red-500/20 text-red-400",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function ConsultationsPage() {
  return (
    <ModuleShell
      title="상담 관리"
      description="상담 요청을 확인하고 상태를 관리하세요."
      breadcrumb={[
        { label: "마케팅", href: "/marketing" },
        { label: "상담 관리" },
      ]}
    >
      <ConsultationsContent />
    </ModuleShell>
  );
}

function ConsultationsContent() {
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const status = filter === "all" ? undefined : filter;
  const {
    data: consultations,
    isLoading,
    isError,
    refetch,
  } = useMarketingConsultations(status);
  const updateStatus = useUpdateConsultationStatus();

  const items = consultations ?? [];

  function handleEdit(consultation: MarketingConsultation) {
    setEditingId(consultation.id);
    setEditStatus(consultation.status);
    setEditNotes(consultation.notes ?? "");
  }

  function handleCancel() {
    setEditingId(null);
    setEditStatus("");
    setEditNotes("");
  }

  function handleSave() {
    if (!editingId) return;
    updateStatus.mutate(
      { id: editingId, status: editStatus, notes: editNotes || undefined },
      {
        onSuccess: () => {
          toast.success("상담 상태가 업데이트되었습니다.");
          handleCancel();
        },
        onError: () => {
          toast.error("상태 업데이트 중 오류가 발생했습니다.");
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex bg-[#141414] rounded-md border border-[#2a2a2a] p-1 w-fit max-w-full overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
              filter === tab.id
                ? "bg-[#1a1a1a] text-[#ffffff]"
                : "text-[#9a9a9a] hover:bg-[#141414]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="animate-pulse bg-[#141414] rounded-md border border-[#2a2a2a] p-4 h-20"
            >
              <div className="h-4 bg-[#1a1a1a] rounded w-1/3 mb-2" />
              <div className="h-3 bg-[#1a1a1a] rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <Card className="mt-4 p-6">
          <p className="text-sm text-[var(--color-danger)]">
            상담 데이터를 불러오지 못했습니다.
          </p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void refetch()}
          >
            다시 시도
          </Button>
        </Card>
      ) : items.length === 0 ? (
        <div className="bg-[#141414] rounded-md border border-[#2a2a2a] p-12 text-center">
          <p className="text-[#9a9a9a] text-lg">상담 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <div
              key={c.id}
              className="bg-[#141414] rounded-lg border border-[#2a2a2a] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#1a1a1a] text-[#9a9a9a] border border-[#2a2a2a] shrink-0">
                    {CONSULTATION_CHANNEL_LABELS[c.requestChannel] ??
                      c.requestChannel}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded shrink-0",
                      STATUS_BADGE_CLASSES[c.status] ??
                        "bg-[#1a1a1a] text-[#9a9a9a]",
                    )}
                  >
                    {CONSULTATION_STATUS_LABELS[c.status] ?? c.status}
                  </span>
                  <span className="text-xs text-[#777777] shrink-0">
                    {formatDate(c.requestedAt)}
                  </span>
                  {c.scheduledAt && (
                    <span className="text-xs text-[#777777] shrink-0">
                      예약: {formatDate(c.scheduledAt)}
                    </span>
                  )}
                  {c.notes && (
                    <span className="text-xs text-[#9a9a9a] truncate">
                      {c.notes}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    editingId === c.id ? handleCancel() : handleEdit(c)
                  }
                  className="text-xs text-[#9a9a9a] hover:text-[#ffffff] transition-colors shrink-0"
                >
                  {editingId === c.id ? "닫기" : "수정"}
                </button>
              </div>

              {editingId === c.id && (
                <div className="mt-3 pt-3 border-t border-[#2a2a2a] space-y-3">
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor={`status-${c.id}`}
                      className="text-xs text-[#9a9a9a] shrink-0"
                    >
                      상태
                    </label>
                    <select
                      id={`status-${c.id}`}
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="flex-1 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-1.5 text-sm text-[#ffffff] outline-none focus:border-[#3a3a3a]"
                    >
                      {Object.entries(CONSULTATION_STATUS_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor={`notes-${c.id}`}
                      className="text-xs text-[#9a9a9a]"
                    >
                      메모
                    </label>
                    <textarea
                      id={`notes-${c.id}`}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={2}
                      className="flex w-full resize-none rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-sm text-[#ffffff] outline-none placeholder:text-[#9a9a9a] focus:border-[#3a3a3a] focus:ring-1 focus:ring-[#3a3a3a]"
                      placeholder="메모를 입력하세요"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSave}
                      isLoading={updateStatus.isPending}
                    >
                      저장
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
