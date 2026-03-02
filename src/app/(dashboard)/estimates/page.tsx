import { ModuleShell } from "@/components/layout/module-shell";

export default function EstimatesPage() {
  return (
    <ModuleShell
      title="견적 시스템"
      description="자재/프리셋/견적 테이블은 준비되었고 UI 포팅은 다음 단계에서 진행됩니다."
      breadcrumb={[{ label: "견적" }, { label: "견적 시스템" }]}
    />
  );
}
