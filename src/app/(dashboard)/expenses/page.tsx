import { ModuleShell } from "@/components/layout/module-shell";
import { ExpensesWorkspace } from "@/components/modules/expenses/expenses-workspace";

export default function ExpensesPage() {
  return (
    <ModuleShell
      title="경비 청구"
      description="경비 등록, 상태 관리, 영수증 증빙을 위한 재무 모듈 기반입니다."
      breadcrumb={[{ label: "재무/회계" }, { label: "경비 청구" }]}
    >
      <ExpensesWorkspace />
    </ModuleShell>
  );
}
