"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ModuleShell } from "@/components/layout/module-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContentPreview, type Content } from "@/components/modules/marketing/content-preview";
import { Modal } from "@/components/ui/modal";
import { useMarketingContent } from "@/lib/api/hooks/marketing";
import { CONTENT_STATUS_LABELS } from "@/types/marketing";

const CHANNELS = ["블로그", "인스타그램", "카페", "유튜브", "당근", "카카오"];

export default function ContentPage() {
  return (
    <ModuleShell
      title="게시물 관리"
      description="다양한 채널에 배포된 마케팅 게시물입니다."
      breadcrumb={[{ label: "마케팅", href: "/marketing" }, { label: "게시물" }]}
    >
      <ContentPageBody />
    </ModuleShell>
  );
}

type PublishFilter = "전체" | "수동" | "자동";

function ContentPageBody() {
  const [activeChannel, setActiveChannel] = useState("전체");
  const [publishFilter, setPublishFilter] = useState<PublishFilter>("전체");
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const { data: contents, isLoading, isError, refetch } = useMarketingContent();

  const allContents = useMemo(() => contents ?? [], [contents]);
  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allContents.forEach((content) => {
      counts[content.channel] = (counts[content.channel] ?? 0) + 1;
    });
    return counts;
  }, [allContents]);

  const channels = useMemo(() => {
    const extraChannels = Object.keys(channelCounts).filter(
      (channel) => !CHANNELS.includes(channel),
    );
    return ["전체", ...CHANNELS, ...extraChannels];
  }, [channelCounts]);

  const filteredContents = useMemo(() => {
    let result = allContents;
    if (activeChannel !== "전체") {
      result = result.filter((content) => content.channel === activeChannel);
    }
    if (publishFilter === "자동") {
      result = result.filter((content) => content.publishedBy === "openclaw");
    } else if (publishFilter === "수동") {
      result = result.filter((content) => content.publishedBy !== "openclaw");
    }
    return result;
  }, [activeChannel, publishFilter, allContents]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredContents.forEach((content) => {
      counts[content.status] = (counts[content.status] ?? 0) + 1;
    });
    return counts;
  }, [filteredContents]);

  function exportContentCsv() {
    const header = "채널,제목,상태,배포방식,생성일,발행일\n";
    const rows = filteredContents
      .map((content) =>
        [
          content.channel,
          content.title ?? "",
          CONTENT_STATUS_LABELS[content.status] ?? content.status,
          content.publishedBy === "openclaw" ? "자동" : "수동",
          content.createdAt,
          content.publishedAt ?? "",
        ].join(","),
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `content_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex bg-[#141414] rounded-md border border-[#2a2a2a] p-1 overflow-x-auto max-w-full">
          {channels.map((channel) => (
            <button
              key={channel}
              type="button"
              onClick={() => setActiveChannel(channel)}
              className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors flex-shrink-0 ${
                activeChannel === channel
                  ? "bg-[#1a1a1a] text-[#ffffff]"
                  : "text-[#9a9a9a] hover:bg-[#141414]"
              }`}
            >
              {channel} ({channel === "전체" ? allContents.length : channelCounts[channel] ?? 0})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {(["전체", "수동", "자동"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setPublishFilter(filter)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                publishFilter === filter
                  ? "bg-[#1a1a1a] text-[#ffffff]"
                  : "text-[#9a9a9a] hover:bg-[#141414]"
              }`}
            >
              {filter === "자동" ? "🤖 자동" : filter === "수동" ? "✋ 수동" : filter}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-[#9a9a9a]">{filteredContents.length}개의 게시물</p>
          <Button variant="outline" size="sm" onClick={exportContentCsv}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
          {Object.entries(statusCounts).map(([status, count]) => (
            <Badge key={status} tone="neutral">
              {CONTENT_STATUS_LABELS[status] ?? status} {count}
            </Badge>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse bg-[#141414] rounded-md border border-[#2a2a2a] p-6">
              <div className="flex justify-between mb-4">
                <div className="flex gap-2">
                  <div className="h-6 w-16 bg-[#1a1a1a] rounded-full" />
                  <div className="h-6 w-16 bg-[#1a1a1a] rounded-full" />
                </div>
                <div className="h-4 w-24 bg-[#1a1a1a] rounded" />
              </div>
              <div className="h-6 w-3/4 bg-[#1a1a1a] rounded mb-4" />
              <div className="h-20 bg-[#1a1a1a] rounded" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <Card className="mt-4 p-6">
          <p className="text-sm text-[var(--color-danger)]">게시물 데이터를 불러오지 못했습니다.</p>
          <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
            다시 시도
          </Button>
        </Card>
      ) : filteredContents.length === 0 ? (
        <div className="bg-[#141414] rounded-md border border-[#2a2a2a] p-12 text-center">
          <p className="text-[#9a9a9a] text-lg">
            {activeChannel === "전체" ? "게시물이 없습니다." : `'${activeChannel}' 채널의 게시물이 없습니다.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredContents.map((content) => (
            <ContentPreview key={content.id} content={content} onClick={setSelectedContent} />
          ))}
        </div>
      )}

      <Modal
        open={selectedContent !== null}
        onClose={() => setSelectedContent(null)}
        title={selectedContent?.title ?? "게시물 상세"}
        size="lg"
      >
        {selectedContent && (
          <div className="space-y-5">
            <div className="flex gap-2 flex-wrap items-center">
              <Badge tone="neutral">{selectedContent.channel}</Badge>
              <Badge tone={selectedContent.status === 'published' || selectedContent.status === 'approved' ? 'brand' : 'neutral'}>
                {CONTENT_STATUS_LABELS[selectedContent.status] || selectedContent.status}
              </Badge>
              {selectedContent.publishedBy === 'openclaw' && (
                <Badge tone="brand">자동 배포</Badge>
              )}
            </div>

            <div className="bg-[#0a0a0a] rounded-md p-4 border border-[#2a2a2a]">
              <p className="text-sm text-[#cccccc] whitespace-pre-wrap leading-relaxed">
                {selectedContent.body}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-[#666666]">
              <span>생성일: {new Date(selectedContent.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              {selectedContent.publishedAt && (
                <span>발행일: {new Date(selectedContent.publishedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              )}
            </div>

            {selectedContent.engagementMetrics && Object.keys(selectedContent.engagementMetrics).length > 0 && (
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#2a2a2a]">
                {typeof selectedContent.engagementMetrics.views === 'number' && (
                  <div className="text-center">
                    <p className="text-lg font-bold text-[#ffffff]">{selectedContent.engagementMetrics.views as number}</p>
                    <p className="text-xs text-[#666666]">조회수</p>
                  </div>
                )}
                {typeof selectedContent.engagementMetrics.clicks === 'number' && (
                  <div className="text-center">
                    <p className="text-lg font-bold text-[#ffffff]">{selectedContent.engagementMetrics.clicks as number}</p>
                    <p className="text-xs text-[#666666]">클릭수</p>
                  </div>
                )}
                {typeof selectedContent.engagementMetrics.engagementRate === 'number' && (
                  <div className="text-center">
                    <p className="text-lg font-bold text-[#ffffff]">
                      {(selectedContent.engagementMetrics.engagementRate as number) <= 1
                        ? Math.round((selectedContent.engagementMetrics.engagementRate as number) * 100)
                        : Math.round(selectedContent.engagementMetrics.engagementRate as number)}%
                    </p>
                    <p className="text-xs text-[#666666]">참여율</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
