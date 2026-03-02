import { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";

type ModuleShellProps = {
  title: string;
  description: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  children?: ReactNode;
};

export function ModuleShell({
  title,
  description,
  breadcrumb,
  children,
}: ModuleShellProps) {
  return (
    <section className="animate-[fade-up_300ms_ease-out] w-full max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-6">
      <PageHeader title={title} description={description} breadcrumb={breadcrumb} />
      <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] shadow-sm">
        <div className="p-6">
          {children ?? (
            <p className="text-sm leading-relaxed text-[#9a9a9a]">
              이 모듈은 화면 골격, 네비게이션, 인증 및 데이터 접근 패턴이 연결되어 있습니다.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
