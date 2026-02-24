import { ModuleShell } from "@/components/layout/module-shell";
import { UtilitiesWorkspace } from "@/components/modules/utilities/utilities-workspace";

export default function UtilitiesPage() {
  return (
    <ModuleShell
      title="공과금"
      description="고지서 업로드, AI 분석, 납부 상태 추적을 위한 구조를 준비했습니다."
      breadcrumb={[{ label: "재무/회계" }, { label: "공과금" }]}
    >
      <UtilitiesWorkspace />
    </ModuleShell>
  );
}
