-- AI Generated Images: persistent storage for AI-generated images
create table if not exists public.ai_generated_images (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  file_path text not null,
  text_content text,
  model text not null check (model in ('flash', 'pro')),
  aspect_ratio text not null,
  image_size text not null check (image_size in ('1K', '2K', '4K')),
  mode text not null check (mode in ('generate', 'edit')),
  is_starred boolean not null default false,
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_generated_images_created_by on public.ai_generated_images (created_by);
create index if not exists idx_ai_generated_images_created_at on public.ai_generated_images (created_at);
create index if not exists idx_ai_generated_images_model on public.ai_generated_images (model);
create index if not exists idx_ai_generated_images_is_starred on public.ai_generated_images (is_starred);

alter table public.ai_generated_images enable row level security;

drop policy if exists ai_generated_images_read_all on public.ai_generated_images;
create policy ai_generated_images_read_all on public.ai_generated_images
for select
using (auth.uid() is not null);

drop policy if exists ai_generated_images_insert_own on public.ai_generated_images;
create policy ai_generated_images_insert_own on public.ai_generated_images
for insert
with check (created_by = auth.uid());

drop policy if exists ai_generated_images_update_own_or_admin on public.ai_generated_images;
create policy ai_generated_images_update_own_or_admin on public.ai_generated_images
for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists ai_generated_images_delete_own_or_admin on public.ai_generated_images;
create policy ai_generated_images_delete_own_or_admin on public.ai_generated_images
for delete
using (created_by = auth.uid() or public.is_admin());

create trigger trg_ai_generated_images_updated_at
before update on public.ai_generated_images
for each row execute function public.set_updated_at();
