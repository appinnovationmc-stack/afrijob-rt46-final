-- job_parts (billable parts on a job) insert/update/delete only checked
-- workshop membership -- any member, including one without workorders.edit,
-- could add/edit/delete billable parts on someone else's job. Gate on the
-- same permission jobs itself already uses.
--
-- job_photos delete had NO ownership or admin check at all -- any workshop
-- member could delete any other member's evidence photo (insert already
-- correctly required uploaded_by = self). Now requires own upload or
-- workshop admin.
--
-- compliance_documents update had NO ownership/admin gate -- any workshop
-- member could edit any other member's uploaded compliance doc (status,
-- expiry, etc). Now requires own upload or workshop admin, matching the
-- existing admin-only delete policy but also allowing self-edit.
-- Applied live and verified against pg_policies.

drop policy if exists job_parts_insert_member on public.job_parts;
create policy job_parts_insert_member on public.job_parts for insert
with check (exists (
  select 1 from jobs j join workshops w on w.id = j.workshop_id
  where j.id = job_parts.job_id
    and is_workshop_member(j.workshop_id)
    and has_permission(w.organisation_id, 'workorders.edit')
));

drop policy if exists job_parts_update_member on public.job_parts;
create policy job_parts_update_member on public.job_parts for update
using (exists (
  select 1 from jobs j join workshops w on w.id = j.workshop_id
  where j.id = job_parts.job_id
    and is_workshop_member(j.workshop_id)
    and has_permission(w.organisation_id, 'workorders.edit')
));

drop policy if exists job_parts_delete_member on public.job_parts;
create policy job_parts_delete_member on public.job_parts for delete
using (exists (
  select 1 from jobs j join workshops w on w.id = j.workshop_id
  where j.id = job_parts.job_id
    and is_workshop_member(j.workshop_id)
    and has_permission(w.organisation_id, 'workorders.edit')
));

drop policy if exists job_photos_delete_member on public.job_photos;
create policy job_photos_delete_member on public.job_photos for delete
using (exists (
  select 1 from jobs j
  where j.id = job_photos.job_id
    and (
      job_photos.uploaded_by = (select auth.uid())
      or is_workshop_admin(j.workshop_id)
    )
));

drop policy if exists compliance_documents_update_member on public.compliance_documents;
create policy compliance_documents_update_member on public.compliance_documents for update
using (
  is_workshop_admin(workshop_id)
  or uploaded_by = (select auth.uid())
);
