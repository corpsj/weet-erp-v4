import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";

type ModuleShellProps = {
  title: string;
  description: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  children?: ReactNode;
  status?: "ready" | "soon";
};

export function ModuleShell({
  title,
  description,
  breadcrumb,
  children,
  status = "ready",
}: ModuleShellProps) {
  return (
    <section className="animate-[fade-up_420ms_ease-out]">
      <PageHeader title={title} description={description} breadcrumb={breadcrumb} />
      <Card className="grid-noise">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-[var(--color-ink-muted)]">Phase 1 기반 화면</p>
          <Badge tone={status === "soon" ? "warning" : "brand"}>
            {status === "soon" ? "출시 예정" : "기반 완료"}
          </Badge>
        </div>
        {children ?? (
          <p className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
            이 모듈은 화면 골격, 네비게이션, 인증 및 데이터 접근 패턴이 연결되어 있습니다.
          </p>
        )}
      </Card>
    </section>
  );
}
