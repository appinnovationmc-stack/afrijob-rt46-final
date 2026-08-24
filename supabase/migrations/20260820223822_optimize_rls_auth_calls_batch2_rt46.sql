alter policy merchant_users_select on rt46.merchant_users
  using (rt46.is_admin() or (profile_id = (select auth.uid())));

alter policy vehicles_select_all on rt46.vehicles
  using ((select auth.uid()) is not null);

alter policy regions_select_all on rt46.regions
  using ((select auth.uid()) is not null);

alter policy parts_ref_select_all on rt46.parts_price_reference
  using ((select auth.uid()) is not null);

alter policy admins_select_self on rt46.admins
  using (profile_id = (select auth.uid()));

alter policy audit_log_admin_read on rt46.audit_log
  using (rt46.is_admin((select auth.uid())));

alter policy insurance_policies_admin_all on rt46.merchant_insurance_policies
  using (rt46.is_admin((select auth.uid())))
  with check (rt46.is_admin((select auth.uid())));

alter policy insurance_policies_merchant_insert on rt46.merchant_insurance_policies
  with check (exists (
    select 1 from rt46.merchant_users mu
    where mu.merchant_id = merchant_insurance_policies.merchant_id
      and mu.profile_id = (select auth.uid())
  ));

alter policy insurance_policies_merchant_read on rt46.merchant_insurance_policies
  using (exists (
    select 1 from rt46.merchant_users mu
    where mu.merchant_id = merchant_insurance_policies.merchant_id
      and mu.profile_id = (select auth.uid())
  ));

alter policy allocation_config_admin_all on rt46.allocation_config
  using (rt46.is_admin((select auth.uid())))
  with check (rt46.is_admin((select auth.uid())));

alter policy allocation_config_authenticated_read on rt46.allocation_config
  using ((select auth.uid()) is not null);

alter policy allocation_log_admin_read on rt46.allocation_log
  using (rt46.is_admin((select auth.uid())));

alter policy allocation_log_merchant_read_own on rt46.allocation_log
  using (exists (
    select 1 from rt46.merchant_users mu
    where mu.merchant_id = allocation_log.merchant_id
      and mu.profile_id = (select auth.uid())
  ));

alter policy "templates readable by authenticated" on rt46.quality_checklist_templates
  using ((select auth.role()) = 'authenticated');

alter policy "sla targets readable by authenticated" on rt46.sla_targets
  using ((select auth.role()) = 'authenticated');
