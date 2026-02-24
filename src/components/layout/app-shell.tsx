"use client";

import { ReactNode, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MenuReadTracker } from "@/components/layout/menu-read-tracker";

type AppShellProps = {
  children: ReactNode;
  username: string;
  role: string;
};

export function AppShell({ children, username, role }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen p-2 md:p-4">
      <MenuReadTracker />
      <div className="flex h-[calc(100vh-1rem)] gap-3 md:h-[calc(100vh-2rem)] md:gap-4">
        <div className="hidden md:block">
          <Sidebar collapsed={collapsed} username={username} role={role} />
        </div>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-[rgb(10_10_10/72%)]"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative h-full w-[84%] max-w-[320px]">
              <Sidebar
                collapsed={false}
                username={username}
                role={role}
                onNavigate={() => setMobileMenuOpen(false)}
              />
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1 overflow-auto pb-20 md:pb-0">
          <TopBar
            collapsed={collapsed}
            onToggleSidebar={() => setCollapsed((prev) => !prev)}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />
          <main className="px-1 pb-2 sm:px-2">{children}</main>
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}
