insert into storage.buckets (id, name, public)
values ('rt46-evidence', 'rt46-evidence', false)
on conflict (id) do nothing;

-- path convention: {merchant_id}/{work_order_id}/{filename}
create policy "rt46 evidence admin read" on storage.objects
  for select using (bucket_id = 'rt46-evidence' and rt46.is_admin());

create policy "rt46 evidence merchant read own" on storage.objects
  for select using (
    bucket_id = 'rt46-evidence'
    and rt46.is_merchant_staff((split_part(name, '/', 1))::uuid)
  );

create policy "rt46 evidence merchant upload own" on storage.objects
  for insert with check (
    bucket_id = 'rt46-evidence'
    and rt46.is_merchant_staff((split_part(name, '/', 1))::uuid)
  );

create policy "rt46 evidence admin upload" on storage.objects
  for insert with check (bucket_id = 'rt46-evidence' and rt46.is_admin());
