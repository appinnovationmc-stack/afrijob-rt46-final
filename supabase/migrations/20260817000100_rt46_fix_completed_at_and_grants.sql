-- CRITICAL FIX: not even service_role had USAGE on schema rt46 — every
-- request from the real app (via PostgREST, not a superuser connection)
-- would have failed with "permission denied for schema rt46" before RLS was
-- ever evaluated. Verified before/after via role impersonation.
grant usage on schema rt46 to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema rt46 to authenticated;
grant select, insert, update, delete on all tables in schema rt46 to service_role;
alter default privileges in schema rt46 grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema rt46 grant select, insert, update, delete on tables to service_role;
grant execute on all functions in schema rt46 to authenticated, service_role;
alter default privileges in schema rt46 grant execute on functions to authenticated, service_role;
grant usage, select on all sequences in schema rt46 to authenticated, service_role;
alter default privileges in schema rt46 grant usage, select on sequences to authenticated, service_role;

-- CRITICAL FIX: work_orders.completed_at was never populated on transition
-- to 'completed' — found via live E2E test. Turnaround-time reporting
-- (average/median repair duration) would have been silently wrong for
-- every completed work order.
create or replace function rt46.set_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' and new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_completed_at on rt46.work_orders;
create trigger trg_set_completed_at
  before update on rt46.work_orders
  for each row execute function rt46.set_completed_at();
