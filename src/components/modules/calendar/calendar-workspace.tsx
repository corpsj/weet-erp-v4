"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subDays,
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
import type { CalendarEvent, CalendarEventColor } from "@/types/calendar";

const weekdayLabels = ["월", "화", "수", "목", "금", "토", "일"];
const eventColorStyles: Record<CalendarEventColor, string> = {
  yellow: "bg-[#e5e5e5]",
  blue: "bg-[#b0b0b0]",
  red: "bg-[#ff4d6d]",
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

type DayState = {
  date: Date;
  key: string;
  events: CalendarEvent[];
};

const defaultEditorState = (date: Date): EditorState => ({
  title: "",
  eventDate: format(date, "yyyy-MM-dd"),
  color: "blue",
  memo: "",
});

export function CalendarWorkspace() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [quickTitle, setQuickTitle] = useState("");
  const [quickColor, setQuickColor] = useState<CalendarEventColor>("blue");
  const [modalOpen, setModalOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(defaultEditorState(new Date()));
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: events, isLoading, isError, refetch } = useCalendarEvents(month);

  useEffect(() => {
    void markMenuAsRead("calendar");
  }, []);

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of events ?? []) {
      const bucket = grouped.get(event.eventDate);
      if (bucket) {
        bucket.push(event);
      } else {
        grouped.set(event.eventDate, [event]);
      }
    }
    return grouped;
  }, [events]);

  const days = useMemo<DayState[]>(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end }).map((date) => {
      const key = format(date, "yyyy-MM-dd");
      return {
        date,
        key,
        events: eventsByDate.get(key) ?? [],
      };
    });
  }, [eventsByDate, month]);

  const selectedDateEvents = useMemo(() => {
    return eventsByDate.get(format(selectedDate, "yyyy-MM-dd")) ?? [];
  }, [eventsByDate, selectedDate]);

  const selectedMonthEventCount = useMemo(() => {
    return (events ?? []).filter((event) => isSameMonth(new Date(event.eventDate), month)).length;
  }, [events, month]);

  const syncDateToMonth = (date: Date) => {
    setSelectedDate(date);
    if (!isSameMonth(date, month)) {
      setMonth(date);
    }
  };

  const refreshCalendarData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-snapshot"] }),
      queryClient.invalidateQueries({ queryKey: ["menu-unread-counts"] }),
    ]);
  };

  const handleQuickAdd = async () => {
    if (isSaving) {
      return;
    }

    if (!quickTitle.trim()) {
      toast.error("일정 제목을 입력해주세요.");
      return;
    }

    setIsSaving(true);
    const result = await upsertCalendarEvent({
      title: quickTitle,
      color: quickColor,
      eventDate: format(selectedDate, "yyyy-MM-dd"),
    });
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setQuickTitle("");
    toast.success("일정을 추가했습니다.");
    await refreshCalendarData();
  };

  const openEdit = (eventId?: string) => {
    if (eventId) {
      const target = (events ?? []).find((event) => event.id === eventId);
      if (!target) {
        toast.error("수정할 일정을 찾을 수 없습니다.");
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
      setEditor(defaultEditorState(selectedDate));
    }

    setModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) {
      return;
    }
    setModalOpen(false);
  };

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    const result = await upsertCalendarEvent({
      id: editor.id,
      title: editor.title,
      eventDate: editor.eventDate,
      color: editor.color,
      memo: editor.memo,
    });
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(editor.id ? "일정을 수정했습니다." : "일정을 생성했습니다.");
    setModalOpen(false);
    syncDateToMonth(new Date(editor.eventDate));
    await refreshCalendarData();
  };

  const handleDelete = async (eventId: string) => {
    if (deletingId) {
      return;
    }

    setDeletingId(eventId);
    const result = await deleteCalendarEvent(eventId);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("일정을 삭제했습니다.");
    await refreshCalendarData();
  };

  if (isLoading) {
    return (
      <Card className="mt-4 space-y-3 border-[#2a2a2a] bg-[#141414] p-6">
        <div className="h-4 w-40 rounded bg-[#2a2a2a]" />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="h-24 rounded-xl bg-[#1a1a1a]" />
          <div className="h-24 rounded-xl bg-[#1a1a1a]" />
        </div>
        <p className="text-sm text-[#9a9a9a]">캘린더 데이터를 불러오는 중입니다...</p>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="mt-4 border-[#2a2a2a] bg-[#141414] p-6">
        <p className="text-sm text-[#ff4d6d]">캘린더 데이터를 불러오지 못했습니다.</p>
        <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </Card>
    );
  }

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <Card className="space-y-4 border-[#2a2a2a] bg-[#141414] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
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

          <p className="display-font text-xl text-[#ffffff]">{format(month, "yyyy년 M월", { locale: ko })}</p>

          <Button className="h-9 px-3" onClick={() => openEdit()}>
            <Plus className="mr-1 h-4 w-4" /> 일정 추가
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2">
          <p className="text-xs text-[#b0b0b0]">이번 달 일정</p>
          <Badge tone="neutral">{selectedMonthEventCount}건</Badge>
        </div>

        <div className="grid grid-cols-7 gap-2 text-xs text-[#9a9a9a]">
          {weekdayLabels.map((label) => (
            <div key={label} className="px-2 py-1 text-center">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const dayIsToday = isToday(day.date);
            const selected = isSameDay(day.date, selectedDate);

            return (
              <button
                key={day.key}
                type="button"
                className={`min-h-28 rounded-xl border p-2 text-left transition ${
                  selected
                    ? "border-[#d4d4d4] bg-[#2a2a2a]"
                    : "border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#b0b0b0]"
                } ${!isSameMonth(day.date, month) ? "opacity-45" : "opacity-100"}`}
                onClick={() => syncDateToMonth(day.date)}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className={`text-sm ${dayIsToday ? "font-semibold text-[#ffffff]" : "text-[#d4d4d4]"}`}>{format(day.date, "d")}</span>
                  {dayIsToday ? (
                    <span className="rounded-full border border-[#ff4d6d] px-2 py-0.5 text-[10px] font-medium text-[#ff4d6d]">오늘</span>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  {day.events.slice(0, 3).map((event) => (
                    <div key={event.id} className="flex items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-1.5 py-1 text-[11px]">
                      <span className={`h-2 w-2 rounded-full ${eventColorStyles[event.color]}`} />
                      <span className="truncate text-[#d4d4d4]">{event.title}</span>
                    </div>
                  ))}
                  {day.events.length > 3 ? <p className="text-[10px] text-[#9a9a9a]">+{day.events.length - 3}개 더 있음</p> : null}
                </div>
              </button>
            );
          })}
        </div>

        {selectedMonthEventCount === 0 ? (
          <div className="rounded-xl border border-dashed border-[#2a2a2a] bg-[#1a1a1a] px-4 py-6 text-sm text-[#9a9a9a]">
            이번 달 등록된 일정이 없습니다. 우측 패널 또는 상단 버튼에서 새 일정을 추가해보세요.
          </div>
        ) : null}
      </Card>

      <Card className="space-y-4 border-[#2a2a2a] bg-[#141414] p-4">
        <div className="flex items-center justify-between">
          <h3 className="display-font text-lg text-[#ffffff]">{format(selectedDate, "M월 d일 (EEE)", { locale: ko })}</h3>
          <Badge tone="neutral">{selectedDateEvents.length}건</Badge>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-2">
          <Button variant="ghost" className="h-8 px-2" onClick={() => syncDateToMonth(subDays(selectedDate, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="text-xs text-[#b0b0b0]">날짜 이동</p>
          <Button variant="ghost" className="h-8 px-2" onClick={() => syncDateToMonth(addDays(selectedDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-3">
          <p className="text-xs text-[#9a9a9a]">빠른 추가</p>
          <Input
            value={quickTitle}
            onChange={(event) => setQuickTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleQuickAdd();
              }
            }}
            placeholder="일정 제목"
          />
          <div className="flex gap-2">
            {(["yellow", "blue", "red"] as CalendarEventColor[]).map((color) => (
              <button
                key={color}
                type="button"
                className={`rounded-lg border px-2 py-1 text-xs transition ${
                  quickColor === color
                    ? "border-[#d4d4d4] bg-[#2a2a2a] text-[#ffffff]"
                    : "border-[#2a2a2a] bg-[#141414] text-[#b0b0b0] hover:border-[#b0b0b0]"
                }`}
                onClick={() => setQuickColor(color)}
              >
                {colorLabelMap[color]}
              </button>
            ))}
            <Button className="ml-auto h-8 px-3 text-xs" onClick={() => void handleQuickAdd()} disabled={isSaving}>
              {isSaving ? "저장 중" : "추가"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {selectedDateEvents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#2a2a2a] bg-[#1a1a1a] px-3 py-5 text-sm text-[#9a9a9a]">
              선택한 날짜의 일정이 없습니다.
            </p>
          ) : (
            selectedDateEvents.map((event) => (
              <div key={event.id} className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${eventColorStyles[event.color]}`} />
                    <p className="truncate text-sm text-[#ffffff]">{event.title}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => openEdit(event.id)} disabled={isSaving}>
                      수정
                    </Button>
                    <Button
                      variant="danger"
                      className="h-7 px-2"
                      onClick={() => void handleDelete(event.id)}
                      disabled={Boolean(deletingId) || isSaving}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {event.memo ? <p className="mt-2 whitespace-pre-wrap text-xs text-[#9a9a9a]">{event.memo}</p> : null}
                {deletingId === event.id ? <p className="mt-2 text-[11px] text-[#9a9a9a]">삭제 중...</p> : null}
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal open={modalOpen} onClose={closeModal} title={editor.id ? "일정 수정" : "일정 추가"}>
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
                className={`rounded-lg border px-3 py-2 text-xs transition ${
                  editor.color === color
                    ? "border-[#d4d4d4] bg-[#2a2a2a] text-[#ffffff]"
                    : "border-[#2a2a2a] bg-[#141414] text-[#b0b0b0] hover:border-[#b0b0b0]"
                }`}
                onClick={() => setEditor((prev) => ({ ...prev, color }))}
              >
                {colorLabelMap[color]}
              </button>
            ))}
          </div>

          <textarea
            className="min-h-28 w-full rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-sm text-[#d4d4d4] outline-none transition focus:border-[#b0b0b0]"
            value={editor.memo}
            onChange={(event) => setEditor((prev) => ({ ...prev, memo: event.target.value }))}
            placeholder="메모"
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal} disabled={isSaving}>
              취소
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "저장 중" : "저장"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
