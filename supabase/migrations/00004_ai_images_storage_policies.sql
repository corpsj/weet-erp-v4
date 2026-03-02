create policy ai_images_storage_insert on storage.objects
for insert
with check (
  bucket_id = 'ai-images'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy ai_images_storage_select on storage.objects
for select
using (
  bucket_id = 'ai-images'
  and auth.uid() is not null
);

create policy ai_images_storage_delete on storage.objects
for delete
using (
  bucket_id = 'ai-images'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);
