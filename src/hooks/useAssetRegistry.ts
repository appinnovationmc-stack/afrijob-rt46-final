import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';
import type { Enums } from '@/types/database.types';
import type { IncidentStatus } from '@/lib/afriops/types';

export interface Site {
  id: string;
  name: string;
  address: string | null;
  business_unit_id: string | null;
}

export interface BusinessUnit {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface AssetType {
  id: string;
  code: string;
  label: string;
  category: string;
}

export interface Asset {
  id: string;
  asset_number: string | null;
  registration: string | null;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  meter_type: 'odometer' | 'hours' | 'none';
  // Narrowed from `string`: database.types.ts confirms asset_status is a
  // real Postgres enum (line 2377), not a free-form column, so this was
  // previously widening a typed value back to string for no reason and
  // hiding mismatches wherever code maps status -> label/chip.
  status: Enums<'asset_status'>;
  site_id: string | null;
  asset_type_id: string | null;
}

// ---------- sites ----------

export function useSites() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'sites', org?.organisation_id],
    enabled: !!org?.organisation_id,
    queryFn: async (): Promise<Site[]> => {
      const { data, error } = await supabase
        .from('sites')
        .select('id, name, address, business_unit_id')
        .eq('organisation_id', org!.organisation_id)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateSite() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (site: { name: string; address?: string; business_unit_id?: string }) => {
      const { data, error } = await supabase
        .from('sites')
        .insert({ ...site, organisation_id: org!.organisation_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'sites'] });
      qc.invalidateQueries({ queryKey: ['ops', 'site-options'] });
    },
  });
}

// ---------- business units ----------

export function useBusinessUnits() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'business-units', org?.organisation_id],
    enabled: !!org?.organisation_id,
    queryFn: async (): Promise<BusinessUnit[]> => {
      const { data, error } = await supabase
        .from('business_units')
        .select('id, name, parent_id')
        .eq('organisation_id', org!.organisation_id)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateBusinessUnit() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (unit: { name: string; parent_id?: string }) => {
      const { data, error } = await supabase
        .from('business_units')
        .insert({ ...unit, organisation_id: org!.organisation_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'business-units'] }),
  });
}

// ---------- asset types ----------

export function useAssetTypes() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'asset-types', org?.organisation_id],
    enabled: !!org?.organisation_id,
    queryFn: async (): Promise<AssetType[]> => {
      // Org-specific types plus the global (organisation_id IS NULL) catalogue.
      const { data, error } = await supabase
        .from('asset_types')
        .select('id, code, label, category')
        .or(`organisation_id.eq.${org!.organisation_id},organisation_id.is.null`)
        .order('label');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateAssetType() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (type: { code: string; label: string; category: string }) => {
      const { data, error } = await supabase
        .from('asset_types')
        .insert({ ...type, organisation_id: org!.organisation_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'asset-types'] }),
  });
}

// ---------- assets ----------

export function useAssets() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'assets', org?.organisation_id],
    enabled: !!org?.organisation_id,
    queryFn: async (): Promise<Asset[]> => {
      const { data, error } = await supabase
        .from('assets')
        .select('id, asset_number, registration, manufacturer, model, year, meter_type, status, site_id, asset_type_id')
        .eq('organisation_id', org!.organisation_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateAsset() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (asset: {
      asset_number?: string;
      registration?: string;
      manufacturer?: string;
      model?: string;
      year?: number;
      meter_type?: 'odometer' | 'hours' | 'none';
      site_id?: string;
      asset_type_id?: string;
    }) => {
      const { data, error } = await supabase
        .from('assets')
        .insert({ ...asset, organisation_id: org!.organisation_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'assets'] });
      qc.invalidateQueries({ queryKey: ['ops', 'asset-options'] });
    },
  });
}

// ---------- asset detail / "Asset 360" ----------
//
// Pulls one asset's full operational picture together from tables that
// already exist and already link to it — no schema change needed. One
// important thing this corrects vs. treating "jobs" and "work_orders" as
// separate histories: work_orders.source_system ('afrijob' | 'rt46' |
// 'native') means work_orders is *already* the unified work-order table
// across all three sub-products, confirmed against live data before
// writing this (5/5 existing work_orders rows have a source_system, and
// the one legacy job is linked via jobs.generic_work_order_id). So this
// queries work_orders once, not jobs+work_orders+rt46 separately.
//
// document_vault is polymorphic (entity_type/entity_id) and already
// supports attaching to anything — filtering to entity_type = 'asset'
// here needs no schema change either.

export interface AssetDetail extends Asset {
  organisation_id: string;
  vin: string | null;
  serial_number: string | null;
  meter_value: number | null;
  commissioned_at: string | null;
  retired_at: string | null;
  business_unit_id: string | null;
}

export interface AssetWorkOrder {
  id: string;
  description: string | null;
  // Narrowed from `string` to the real enums — confirmed present in
  // database.types.ts (work_orders.status/priority/category all resolve
  // to Database["public"]["Enums"][...]), not asserted.
  status: Enums<'work_order_generic_status'>;
  priority: Enums<'work_order_priority'>;
  category: Enums<'work_order_category'>;
  source_system: string | null;
  actual_cost: number | null;
  estimated_value: number | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AssetIncident {
  id: string;
  category: string;
  severity: string;
  // Narrowed from `string` — reuses IncidentStatus (confirmed defined in
  // lib/afriops/types.ts) so this stays one source of truth with the
  // dedicated Incidents page instead of drifting into its own string type.
  status: IncidentStatus;
  occurred_at: string;
  description: string | null;
}

export interface AssetMaintenanceSchedule {
  id: string;
  name: string;
  active: boolean;
  next_due_at: string | null;
  trigger_type: string | null;
}

export interface AssetDocument {
  id: string;
  doc_type: string;
  status: string;
  expiry_date: string | null;
  storage_path: string;
}

export function useAsset(assetId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'asset', assetId],
    enabled: !!assetId,
    queryFn: async (): Promise<AssetDetail> => {
      const { data, error } = await supabase
        .from('assets')
        .select('id, organisation_id, asset_number, registration, vin, serial_number, manufacturer, model, year, meter_type, meter_value, status, commissioned_at, retired_at, site_id, business_unit_id, asset_type_id')
        .eq('id', assetId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useAssetWorkOrders(assetId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'asset-work-orders', assetId],
    enabled: !!assetId,
    queryFn: async (): Promise<AssetWorkOrder[]> => {
      const { data, error } = await supabase
        .from('work_orders')
        .select('id, description, status, priority, category, source_system, actual_cost, estimated_value, due_at, completed_at, created_at')
        .eq('asset_id', assetId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

const INCIDENT_STATUSES: readonly IncidentStatus[] = ['reported', 'investigating', 'resolved', 'closed'];

// incidents.status is unconstrained text in the DB (no CHECK constraint,
// no enum) — Supabase's generated types correctly type it as `string`, so
// this narrows it to the app's IncidentStatus union at the read boundary
// instead of casting past a real mismatch. Unrecognised values fall back
// to 'reported' rather than crashing the Asset 360 Incidents tab, since
// this is read-only display data.
function toIncidentStatus(raw: string): IncidentStatus {
  return (INCIDENT_STATUSES as readonly string[]).includes(raw) ? (raw as IncidentStatus) : 'reported';
}

export function useAssetIncidents(assetId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'asset-incidents', assetId],
    enabled: !!assetId,
    queryFn: async (): Promise<AssetIncident[]> => {
      const { data, error } = await supabase
        .from('incidents')
        .select('id, category, severity, status, occurred_at, description')
        .eq('asset_id', assetId!)
        .order('occurred_at', { ascending: false });
      if (error) throw error;
      return data.map((row) => ({ ...row, status: toIncidentStatus(row.status) }));
    },
  });
}

export function useAssetMaintenanceSchedules(assetId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'asset-maintenance', assetId],
    enabled: !!assetId,
    queryFn: async (): Promise<AssetMaintenanceSchedule[]> => {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select('id, name, active, next_due_at, trigger_type')
        .eq('asset_id', assetId!)
        .order('next_due_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useAssetDocuments(assetId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'asset-documents', assetId],
    enabled: !!assetId,
    queryFn: async (): Promise<AssetDocument[]> => {
      const { data, error } = await supabase
        .from('document_vault')
        .select('id, doc_type, status, expiry_date, storage_path')
        .eq('entity_type', 'asset')
        .eq('entity_id', assetId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// SLA breaches don't carry asset_id directly — only work_order_id. Joins
// through the FK to work_orders and filters the embedded resource, same
// pattern PostgREST supports elsewhere for this kind of asset-scoped-via-
// work-order query.
export interface AssetSlaBreach {
  id: string;
  metric: 'response' | 'resolution';
  breached_at: string;
  minutes_over: number;
  acknowledged_at: string | null;
  work_order_id: string;
}

export function useAssetSlaBreaches(assetId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'asset-sla-breaches', assetId],
    enabled: !!assetId,
    queryFn: async (): Promise<AssetSlaBreach[]> => {
      const { data, error } = await supabase
        .from('sla_breaches')
        .select('id, metric, breached_at, minutes_over, acknowledged_at, work_order_id, work_orders!inner(asset_id)')
        .eq('work_orders.asset_id', assetId!)
        .order('breached_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AssetSlaBreach[];
    },
  });
}
