import { SupabaseClient } from '@supabase/supabase-js';
import { WorkOrder, WorkOrderPriority } from './types';
import { recordInventoryMovement } from './inventory';
import { createInAppNotification, NotificationType } from './notifications';

// The Action API.
//
// Every function here runs under the CALLER's own Supabase session — never
// a service-role client — so it rides the existing RLS policies and
// has_permission() checks exactly like a human clicking a button in the UI.
// This is deliberate: it's what lets the AI Operational Co-Pilot propose and
// (once accepted) execute actions without a new permission model or a
// service-role bypass. The LLM never writes directly; it returns a
// structured draft, the person reviews it in the UI, and only an explicit
// Accept calls one of these functions under their own identity.
//
// created_via lets audit_log / domain_events distinguish an agent-originated
// row from a human one. It is NOT a security boundary by itself — RLS would
// reject the insert regardless of this value if the caller lacked
// permission.

export type ActionOrigin = 'ui' | 'ai_copilot';

export interface CreateWorkOrderInput {
  organisation_id: string;
  asset_id?: string | null;
  site_id?: string | null;
  category: string;
  priority?: WorkOrderPriority;
  description?: string | null;
  due_at?: string | null;
  assignee_profile_id?: string | null;
  origin?: ActionOrigin;
}

// The one path that creates a native work_orders row from the client.
// Nothing else in the app inserts into work_orders directly — RT46/AfriJob
// write their own tables and reach public.work_orders only via the bridge.
export async function createWorkOrder(
  supabase: SupabaseClient,
  input: CreateWorkOrderInput
): Promise<WorkOrder> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('work_orders')
    .insert({
      organisation_id: input.organisation_id,
      asset_id: input.asset_id ?? null,
      site_id: input.site_id ?? null,
      category: input.category,
      priority: input.priority ?? 'normal',
      status: 'draft',
      description: input.description ?? null,
      due_at: input.due_at ?? null,
      assignee_profile_id: input.assignee_profile_id ?? null,
      requester_profile_id: user?.id ?? null,
      source_system: 'native',
      created_via: input.origin === 'ai_copilot' ? 'ai_copilot' : 'ui',
    })
    .select()
    .single();
  if (error) throw error;
  return data as WorkOrder;
}

export async function prioritiseWorkOrder(
  supabase: SupabaseClient,
  workOrderId: string,
  priority: WorkOrderPriority
): Promise<void> {
  const { error } = await supabase.from('work_orders').update({ priority }).eq('id', workOrderId);
  if (error) throw error;
}

// Thin re-exports so callers that only need the Action API surface (the
// co-pilot draft/accept flow, in particular) can import one module instead
// of reaching into inventory.ts / notifications.ts individually. The real
// implementations already existed and are unchanged.
export const reserveInventory = recordInventoryMovement;
export const notifyUser = createInAppNotification;

// ---- Draft action dispatch (co-pilot accept flow) ----

export type DraftActionType = 'create_work_order' | 'prioritise_work_order' | 'notify_user';

export interface DraftAction {
  type: DraftActionType;
  // Kept loose (matches the JSON shape the LLM returns) — validated per-type
  // in executeDraftAction before anything touches the database.
  payload: Record<string, unknown>;
  label: string;
}

// Validates and executes one accepted draft action. Throws on malformed
// payloads rather than guessing — a rejected draft is safer than a
// half-guessed write.
export async function executeDraftAction(
  supabase: SupabaseClient,
  action: DraftAction,
  organisationId: string
): Promise<unknown> {
  switch (action.type) {
    case 'create_work_order': {
      const p = action.payload;
      if (typeof p.category !== 'string') throw new Error('Draft work order is missing a category.');
      return createWorkOrder(supabase, {
        organisation_id: organisationId,
        asset_id: typeof p.asset_id === 'string' ? p.asset_id : null,
        category: p.category,
        priority: (p.priority as WorkOrderPriority) ?? 'normal',
        description: typeof p.description === 'string' ? p.description : null,
        due_at: typeof p.due_at === 'string' ? p.due_at : null,
        origin: 'ai_copilot',
      });
    }
    case 'prioritise_work_order': {
      const p = action.payload;
      if (typeof p.work_order_id !== 'string' || typeof p.priority !== 'string') {
        throw new Error('Draft priority change is missing a work_order_id or priority.');
      }
      return prioritiseWorkOrder(supabase, p.work_order_id, p.priority as WorkOrderPriority);
    }
    case 'notify_user': {
      const p = action.payload;
      if (typeof p.recipient_profile_id !== 'string' || typeof p.title !== 'string') {
        throw new Error('Draft notification is missing a recipient or title.');
      }
      return notifyUser(supabase, {
        organisation_id: organisationId,
        recipient_profile_id: p.recipient_profile_id,
        type: (typeof p.notification_type === 'string' ? p.notification_type : 'system') as NotificationType,
        title: p.title,
        body: typeof p.body === 'string' ? p.body : undefined,
      });
    }
    default:
      throw new Error(`Unknown draft action type: ${action.type}`);
  }
}
