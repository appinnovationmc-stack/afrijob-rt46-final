import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { rt46 } from '@/lib/rt46';
import type {
  Merchant, Region, WorkOrder, AllocationLogEntry, FraudFlag, InsurancePolicy,
  ChecklistItem, Evidence, QualityReview, ReworkCase, SlaEvent, MerchantInspection,
  MerchantFacility, MerchantEquipment, MerchantTechnician, MerchantBankDetail,
  MerchantChangeLogEntry, WorkOrderPart, AuditLogEntry,
} from '@/lib/rt46';

// ---------- current-user admin check ----------
export function useIsRt46Admin() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['rt46', 'is-admin', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await rt46.from('admins').select('profile_id').eq('profile_id', userId).maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

// ---------- regions ----------
export function useRegions() {
  return useQuery({
    queryKey: ['rt46', 'regions'],
    queryFn: async () => {
      const { data, error } = await rt46.from('regions').select('*').order('province');
      if (error) throw error;
      return data as Region[];
    },
  });
}

// ---------- merchants ----------
export function useMerchants() {
  return useQuery({
    queryKey: ['rt46', 'merchants'],
    queryFn: async () => {
      const { data, error } = await rt46.from('merchants').select('*').order('trading_name');
      if (error) throw error;
      return data as Merchant[];
    },
  });
}

export function useMerchant(id: string | undefined) {
  return useQuery({
    queryKey: ['rt46', 'merchant', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await rt46.from('merchants').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Merchant;
    },
  });
}

export function useMerchantVerification(merchantId: string | undefined) {
  return useQuery({
    queryKey: ['rt46', 'merchant-verification', merchantId],
    enabled: !!merchantId,
    queryFn: async () => {
      const [facilities, equipment, technicians, bank, changeLog, inspections] = await Promise.all([
        rt46.from('merchant_facilities').select('*').eq('merchant_id', merchantId),
        rt46.from('merchant_equipment').select('*').eq('merchant_id', merchantId),
        rt46.from('merchant_technicians').select('*').eq('merchant_id', merchantId),
        rt46.from('merchant_bank_details').select('*').eq('merchant_id', merchantId),
        rt46.from('merchant_change_log').select('*').eq('merchant_id', merchantId).order('changed_at', { ascending: false }).limit(20),
        rt46.from('merchant_inspections').select('*').eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(10),
      ]);
      for (const r of [facilities, equipment, technicians, bank, changeLog, inspections]) {
        if (r.error) throw r.error;
      }
      return {
        facilities: facilities.data as MerchantFacility[],
        equipment: equipment.data as MerchantEquipment[],
        technicians: technicians.data as MerchantTechnician[],
        bankDetails: bank.data as MerchantBankDetail[],
        changeLog: changeLog.data as MerchantChangeLogEntry[],
        inspections: inspections.data as MerchantInspection[],
      };
    },
  });
}

export function useSuspendMerchant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ merchantId, actorId, reason }: { merchantId: string; actorId: string; reason: string }) => {
      const { suspendMerchant } = await import('@/lib/rt46');
      await suspendMerchant(merchantId, actorId, reason);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rt46', 'merchants'] }),
  });
}

export function useReinstateMerchant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ merchantId, actorId, reason }: { merchantId: string; actorId: string; reason?: string }) => {
      const { reinstateMerchant } = await import('@/lib/rt46');
      await reinstateMerchant(merchantId, actorId, reason);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rt46', 'merchants'] }),
  });
}

// ---------- work orders ----------
export function useWorkOrders(statusFilter?: string) {
  return useQuery({
    queryKey: ['rt46', 'work-orders', statusFilter],
    queryFn: async () => {
      let q = rt46.from('work_orders').select('*').order('created_at', { ascending: false });
      if (statusFilter) q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as WorkOrder[];
    },
  });
}

export function useWorkOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['rt46', 'work-order', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await rt46.from('work_orders').select('*').eq('id', id).single();
      if (error) throw error;
      return data as WorkOrder;
    },
  });
}

export function useAllocationLog(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ['rt46', 'allocation-log', workOrderId],
    enabled: !!workOrderId,
    queryFn: async () => {
      const { data, error } = await rt46.from('allocation_log')
        .select('*, merchants(trading_name)')
        .eq('work_order_id', workOrderId)
        .order('score', { ascending: false });
      if (error) throw error;
      return data as (AllocationLogEntry & { merchants: { trading_name: string } })[];
    },
  });
}

export function useAllocateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workOrderId: string) => {
      const { allocateWorkOrder } = await import('@/lib/rt46');
      return allocateWorkOrder(workOrderId);
    },
    onSuccess: (_data, workOrderId) => {
      qc.invalidateQueries({ queryKey: ['rt46', 'work-orders'] });
      qc.invalidateQueries({ queryKey: ['rt46', 'work-order', workOrderId] });
      qc.invalidateQueries({ queryKey: ['rt46', 'allocation-log', workOrderId] });
    },
  });
}

export function useAuditLog(entityType: string, entityId: string | undefined) {
  return useQuery({
    queryKey: ['rt46', 'audit-log', entityType, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await rt46.from('audit_log')
        .select('*').eq('entity_type', entityType).eq('entity_id', entityId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AuditLogEntry[];
    },
  });
}

// ---------- insurance / compliance ----------
export function useInsurancePolicies(merchantId?: string) {
  return useQuery({
    queryKey: ['rt46', 'insurance-policies', merchantId],
    queryFn: async () => {
      let q = rt46.from('merchant_insurance_policies').select('*, merchants(trading_name)').order('created_at', { ascending: false });
      if (merchantId) q = q.eq('merchant_id', merchantId);
      const { data, error } = await q;
      if (error) throw error;
      return data as (InsurancePolicy & { merchants: { trading_name: string } })[];
    },
  });
}

export function useVerifyInsurance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { policyId: string; approve: boolean; actorId: string; reason?: string }) => {
      const { verifyInsurancePolicy } = await import('@/lib/rt46');
      await verifyInsurancePolicy(args.policyId, args.approve, args.actorId, args.reason);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rt46', 'insurance-policies'] });
      qc.invalidateQueries({ queryKey: ['rt46', 'merchants'] });
    },
  });
}

// ---------- quality: checklist, evidence, reviews, rework ----------
export function useChecklistItems(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ['rt46', 'checklist', workOrderId],
    enabled: !!workOrderId,
    queryFn: async () => {
      const { data, error } = await rt46.from('work_order_checklist_items')
        .select('*, quality_checklist_templates(*)')
        .eq('work_order_id', workOrderId);
      if (error) throw error;
      return (data as ChecklistItem[]).sort(
        (a, b) => (a.quality_checklist_templates?.item_order ?? 0) - (b.quality_checklist_templates?.item_order ?? 0)
      );
    },
  });
}

export function useToggleChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, checked, actorId, notes }: { id: string; checked: boolean; actorId: string; notes?: string }) => {
      const { error } = await rt46.from('work_order_checklist_items').update({
        is_checked: checked,
        checked_by: checked ? actorId : null,
        checked_at: checked ? new Date().toISOString() : null,
        notes: notes ?? null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rt46', 'checklist'] }),
  });
}

export function useEvidence(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ['rt46', 'evidence', workOrderId],
    enabled: !!workOrderId,
    queryFn: async () => {
      const { data, error } = await rt46.from('work_order_evidence').select('*').eq('work_order_id', workOrderId).order('taken_at');
      if (error) throw error;
      return data as Evidence[];
    },
  });
}

export function useAddEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (evidence: Omit<Evidence, 'id'>) => {
      const { error } = await rt46.from('work_order_evidence').insert(evidence);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rt46', 'evidence'] }),
  });
}

export function useQualityReviews(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ['rt46', 'quality-reviews', workOrderId],
    enabled: !!workOrderId,
    queryFn: async () => {
      const { data, error } = await rt46.from('work_order_quality_reviews').select('*').eq('work_order_id', workOrderId).order('created_at', { ascending: false });
      if (error) throw error;
      return data as QualityReview[];
    },
  });
}

export function useSubmitQualityReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { workOrderId: string; score: number; outcome: 'pass' | 'rework' | 'fail'; actorId: string; notes?: string }) => {
      const { submitQualityReview } = await import('@/lib/rt46');
      return submitQualityReview(args.workOrderId, args.score, args.outcome, args.actorId, args.notes);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['rt46', 'quality-reviews', vars.workOrderId] });
      qc.invalidateQueries({ queryKey: ['rt46', 'rework-cases', vars.workOrderId] });
      qc.invalidateQueries({ queryKey: ['rt46', 'merchants'] });
    },
  });
}

export function useReworkCases(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ['rt46', 'rework-cases', workOrderId],
    enabled: !!workOrderId,
    queryFn: async () => {
      const { data, error } = await rt46.from('rework_cases').select('*').eq('work_order_id', workOrderId).order('opened_at', { ascending: false });
      if (error) throw error;
      return data as ReworkCase[];
    },
  });
}

export function useCanComplete(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ['rt46', 'can-complete', workOrderId],
    enabled: !!workOrderId,
    queryFn: async () => {
      const { canCompleteWorkOrder } = await import('@/lib/rt46');
      return canCompleteWorkOrder(workOrderId!);
    },
  });
}

// ---------- parts & pricing ----------
export function useWorkOrderParts(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ['rt46', 'parts', workOrderId],
    enabled: !!workOrderId,
    queryFn: async () => {
      const { data, error } = await rt46.from('work_order_parts').select('*').eq('work_order_id', workOrderId).order('created_at');
      if (error) throw error;
      return data as WorkOrderPart[];
    },
  });
}

export function useAddWorkOrderPart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (part: Omit<WorkOrderPart, 'id' | 'variance_pct'>) => {
      const { error } = await rt46.from('work_order_parts').insert(part);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rt46', 'parts'] }),
  });
}

export function useUpdateWorkOrderLabour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workOrderId, labourHours, labourRate }: { workOrderId: string; labourHours: number; labourRate: number }) => {
      const { error } = await rt46.from('work_orders').update({ labour_hours: labourHours, labour_rate: labourRate }).eq('id', workOrderId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['rt46', 'work-order', vars.workOrderId] }),
  });
}

// ---------- fraud ----------
export function useFraudFlags(statusFilter?: string) {
  return useQuery({
    queryKey: ['rt46', 'fraud-flags', statusFilter],
    queryFn: async () => {
      let q = rt46.from('fraud_flags').select('*, merchants(trading_name)').order('created_at', { ascending: false });
      if (statusFilter) q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as (FraudFlag & { merchants: { trading_name: string } | null })[];
    },
  });
}

export function useUpdateFraudFlagStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { flagId: string; status: 'open' | 'under_review' | 'confirmed' | 'dismissed'; actorId: string; notes?: string }) => {
      const { updateFraudFlagStatus } = await import('@/lib/rt46');
      await updateFraudFlagStatus(args.flagId, args.status, args.actorId, args.notes);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rt46', 'fraud-flags'] }),
  });
}

// ---------- SLA / dashboard ----------
export function useSlaEvents(workOrderId?: string) {
  return useQuery({
    queryKey: ['rt46', 'sla-events', workOrderId],
    enabled: !!workOrderId,
    queryFn: async () => {
      const { data, error } = await rt46.from('sla_events').select('*').eq('work_order_id', workOrderId).order('created_at', { ascending: false });
      if (error) throw error;
      return data as SlaEvent[];
    },
  });
}

export function useSignedUrl(bucket: string, path: string | null | undefined, expiresIn = 3600) {
  return useQuery({
    queryKey: ['signed-url', bucket, path],
    enabled: !!path,
    staleTime: (expiresIn - 60) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, expiresIn);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function useSetAwaitingParts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workOrderId, awaiting, actorId }: { workOrderId: string; awaiting: boolean; actorId: string }) => {
      const { setAwaitingParts } = await import('@/lib/rt46');
      await setAwaitingParts(workOrderId, awaiting, actorId);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['rt46', 'work-orders'] });
      qc.invalidateQueries({ queryKey: ['rt46', 'work-order', vars.workOrderId] });
    },
  });
}

export function useControlTowerStats() {
  return useQuery({
    queryKey: ['rt46', 'control-tower'],
    queryFn: async () => {
      const [wos, merchants, flags, policies] = await Promise.all([
        rt46.from('work_orders').select('id, status, sla_breached'),
        rt46.from('merchants').select('id, status, quality_score, insurance_valid_until'),
        rt46.from('fraud_flags').select('id, status').eq('status', 'open'),
        rt46.from('merchant_insurance_policies').select('id, status').eq('status', 'pending_verification'),
      ]);
      for (const r of [wos, merchants, flags, policies]) if (r.error) throw r.error;

      const workOrders = wos.data as { id: string; status: string; sla_breached: boolean }[];
      const merchantList = merchants.data as { id: string; status: string; quality_score: number; insurance_valid_until: string | null }[];

      const activeStatuses = ['allocated', 'accepted', 'in_progress'];
      const active = workOrders.filter((w) => activeStatuses.includes(w.status));
      const breached = workOrders.filter((w) => w.sla_breached).length;
      const suspended = merchantList.filter((m) => m.status === 'suspended').length;
      const activeMerchants = merchantList.filter((m) => m.status === 'active');
      const avgQuality = activeMerchants.length
        ? activeMerchants.reduce((s, m) => s + Number(m.quality_score), 0) / activeMerchants.length
        : 0;
      const expiringInsurance = activeMerchants.filter((m) => {
        if (!m.insurance_valid_until) return false;
        const days = Math.ceil((new Date(m.insurance_valid_until).getTime() - Date.now()) / 86_400_000);
        return days <= 60 && days >= 0;
      }).length;

      return {
        activeWorkOrders: active.length,
        pendingAllocation: workOrders.filter((w) => w.status === 'pending_allocation').length,
        breachedSla: breached,
        suspendedMerchants: suspended,
        avgQualityScore: avgQuality,
        expiringInsurance,
        openFraudFlags: (flags.data as unknown[]).length,
        pendingInsuranceVerification: (policies.data as unknown[]).length,
      };
    },
  });
}
