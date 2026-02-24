import { ModuleShell } from "@/components/layout/module-shell";
import { CalendarWorkspace } from "@/components/modules/calendar/calendar-workspace";

export default function CalendarPage() {
  return (
    <ModuleShell
      title="캘린더"
      description="팀 공용 일정의 월간 뷰와 일정 CRUD를 위한 기본 구조입니다."
      breadcrumb={[{ label: "워크스페이스" }, { label: "캘린더" }]}
    >
      <CalendarWorkspace />
    </ModuleShell>
  );
}
