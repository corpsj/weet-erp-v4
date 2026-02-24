import {
  Banknote,
  CalendarDays,
  ClipboardList,
  FolderKanban,
  Home,
  Landmark,
  Lock,
  Receipt,
  ScrollText,
  Settings,
  StickyNote,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "워크스페이스",
    items: [
      { key: "hub", label: "허브", href: "/hub", icon: Home },
      { key: "calendar", label: "캘린더", href: "/calendar", icon: CalendarDays },
      { key: "todos", label: "To-Do", href: "/todos", icon: ClipboardList },
      { key: "memos", label: "메모", href: "/memos", icon: StickyNote },
    ],
  },
  {
    label: "재무/회계",
    items: [
      { key: "expenses", label: "경비 청구", href: "/expenses", icon: Receipt },
      { key: "utilities", label: "공과금", href: "/utilities", icon: Wallet },
      { key: "tax_invoices", label: "세금계산서", href: "/tax-invoices", icon: ScrollText },
      {
        key: "bank_transactions",
        label: "입출금",
        href: "/bank-transactions",
        icon: Landmark,
      },
    ],
  },
  {
    label: "보안",
    items: [{ key: "vault", label: "계정 공유", href: "/vault", icon: Lock }],
  },
  {
    label: "견적",
    items: [{ key: "estimates", label: "견적 시스템", href: "/estimates", icon: FolderKanban, disabled: true }],
  },
];

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { key: "hub", label: "허브", href: "/hub", icon: Home },
  { key: "calendar", label: "캘린더", href: "/calendar", icon: CalendarDays },
  { key: "todos", label: "To-Do", href: "/todos", icon: ClipboardList },
  { key: "expenses", label: "경비", href: "/expenses", icon: Banknote },
  { key: "settings", label: "설정", href: "/settings", icon: Settings },
];
