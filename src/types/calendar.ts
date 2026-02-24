export type CalendarEventColor = "yellow" | "blue" | "red";

export type CalendarEvent = {
  id: string;
  title: string;
  eventDate: string;
  color: CalendarEventColor;
  memo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CalendarEventInput = {
  title: string;
  eventDate: string;
  color: CalendarEventColor;
  memo?: string;
};
