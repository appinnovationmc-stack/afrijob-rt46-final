-- Static/live-contract checks for the P0 audit hardening migration.
-- Run in a privileged Supabase SQL test session after migrations are applied.

DO $$
DECLARE
  trigger_count integer;
  policy_count integer;
  permission_count integer;
BEGIN
  SELECT count(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
    AND trigger_name IN ('audit_work_orders', 'audit_assets', 'audit_service_providers', 'audit_incidents')
    AND event_manipulation = 'DELETE';

  IF trigger_count <> 4 THEN
    RAISE EXCEPTION 'Expected semantic DELETE coverage on 4 audit triggers, found %', trigger_count;
  END IF;

  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'audit_log'
    AND policyname = 'roles with audit view can view audit log';

  IF policy_count <> 1 THEN
    RAISE EXCEPTION 'Expected dedicated audit_log read policy';
  END IF;

  SELECT count(*) INTO permission_count
  FROM public.role_permissions
  WHERE permission_code = 'audit.view'
    AND granted = true
    AND role IN ('owner', 'admin', 'manager', 'supervisor', 'operations_manager');

  IF permission_count <> 5 THEN
    RAISE EXCEPTION 'Expected audit.view for 5 operational roles, found %', permission_count;
  END IF;
END $$;
