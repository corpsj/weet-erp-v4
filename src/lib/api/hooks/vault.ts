"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { VaultEntry } from "@/types/vault";

export function useVaultEntries() {
  return useQuery({
    queryKey: ["vault-entries"],
    staleTime: 1000 * 30,
    queryFn: async (): Promise<VaultEntry[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("vault_entries")
        .select("id, site_name, url, username, password_encrypted, iv, memo, created_by, created_at, updated_at")
        .order("site_name", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error("계정 공유 목록을 불러오지 못했습니다.");
      }

      return (data ?? []) as VaultEntry[];
    },
  });
}
