-- Supabase auto-grants anon an explicit EXECUTE grant on function creation,
-- separate from the PUBLIC pseudo-role, so the public-level revoke in
-- harden_role_permission_audit_function alone left anon's direct grant
-- intact. Revoking it explicitly here, matching the pattern already applied
-- to other trigger functions in this codebase.

revoke execute on function public.log_role_permission_change() from anon;
