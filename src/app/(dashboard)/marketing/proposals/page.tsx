"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ModuleShell } from "@/components/layout/module-shell";
import { useMarketingProposals, useApproveProposal, useRejectProposal } from "@/lib/api/hooks/marketing";
import { ProposalCard, type Proposal } from "@/components/modules/marketing/proposal-card";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROPOSAL_STATUS_LABELS } from "@/types/marketing";

const FILTER_TABS = [
  { id: "all", label: "전체" },
  ...Object.entries(PROPOSAL_STATUS_LABELS).map(([id, label]) => ({ id, label })),
];

export default function ProposalsPage() {
  return (
    <ModuleShell
      title="승인 대기"
      description="AI가 생성한 마케팅 액션을 검토하고 승인하세요."
      breadcrumb={[{ label: "마케팅", href: "/marketing" }, { label: "승인 대기" }]}
    >
      <ProposalsContent />
    </ModuleShell>
  );
}

function ProposalsContent() {
  const [filter, setFilter] = useState("all");
  const [pendingApproveId, setPendingApproveId] = useState<string | null>(null);
  const [pendingRejectId, setPendingRejectId] = useState<string | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; proposalId: string | null; reason: string }>({
    open: false,
    proposalId: null,
    reason: "",
  });

  const { data: proposals, isLoading, isError, refetch } = useMarketingProposals();
  const approveProposal = useApproveProposal();
  const rejectProposal = useRejectProposal();

  const filtered = (proposals ?? []).filter((p) => filter === "all" || p.status === filter);

  function handleApprove(id: string) {
    if (pendingApproveId) return;
    setPendingApproveId(id);
    approveProposal.mutate(id, {
      onSuccess: () => {
        toast.success("제안이 승인되었습니다.");
        setPendingApproveId(null);
      },
      onError: () => {
        toast.error("승인 처리 중 오류가 발생했습니다.");
        setPendingApproveId(null);
      },
    });
  }

  function handleReject(id: string) {
    setRejectModal({ open: true, proposalId: id, reason: "" });
  }

  function handleRejectConfirm() {
    if (!rejectModal.proposalId || pendingRejectId) return;
    setPendingRejectId(rejectModal.proposalId);
    rejectProposal.mutate(
      { id: rejectModal.proposalId, reason: rejectModal.reason || "관리자 거부" },
      {
        onSuccess: () => {
          toast.success("제안이 거부되었습니다.");
          setPendingRejectId(null);
          setRejectModal({ open: false, proposalId: null, reason: "" });
        },
        onError: () => {
          toast.error("거부 처리 중 오류가 발생했습니다.");
          setPendingRejectId(null);
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
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === tab.id ? "bg-[#1a1a1a] text-[#ffffff]" : "text-[#9a9a9a] hover:bg-[#141414]"
              }`}
            >
              {tab.label}
            </button>
          ))}
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
      ) : isError ? (
        <Card className="mt-4 p-6">
          <p className="text-sm text-[var(--color-danger)]">승인 대기 데이터를 불러오지 못했습니다.</p>
          <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
            다시 시도
          </Button>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="bg-[#141414] rounded-md border border-[#2a2a2a] p-12 text-center">
          <p className="text-[#9a9a9a] text-lg">해당 조건의 승인 대기 항목이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((proposal) => (
            <div key={proposal.id} className="space-y-2">
              <ProposalCard
                proposal={proposal}
                onApprove={handleApprove}
                onReject={handleReject}
                onClick={setSelectedProposal}
              />
              {(pendingApproveId === proposal.id || pendingRejectId === proposal.id) && (
                <p className="text-xs text-[#9a9a9a]">처리 중입니다...</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={selectedProposal !== null}
        onClose={() => setSelectedProposal(null)}
        title={selectedProposal?.title ?? "제안 상세"}
        size="lg"
      >
        {selectedProposal && (
          <div className="space-y-5">
            <div className="flex gap-2 flex-wrap">
              <Badge tone="neutral">{selectedProposal.actionType || '알 수 없음'}</Badge>
              <Badge tone={selectedProposal.status === 'approved' ? 'brand' : selectedProposal.status === 'pending' ? 'warning' : selectedProposal.status === 'rejected' ? 'danger' : 'neutral'}>
                {PROPOSAL_STATUS_LABELS[selectedProposal.status] ?? selectedProposal.status}
              </Badge>
            </div>

            <div className="bg-[#0a0a0a] rounded-md p-4 border border-[#2a2a2a]">
              <p className="text-sm text-[#cccccc] whitespace-pre-wrap leading-relaxed">
                {selectedProposal.contentDraft || '내용이 없습니다.'}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-[#666666]">
              <span>생성일: {new Date(selectedProposal.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              {selectedProposal.approvedAt && (
                <span>승인일: {new Date(selectedProposal.approvedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              )}
            </div>

            {selectedProposal.status === 'pending' && (
              <div className="flex gap-2 pt-2 border-t border-[#2a2a2a]">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    handleApprove(selectedProposal.id);
                    setSelectedProposal(null);
                  }}
                >
                  승인
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setSelectedProposal(null);
                    handleReject(selectedProposal.id);
                  }}
                >
                  거부
                </Button>
              </div>
            )}

            {selectedProposal.rejectionReason && (
              <div className="bg-[#1a0a0a] rounded-md p-3 border border-[#3a1a1a]">
                <p className="text-xs text-[#ff6666]">거부 사유: {selectedProposal.rejectionReason}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={rejectModal.open}
        onClose={() => setRejectModal({ open: false, proposalId: null, reason: "" })}
        title="거부 사유 입력"
      >
        <div className="space-y-4">
          <textarea
            placeholder="거부 사유를 입력하세요 (선택)"
            value={rejectModal.reason}
            onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
            rows={3}
            className="flex w-full resize-none rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-sm text-[#ffffff] outline-none placeholder:text-[#9a9a9a] focus:border-[#3a3a3a] focus:ring-1 focus:ring-[#3a3a3a]"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              disabled={pendingRejectId !== null}
              onClick={() => setRejectModal({ open: false, proposalId: null, reason: "" })}
            >
              취소
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleRejectConfirm}
              isLoading={pendingRejectId !== null}
            >
              거부 확인
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
