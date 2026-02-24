-- Change profile_color default from Tesla cyan to Grok gray
alter table public.app_users alter column profile_color set default '#d4d4d4';
