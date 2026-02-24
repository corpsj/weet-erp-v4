export type VaultEntry = {
  id: string;
  site_name: string;
  url: string | null;
  username: string;
  password_encrypted: string;
  iv: string;
  memo: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type VaultEntryInput = {
  site_name: string;
  url?: string;
  username: string;
  password?: string;
  memo?: string;
};
