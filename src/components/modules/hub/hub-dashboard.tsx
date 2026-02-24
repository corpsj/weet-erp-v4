"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { Bell, CalendarDays, CheckCircle2, ClipboardList, CreditCard, FileText, Shield, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { markAllMenusAsRead, markMenuAsRead } from "@/lib/api/actions/hub";
import { updateTodoStatus } from "@/lib/api/actions/todos";
import { useHubSnapshot, useUnreadMenuCounts } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/format";

const quickActions = [
  { href: "/todos", label: "업무 등록", icon: ClipboardList },
  { href: "/calendar", label: "일정 확인", icon: CalendarDays },
  { href: "/expenses", label: "경비 처리", icon: CreditCard },
  { href: "/memos", label: "메모 작성", icon: FileText },
  { href: "/vault", label: "계정 공유", icon: Shield },
];

export function HubDashboard() {
  const queryClient = useQueryClient();
  const [reading, setReading] = useState(false);
  const [completingTodoId, setCompletingTodoId] = useState<string | null>(null);
  const { data: snapshot, isLoading, isError, refetch } = useHubSnapshot();
  const { data: unreadCounts } = useUnreadMenuCounts();

  useEffect(() => {
    void markMenuAsRead("hub");
  }, []);

  const totalUnread = useMemo(
    () => (unreadCounts ?? []).reduce((sum, entry) => sum + entry.count, 0),
    [unreadCounts],
  );

  const unreadEntries = useMemo(() => (unreadCounts ?? []).filter((entry) => entry.count > 0), [unreadCounts]);

  const urgentTodos = useMemo(
    () => {
      const today = new Date();
      return (
        snapshot?.focusTodos.filter((todo) => {
          if (!todo.dueDate) {
            return false;
          }
          const dDay = differenceInCalendarDays(parseISO(todo.dueDate), today);
          return dDay <= 1;
        }).length ?? 0
      );
    },
    [snapshot],
  );

  const upcomingInWeek = useMemo(
    () => {
      const today = new Date();
      return (
        snapshot?.upcomingEvents.filter((event) => {
          const dDay = differenceInCalendarDays(parseISO(event.eventDate), today);
          return dDay >= 0 && dDay <= 7;
        }).length ?? 0
      );
    },
    [snapshot],
  );

  const handleComplete = async (todoId: string) => {
    setCompletingTodoId(todoId);
    const result = await updateTodoStatus(todoId, "done");
    setCompletingTodoId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("할 일을 완료했습니다.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["hub-snapshot"] }),
      queryClient.invalidateQueries({ queryKey: ["todos"] }),
      queryClient.invalidateQueries({ queryKey: ["menu-unread-counts"] }),
    ]);
  };

  const handleMarkAllRead = async () => {
    setReading(true);
    const result = await markAllMenusAsRead();
    setReading(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("모든 알림을 읽음 처리했습니다.");
    await queryClient.invalidateQueries({ queryKey: ["menu-unread-counts"] });
  };

  if (isLoading) {
    return (
      <div className="mt-4 space-y-4">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {["a", "b", "c", "d"].map((item) => (
            <Card key={`metric-skeleton-${item}`} className="space-y-3 p-5">
              <div className="h-3 w-24 animate-pulse rounded bg-[#2a2a2a]" />
              <div className="h-8 w-28 animate-pulse rounded bg-[#1a1a1a]" />
            </Card>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {["left", "right"].map((item) => (
            <Card key={`panel-skeleton-${item}`} className="space-y-3 p-5">
              <div className="h-4 w-32 animate-pulse rounded bg-[#2a2a2a]" />
              <div className="h-12 animate-pulse rounded bg-[#1a1a1a]" />
              <div className="h-12 animate-pulse rounded bg-[#1a1a1a]" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !snapshot) {
    return (
      <Card className="mt-4 p-6">
        <p className="text-sm text-[var(--color-danger)]">허브 데이터를 불러오지 못했습니다.</p>
        <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs tracking-[0.14em] text-[#9a9a9a]">OPEN TASKS</p>
          <p className="display-font mt-2 text-3xl font-semibold text-[#ffffff]">{snapshot.metrics.openTodos}</p>
          <p className="mt-1 text-xs text-[#9a9a9a]">미완료 할 일</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs tracking-[0.14em] text-[#9a9a9a]">UNPAID EXPENSES</p>
          <p className="display-font mt-2 text-3xl font-semibold text-[#ffffff]">{formatCurrency(snapshot.metrics.unpaidExpenseAmount)}</p>
          <p className="mt-1 text-xs text-[#9a9a9a]">미지급 경비 {snapshot.metrics.unpaidExpenseCount}건</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs tracking-[0.14em] text-[#9a9a9a]">UNPAID UTILITIES</p>
          <p className="display-font mt-2 text-3xl font-semibold text-[#ffffff]">{formatCurrency(snapshot.metrics.unpaidUtilityAmount)}</p>
          <p className="mt-1 text-xs text-[#9a9a9a]">미납 공과금 {snapshot.metrics.unpaidUtilityCount}건</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs tracking-[0.14em] text-[#9a9a9a]">THIS WEEK EVENTS</p>
          <p className="display-font mt-2 text-3xl font-semibold text-[#ffffff]">{snapshot.metrics.thisWeekEventCount}</p>
          <p className="mt-1 text-xs text-[#9a9a9a]">이번 주 일정</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#d4d4d4]">나의 포커스 할 일</p>
            <Badge tone="neutral">상위 5개</Badge>
          </div>
          <div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-xs text-[#b0b0b0]">
            긴급/내일 마감 {urgentTodos}건
          </div>
          {snapshot.focusTodos.length === 0 ? (
            <div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-4 text-sm text-[#9a9a9a]">
              <p>데이터 없음 - 아직 미완료 업무가 없습니다.</p>
              <Link href="/todos" className="mt-2 inline-flex text-xs text-[#e5e5e5] hover:text-[#ffffff]">
                할 일 등록하러 가기
              </Link>
            </div>
          ) : (
            snapshot.focusTodos.map((todo) => (
              <label key={todo.id} className="flex items-center gap-3 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#e5e5e5]"
                  disabled={completingTodoId === todo.id}
                  onChange={() => void handleComplete(todo.id)}
                />
                <span className="flex-1 text-sm">{todo.title}</span>
                {todo.dueDate ? (
                  <span className="text-xs text-[#9a9a9a]">{format(parseISO(todo.dueDate), "M/d (E)", { locale: ko })}</span>
                ) : null}
              </label>
            ))
          )}
        </Card>

        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#d4d4d4]">알림 허브</p>
            <div className="flex items-center gap-2">
              <Badge tone={totalUnread > 0 ? "brand" : "neutral"}>{totalUnread}건</Badge>
              <Button variant="outline" className="h-8 px-3 text-xs" disabled={reading} onClick={() => void handleMarkAllRead()}>
                모두 읽음
              </Button>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {unreadEntries.length === 0 ? (
              <div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-4 text-sm text-[#9a9a9a]">
                데이터 없음 - 확인이 필요한 알림이 없습니다.
              </div>
            ) : (
              unreadEntries.map((entry) => (
                <div key={entry.key} className="flex items-center justify-between rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5 text-[#d4d4d4]" />
                    <span>{entry.key.replaceAll("_", " ")}</span>
                  </div>
                  <Badge tone="brand">{entry.count}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#d4d4d4]">예정 이벤트</p>
            <Badge tone="neutral">7일 내 {upcomingInWeek}건</Badge>
          </div>
          {snapshot.upcomingEvents.length === 0 ? (
            <div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-4 text-sm text-[#9a9a9a]">
              <p>데이터 없음 - 예정된 일정이 없습니다.</p>
              <Link href="/calendar" className="mt-2 inline-flex text-xs text-[#e5e5e5] hover:text-[#ffffff]">
                일정 등록하러 가기
              </Link>
            </div>
          ) : (
            snapshot.upcomingEvents.map((event) => {
              const dDay = differenceInCalendarDays(parseISO(event.eventDate), new Date());
              const badge = dDay === 0 ? "D-Day" : dDay > 0 ? `D-${dDay}` : `D+${Math.abs(dDay)}`;

              return (
                <div key={event.id} className="flex items-center justify-between rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2">
                  <div>
                    <p className="text-sm">{event.title}</p>
                    <p className="text-xs text-[#9a9a9a]">{format(parseISO(event.eventDate), "M월 d일 (EEE)", { locale: ko })}</p>
                  </div>
                  <Badge tone={dDay < 0 ? "danger" : "neutral"}>{badge}</Badge>
                </div>
              );
            })
          )}
        </Card>

        <Card className="space-y-3 p-5">
          <p className="text-sm text-[#d4d4d4]">Financial Pulse</p>
          <div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] p-4">
            <p className="text-xs text-[#9a9a9a]">대기 중 금액</p>
            <p className="display-font mt-1 text-3xl font-semibold text-[#ffffff]">
              {formatCurrency(snapshot.metrics.unpaidExpenseAmount + snapshot.metrics.unpaidUtilityAmount)}
            </p>
            <p className="mt-2 text-xs text-[#b0b0b0]">
              미지급 경비 {snapshot.metrics.unpaidExpenseCount}건 / 미납 공과금 {snapshot.metrics.unpaidUtilityCount}건
            </p>
          </div>
          <div>
            <p className="mb-2 text-sm text-[#9a9a9a]">빠른 실행</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group rounded-md border border-[#2a2a2a] bg-[#141414] px-3 py-2 text-sm text-[#d4d4d4] transition hover:border-[#e5e5e5] hover:text-[#ffffff]"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {action.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 text-sm text-[#9a9a9a]">
        <div className="flex items-center gap-2 text-[#d4d4d4]">
          <Sparkles className="h-4 w-4" />
          워크스페이스가 실시간 데이터로 연결되었습니다.
        </div>
        <div className="mt-1 text-xs text-[#b0b0b0]">모든 위젯은 최근 데이터 기준으로 자동 갱신됩니다.</div>
      </Card>

      {completingTodoId ? (
        <div className="flex items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#141414] px-3 py-2 text-xs text-[#b0b0b0]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          할 일 완료 상태를 저장하고 있습니다.
        </div>
      ) : null}
    </div>
  );
}
