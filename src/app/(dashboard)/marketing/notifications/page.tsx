"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ModuleShell } from "@/components/layout/module-shell";
import {
  useNotifications,
  useMarkNotificationsRead,
} from "@/lib/api/hooks/marketing";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { NotificationCategory, MarketingNotification } from "@/types/marketing";
import {
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_CATEGORY_ICONS,
} from "@/types/marketing";
import { cn } from "@/lib/utils/cn";

const FILTER_TABS: { id: NotificationCategory | "all"; label: string }[] = [
  { id: "all", label: "전체" },
  ...Object.entries(NOTIFICATION_CATEGORY_LABELS).map(([id, label]) => ({
    id: id as NotificationCategory,
    label,
  })),
];

function severityClass(severity: number): string {
  switch (severity) {
    case 1:
      return "border-l-red-500";
    case 2:
      return "border-l-orange-400";
    case 3:
      return "border-l-[#3a3a3a]";
    default:
      return "border-l-[#2a2a2a]";
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

export default function NotificationsPage() {
  return (
    <ModuleShell
      title="알림 센터"
      description="마케팅 시스템에서 발생한 알림을 확인하세요."
      breadcrumb={[
        { label: "마케팅", href: "/marketing" },
        { label: "알림 센터" },
      ]}
    >
      <NotificationsContent />
    </ModuleShell>
  );
}

function NotificationsContent() {
  const router = useRouter();
  const [filter, setFilter] = useState<NotificationCategory | "all">("all");

  const category = filter === "all" ? undefined : filter;
  const { data: notifications, isLoading, isError, refetch } = useNotifications(category);
  const markRead = useMarkNotificationsRead();

  const items = notifications ?? [];
  const unreadIds = items.filter((n) => !n.isRead).map((n) => n.id);

  function handleMarkAllRead() {
    if (unreadIds.length === 0) return;
    markRead.mutate(unreadIds, {
      onSuccess: () => toast.success("모든 알림을 읽음 처리했습니다."),
      onError: () => toast.error("읽음 처리 중 오류가 발생했습니다."),
    });
  }

  function handleClick(notification: MarketingNotification) {
    if (!notification.isRead) {
      markRead.mutate([notification.id]);
    }
    if (notification.actionPath) {
      router.push(notification.actionPath);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
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

        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkAllRead}
          disabled={unreadIds.length === 0 || markRead.isPending}
        >
          모두 읽음
        </Button>
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
            알림 데이터를 불러오지 못했습니다.
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
          <p className="text-[#9a9a9a] text-lg">알림이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleClick(n)}
              className={cn(
                "w-full text-left flex items-start gap-3 rounded-lg border border-[#2a2a2a] border-l-4 px-4 py-3 transition-colors",
                severityClass(n.severity),
                n.isRead
                  ? "bg-[#0a0a0a] hover:bg-[#111111]"
                  : "bg-[#141414] hover:bg-[#1a1a1a]",
                n.actionPath && "cursor-pointer",
              )}
            >
              <span className="text-lg shrink-0 mt-0.5">
                {NOTIFICATION_CATEGORY_ICONS[n.category] ?? "📌"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium truncate",
                      n.isRead ? "text-[#9a9a9a]" : "text-[#ffffff]",
                    )}
                  >
                    {n.title}
                  </span>
                  {!n.isRead && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </div>
                <p className="text-xs text-[#777777] mt-0.5 line-clamp-1">
                  {n.body}
                </p>
              </div>
              <span className="text-[11px] text-[#666666] whitespace-nowrap shrink-0 mt-0.5">
                {timeAgo(n.createdAt)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
