-- ============================================================================
-- Tenant isolation RLS test suite — AfriOps
-- ============================================================================
-- Run this against a Supabase branch, NOT production. Even though the whole
-- script is wrapped in one transaction that ROLLBACKs at the end (so it
-- never leaves test data behind even if run against prod by mistake), it
-- still creates two real auth.users rows for the duration of the run, which
-- production auth hooks/webhooks may react to. Use a branch:
--
--   1. In Claude or the Supabase dashboard: create a branch of this project
--   2. Run this file against the branch's connection string:
--        psql "$BRANCH_DB_URL" -f tenant_isolation_test.sql
--      or paste it into the branch's SQL editor
--   3. Read the NOTICE output — every line should say PASS
--
-- What this checks: that a member of Org A can never see, or write into,
-- Org B's rows on every org-scoped table in the schema — using the exact
-- mechanism the app itself relies on (PostgREST's request.jwt.claims,
-- which is what auth.uid() reads from under RLS), not a superuser bypass.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  org_a_id uuid;
  org_b_id uuid;
  user_a_id uuid := gen_random_uuid();
  user_b_id uuid := gen_random_uuid();
  site_a_id uuid;
  asset_a_id uuid;
  sp_a_id uuid;
  wo_a_id uuid;
  inv_a_id uuid;
  incident_a_id uuid;
  bu_a_id uuid;
  leaked_count int;
  test_count int := 0;
  pass_count int := 0;
BEGIN
  -- ---------- fixtures: two orgs, two users, one row per org-scoped table ----------

  INSERT INTO public.organisations (name, slug) VALUES ('RLS Test Org A', 'rls-test-org-a-' || substr(gen_random_uuid()::text, 1, 8)) RETURNING id INTO org_a_id;
  INSERT INTO public.organisations (name, slug) VALUES ('RLS Test Org B', 'rls-test-org-b-' || substr(gen_random_uuid()::text, 1, 8)) RETURNING id INTO org_b_id;

  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES
    (user_a_id, 'rls-test-a-' || user_a_id || '@example.invalid', crypt('x', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated'),
    (user_b_id, 'rls-test-b-' || user_b_id || '@example.invalid', crypt('x', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated');

  INSERT INTO public.profiles (id, full_name) VALUES (user_a_id, 'RLS Test A'), (user_b_id, 'RLS Test B');

  INSERT INTO public.organisation_members (organisation_id, profile_id, role, joined_at)
  VALUES (org_a_id, user_a_id, 'owner', now()), (org_b_id, user_b_id, 'owner', now());

  INSERT INTO public.business_units (organisation_id, name) VALUES (org_a_id, 'Org A Unit') RETURNING id INTO bu_a_id;
  INSERT INTO public.sites (organisation_id, business_unit_id, name) VALUES (org_a_id, bu_a_id, 'Org A Site') RETURNING id INTO site_a_id;
  INSERT INTO public.assets (organisation_id, site_id, asset_number) VALUES (org_a_id, site_a_id, 'RLS-A-001') RETURNING id INTO asset_a_id;
  INSERT INTO public.service_providers (organisation_id, trading_name, primary_type) VALUES (org_a_id, 'Org A Provider', 'workshop') RETURNING id INTO sp_a_id;
  INSERT INTO public.work_orders (organisation_id, asset_id, description) VALUES (org_a_id, asset_a_id, 'RLS test work order') RETURNING id INTO wo_a_id;
  INSERT INTO public.inventory_items (organisation_id, name) VALUES (org_a_id, 'RLS test part') RETURNING id INTO inv_a_id;
  INSERT INTO public.incidents (organisation_id, site_id, category, description) VALUES (org_a_id, site_a_id, 'other', 'RLS test incident') RETURNING id INTO incident_a_id;

  -- ---------- helper: run a query as a given user, count rows returned ----------
  -- set_config('request.jwt.claims', ...) is exactly what PostgREST sets on
  -- every API request, so this exercises the same RLS path the app hits —
  -- not a superuser bypass and not a hand-rolled approximation of it.

  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_b_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- ---------- assertions: Org B's user must see zero of Org A's rows ----------

  test_count := test_count + 1;
  SELECT count(*) INTO leaked_count FROM public.organisations WHERE id = org_a_id;
  IF leaked_count = 0 THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS  organisations:        Org B cannot see Org A''s organisation row'; ELSE RAISE NOTICE 'FAIL  organisations:        Org B can see Org A''s organisation row (%)', leaked_count; END IF;

  test_count := test_count + 1;
  SELECT count(*) INTO leaked_count FROM public.business_units WHERE organisation_id = org_a_id;
  IF leaked_count = 0 THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS  business_units:       leaked=0'; ELSE RAISE NOTICE 'FAIL  business_units:       leaked=%', leaked_count; END IF;

  test_count := test_count + 1;
  SELECT count(*) INTO leaked_count FROM public.sites WHERE organisation_id = org_a_id;
  IF leaked_count = 0 THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS  sites:                leaked=0'; ELSE RAISE NOTICE 'FAIL  sites:                leaked=%', leaked_count; END IF;

  test_count := test_count + 1;
  SELECT count(*) INTO leaked_count FROM public.assets WHERE organisation_id = org_a_id;
  IF leaked_count = 0 THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS  assets:               leaked=0'; ELSE RAISE NOTICE 'FAIL  assets:               leaked=%', leaked_count; END IF;

  test_count := test_count + 1;
  SELECT count(*) INTO leaked_count FROM public.service_providers WHERE organisation_id = org_a_id;
  IF leaked_count = 0 THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS  service_providers:    leaked=0'; ELSE RAISE NOTICE 'FAIL  service_providers:    leaked=%', leaked_count; END IF;

  test_count := test_count + 1;
  SELECT count(*) INTO leaked_count FROM public.work_orders WHERE organisation_id = org_a_id;
  IF leaked_count = 0 THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS  work_orders:          leaked=0'; ELSE RAISE NOTICE 'FAIL  work_orders:          leaked=%', leaked_count; END IF;

  test_count := test_count + 1;
  SELECT count(*) INTO leaked_count FROM public.inventory_items WHERE organisation_id = org_a_id;
  IF leaked_count = 0 THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS  inventory_items:      leaked=0'; ELSE RAISE NOTICE 'FAIL  inventory_items:      leaked=%', leaked_count; END IF;

  test_count := test_count + 1;
  SELECT count(*) INTO leaked_count FROM public.incidents WHERE organisation_id = org_a_id;
  IF leaked_count = 0 THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS  incidents:            leaked=0'; ELSE RAISE NOTICE 'FAIL  incidents:            leaked=%', leaked_count; END IF;

  test_count := test_count + 1;
  SELECT count(*) INTO leaked_count FROM public.organisation_members WHERE organisation_id = org_a_id;
  IF leaked_count = 0 THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS  organisation_members: leaked=0'; ELSE RAISE NOTICE 'FAIL  organisation_members: leaked=%', leaked_count; END IF;

  -- ---------- write-path checks: Org B's user must not be able to modify Org A's rows ----------

  test_count := test_count + 1;
  BEGIN
    UPDATE public.assets SET asset_number = 'HIJACKED' WHERE id = asset_a_id;
    GET DIAGNOSTICS leaked_count = ROW_COUNT;
    IF leaked_count = 0 THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS  assets UPDATE:        Org B update affected 0 rows of Org A''s asset'; ELSE RAISE NOTICE 'FAIL  assets UPDATE:        Org B updated % row(s) of Org A''s asset', leaked_count; END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    pass_count := pass_count + 1; RAISE NOTICE 'PASS  assets UPDATE:        rejected outright (insufficient_privilege)';
  END;

  test_count := test_count + 1;
  BEGIN
    DELETE FROM public.work_orders WHERE id = wo_a_id;
    GET DIAGNOSTICS leaked_count = ROW_COUNT;
    IF leaked_count = 0 THEN pass_count := pass_count + 1; RAISE NOTICE 'PASS  work_orders DELETE:   Org B delete affected 0 rows of Org A''s work order'; ELSE RAISE NOTICE 'FAIL  work_orders DELETE:   Org B deleted % row(s) of Org A''s work order', leaked_count; END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    pass_count := pass_count + 1; RAISE NOTICE 'PASS  work_orders DELETE:   rejected outright (insufficient_privilege)';
  END;

  test_count := test_count + 1;
  BEGIN
    INSERT INTO public.assets (organisation_id, site_id, asset_number) VALUES (org_a_id, site_a_id, 'FORGED-BY-B');
    RAISE NOTICE 'FAIL  assets INSERT:        Org B was able to insert a row into Org A''s organisation';
  EXCEPTION WHEN insufficient_privilege OR check_violation OR foreign_key_violation OR others THEN
    pass_count := pass_count + 1; RAISE NOTICE 'PASS  assets INSERT:        Org B blocked from inserting into Org A''s organisation';
  END;

  -- ---------- role_permissions sanity: confirm it's platform-global, not per-org ----------
  -- Documents the finding rather than asserting isolation that was never
  -- designed to exist here — role_permissions/permissions have no
  -- organisation_id column, so every org reads the same rows on purpose.
  -- If this ever regresses to per-org isolation being expected, this NOTICE
  -- is the tripwire to update.
  RAISE NOTICE 'INFO  role_permissions:     platform-global by design (no organisation_id column) — not a per-tenant isolation test';

  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'RESULT: % / % checks passed', pass_count, test_count;
  IF pass_count < test_count THEN
    RAISE EXCEPTION 'TENANT ISOLATION TEST FAILED — % of % checks did not pass, see FAIL lines above', (test_count - pass_count), test_count;
  END IF;
END $$;

ROLLBACK;
