-- assets_update_member / assets_write_member only checked org membership.
-- assets.create / assets.edit permission codes already existed and were
-- correctly seeded (procurement_officer, finance excluded) but were never
-- wired into RLS. Any org member, including a viewer, could edit any asset.
-- Applied live and verified against pg_policies.

drop policy if exists assets_update_member on public.assets;
create policy assets_update_member
on public.assets
for update
using (
  is_org_member(organisation_id)
  and has_permission(organisation_id, 'assets.edit')
);

drop policy if exists assets_write_member on public.assets;
create policy assets_write_member
on public.assets
for insert
with check (
  is_org_member(organisation_id)
  and has_permission(organisation_id, 'assets.create')
);
