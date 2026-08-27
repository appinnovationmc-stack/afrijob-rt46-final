-- Fleet trip integrity: one active trip per vehicle.
-- Existing data is preserved; the partial unique index only constrains
-- future and current in_progress rows and prevents concurrent duplicate
-- active trips that UI-only guards cannot reliably prevent.
create unique index if not exists trips_one_active_per_asset_idx
  on public.trips (asset_id)
  where status = 'in_progress';

comment on index public.trips_one_active_per_asset_idx is
  'Prevents more than one in-progress trip for the same asset.';
