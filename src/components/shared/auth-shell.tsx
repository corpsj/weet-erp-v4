import { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <section className="glass relative z-10 w-full max-w-md rounded-3xl p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-ink-muted)]">WE-ET ERP V4</p>
        <h1 className="display-font mt-2 text-3xl font-semibold text-[var(--color-ink)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </section>
    </div>
  );
}
