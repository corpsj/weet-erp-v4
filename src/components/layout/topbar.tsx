"use client";

import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fetchApi } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TopBarProps = {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileMenu: () => void;
};

export function TopBar({ collapsed, onToggleSidebar, onOpenMobileMenu }: TopBarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetchApi("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      toast.error("로그아웃에 실패했습니다.");
    }
  };

  return (
    <header className="glass sticky top-0 z-20 mb-5 flex h-16 items-center gap-2 rounded-2xl px-3 sm:px-4">
      <Button variant="ghost" className="md:hidden" onClick={onOpenMobileMenu}>
        <Menu className="h-4 w-4" />
      </Button>

      <Button variant="ghost" className="hidden md:inline-flex" onClick={onToggleSidebar}>
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>

      <div className="relative ml-1 max-w-[440px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]" />
        <Input className="pl-9" placeholder="통합 검색 (Phase 2)" />
      </div>

      <Button variant="outline" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" /> 로그아웃
      </Button>
    </header>
  );
}
