import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function getCurrentUserWithProfile() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("app_users")
    .select("id, username, email, display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    username: profile?.username ?? user.email?.replace("@we-et.com", "") ?? "",
    email: user.email ?? "",
    displayName: profile?.display_name ?? profile?.username ?? "사용자",
    role: profile?.role ?? "user",
  };
}
