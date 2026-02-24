"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { InviteCodeRecord, SettingsProfile } from "@/types/settings";

const DEFAULT_AI_MODEL = "google/gemini-2.5-flash";

export function useMySettingsProfile() {
  return useQuery({
    queryKey: ["settings-my-profile"],
    staleTime: 1000 * 60,
    queryFn: async (): Promise<SettingsProfile> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("로그인이 필요합니다.");
      }

      const { data, error } = await supabase
        .from("app_users")
        .select("id, username, email, display_name, job_title, bio, profile_color, role, status")
        .eq("id", user.id)
        .single();

      if (error || !data) {
        throw new Error("프로필 정보를 불러오지 못했습니다.");
      }

      return data as SettingsProfile;
    },
  });
}

export function useInviteCodes() {
  return useQuery({
    queryKey: ["settings-invite-codes"],
    queryFn: async (): Promise<InviteCodeRecord[]> => {
      const supabase = createClient();
      const { data: inviteCodes, error: inviteError } = await supabase
        .from("signup_invite_codes")
        .select("id, code_hash, code_encrypted, iv, max_uses, use_count, expires_at, is_active, memo, created_by, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (inviteError) {
        throw new Error("초대코드 목록을 불러오지 못했습니다.");
      }

      const ids = (inviteCodes ?? []).map((code) => code.id);
      let lastUsedMap = new Map<string, string>();

      if (ids.length > 0) {
        const { data: usages } = await supabase
          .from("signup_invite_code_usages")
          .select("invite_code_id, used_at")
          .in("invite_code_id", ids)
          .order("used_at", { ascending: false });

        lastUsedMap = new Map<string, string>();
        (usages ?? []).forEach((usage) => {
          if (!lastUsedMap.has(usage.invite_code_id)) {
            lastUsedMap.set(usage.invite_code_id, usage.used_at);
          }
        });
      }

      return (inviteCodes ?? []).map((code) => ({
        ...(code as Omit<InviteCodeRecord, "last_used_at">),
        last_used_at: lastUsedMap.get(code.id) ?? null,
      }));
    },
  });
}

export function useSettingsUsers() {
  return useQuery({
    queryKey: ["settings-users"],
    staleTime: 1000 * 60,
    queryFn: async (): Promise<SettingsProfile[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("app_users")
        .select("id, username, email, display_name, job_title, bio, profile_color, role, status")
        .order("display_name", { ascending: true });

      if (error) {
        throw new Error("사용자 목록을 불러오지 못했습니다.");
      }

      return (data ?? []) as SettingsProfile[];
    },
  });
}

export function useAiModelSetting() {
  return useQuery({
    queryKey: ["settings-ai-model"],
    staleTime: 1000 * 30,
    queryFn: async (): Promise<string> => {
      const supabase = createClient();
      const { data } = await supabase.from("app_settings").select("value").eq("key", "ai_model").maybeSingle();

      const value = data?.value;
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
      if (value && typeof value === "object") {
        const model = (value as Record<string, unknown>).model;
        if (typeof model === "string" && model.trim()) {
          return model.trim();
        }
      }
      return DEFAULT_AI_MODEL;
    },
  });
}
