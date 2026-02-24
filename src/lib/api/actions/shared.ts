"use server";

import { createClient } from "@/lib/supabase/server";

export async function getActionContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  return { supabase, user };
}
