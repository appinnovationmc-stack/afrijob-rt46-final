-- Global search across the organisation. SECURITY INVOKER (the default
-- for SQL functions unless declared otherwise) means this runs with the
-- calling user's own privileges, so each underlying table's existing RLS
-- policies apply exactly as if the query were issued directly against that
-- table — no cross-tenant bypass, no separate permission model to keep in
-- sync with RLS. No explicit organisation_id filter needed for the same
-- reason: RLS already scopes every row to what auth.uid() can see.
create or replace function public.global_search(p_query text, p_limit int default 8)
returns table (
  entity_type text,
  entity_id uuid,
  title text,
  subtitle text
)
language sql
security invoker
stable
as $function$
  (
    select 'asset'::text, a.id, coalesce(a.registration, a.asset_number), a.asset_number
    from assets a
    where a.asset_number ilike '%' || p_query || '%' or a.registration ilike '%' || p_query || '%'
    order by a.asset_number
    limit p_limit
  )
  union all
  (
    select 'work_order'::text, w.id, coalesce(w.description, w.category::text), w.category::text
    from work_orders w
    where w.description ilike '%' || p_query || '%' or w.category::text ilike '%' || p_query || '%'
    order by w.created_at desc
    limit p_limit
  )
  union all
  (
    select 'incident'::text, i.id, coalesce(i.description, i.category::text), i.category::text
    from incidents i
    where i.description ilike '%' || p_query || '%' or i.category::text ilike '%' || p_query || '%'
    order by i.occurred_at desc
    limit p_limit
  )
  union all
  (
    select 'supplier'::text, s.id, coalesce(s.trading_name, s.legal_name), s.legal_name
    from suppliers s
    where s.trading_name ilike '%' || p_query || '%' or s.legal_name ilike '%' || p_query || '%'
    order by s.trading_name
    limit p_limit
  )
  union all
  (
    select 'service_provider'::text, sp.id, coalesce(sp.trading_name, sp.legal_name), sp.legal_name
    from service_providers sp
    where sp.trading_name ilike '%' || p_query || '%' or sp.legal_name ilike '%' || p_query || '%'
    order by sp.trading_name
    limit p_limit
  )
  union all
  (
    select 'document'::text, d.id, d.doc_type, d.entity_type
    from document_vault d
    where d.doc_type ilike '%' || p_query || '%'
    order by d.created_at desc
    limit p_limit
  )
$function$;

revoke all on function public.global_search(text, int) from public;
grant execute on function public.global_search(text, int) to authenticated;
