-- Wrap direct auth.uid()/auth.role() calls in (select ...) so Postgres evaluates
-- them once per query instead of once per row. Pure perf fix, no logic change.

alter policy profiles_select_own_or_workshop on public.profiles
  using ((id = (select auth.uid())) or (exists (
    select 1 from workshop_members wm1
    join workshop_members wm2 on wm1.workshop_id = wm2.workshop_id
    where wm1.profile_id = (select auth.uid()) and wm2.profile_id = profiles.id
  )));

alter policy profiles_update_own on public.profiles
  using (id = (select auth.uid()));

alter policy profiles_insert_own on public.profiles
  with check (id = (select auth.uid()));

alter policy workshops_insert_self_owner on public.workshops
  with check (owner_id = (select auth.uid()));

alter policy workshops_delete_owner on public.workshops
  using (owner_id = (select auth.uid()));

alter policy workshop_members_delete_admin on public.workshop_members
  using (is_workshop_admin(workshop_id) or (profile_id = (select auth.uid())));

alter policy jobs_insert_member on public.jobs
  with check (is_workshop_member(workshop_id) and (created_by = (select auth.uid())));

alter policy job_photos_insert_member on public.job_photos
  with check ((exists (
    select 1 from jobs j where j.id = job_photos.job_id and is_workshop_member(j.workshop_id)
  )) and (uploaded_by = (select auth.uid())));

alter policy compliance_documents_insert_member on public.compliance_documents
  with check (is_workshop_member(workshop_id) and (uploaded_by = (select auth.uid())));

alter policy incidents_update on public.incidents
  using (
    has_permission(organisation_id, 'incidents.manage')
    or (has_permission(organisation_id, 'incidents.report')
        and (reported_by = (select auth.uid()))
        and (status = 'reported'))
  );

alter policy notifications_select_own on public.notifications
  using (recipient_profile_id = (select auth.uid()));

alter policy notifications_update_own on public.notifications
  using (recipient_profile_id = (select auth.uid()));

alter policy notifications_delete_own on public.notifications
  using (recipient_profile_id = (select auth.uid()));

alter policy notification_preferences_select_own on public.notification_preferences
  using (profile_id = (select auth.uid()));

alter policy notification_preferences_update_own on public.notification_preferences
  using (profile_id = (select auth.uid()));

alter policy notification_preferences_delete_own on public.notification_preferences
  using (profile_id = (select auth.uid()));

alter policy notification_preferences_upsert_own on public.notification_preferences
  with check (profile_id = (select auth.uid()));

alter policy "org members can create invitations for their org" on public.organisation_invitations
  with check (has_permission(organisation_id, 'org.manage_members') and (invited_by = (select auth.uid())));
