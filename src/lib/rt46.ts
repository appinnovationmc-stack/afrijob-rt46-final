import { supabase } from './supabase';

// The generated database.types.ts only covers the `public` schema, so
// cross-schema access to `rt46` goes through PostgREST's schema switch.
// This cast is narrow and confined to this one client export — every
// query below is typed against the interfaces here, which are kept in
// sync with the live `rt46` schema (verified directly against the
// Supabase project, not guessed).
export const rt46 = (supabase as any).schema('rt46');

// ---------- enums ----------
export type MerchantStatus = 'pending_onboarding' | 'active' | 'suspended' | 'terminated';
export type BbbeeLevel =
  | 'level_1' | 'level_2' | 'level_3' | 'level_4'
  | 'level_5' | 'level_6' | 'level_7' | 'level_8' | 'non_compliant';
export type WorkOrderStatus =
  | 'pending_allocation' | 'allocated' | 'accepted'
  | 'in_progress' | 'completed' | 'disputed' | 'cancelled';
export type InsuranceStatus = 'pending_verification' | 'verified' | 'rejected' | 'expired';
export type FraudFlagType = 'self_invoicing' | 'price_anomaly' | 'duplicate_claim' | 'collusion_pattern' | 'insurance_lapse' | 'other';
export type FraudFlagStatus = 'open' | 'under_review' | 'confirmed' | 'dismissed';
export type InspectionResult = 'pass' | 'conditional_pass' | 'fail';
export type EvidenceStage = 'before' | 'during' | 'after';
export type QualityOutcome = 'pass' | 'rework' | 'fail';
export type ReworkStatus = 'open' | 'in_progress' | 'resolved';
export type SlaEventType = 'breach' | 'escalated' | 'resolved_late' | 'resolved_on_time';

// ---------- core tables ----------
export interface Region {
  id: string;
  province: string;
  district: string | null;
}

export interface Merchant {
  id: string;
  trading_name: string;
  registration_number: string | null;
  bbbee_level: BbbeeLevel;
  region_id: string;
  categories: string[];
  declared_capacity_per_month: number;
  status: MerchantStatus;
  contact_email: string | null;
  contact_phone: string | null;
  insurance_valid_until: string | null;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
  quality_score: number;
  last_allocated_at: string | null;
  next_inspection_due: string | null;
  last_inspection_at: string | null;
  verification_hold_until: string | null;
  verification_hold_reason: string | null;
}

export interface Vehicle {
  id: string;
  fleet_number: string;
  registration: string;
  department: string | null;
  region_id: string | null;
  make: string | null;
  model: string | null;
}

export interface WorkOrder {
  id: string;
  vehicle_id: string;
  category: string;
  region_id: string;
  priority: string;
  description: string | null;
  status: WorkOrderStatus;
  allocated_merchant_id: string | null;
  estimated_value: number | null;
  created_at: string;
  allocated_at: string | null;
  completed_at: string | null;
  updated_at: string;
  due_at: string | null;
  sla_breached: boolean;
  sla_breached_at: string | null;
  labour_hours: number | null;
  labour_rate: number | null;
  pdf_report_url: string | null;
  awaiting_parts: boolean;
  awaiting_parts_since: string | null;
  parts_delay_seconds: number;
  awaiting_authorization: boolean;
  awaiting_authorization_since: string | null;
  authorization_delay_seconds: number;
}

export interface AllocationLogEntry {
  id: string;
  work_order_id: string;
  merchant_id: string;
  score: number;
  trailing_90d_volume: number;
  capacity_ratio: number;
  bbbee_weight: number;
  was_selected: boolean;
  created_at: string;
  eligible: boolean;
  exclusion_reason: string | null;
  quality_score: number | null;
  region_match: boolean;
}

export interface FraudFlag {
  id: string;
  merchant_id: string | null;
  work_order_id: string | null;
  flag_type: FraudFlagType;
  status: FraudFlagStatus;
  detail: string | null;
  raised_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface InsurancePolicy {
  id: string;
  merchant_id: string;
  policy_number: string;
  insurer: string;
  cover_type: string;
  start_date: string;
  expiry_date: string;
  status: InsuranceStatus;
  document_storage_path: string;
  uploaded_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface ChecklistTemplate {
  id: string;
  category: string;
  item_order: number;
  item_text: string;
  is_required: boolean;
}

export interface ChecklistItem {
  id: string;
  work_order_id: string;
  template_id: string;
  is_checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  notes: string | null;
  quality_checklist_templates?: ChecklistTemplate;
}

export interface Evidence {
  id: string;
  work_order_id: string;
  stage: EvidenceStage;
  storage_path: string;
  latitude: number;
  longitude: number;
  taken_at: string;
  uploaded_by: string;
}

export interface QualityReview {
  id: string;
  work_order_id: string;
  reviewer_profile_id: string;
  score: number;
  outcome: QualityOutcome;
  notes: string | null;
  created_at: string;
}

export interface ReworkCase {
  id: string;
  work_order_id: string;
  quality_review_id: string;
  reason: string;
  status: ReworkStatus;
  opened_at: string;
  resolved_at: string | null;
}

export interface SlaTarget {
  category: string;
  target_hours: number;
}

export interface SlaEvent {
  id: string;
  work_order_id: string;
  event_type: SlaEventType;
  detail: string | null;
  created_at: string;
}

export interface MerchantInspection {
  id: string;
  merchant_id: string;
  inspector_profile_id: string | null;
  scheduled_for: string | null;
  performed_at: string | null;
  result: InspectionResult | null;
  staff_count_verified: number | null;
  equipment_notes: string | null;
  is_surprise_inspection: boolean;
  created_at: string;
}

export interface MerchantFacility {
  id: string;
  merchant_id: string;
  facility_type: string;
  address: string | null;
  bay_count: number | null;
  verified_at: string | null;
}

export interface MerchantEquipment {
  id: string;
  merchant_id: string;
  equipment_name: string;
  condition: 'good' | 'fair' | 'poor' | 'out_of_service' | null;
  verified_at: string | null;
}

export interface MerchantTechnician {
  id: string;
  merchant_id: string;
  full_name: string;
  certification: string | null;
  cert_number: string | null;
  cert_expiry: string | null;
  verified_at: string | null;
}

export interface MerchantBankDetail {
  id: string;
  merchant_id: string;
  bank_name: string;
  account_holder: string;
  account_number_last4: string;
  branch_code: string | null;
  verified_at: string | null;
}

export interface MerchantChangeLogEntry {
  id: string;
  merchant_id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  is_critical: boolean;
  changed_at: string;
}

export interface WorkOrderPart {
  id: string;
  work_order_id: string;
  part_name: string;
  part_number: string | null;
  description: string | null;
  source: 'oem' | 'aftermarket' | 'salvage' | 'other' | null;
  quantity: number;
  billed_unit_cost: number;
  reference_id: string | null;
  variance_pct: number | null;
}

export interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_profile_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---------- RPC wrappers ----------
export async function allocateWorkOrder(workOrderId: string): Promise<string | null> {
  const { data, error } = await rt46.rpc('allocate_work_order', { p_work_order_id: workOrderId });
  if (error) throw error;
  return data as string | null;
}

export async function suspendMerchant(merchantId: string, actorId: string, reason: string) {
  if (!reason.trim() || reason.trim().length < 5) {
    throw new Error('A suspension reason of at least 5 characters is mandatory.');
  }
  const { error } = await rt46.rpc('suspend_merchant', {
    p_merchant_id: merchantId, p_actor: actorId, p_reason: reason.trim(),
  });
  if (error) throw error;
}

export async function reinstateMerchant(merchantId: string, actorId: string, reason?: string) {
  const { error } = await rt46.rpc('reinstate_merchant', {
    p_merchant_id: merchantId, p_actor: actorId, p_reason: reason ?? null,
  });
  if (error) throw error;
}

export async function updateFraudFlagStatus(flagId: string, status: FraudFlagStatus, actorId: string, notes?: string) {
  const { error } = await rt46.rpc('update_fraud_flag_status', {
    p_flag_id: flagId, p_status: status, p_actor: actorId, p_notes: notes ?? null,
  });
  if (error) throw error;
}

export async function verifyInsurancePolicy(policyId: string, approve: boolean, actorId: string, reason?: string) {
  const { error } = await rt46.rpc('verify_insurance_policy', {
    p_policy_id: policyId, p_approve: approve, p_actor: actorId, p_reason: reason ?? null,
  });
  if (error) throw error;
}

export async function submitQualityReview(
  workOrderId: string, score: number, outcome: QualityOutcome, actorId: string, notes?: string
): Promise<string> {
  const { data, error } = await rt46.rpc('submit_quality_review', {
    p_work_order_id: workOrderId, p_score: score, p_outcome: outcome, p_notes: notes ?? null, p_actor: actorId,
  });
  if (error) throw error;
  return data as string;
}

export async function canCompleteWorkOrder(workOrderId: string): Promise<string | null> {
  const { data, error } = await rt46.rpc('can_complete_work_order', { p_work_order_id: workOrderId });
  if (error) throw error;
  return data as string | null;
}

export async function setAwaitingParts(workOrderId: string, awaiting: boolean, actorId: string) {
  const { error } = await rt46.rpc('set_awaiting_parts', { p_work_order_id: workOrderId, p_awaiting: awaiting, p_actor: actorId });
  if (error) throw error;
}

export async function setAwaitingAuthorization(workOrderId: string, awaiting: boolean, actorId: string) {
  const { error } = await rt46.rpc('set_awaiting_authorization', { p_work_order_id: workOrderId, p_awaiting: awaiting, p_actor: actorId });
  if (error) throw error;
}

// ---------- helpers ----------
export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

export function formatCountdown(dueAt: string | null): string {
  if (!dueAt) return 'No SLA target';
  const delta = new Date(dueAt).getTime() - Date.now();
  const abs = Math.abs(delta);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  return delta < 0 ? `Overdue by ${h}h ${m}m` : `${h}h ${m}m remaining`;
}

export const BBBEE_LABELS: Record<BbbeeLevel, string> = {
  level_1: 'Level 1', level_2: 'Level 2', level_3: 'Level 3', level_4: 'Level 4',
  level_5: 'Level 5', level_6: 'Level 6', level_7: 'Level 7', level_8: 'Level 8',
  non_compliant: 'Non-compliant',
};

export const MERCHANT_STATUS_LABELS: Record<MerchantStatus, string> = {
  pending_onboarding: 'Pending Onboarding',
  active: 'Active',
  suspended: 'Suspended',
  terminated: 'Terminated',
};

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  pending_allocation: 'Pending Allocation',
  allocated: 'Allocated',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  completed: 'Completed',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
};

export const FRAUD_STATUS_LABELS: Record<FraudFlagStatus, string> = {
  open: 'Open',
  under_review: 'Under Review',
  confirmed: 'Confirmed',
  dismissed: 'Dismissed',
};
