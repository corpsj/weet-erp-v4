"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/lib/api/client";

const SAVED_USERNAME_KEY = "weet.erp.saved.username";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberUsername, setRememberUsername] = useState(true);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem(SAVED_USERNAME_KEY);
    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsPending(true);

    try {
      await fetchApi("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password, rememberUsername }),
      });

      if (rememberUsername) {
        localStorage.setItem(SAVED_USERNAME_KEY, username.trim());
      } else {
        localStorage.removeItem(SAVED_USERNAME_KEY);
      }

      toast.success("로그인되었습니다.");
      router.push("/hub");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "로그인에 실패했습니다.";
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1.5 block text-sm text-[var(--color-ink-muted)]" htmlFor="username">
          아이디
        </label>
        <Input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="예: manager"
          autoComplete="username"
          required
        />
        <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">로그인 계정은 {`{아이디}@we-et.com`} 형식입니다.</p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm text-[var(--color-ink-muted)]" htmlFor="password">
          비밀번호
        </label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
        <input
          type="checkbox"
          checked={rememberUsername}
          onChange={(event) => setRememberUsername(event.target.checked)}
          className="h-4 w-4 rounded border-[var(--color-line-2)] bg-transparent"
        />
        아이디 기억
      </label>

      <Button className="w-full" disabled={isPending}>
        {isPending ? "로그인 중..." : "로그인"}
      </Button>

      <p className="text-center text-sm text-[var(--color-ink-muted)]">
        초대코드가 있으신가요?{" "}
        <Link href="/signup" className="font-semibold text-[var(--color-brand)] hover:underline">
          회원가입
        </Link>
      </p>
    </form>
  );
}
