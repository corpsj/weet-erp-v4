create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  username text not null unique,
  display_name text not null,
  job_title text,
  bio text,
  profile_color text not null default '#29d3ff',
  role text not null default 'user' check (role in ('admin', 'user')),
  status text not null default 'active' check (status in ('active', 'inactive', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signup_invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  code_encrypted text not null,
  iv text not null,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  memo text,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signup_invite_code_usages (
  id uuid primary key default gen_random_uuid(),
  invite_code_id uuid not null references public.signup_invite_codes (id) on delete cascade,
  user_id uuid not null references public.app_users (id) on delete cascade,
  used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.app_users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_menu_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  menu_key text not null,
  last_read_at timestamptz not null default now(),
  unique (user_id, menu_key)
);

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  parent_id uuid references public.todos (id) on delete cascade,
  assignee_id uuid references public.app_users (id) on delete set null,
  due_date date,
  memo text,
  sort_order integer,
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  color text not null default 'blue',
  memo text,
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_claims (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  used_date date not null,
  category text,
  memo text,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_receipts (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expense_claims (id) on delete cascade,
  file_path text not null,
  file_name text,
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.tax_invoices (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('sales', 'purchase')),
  issue_date date not null,
  supplier_name text not null,
  supplier_biz_no text,
  receiver_name text not null,
  receiver_biz_no text,
  supply_amount numeric(14, 2) not null check (supply_amount >= 0),
  tax_amount numeric(14, 2) not null check (tax_amount >= 0),
  total_amount numeric(14, 2) not null check (total_amount >= 0),
  description text,
  status text not null default 'issued' check (status in ('issued', 'cancelled')),
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_amount = supply_amount + tax_amount)
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date timestamptz not null,
  type text not null check (type in ('deposit', 'withdrawal')),
  amount numeric(14, 2) not null check (amount >= 0),
  description text,
  bank_name text,
  account_number text,
  balance_after numeric(14, 2),
  category text,
  relation_id uuid,
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.utility_bills (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  category text not null,
  billing_month date not null,
  amount numeric(14, 2) not null check (amount >= 0),
  image_path text,
  memo text,
  processing_status text not null default 'manual' check (processing_status in ('processed', 'manual', 'processing')),
  is_paid boolean not null default false,
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memo_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memos (
  id uuid primary key default gen_random_uuid(),
  title text,
  content text not null default '',
  folder_id uuid references public.memo_folders (id) on delete set null,
  is_pinned boolean not null default false,
  created_by uuid not null references public.app_users (id) on delete restrict,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memo_attachments (
  id uuid primary key default gen_random_uuid(),
  memo_id uuid not null references public.memos (id) on delete cascade,
  file_path text not null,
  file_name text,
  file_size bigint,
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.company_info_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  is_pinned boolean not null default false,
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vault_entries (
  id uuid primary key default gen_random_uuid(),
  site_name text not null,
  url text,
  username text,
  password_encrypted text not null,
  iv text not null,
  memo text,
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  classification text not null,
  item_name text not null,
  spec text,
  unit text,
  material_cost numeric(14, 2) not null default 0 check (material_cost >= 0),
  labor_cost numeric(14, 2) not null default 0 check (labor_cost >= 0),
  expense_cost numeric(14, 2) not null default 0 check (expense_cost >= 0),
  note text,
  reference text,
  sort_order integer,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (classification, item_name, spec, unit)
);

create table if not exists public.process_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  deleted_at timestamptz,
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.process_preset_items (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references public.process_presets (id) on delete cascade,
  cost_type text not null check (cost_type in ('material', 'labor', 'expense')),
  label text not null,
  unit text,
  quantity numeric(14, 3) not null default 1 check (quantity >= 0),
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  material_id uuid references public.materials (id) on delete set null,
  sort_order integer,
  created_at timestamptz not null default now()
);

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  overhead_type text not null default 'percentage' check (overhead_type in ('percentage', 'fixed')),
  overhead_value numeric(14, 2) not null default 0,
  profit_type text not null default 'percentage' check (profit_type in ('percentage', 'fixed')),
  profit_value numeric(14, 2) not null default 0,
  vat_rate numeric(5, 2) not null default 10 check (vat_rate >= 0),
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estimate_presets (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  preset_id uuid not null references public.process_presets (id) on delete cascade,
  quantity numeric(14, 3) not null default 1 check (quantity >= 0),
  sort_order integer,
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  cost_type text not null check (cost_type in ('material', 'labor', 'expense')),
  label text not null,
  quantity numeric(14, 3) not null default 1 check (quantity >= 0),
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  material_id uuid references public.materials (id) on delete set null,
  sort_order integer,
  created_at timestamptz not null default now()
);

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.app_users where id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create index if not exists idx_invite_codes_active on public.signup_invite_codes (is_active);
create index if not exists idx_invite_codes_expires_at on public.signup_invite_codes (expires_at);
create index if not exists idx_invite_code_usages_invite on public.signup_invite_code_usages (invite_code_id);
create index if not exists idx_invite_code_usages_user on public.signup_invite_code_usages (user_id);
create index if not exists idx_menu_reads_user_menu on public.user_menu_reads (user_id, menu_key);
create index if not exists idx_todos_parent_id on public.todos (parent_id);
create index if not exists idx_todos_assignee_id on public.todos (assignee_id);
create index if not exists idx_todos_status on public.todos (status);
create index if not exists idx_todos_due_date on public.todos (due_date);
create index if not exists idx_calendar_event_date on public.calendar_events (event_date);
create index if not exists idx_expense_claims_status on public.expense_claims (status);
create index if not exists idx_expense_claims_used_date on public.expense_claims (used_date);
create index if not exists idx_expense_receipts_expense_id on public.expense_receipts (expense_id);
create index if not exists idx_tax_invoices_type on public.tax_invoices (type);
create index if not exists idx_tax_invoices_issue_date on public.tax_invoices (issue_date);
create index if not exists idx_bank_transactions_date on public.bank_transactions (transaction_date);
create index if not exists idx_bank_transactions_type on public.bank_transactions (type);
create index if not exists idx_utility_bills_month on public.utility_bills (billing_month);
create index if not exists idx_utility_bills_status on public.utility_bills (processing_status);
create index if not exists idx_memos_folder_id on public.memos (folder_id);
create index if not exists idx_memos_deleted_at on public.memos (deleted_at);
create index if not exists idx_memo_attachments_memo_id on public.memo_attachments (memo_id);
create index if not exists idx_preset_items_preset_id on public.process_preset_items (preset_id);
create index if not exists idx_preset_items_material_id on public.process_preset_items (material_id);
create index if not exists idx_estimate_presets_estimate_id on public.estimate_presets (estimate_id);
create index if not exists idx_estimate_presets_preset_id on public.estimate_presets (preset_id);
create index if not exists idx_estimate_items_estimate_id on public.estimate_items (estimate_id);
create index if not exists idx_estimate_items_material_id on public.estimate_items (material_id);

alter table public.app_users enable row level security;
alter table public.signup_invite_codes enable row level security;
alter table public.signup_invite_code_usages enable row level security;
alter table public.app_settings enable row level security;
alter table public.user_menu_reads enable row level security;
alter table public.todos enable row level security;
alter table public.calendar_events enable row level security;
alter table public.expense_claims enable row level security;
alter table public.expense_receipts enable row level security;
alter table public.tax_invoices enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.utility_bills enable row level security;
alter table public.memo_folders enable row level security;
alter table public.memos enable row level security;
alter table public.memo_attachments enable row level security;
alter table public.company_info_cards enable row level security;
alter table public.vault_entries enable row level security;
alter table public.materials enable row level security;
alter table public.process_presets enable row level security;
alter table public.process_preset_items enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_presets enable row level security;
alter table public.estimate_items enable row level security;

drop policy if exists app_users_select_all on public.app_users;
create policy app_users_select_all on public.app_users
for select
using (auth.uid() is not null);

drop policy if exists app_users_insert_self on public.app_users;
create policy app_users_insert_self on public.app_users
for insert
with check (auth.uid() = id);

drop policy if exists app_users_update_self on public.app_users;
create policy app_users_update_self on public.app_users
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists signup_invite_codes_admin_crud on public.signup_invite_codes;
create policy signup_invite_codes_admin_crud on public.signup_invite_codes
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists signup_invite_codes_user_validate on public.signup_invite_codes;
create policy signup_invite_codes_user_validate on public.signup_invite_codes
for select
using (
  auth.uid() is not null
  and is_active = true
  and (expires_at is null or expires_at > now())
  and (max_uses is null or use_count < max_uses)
);

drop policy if exists invite_usage_admin_select on public.signup_invite_code_usages;
create policy invite_usage_admin_select on public.signup_invite_code_usages
for select
using (public.is_admin());

drop policy if exists invite_usage_insert_self on public.signup_invite_code_usages;
create policy invite_usage_insert_self on public.signup_invite_code_usages
for insert
with check (auth.uid() = user_id);

drop policy if exists app_settings_read_all on public.app_settings;
create policy app_settings_read_all on public.app_settings
for select
using (auth.uid() is not null);

drop policy if exists app_settings_write_admin on public.app_settings;
create policy app_settings_write_admin on public.app_settings
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists menu_reads_own on public.user_menu_reads;
create policy menu_reads_own on public.user_menu_reads
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists todos_read_all on public.todos;
create policy todos_read_all on public.todos
for select
using (auth.uid() is not null);

drop policy if exists todos_insert_own on public.todos;
create policy todos_insert_own on public.todos
for insert
with check (created_by = auth.uid());

drop policy if exists todos_update_own_or_admin on public.todos;
create policy todos_update_own_or_admin on public.todos
for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists todos_delete_own_or_admin on public.todos;
create policy todos_delete_own_or_admin on public.todos
for delete
using (created_by = auth.uid() or public.is_admin());

drop policy if exists calendar_events_read_all on public.calendar_events;
create policy calendar_events_read_all on public.calendar_events
for select
using (auth.uid() is not null);

drop policy if exists calendar_events_insert_own on public.calendar_events;
create policy calendar_events_insert_own on public.calendar_events
for insert
with check (created_by = auth.uid());

drop policy if exists calendar_events_update_own_or_admin on public.calendar_events;
create policy calendar_events_update_own_or_admin on public.calendar_events
for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists calendar_events_delete_own_or_admin on public.calendar_events;
create policy calendar_events_delete_own_or_admin on public.calendar_events
for delete
using (created_by = auth.uid() or public.is_admin());

drop policy if exists expense_claims_read_all on public.expense_claims;
create policy expense_claims_read_all on public.expense_claims
for select
using (auth.uid() is not null);

drop policy if exists expense_claims_insert_own on public.expense_claims;
create policy expense_claims_insert_own on public.expense_claims
for insert
with check (created_by = auth.uid());

drop policy if exists expense_claims_update_own_or_admin on public.expense_claims;
create policy expense_claims_update_own_or_admin on public.expense_claims
for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists expense_claims_delete_own_or_admin on public.expense_claims;
create policy expense_claims_delete_own_or_admin on public.expense_claims
for delete
using (created_by = auth.uid() or public.is_admin());

drop policy if exists expense_receipts_read_all on public.expense_receipts;
create policy expense_receipts_read_all on public.expense_receipts
for select
using (auth.uid() is not null);

drop policy if exists expense_receipts_insert_own on public.expense_receipts;
create policy expense_receipts_insert_own on public.expense_receipts
for insert
with check (created_by = auth.uid());

drop policy if exists expense_receipts_update_own_or_admin on public.expense_receipts;
create policy expense_receipts_update_own_or_admin on public.expense_receipts
for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists expense_receipts_delete_own_or_admin on public.expense_receipts;
create policy expense_receipts_delete_own_or_admin on public.expense_receipts
for delete
using (created_by = auth.uid() or public.is_admin());

drop policy if exists tax_invoices_read_all on public.tax_invoices;
create policy tax_invoices_read_all on public.tax_invoices
for select
using (auth.uid() is not null);

drop policy if exists tax_invoices_insert_own on public.tax_invoices;
create policy tax_invoices_insert_own on public.tax_invoices
for insert
with check (created_by = auth.uid());

drop policy if exists tax_invoices_update_own_or_admin on public.tax_invoices;
create policy tax_invoices_update_own_or_admin on public.tax_invoices
for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists tax_invoices_delete_own_or_admin on public.tax_invoices;
create policy tax_invoices_delete_own_or_admin on public.tax_invoices
for delete
using (created_by = auth.uid() or public.is_admin());

drop policy if exists bank_transactions_read_all on public.bank_transactions;
create policy bank_transactions_read_all on public.bank_transactions
for select
using (auth.uid() is not null);

drop policy if exists bank_transactions_insert_own on public.bank_transactions;
create policy bank_transactions_insert_own on public.bank_transactions
for insert
with check (created_by = auth.uid());

drop policy if exists bank_transactions_update_own_or_admin on public.bank_transactions;
create policy bank_transactions_update_own_or_admin on public.bank_transactions
for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists bank_transactions_delete_own_or_admin on public.bank_transactions;
create policy bank_transactions_delete_own_or_admin on public.bank_transactions
for delete
using (created_by = auth.uid() or public.is_admin());

drop policy if exists utility_bills_read_all on public.utility_bills;
create policy utility_bills_read_all on public.utility_bills
for select
using (auth.uid() is not null);

drop policy if exists utility_bills_insert_own on public.utility_bills;
create policy utility_bills_insert_own on public.utility_bills
for insert
with check (created_by = auth.uid());

drop policy if exists utility_bills_update_own_or_admin on public.utility_bills;
create policy utility_bills_update_own_or_admin on public.utility_bills
for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists utility_bills_delete_own_or_admin on public.utility_bills;
create policy utility_bills_delete_own_or_admin on public.utility_bills
for delete
using (created_by = auth.uid() or public.is_admin());

drop policy if exists memo_folders_read_all on public.memo_folders;
create policy memo_folders_read_all on public.memo_folders
for select
using (auth.uid() is not null);

drop policy if exists memo_folders_insert_own on public.memo_folders;
create policy memo_folders_insert_own on public.memo_folders
for insert
with check (created_by = auth.uid());

drop policy if exists memo_folders_update_own_or_admin on public.memo_folders;
create policy memo_folders_update_own_or_admin on public.memo_folders
for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists memo_folders_delete_own_or_admin on public.memo_folders;
create policy memo_folders_delete_own_or_admin on public.memo_folders
for delete
using (created_by = auth.uid() or public.is_admin());

drop policy if exists memos_read_all on public.memos;
create policy memos_read_all on public.memos
for select
using (auth.uid() is not null);

drop policy if exists memos_insert_own on public.memos;
create policy memos_insert_own on public.memos
for insert
with check (created_by = auth.uid());

drop policy if exists memos_update_own_or_admin on public.memos;
create policy memos_update_own_or_admin on public.memos
for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists memos_delete_own_or_admin on public.memos;
create policy memos_delete_own_or_admin on public.memos
for delete
using (created_by = auth.uid() or public.is_admin());

drop policy if exists memo_attachments_read_all on public.memo_attachments;
create policy memo_attachments_read_all on public.memo_attachments
for select
using (auth.uid() is not null);

drop policy if exists memo_attachments_insert_own on public.memo_attachments;
create policy memo_attachments_insert_own on public.memo_attachments
for insert
with check (created_by = auth.uid());

drop policy if exists memo_attachments_update_own_or_admin on public.memo_attachments;
create policy memo_attachments_update_own_or_admin on public.memo_attachments
for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists memo_attachments_delete_own_or_admin on public.memo_attachments;
create policy memo_attachments_delete_own_or_admin on public.memo_attachments
for delete
using (created_by = auth.uid() or public.is_admin());

drop policy if exists company_info_cards_read_all on public.company_info_cards;
create policy company_info_cards_read_all on public.company_info_cards
for select
using (auth.uid() is not null);

drop policy if exists company_info_cards_insert_own on public.company_info_cards;
create policy company_info_cards_insert_own on public.company_info_cards
for insert
with check (created_by = auth.uid());

drop policy if exists company_info_cards_update_own_or_admin on public.company_info_cards;
create policy company_info_cards_update_own_or_admin on public.company_info_cards
for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists company_info_cards_delete_own_or_admin on public.company_info_cards;
create policy company_info_cards_delete_own_or_admin on public.company_info_cards
for delete
using (created_by = auth.uid() or public.is_admin());

drop policy if exists vault_entries_read_all on public.vault_entries;
create policy vault_entries_read_all on public.vault_entries
for select
using (auth.uid() is not null);

drop policy if exists vault_entries_insert_own on public.vault_entries;
create policy vault_entries_insert_own on public.vault_entries
for insert
with check (created_by = auth.uid());

drop policy if exists vault_entries_update_own_or_admin on public.vault_entries;
create policy vault_entries_update_own_or_admin on public.vault_entries
for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists vault_entries_delete_own_or_admin on public.vault_entries;
create policy vault_entries_delete_own_or_admin on public.vault_entries
for delete
using (created_by = auth.uid() or public.is_admin());

drop policy if exists materials_read_all on public.materials;
create policy materials_read_all on public.materials
for select
using (auth.uid() is not null);

drop policy if exists materials_insert_own on public.materials;
create policy materials_insert_own on public.materials
for insert
with check (created_by = auth.uid() or (created_by is null and public.is_admin()));

drop policy if exists materials_update_own_or_admin on public.materials;
create policy materials_update_own_or_admin on public.materials
for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists materials_delete_own_or_admin on public.materials;
create policy materials_delete_own_or_admin on public.materials
for delete
using (created_by = auth.uid() or public.is_admin());

drop policy if exists process_presets_read_all on public.process_presets;
create policy process_presets_read_all on public.process_presets
for select
using (auth.uid() is not null);

drop policy if exists process_presets_insert_own on public.process_presets;
create policy process_presets_insert_own on public.process_presets
for insert
with check (created_by = auth.uid());

drop policy if exists process_presets_update_own_or_admin on public.process_presets;
create policy process_presets_update_own_or_admin on public.process_presets
for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists process_presets_delete_own_or_admin on public.process_presets;
create policy process_presets_delete_own_or_admin on public.process_presets
for delete
using (created_by = auth.uid() or public.is_admin());

drop policy if exists process_preset_items_read_all on public.process_preset_items;
create policy process_preset_items_read_all on public.process_preset_items
for select
using (auth.uid() is not null);

drop policy if exists process_preset_items_write_admin_or_preset_owner on public.process_preset_items;
create policy process_preset_items_write_admin_or_preset_owner on public.process_preset_items
for all
using (
  public.is_admin()
  or exists (
    select 1
    from public.process_presets p
    where p.id = preset_id
      and p.created_by = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.process_presets p
    where p.id = preset_id
      and p.created_by = auth.uid()
  )
);

drop policy if exists estimates_read_all on public.estimates;
create policy estimates_read_all on public.estimates
for select
using (auth.uid() is not null);

drop policy if exists estimates_insert_own on public.estimates;
create policy estimates_insert_own on public.estimates
for insert
with check (created_by = auth.uid());

drop policy if exists estimates_update_own_or_admin on public.estimates;
create policy estimates_update_own_or_admin on public.estimates
for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists estimates_delete_own_or_admin on public.estimates;
create policy estimates_delete_own_or_admin on public.estimates
for delete
using (created_by = auth.uid() or public.is_admin());

drop policy if exists estimate_presets_read_all on public.estimate_presets;
create policy estimate_presets_read_all on public.estimate_presets
for select
using (auth.uid() is not null);

drop policy if exists estimate_presets_write_admin_or_estimate_owner on public.estimate_presets;
create policy estimate_presets_write_admin_or_estimate_owner on public.estimate_presets
for all
using (
  public.is_admin()
  or exists (
    select 1
    from public.estimates e
    where e.id = estimate_id
      and e.created_by = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.estimates e
    where e.id = estimate_id
      and e.created_by = auth.uid()
  )
);

drop policy if exists estimate_items_read_all on public.estimate_items;
create policy estimate_items_read_all on public.estimate_items
for select
using (auth.uid() is not null);

drop policy if exists estimate_items_write_admin_or_estimate_owner on public.estimate_items;
create policy estimate_items_write_admin_or_estimate_owner on public.estimate_items
for all
using (
  public.is_admin()
  or exists (
    select 1
    from public.estimates e
    where e.id = estimate_id
      and e.created_by = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.estimates e
    where e.id = estimate_id
      and e.created_by = auth.uid()
  )
);

create trigger trg_app_users_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

create trigger trg_signup_invite_codes_updated_at
before update on public.signup_invite_codes
for each row execute function public.set_updated_at();

create trigger trg_app_settings_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

create trigger trg_todos_updated_at
before update on public.todos
for each row execute function public.set_updated_at();

create trigger trg_calendar_events_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

create trigger trg_expense_claims_updated_at
before update on public.expense_claims
for each row execute function public.set_updated_at();

create trigger trg_tax_invoices_updated_at
before update on public.tax_invoices
for each row execute function public.set_updated_at();

create trigger trg_bank_transactions_updated_at
before update on public.bank_transactions
for each row execute function public.set_updated_at();

create trigger trg_utility_bills_updated_at
before update on public.utility_bills
for each row execute function public.set_updated_at();

create trigger trg_memo_folders_updated_at
before update on public.memo_folders
for each row execute function public.set_updated_at();

create trigger trg_memos_updated_at
before update on public.memos
for each row execute function public.set_updated_at();

create trigger trg_company_info_cards_updated_at
before update on public.company_info_cards
for each row execute function public.set_updated_at();

create trigger trg_vault_entries_updated_at
before update on public.vault_entries
for each row execute function public.set_updated_at();

create trigger trg_materials_updated_at
before update on public.materials
for each row execute function public.set_updated_at();

create trigger trg_process_presets_updated_at
before update on public.process_presets
for each row execute function public.set_updated_at();

create trigger trg_estimates_updated_at
before update on public.estimates
for each row execute function public.set_updated_at();
