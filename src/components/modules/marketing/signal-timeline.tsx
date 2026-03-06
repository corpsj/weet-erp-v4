import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Radio } from 'lucide-react';
import type { MarketSignal } from '@/types/marketing';

export interface Signal extends Omit<MarketSignal, 'title' | 'summary'> {
  title: string;
  summary: string;
}

interface SignalTimelineProps {
  signals: Signal[];
}

const urgencyTone: Record<string, 'neutral' | 'brand' | 'warning' | 'danger'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'neutral',
  low: 'neutral',
};

export function SignalTimeline({ signals }: SignalTimelineProps) {
  if (signals.length === 0) {
    return (
      <Card className="p-8 text-center text-[#9a9a9a]">
        최근 시장 신호가 없습니다.
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-lg font-bold text-[#ffffff] mb-6 flex items-center gap-2">
        <Radio className="h-5 w-5 text-[#9a9a9a]" />
        시장 신호 타임라인
      </h2>
      
      <div className="relative border-l-2 border-[#2a2a2a] ml-3 pl-6 space-y-8">
        {signals.map((signal) => {
          const tone = urgencyTone[signal.urgency] || 'neutral';
          const date = new Date(signal.collectedAt);
          
          return (
            <div key={signal.id} className="relative">
              <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-[#0a0a0a] bg-[#2a2a2a] z-10" />
              
              <div className="mb-1 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Badge tone={tone}>{signal.urgency.toUpperCase()}</Badge>
                  <span className="text-sm font-medium text-[#9a9a9a]">{signal.source}</span>
                </div>
                <time className="text-xs text-[#9a9a9a] font-mono">
                  {date.toLocaleDateString('ko-KR')} {date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
              
              <h3 className="text-base font-bold text-[#ffffff] mb-2">{signal.title}</h3>
              
              <div className="bg-[#0a0a0a] rounded-lg p-3 text-sm text-[#9a9a9a] border border-[#2a2a2a] font-mono">
                {signal.summary}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
