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
    <header className="sticky top-0 z-20 mb-5 flex h-14 items-center gap-2 border-b border-[#2a2a2a] bg-[#0a0a0a] px-3 sm:px-4">
      <Button variant="ghost" className="md:hidden h-8 w-8 text-[#9a9a9a] hover:bg-[#1a1a1a] hover:text-[#ffffff]" onClick={onOpenMobileMenu}>
        <Menu className="h-4 w-4" />
      </Button>

      <Button variant="ghost" className="hidden md:inline-flex h-8 w-8 text-[#9a9a9a] hover:bg-[#1a1a1a] hover:text-[#ffffff]" onClick={onToggleSidebar}>
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>

      <div className="relative ml-1 max-w-[440px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
        <Input 
          className="pl-9 h-8 bg-[#141414] border-[#2a2a2a] text-[#ffffff] placeholder:text-[#9a9a9a] focus-visible:ring-1 focus-visible:ring-[#d4d4d4] focus-visible:ring-offset-0" 
          placeholder="통합 검색 (Phase 2)" 
        />
      </div>

      <div className="flex-1" />

      <Button 
        variant="outline" 
        onClick={handleLogout}
        className="h-8 border-[#2a2a2a] bg-[#141414] text-[#9a9a9a] hover:bg-[#1a1a1a] hover:text-[#ffffff]"
      >
        <LogOut className="mr-2 h-3.5 w-3.5" /> 로그아웃
      </Button>
    </header>
  );
}
