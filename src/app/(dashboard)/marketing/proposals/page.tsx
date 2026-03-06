"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMarketingProposals, useApproveProposal, useRejectProposal } from "@/lib/api/hooks/marketing";
import { ProposalCard } from "@/components/modules/marketing/proposal-card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const FILTER_TABS = [
  { id: "all", label: "전체" },
  { id: "pending", label: "대기중" },
  { id: "approved", label: "승인됨" },
  { id: "rejected", label: "거부됨" },
];

export default function ProposalsPage() {
  const [filter, setFilter] = useState("all");
  const [rejectModal, setRejectModal] = useState<{ open: boolean; proposalId: string | null; reason: string }>({
    open: false,
    proposalId: null,
    reason: "",
  });

  const { data: proposals, isLoading } = useMarketingProposals();
  const approveProposal = useApproveProposal();
  const rejectProposal = useRejectProposal();

  const filtered = (proposals ?? []).filter((p) => filter === "all" || p.status === filter);

  function handleApprove(id: string) {
    approveProposal.mutate(id, {
      onSuccess: () => toast.success("제안이 승인되었습니다."),
      onError: () => toast.error("승인 처리 중 오류가 발생했습니다."),
    });
  }

  function handleReject(id: string) {
    setRejectModal({ open: true, proposalId: id, reason: "" });
  }

  function handleRejectConfirm() {
    if (!rejectModal.proposalId) return;
    rejectProposal.mutate(
      { id: rejectModal.proposalId, reason: rejectModal.reason || "관리자 거부" },
      {
        onSuccess: () => {
          toast.success("제안이 거부되었습니다.");
          setRejectModal({ open: false, proposalId: null, reason: "" });
        },
        onError: () => toast.error("거부 처리 중 오류가 발생했습니다."),
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#ffffff] tracking-tight">작업 제안</h1>
          <p className="text-[#9a9a9a] mt-1">AI가 생성한 마케팅 액션 제안을 검토하세요.</p>
        </div>
        <div className="flex bg-[#141414] rounded-md border border-[#2a2a2a] p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === tab.id ? "bg-[#1a1a1a] text-[#ffffff]" : "text-[#9a9a9a] hover:bg-[#141414]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-[#141414] rounded-md border border-[#2a2a2a] p-6 h-64">
              <div className="h-4 bg-[#1a1a1a] rounded w-1/4 mb-4" />
              <div className="h-6 bg-[#1a1a1a] rounded w-3/4 mb-4" />
              <div className="h-24 bg-[#1a1a1a] rounded mb-4" />
              <div className="h-10 bg-[#1a1a1a] rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#141414] rounded-md border border-[#2a2a2a] p-12 text-center">
          <p className="text-[#9a9a9a] text-lg">해당 조건의 제안이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}

      <Modal
        open={rejectModal.open}
        onClose={() => setRejectModal({ open: false, proposalId: null, reason: "" })}
        title="거부 사유 입력"
      >
        <div className="space-y-4">
          <Input
            placeholder="거부 사유를 입력하세요 (선택)"
            value={rejectModal.reason}
            onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRejectModal({ open: false, proposalId: null, reason: "" })}
            >
              취소
            </Button>
            <Button variant="danger" size="sm" onClick={handleRejectConfirm}>
              거부 확인
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
