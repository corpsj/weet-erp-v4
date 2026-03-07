import {
  Banknote,
  Bell,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderKanban,
  Home,
  ImagePlus,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  Lock,
  Megaphone,
  Radio,
  Receipt,
  ScrollText,
  Settings,
  StickyNote,
  Users,
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
    label: "도구",
    items: [{ key: "ai_images", label: "AI 이미지", href: "/ai-images", icon: ImagePlus }],
  },
  {
    label: "견적",
    items: [{ key: "estimates", label: "견적 시스템", href: "/estimates", icon: FolderKanban, disabled: true }],
  },
  {
    label: "마케팅",
    items: [
      { key: "marketing", label: "마케팅", href: "/marketing", icon: Megaphone },
    ],
  },
];

export const MARKETING_NAV_GROUPS: NavGroup[] = [
  {
    label: "마케팅",
    items: [
      { key: "marketing-overview", label: "대시보드", href: "/marketing", icon: LayoutDashboard },
      { key: "marketing-leads", label: "잠재고객", href: "/marketing/leads", icon: Users },
      { key: "marketing-proposals", label: "승인 대기", href: "/marketing/proposals", icon: Lightbulb },
      { key: "marketing-content", label: "게시물", href: "/marketing/content", icon: FileText },
      { key: "marketing-signals", label: "트렌드", href: "/marketing/signals", icon: Radio },
      { key: "marketing-system", label: "운영 현황", href: "/marketing/system", icon: Settings },
      { key: "marketing-notifications", label: "알림 센터", href: "/marketing/notifications", icon: Bell },
    ],
  },
];

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { key: "hub", label: "허브", href: "/hub", icon: Home },
  { key: "calendar", label: "캘린더", href: "/calendar", icon: CalendarDays },
  { key: "todos", label: "To-Do", href: "/todos", icon: ClipboardList },
  { key: "expenses", label: "경비", href: "/expenses", icon: Banknote },
  { key: "settings", label: "설정", href: "/settings", icon: Settings },
];
