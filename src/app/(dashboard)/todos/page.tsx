import { ModuleShell } from "@/components/layout/module-shell";
import { TodosWorkspace } from "@/components/modules/todos/todos-workspace";

export default function TodosPage() {
  return (
    <ModuleShell
      title="To-Do"
      description="계층형 작업과 보드/리스트/그리드 뷰를 담을 모듈 기반을 구성했습니다."
      breadcrumb={[{ label: "워크스페이스" }, { label: "To-Do" }]}
    >
      <TodosWorkspace />
    </ModuleShell>
  );
}
