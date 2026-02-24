"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TodoAssignee } from "@/types/todo";

export function useAppUsers() {
  return useQuery({
    queryKey: ["app-users"],
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<TodoAssignee[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("app_users")
        .select("id, username, display_name, profile_color")
        .order("display_name", { ascending: true });

      if (error) {
        throw new Error("사용자 목록을 불러오지 못했습니다.");
      }

      return (data ?? []).map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        profileColor: user.profile_color,
      }));
    },
  });
}
