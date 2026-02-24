"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { Bell, CalendarDays, ClipboardList, CreditCard, FileText, Shield, Sparkles } from "lucide-react";
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
  const { data: snapshot, isLoading, isError, refetch } = useHubSnapshot();
  const { data: unreadCounts } = useUnreadMenuCounts();

  useEffect(() => {
    void markMenuAsRead("hub");
  }, []);

  const totalUnread = useMemo(
    () => (unreadCounts ?? []).reduce((sum, entry) => sum + entry.count, 0),
    [unreadCounts],
  );

  const handleComplete = async (todoId: string) => {
    const result = await updateTodoStatus(todoId, "done");
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
      <Card className="mt-4 p-6 text-sm text-[var(--color-ink-muted)]">
        허브 데이터를 불러오는 중입니다...
      </Card>
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
        <Card className="border-[rgb(42_42_42/45%)] p-4">
          <p className="text-xs text-[var(--color-ink-muted)]">미완료 할 일</p>
          <p className="display-font mt-2 text-2xl font-semibold">{snapshot.metrics.openTodos}건</p>
        </Card>
        <Card className="border-[rgb(42_42_42/45%)] p-4">
          <p className="text-xs text-[var(--color-ink-muted)]">미지급 경비</p>
          <p className="display-font mt-2 text-2xl font-semibold">{formatCurrency(snapshot.metrics.unpaidExpenseAmount)}</p>
        </Card>
        <Card className="border-[rgb(42_42_42/45%)] p-4">
          <p className="text-xs text-[var(--color-ink-muted)]">미납 공과금</p>
          <p className="display-font mt-2 text-2xl font-semibold">{formatCurrency(snapshot.metrics.unpaidUtilityAmount)}</p>
        </Card>
        <Card className="border-[rgb(42_42_42/45%)] p-4">
          <p className="text-xs text-[var(--color-ink-muted)]">이번 주 일정</p>
          <p className="display-font mt-2 text-2xl font-semibold">{snapshot.metrics.thisWeekEventCount}건</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="space-y-3 border-[rgb(42_42_42/45%)] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-ink-muted)]">나의 포커스</p>
            <Badge tone="brand">상위 5개</Badge>
          </div>
          {snapshot.focusTodos.length === 0 ? (
            <p className="rounded-xl bg-[rgb(26_26_26/72%)] px-3 py-4 text-sm text-[var(--color-ink-muted)]">
              미완료 업무가 없습니다.
            </p>
          ) : (
            snapshot.focusTodos.map((todo) => (
              <label key={todo.id} className="flex items-center gap-3 rounded-xl bg-[rgb(26_26_26/72%)] px-3 py-2">
                <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" onChange={() => void handleComplete(todo.id)} />
                <span className="flex-1 text-sm">{todo.title}</span>
                {todo.dueDate ? (
                  <span className="text-xs text-[var(--color-ink-muted)]">{format(parseISO(todo.dueDate), "M/d (E)", { locale: ko })}</span>
                ) : null}
              </label>
            ))
          )}
        </Card>

        <Card className="space-y-3 border-[rgb(42_42_42/45%)] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-ink-muted)]">알림 허브</p>
            <div className="flex items-center gap-2">
              <Badge tone={totalUnread > 0 ? "warning" : "neutral"}>{totalUnread}건</Badge>
              <Button variant="outline" className="h-8 px-3 text-xs" disabled={reading} onClick={() => void handleMarkAllRead()}>
                모두 읽음
              </Button>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {(unreadCounts ?? []).map((entry) => (
              <div key={entry.key} className="flex items-center justify-between rounded-xl bg-[rgb(26_26_26/72%)] px-3 py-2">
                <div className="flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 text-[var(--color-brand)]" />
                  <span>{entry.key.replaceAll("_", " ")}</span>
                </div>
                <Badge tone={entry.count > 0 ? "brand" : "neutral"}>{entry.count}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="space-y-3 border-[rgb(42_42_42/45%)] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-ink-muted)]">다가오는 일정</p>
            <Badge tone="brand">4건</Badge>
          </div>
          {snapshot.upcomingEvents.length === 0 ? (
            <p className="rounded-xl bg-[rgb(26_26_26/72%)] px-3 py-4 text-sm text-[var(--color-ink-muted)]">등록된 일정이 없습니다.</p>
          ) : (
            snapshot.upcomingEvents.map((event) => {
              const dDay = differenceInCalendarDays(parseISO(event.eventDate), new Date());
              const badge = dDay === 0 ? "D-Day" : dDay > 0 ? `D-${dDay}` : `D+${Math.abs(dDay)}`;

              return (
                <div key={event.id} className="flex items-center justify-between rounded-xl bg-[rgb(26_26_26/72%)] px-3 py-2">
                  <div>
                    <p className="text-sm">{event.title}</p>
                    <p className="text-xs text-[var(--color-ink-muted)]">{format(parseISO(event.eventDate), "M월 d일 (EEE)", { locale: ko })}</p>
                  </div>
                  <Badge tone={dDay < 0 ? "danger" : dDay <= 2 ? "warning" : "brand"}>{badge}</Badge>
                </div>
              );
            })
          )}
        </Card>

        <Card className="space-y-3 border-[rgb(42_42_42/45%)] p-4">
          <p className="text-sm text-[var(--color-ink-muted)]">Financial Pulse</p>
          <div className="rounded-xl border border-[rgb(42_42_42/45%)] bg-[rgb(26_26_26/72%)] p-4">
            <p className="text-xs text-[var(--color-ink-muted)]">대기 중 금액</p>
            <p className="display-font mt-1 text-2xl font-semibold text-[var(--color-warning)]">
              {formatCurrency(snapshot.metrics.unpaidExpenseAmount + snapshot.metrics.unpaidUtilityAmount)}
            </p>
            <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
              미지급 경비 {snapshot.metrics.unpaidExpenseCount}건 / 미납 공과금 {snapshot.metrics.unpaidUtilityCount}건
            </p>
          </div>
          <div>
            <p className="mb-2 text-sm text-[var(--color-ink-muted)]">빠른 실행</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group rounded-xl border border-[rgb(42_42_42/45%)] bg-[rgb(16_27_43/65%)] px-3 py-2 text-sm transition hover:border-[rgb(212_212_212/45%)] hover:text-[var(--color-brand)]"
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

      <Card className="border-[rgb(42_42_42/45%)] p-4 text-sm text-[var(--color-ink-muted)]">
        <div className="flex items-center gap-2 text-[var(--color-brand)]">
          <Sparkles className="h-4 w-4" />
          워크스페이스가 실시간 데이터로 연결되었습니다.
        </div>
      </Card>
    </div>
  );
}
