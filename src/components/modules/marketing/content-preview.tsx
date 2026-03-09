import React from 'react';
import { BookOpen, Camera, Coffee, Video, Carrot, MessageCircle, FileText } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/format';
import { CONTENT_STATUS_LABELS, type MarketingContent } from '@/types/marketing';

export type Content = Pick<MarketingContent, 'id' | 'channel' | 'title' | 'body' | 'status' | 'createdAt' | 'engagementMetrics' | 'publishedAt' | 'publishedBy'>;

interface ContentPreviewProps {
  content: Content;
  onClick?: (content: Content) => void;
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

export function ContentPreview({ content, onClick }: ContentPreviewProps) {
  const ChannelIcon = channelIcons[content.channel] || FileText;
  const formattedDate = new Date(content.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const views = typeof content.engagementMetrics?.views === 'number' ? content.engagementMetrics.views : null;
  const clicks = typeof content.engagementMetrics?.clicks === 'number' ? content.engagementMetrics.clicks : null;
  const engagementRate =
    typeof content.engagementMetrics?.engagementRate === 'number'
      ? content.engagementMetrics.engagementRate
      : null;

  const hasMetrics = views !== null || clicks !== null || engagementRate !== null;
  const displayRate =
    engagementRate === null
      ? null
      : engagementRate <= 1
        ? Math.round(engagementRate * 100)
        : Math.round(engagementRate);

  const cardContent = (
    <>
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-2 items-center">
          <ChannelIcon className="h-5 w-5 text-[#9a9a9a]" />
          <Badge tone="neutral">{content.channel}</Badge>
          <Badge tone={statusTone(content.status)}>{CONTENT_STATUS_LABELS[content.status] || content.status}</Badge>
          {content.publishedBy === 'openclaw' && (
            <Badge tone="brand">자동 배포</Badge>
          )}
        </div>
        <span className="text-xs text-[#9a9a9a] font-mono">{formattedDate}</span>
      </div>

      <h3 className="text-base font-bold text-[#ffffff] mb-2">{content.title || '제목 없음'}</h3>

      <div className="bg-[#0a0a0a] p-3 rounded-md border border-[#2a2a2a] mt-3">
        <p className="text-sm text-[#9a9a9a] line-clamp-3 whitespace-pre-wrap font-mono">
          {content.body}
        </p>
      </div>

      {content.publishedAt && (
        <p className="text-xs text-[#9a9a9a] mt-3">발행일: {formatDate(content.publishedAt)}</p>
      )}

      {hasMetrics && (
        <p className="text-xs text-[#9a9a9a] mt-2">
          조회 {views ?? 0} · 클릭 {clicks ?? 0} · 참여율 {displayRate ?? 0}%
        </p>
      )}

      {onClick && (
        <p className="mt-2 text-xs text-[#666666]">클릭하여 전체 내용 보기</p>
      )}
    </>
  );

  if (onClick) {
    return (
      <Card className="cursor-pointer transition-colors hover:border-[#3a3a3a]">
        <button type="button" className="w-full text-left" onClick={() => onClick(content)}>
          {cardContent}
        </button>
      </Card>
    );
  }

  return <Card>{cardContent}</Card>;
}
