import { AuthShell } from "@/components/shared/auth-shell";
import { LoginForm } from "@/components/shared/login-form";

export default function LoginPage() {
  return (
    <AuthShell title="로그인" subtitle="WE-ET 내부 전용 시스템입니다.">
      <LoginForm />
    </AuthShell>
  );
}
