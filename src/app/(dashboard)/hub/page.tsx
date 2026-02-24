import { ModuleShell } from "@/components/layout/module-shell";
import { HubDashboard } from "@/components/modules/hub/hub-dashboard";

export default function HubPage() {
  return (
    <ModuleShell
      title="허브"
      description="핵심 지표와 빠른 실행을 한 화면에서 확인합니다."
      breadcrumb={[{ label: "워크스페이스" }, { label: "허브" }]}
    >
      <HubDashboard />
    </ModuleShell>
  );
}
