export type SettingsProfile = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  job_title: string | null;
  bio: string | null;
  profile_color: string;
  role: "admin" | "user";
  status: "active" | "inactive" | "pending";
};

export type InviteCodeRecord = {
  id: string;
  code_hash: string;
  code_encrypted: string;
  iv: string;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  is_active: boolean;
  memo: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

export type AiModelOption = {
  value: string;
  label: string;
};
