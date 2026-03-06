"use client";

import { useState } from "react";
import { useMarketingContent } from "@/lib/api/hooks";
import { ContentPreview } from "@/components/modules/marketing/content-preview";

const CHANNELS = ["전체", "블로그", "인스타그램", "카페", "유튜브", "당근", "카카오"];

export default function ContentPage() {
  const [activeChannel, setActiveChannel] = useState("전체");
  const { data: contents, isLoading } = useMarketingContent(
    activeChannel === "전체" ? undefined : activeChannel,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#ffffff] tracking-tight">발행 콘텐츠</h1>
          <p className="text-[#9a9a9a] mt-1">다양한 채널에 배포된 마케팅 콘텐츠입니다.</p>
        </div>
        <div className="flex bg-[#141414] rounded-md border border-[#2a2a2a] p-1 overflow-x-auto max-w-full">
          {CHANNELS.map((channel) => (
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
              {channel}
            </button>
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
      ) : (contents ?? []).length === 0 ? (
        <div className="bg-[#141414] rounded-md border border-[#2a2a2a] p-12 text-center">
          <p className="text-[#9a9a9a] text-lg">
            {activeChannel === "전체" ? "콘텐츠가 없습니다." : `'${activeChannel}' 채널의 콘텐츠가 없습니다.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(contents ?? []).map((content) => (
            <ContentPreview key={content.id} content={content} />
          ))}
        </div>
      )}
    </div>
  );
}
