-- Organisation invitations for users who don't have a profile yet.
-- organisation_members.profile_id is NOT NULL, so it can only represent
-- someone who has already signed up. This table represents a pending
-- invite by email + role, independent of whether the invitee has an
-- account yet. accept_organisation_invitation() converts a matching
-- invitation into a real organisation_members row once the invitee is
-- authenticated (called right after signup / first login).
--
-- NOTE: this migration only creates the DB-side primitive. Sending the
-- actual invite email requires a Supabase Edge Function (to call an email
-- provider) which needs to be deployed against the live project — it is
-- not created here because this environment has no network path to
-- Supabase to deploy or test it. See AFRIOPS_PRODUCTION_READINESS.md.

create table if not exists public.organisation_invitations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  role public.organisation_role not null default 'member',
  invited_by uuid not null references public.profiles(id),
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz
);

-- One active *pending* invite per (org, email) — a case-insensitive
-- partial unique index rather than a plain table constraint, since email
-- comparisons throughout this migration are done via lower() rather than
-- relying on the citext extension (which needs a schema-search-path
-- assumption this repo can't verify against the live project, so it's
-- avoided entirely). Scoped to status = 'pending' so a revoked/expired/
-- accepted invite doesn't block sending a new one to the same address.
create unique index if not exists organisation_invitations_pending_email_unique
  on public.organisation_invitations (organisation_id, lower(email))
  where status = 'pending';

create index if not exists organisation_invitations_org_idx on public.organisation_invitations(organisation_id);
create index if not exists organisation_invitations_email_idx on public.organisation_invitations(lower(email));
create index if not exists organisation_invitations_token_idx on public.organisation_invitations(token);

alter table public.organisation_invitations enable row level security;

-- Only members who can manage members may view/create/revoke invitations
-- for their own organisation — reuses the same permission code the Team
-- page already gates the invite button on.
create policy "org members can view invitations for their org"
  on public.organisation_invitations for select
  using (public.has_permission(organisation_id, 'org.manage_members'));

create policy "org members can create invitations for their org"
  on public.organisation_invitations for insert
  with check (
    public.has_permission(organisation_id, 'org.manage_members')
    and invited_by = auth.uid()
  );

create policy "org members can revoke invitations for their org"
  on public.organisation_invitations for update
  using (public.has_permission(organisation_id, 'org.manage_members'))
  with check (public.has_permission(organisation_id, 'org.manage_members'));

-- Defensive: organisation_members was applied via an install script, not a
-- tracked migration, so its exact constraints aren't visible from this
-- repo. accept_organisation_invitation() below needs a uniqueness
-- guarantee on (organisation_id, profile_id) for its ON CONFLICT clause —
-- add it if it isn't already there, rather than assume.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organisation_members'::regclass
      and contype = 'u'
      and conkey = (
        select array_agg(attnum order by attnum) from pg_attribute
        where attrelid = 'public.organisation_members'::regclass
          and attname in ('organisation_id', 'profile_id')
      )
  ) then
    alter table public.organisation_members
      add constraint organisation_members_org_profile_unique unique (organisation_id, profile_id);
  end if;
end $$;

-- Accepts a pending invitation for the currently-authenticated user,
-- matching on token. Idempotent: re-calling with an already-accepted
-- token is a no-op rather than an error, so a double-click or a retried
-- network call can't create duplicate memberships or throw a confusing
-- error to the user.
create or replace function public.accept_organisation_invitation(p_token uuid)
returns table (organisation_id uuid, role public.organisation_role)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.organisation_invitations%rowtype;
  v_profile_email text;
begin
  select email into v_profile_email from public.profiles where id = auth.uid();
  if v_profile_email is null then
    raise exception 'no authenticated profile';
  end if;

  select * into v_invite
  from public.organisation_invitations
  where token = p_token
  for update;

  if not found then
    raise exception 'invitation not found';
  end if;

  if v_invite.status = 'accepted' then
    -- already accepted (possibly by this exact call, retried) — treat as success
    return query select v_invite.organisation_id, v_invite.role;
    return;
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'invitation is % and can no longer be accepted', v_invite.status;
  end if;

  if v_invite.expires_at < now() then
    update public.organisation_invitations set status = 'expired' where id = v_invite.id;
    raise exception 'invitation has expired';
  end if;

  if lower(v_invite.email::text) <> lower(v_profile_email::text) then
    raise exception 'this invitation was sent to a different email address';
  end if;

  insert into public.organisation_members (organisation_id, profile_id, role, invited_by, invited_at, joined_at)
  values (v_invite.organisation_id, auth.uid(), v_invite.role, v_invite.invited_by, v_invite.created_at, now())
  on conflict (organisation_id, profile_id) do update
    set role = excluded.role, joined_at = coalesce(public.organisation_members.joined_at, now());

  update public.organisation_invitations
    set status = 'accepted', accepted_at = now()
    where id = v_invite.id;

  return query select v_invite.organisation_id, v_invite.role;
end;
$$;

grant execute on function public.accept_organisation_invitation(uuid) to authenticated;
