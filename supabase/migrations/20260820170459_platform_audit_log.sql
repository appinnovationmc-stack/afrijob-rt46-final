-- Platform-wide audit log for AfriOps organisation-scoped mutations.
--
-- Distinct from rt46.audit_log (which exists, has RLS, and a working
-- log_audit() helper, but zero rows and zero callers anywhere in the
-- database as of this migration -- it predates the multi-tenant
-- organisation model and has no organisation_id column, so it can't
-- represent an org-scoped event). Left untouched rather than migrated,
-- in case anything still references it by name later.
--
-- This table captures: role changes on organisation_members, invitation
-- lifecycle events on organisation_invitations, and changes to
-- organisations.enabled_modules / organisations.settings -- via triggers,
-- so it catches writes made through the SQL editor or a direct DB
-- connection, not just ones that go through app-layer RPCs.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_profile_id uuid references public.profiles(id),
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_org_idx on public.audit_log(organisation_id, created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log(entity_type, entity_id);

alter table public.audit_log enable row level security;

create policy "org members can view audit log for their org"
  on public.audit_log for select
  using (public.has_permission(organisation_id, 'org.manage_members'));

create or replace function public.log_audit(
  p_organisation_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_actor uuid default auth.uid(),
  p_before jsonb default null,
  p_after jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.audit_log (organisation_id, entity_type, entity_id, action, actor_profile_id, before_data, after_data, metadata)
  values (p_organisation_id, p_entity_type, p_entity_id, p_action, p_actor, p_before, p_after, p_metadata)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.log_audit(uuid, text, uuid, text, uuid, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.trg_audit_organisation_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(new.organisation_id, 'organisation_member', new.id, 'member_added', auth.uid(), null, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      perform public.log_audit(new.organisation_id, 'organisation_member', new.id, 'role_changed', auth.uid(), to_jsonb(old), to_jsonb(new));
    end if;
  elsif tg_op = 'DELETE' then
    perform public.log_audit(old.organisation_id, 'organisation_member', old.id, 'member_removed', auth.uid(), to_jsonb(old), null);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_organisation_members on public.organisation_members;
create trigger audit_organisation_members
  after insert or update or delete on public.organisation_members
  for each row execute function public.trg_audit_organisation_members();

create or replace function public.trg_audit_organisation_invitations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(new.organisation_id, 'organisation_invitation', new.id, 'invitation_created', auth.uid(), null, to_jsonb(new) - 'token');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.log_audit(new.organisation_id, 'organisation_invitation', new.id, 'invitation_' || new.status, auth.uid(), to_jsonb(old) - 'token', to_jsonb(new) - 'token');
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_organisation_invitations on public.organisation_invitations;
create trigger audit_organisation_invitations
  after insert or update on public.organisation_invitations
  for each row execute function public.trg_audit_organisation_invitations();

create or replace function public.trg_audit_organisations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.enabled_modules is distinct from old.enabled_modules or new.settings is distinct from old.settings then
    perform public.log_audit(
      new.id, 'organisation', new.id, 'settings_changed', auth.uid(),
      jsonb_build_object('enabled_modules', old.enabled_modules, 'settings', old.settings),
      jsonb_build_object('enabled_modules', new.enabled_modules, 'settings', new.settings)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_organisations on public.organisations;
create trigger audit_organisations
  after update on public.organisations
  for each row execute function public.trg_audit_organisations();
