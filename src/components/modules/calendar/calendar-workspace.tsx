"use client";

import { useMemo, useState, useEffect } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteCalendarEvent, upsertCalendarEvent } from "@/lib/api/actions/calendar";
import { markMenuAsRead } from "@/lib/api/actions/hub";
import { useCalendarEvents } from "@/lib/api/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { CalendarEventColor } from "@/types/calendar";

const weekdayLabels = ["월", "화", "수", "목", "금", "토", "일"];
const colorMap: Record<CalendarEventColor, string> = {
  yellow: "bg-[rgb(229_229_229/85%)]",
  blue: "bg-[rgb(212_212_212/85%)]",
  red: "bg-[rgb(255_77_109/85%)]",
};

const colorLabelMap: Record<CalendarEventColor, string> = {
  yellow: "일반",
  blue: "업무",
  red: "중요",
};

type EditorState = {
  id?: string;
  title: string;
  eventDate: string;
  color: CalendarEventColor;
  memo: string;
};

export function CalendarWorkspace() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [quickTitle, setQuickTitle] = useState("");
  const [quickColor, setQuickColor] = useState<CalendarEventColor>("blue");
  const [modalOpen, setModalOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>({
    title: "",
    eventDate: format(new Date(), "yyyy-MM-dd"),
    color: "blue",
    memo: "",
  });

  const { data: events, isLoading, isError, refetch } = useCalendarEvents(month);

  useEffect(() => {
    void markMenuAsRead("calendar");
  }, []);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const selectedDateEvents = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return (events ?? []).filter((event) => event.eventDate === key);
  }, [events, selectedDate]);

  const handleQuickAdd = async () => {
    if (!quickTitle.trim()) {
      toast.error("일정 제목을 입력해주세요.");
      return;
    }

    const result = await upsertCalendarEvent({
      title: quickTitle,
      color: quickColor,
      eventDate: format(selectedDate, "yyyy-MM-dd"),
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setQuickTitle("");
    toast.success("일정을 추가했습니다.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-snapshot"] }),
      queryClient.invalidateQueries({ queryKey: ["menu-unread-counts"] }),
    ]);
  };

  const openEdit = (eventId?: string) => {
    if (eventId) {
      const target = (events ?? []).find((event) => event.id === eventId);
      if (!target) {
        return;
      }
      setEditor({
        id: target.id,
        title: target.title,
        eventDate: target.eventDate,
        color: target.color,
        memo: target.memo ?? "",
      });
    } else {
      setEditor({
        title: "",
        eventDate: format(selectedDate, "yyyy-MM-dd"),
        color: "blue",
        memo: "",
      });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    const result = await upsertCalendarEvent({
      id: editor.id,
      title: editor.title,
      eventDate: editor.eventDate,
      color: editor.color,
      memo: editor.memo,
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(editor.id ? "일정을 수정했습니다." : "일정을 생성했습니다.");
    setModalOpen(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-snapshot"] }),
      queryClient.invalidateQueries({ queryKey: ["menu-unread-counts"] }),
    ]);
  };

  const handleDelete = async (eventId: string) => {
    const result = await deleteCalendarEvent(eventId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("일정을 삭제했습니다.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-snapshot"] }),
      queryClient.invalidateQueries({ queryKey: ["menu-unread-counts"] }),
    ]);
  };

  if (isLoading) {
    return <Card className="mt-4 p-6 text-sm text-[var(--color-ink-muted)]">캘린더 데이터를 불러오는 중입니다...</Card>;
  }

  if (isError) {
    return (
      <Card className="mt-4 p-6">
        <p className="text-sm text-[var(--color-danger)]">캘린더 데이터를 불러오지 못했습니다.</p>
        <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </Card>
    );
  }

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9 px-3" onClick={() => setMonth(subMonths(month, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="h-9 px-3" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              className="h-9 px-3"
              onClick={() => {
                const today = new Date();
                setMonth(today);
                setSelectedDate(today);
              }}
            >
              오늘
            </Button>
          </div>
          <p className="display-font text-xl">{format(month, "yyyy년 M월", { locale: ko })}</p>
          <Button className="h-9 px-3" onClick={() => openEdit()}>
            <Plus className="mr-1 h-4 w-4" /> 일정 추가
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-xs text-[var(--color-ink-muted)]">
          {weekdayLabels.map((label) => (
            <div key={label} className="px-2 py-1 text-center">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.map((date) => {
            const dateKey = format(date, "yyyy-MM-dd");
            const dayEvents = (events ?? []).filter((event) => event.eventDate === dateKey);
            const today = isSameDay(date, new Date());
            const selected = isSameDay(date, selectedDate);

            return (
              <button
                key={dateKey}
                type="button"
                className={`min-h-26 rounded-xl border p-2 text-left transition ${
                  selected
                    ? "border-[rgb(212_212_212/70%)] bg-[rgb(13_33_49/80%)]"
                    : "border-[rgb(42_42_42/45%)] bg-[rgb(16_27_43/65%)] hover:border-[rgb(212_212_212/45%)]"
                } ${!isSameMonth(date, month) ? "opacity-45" : "opacity-100"}`}
                onClick={() => setSelectedDate(date)}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className={`text-sm ${today ? "text-[var(--color-brand)]" : "text-[var(--color-ink)]"}`}>{format(date, "d")}</span>
                  {today && <Badge tone="brand">오늘</Badge>}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div key={event.id} className="flex items-center gap-1 rounded-md bg-[rgb(9_18_30/80%)] px-1.5 py-1 text-[11px]">
                      <span className={`h-2 w-2 rounded-full ${colorMap[event.color]}`} />
                      <span className="truncate">{event.title}</span>
                    </div>
                  ))}
                  {dayEvents.length > 3 ? <p className="text-[10px] text-[var(--color-ink-muted)]">+{dayEvents.length - 3}개</p> : null}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h3 className="display-font text-lg">{format(selectedDate, "M월 d일 (EEE)", { locale: ko })}</h3>
          <Badge tone="brand">{selectedDateEvents.length}건</Badge>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-[var(--color-ink-muted)]">빠른 추가</p>
          <Input value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder="일정 제목" />
          <div className="flex gap-2">
            {(["yellow", "blue", "red"] as CalendarEventColor[]).map((color) => (
              <button
                key={color}
                type="button"
                className={`rounded-lg border px-2 py-1 text-xs ${
                  quickColor === color
                    ? "border-[rgb(212_212_212/65%)] bg-[rgb(23_43_66/85%)]"
                    : "border-[rgb(42_42_42/45%)] bg-[rgb(11_21_33/70%)]"
                }`}
                onClick={() => setQuickColor(color)}
              >
                {colorLabelMap[color]}
              </button>
            ))}
            <Button className="ml-auto h-8 px-3 text-xs" onClick={() => void handleQuickAdd()}>
              추가
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {selectedDateEvents.length === 0 ? (
            <p className="rounded-xl bg-[rgb(26_26_26/72%)] px-3 py-4 text-sm text-[var(--color-ink-muted)]">선택한 날짜의 일정이 없습니다.</p>
          ) : (
            selectedDateEvents.map((event) => (
              <div key={event.id} className="rounded-xl border border-[rgb(42_42_42/45%)] bg-[rgb(16_27_43/65%)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${colorMap[event.color]}`} />
                    <p className="text-sm">{event.title}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => openEdit(event.id)}>
                      수정
                    </Button>
                    <Button variant="danger" className="h-7 px-2" onClick={() => void handleDelete(event.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {event.memo ? <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--color-ink-muted)]">{event.memo}</p> : null}
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editor.id ? "일정 수정" : "일정 추가"}>
        <div className="space-y-3">
          <Input
            value={editor.title}
            onChange={(event) => setEditor((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="일정 제목"
          />
          <Input
            type="date"
            value={editor.eventDate}
            onChange={(event) => setEditor((prev) => ({ ...prev, eventDate: event.target.value }))}
          />
          <div className="grid grid-cols-3 gap-2">
            {(["yellow", "blue", "red"] as CalendarEventColor[]).map((color) => (
              <button
                key={color}
                type="button"
                className={`rounded-lg border px-3 py-2 text-xs ${
                  editor.color === color
                    ? "border-[rgb(212_212_212/70%)] bg-[rgb(24_44_66/80%)]"
                    : "border-[rgb(42_42_42/45%)] bg-[rgb(11_21_33/70%)]"
                }`}
                onClick={() => setEditor((prev) => ({ ...prev, color }))}
              >
                {colorLabelMap[color]}
              </button>
            ))}
          </div>
          <textarea
            className="min-h-28 w-full rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
            value={editor.memo}
            onChange={(event) => setEditor((prev) => ({ ...prev, memo: event.target.value }))}
            placeholder="메모"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button onClick={() => void handleSave()}>저장</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
