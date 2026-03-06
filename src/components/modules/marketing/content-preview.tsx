import React from 'react';
import { BookOpen, Camera, Coffee, Video, Carrot, MessageCircle, FileText } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { MarketingContent } from '@/types/marketing';

export type Content = Pick<MarketingContent, 'id' | 'channel' | 'title' | 'body' | 'status' | 'createdAt'>;

interface ContentPreviewProps {
  content: Content;
}

function statusTone(status: string): 'neutral' | 'brand' | 'warning' | 'danger' {
  if (status === 'published') return 'brand';
  if (status === 'approved') return 'brand';
  return 'neutral';
}

const channelIcons: Record<string, LucideIcon> = {
  '블로그': BookOpen,
  '인스타그램': Camera,
  '카페': Coffee,
  '유튜브': Video,
  '당근': Carrot,
  '카카오': MessageCircle,
};

export function ContentPreview({ content }: ContentPreviewProps) {
  const ChannelIcon = channelIcons[content.channel] || FileText;
  const formattedDate = new Date(content.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card>
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-2 items-center">
          <ChannelIcon className="h-5 w-5 text-[#9a9a9a]" />
          <Badge tone="neutral">{content.channel}</Badge>
          <Badge tone={statusTone(content.status)}>{content.status}</Badge>
        </div>
        <span className="text-xs text-[#9a9a9a] font-mono">{formattedDate}</span>
      </div>

      <h3 className="text-base font-bold text-[#ffffff] mb-2">{content.title || '제목 없음'}</h3>

      <div className="bg-[#0a0a0a] p-3 rounded-md border border-[#2a2a2a] mt-3">
        <p className="text-sm text-[#9a9a9a] line-clamp-3 whitespace-pre-wrap font-mono">
          {content.body}
        </p>
      </div>
    </Card>
  );
}
