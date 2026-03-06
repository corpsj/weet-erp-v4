"use client";

import React from 'react';
import { Table, THead, TBody, TH, TD, TR, TableEmpty } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { MarketingLead } from '@/types/marketing';

export type Lead = Pick<MarketingLead, 'id' | 'username' | 'platform' | 'score' | 'personaType' | 'journeyStage'>;

interface LeadTableProps {
  leads: Lead[];
}

const stages = ['awareness', 'interest', 'explore', 'compare', 'hesitate', 'decide', 'contract'];

function scoreTone(score: number): 'brand' | 'warning' | 'neutral' {
  if (score >= 8) return 'brand';
  if (score >= 5) return 'warning';
  return 'neutral';
}

export function LeadTable({ leads }: LeadTableProps) {
  return (
    <Table>
      <THead>
        <tr>
          <TH>사용자</TH>
          <TH>플랫폼</TH>
          <TH>점수</TH>
          <TH>페르소나</TH>
          <TH>여정 단계</TH>
        </tr>
      </THead>
      <TBody>
        {leads.length === 0 ? (
          <TableEmpty colSpan={5} />
        ) : (
          leads.map((lead) => {
            const stageIndex = stages.indexOf(lead.journeyStage);
            const progressPercentage = stageIndex === -1 ? 0 : ((stageIndex + 1) / stages.length) * 100;
            return (
              <TR key={lead.id}>
                <TD className="font-medium text-[#ffffff]">{lead.username}</TD>
                <TD className="text-[#9a9a9a]">{lead.platform}</TD>
                <TD>
                  <Badge tone={scoreTone(lead.score)}>{lead.score}점</Badge>
                </TD>
                <TD>
                  <Badge tone="neutral">{lead.personaType || '알 수 없음'}</Badge>
                </TD>
                <TD className="w-48">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#e5e5e5] rounded-full transition-all"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#9a9a9a] w-16 truncate" title={lead.journeyStage}>
                      {lead.journeyStage}
                    </span>
                  </div>
                </TD>
              </TR>
            );
          })
        )}
      </TBody>
    </Table>
  );
}
