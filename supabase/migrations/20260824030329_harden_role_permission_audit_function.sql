-- Apply the same hardening pattern already used elsewhere in the codebase
-- (pinned search_path, SECURITY DEFINER) to the new role_permissions audit
-- trigger function, matching harden_function_privileges_and_search_path.

alter function public.log_role_permission_change() set search_path = 'public';

revoke all on function public.log_role_permission_change() from public;
grant execute on function public.log_role_permission_change() to authenticated;
