import { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserWithProfile } from "@/lib/supabase/auth";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUserWithProfile();

  return (
    <AppShell username={user.displayName || user.username} role={user.role}>
      {children}
    </AppShell>
  );
}
