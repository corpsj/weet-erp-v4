import type { CalendarEvent } from "@/types/calendar";
import type { TodoItem } from "@/types/todo";

export type HubMetrics = {
  openTodos: number;
  unpaidExpenseCount: number;
  unpaidExpenseAmount: number;
  unpaidUtilityCount: number;
  unpaidUtilityAmount: number;
  thisWeekEventCount: number;
};

export type HubFinancialPulse = {
  pendingExpenses: number;
  unpaidUtilities: number;
  totalPending: number;
};

export type HubSnapshot = {
  metrics: HubMetrics;
  focusTodos: TodoItem[];
  upcomingEvents: CalendarEvent[];
};
