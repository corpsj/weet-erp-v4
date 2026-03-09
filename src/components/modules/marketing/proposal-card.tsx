"use client";

import React from 'react';
import { Check, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PROPOSAL_STATUS_LABELS, type MarketingProposal } from '@/types/marketing';

export interface Proposal extends MarketingProposal {
  urgency?: string;
}

interface ProposalCardProps {
  proposal: Proposal;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onClick?: (proposal: Proposal) => void;
}

function statusTone(status: string): 'brand' | 'warning' | 'danger' | 'neutral' {
  if (status === 'approved') return 'brand';
  if (status === 'pending') return 'warning';
  if (status === 'rejected') return 'danger';
  return 'neutral';
}

function urgencyTone(urgency: string): 'danger' | 'warning' | 'neutral' {
  if (urgency === 'critical') return 'danger';
  if (urgency === 'high') return 'warning';
  return 'neutral';
}

function ProposalCardBody({ proposal, showHint }: { proposal: Proposal; showHint?: boolean }) {
  return (
    <>
      <div className="flex items-start justify-between mb-3">
        <div className="flex gap-2 flex-wrap">
          <Badge tone="neutral">{proposal.actionType || '알 수 없음'}</Badge>
          <Badge tone={statusTone(proposal.status)}>
            {PROPOSAL_STATUS_LABELS[proposal.status] ?? proposal.status}
          </Badge>
        </div>
        {proposal.urgency && (
          <Badge tone={urgencyTone(proposal.urgency)}>{proposal.urgency.toUpperCase()}</Badge>
        )}
      </div>

      <h3 className="text-base font-bold text-[#ffffff] mb-2 leading-tight">
        {proposal.title}
      </h3>

      <div className="mt-4 bg-[#0a0a0a] rounded-md p-3 border border-[#2a2a2a]">
        <p className="text-sm text-[#9a9a9a] line-clamp-4 whitespace-pre-wrap font-mono">
          {proposal.contentDraft || '내용이 없습니다.'}
        </p>
      </div>
      {showHint && proposal.contentDraft && (
        <p className="mt-2 text-xs text-[#666666]">클릭하여 전체 내용 보기</p>
      )}
    </>
  );
}

export function ProposalCard({ proposal, onApprove, onReject, onClick }: ProposalCardProps) {
  const isPending = proposal.status === 'pending';

  return (
    <Card className={`flex flex-col h-full p-0 overflow-hidden${onClick ? ' cursor-pointer transition-colors hover:border-[#3a3a3a]' : ''}`}>
      {onClick ? (
        <button
          type="button"
          className="p-5 flex-1 text-left w-full"
          onClick={() => onClick(proposal)}
        >
          <ProposalCardBody proposal={proposal} showHint />
        </button>
      ) : (
        <div className="p-5 flex-1">
          <ProposalCardBody proposal={proposal} />
        </div>
      )}

      {isPending && (
        <div className="p-4 border-t border-[#2a2a2a] flex gap-2">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={() => onApprove(proposal.id)}
          >
            <Check className="h-4 w-4 mr-1" /> 승인
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onReject(proposal.id)}
          >
            <X className="h-4 w-4 mr-1" /> 거부
          </Button>
        </div>
      )}
    </Card>
  );
}
