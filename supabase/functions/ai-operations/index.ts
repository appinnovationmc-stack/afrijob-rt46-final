import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Keep this in sync with INDUSTRY_LABELS / INDUSTRY_CONFIG in
// src/hooks/useOrganisation.ts. Deno can't import the frontend module
// directly, so only the pieces the prompt actually needs are duplicated
// here — glossary + skills, not the whole config (KPI ordering, category
// label overrides, etc. stay frontend-only, they don't change what the
// model should say).
const INDUSTRY_PROMPT_CONTEXT: Record<string, { label: string; glossary: string[] }> = {
  general: { label: 'General operations', glossary: ['asset', 'work order', 'maintenance schedule'] },
  mining: { label: 'Mining', glossary: ['haul truck', 'pit site', 'safety incident', 'scheduled maintenance', 'breakdown'] },
  fleet: { label: 'Fleet', glossary: ['vehicle', 'service', 'accident', 'vehicle inspection', 'parts'] },
  municipal: { label: 'Municipal', glossary: ['service request', 'SLA', 'public incident', 'compliance inspection'] },
  government: { label: 'Government', glossary: ['procurement', 'compliance', 'reportable incident', 'SLA'] },
  logistics: { label: 'Logistics', glossary: ['route incident', 'pre-trip inspection', 'delivery vehicle', 'breakdown'] },
};

// ---- Phase 2.1: Fleet vertical skill routing ----
//
// INDUSTRY_CONFIG.fleet.agentSkills in useOrganisation.ts declares
// 'predict_service_due' and 'flag_high_cost_vehicle' but — per the comment
// on that field — this was informational only: nothing computed real
// output for them. This is the first real skill-routing logic: for a
// fleet-mode org, compute both skills as plain SQL/JS aggregation (no LLM
// involved in the computation itself, only in phrasing the answer), and
// hand the model pre-computed, ID-bearing facts instead of leaving it to
// eyeball raw rows. Every underlying read still goes through the caller's
// own JWT — nothing here escalates privilege beyond what the caller's RLS
// already allows.
interface AssetRow {
  id: string;
  status: string;
  asset_type_id: string | null;
  risk_score: number | null;
  risk_factors: unknown;
  meter_value: number | null;
  registration: string | null;
  asset_number: string | null;
}

interface MaintenanceScheduleRow {
  id: string;
  asset_id: string;
  name: string;
  trigger_type: string;
  next_due_at: string | null;
  next_due_meter_reading: number | null;
  active: boolean;
}

interface WorkOrderRow {
  id: string;
  status: string;
  priority: string;
  category: string;
  actual_cost: number | null;
  created_at: string;
  due_at: string | null;
  asset_id: string | null;
}

function assetLabel(a: AssetRow): string {
  return a.registration || a.asset_number || a.id;
}

// predict_service_due: schedules ordered by how close they are to being
// due, on whichever axis (date or meter) the schedule actually tracks.
// Time-based schedules are ranked by days remaining; meter-based schedules
// by remaining distance/hours on the asset's current meter_value. Only
// active schedules with a resolvable due target are considered — a
// schedule missing both next_due_at and next_due_meter_reading has nothing
// to rank on and is skipped rather than guessed at.
function computeServiceDue(schedules: MaintenanceScheduleRow[], assets: AssetRow[]) {
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const now = Date.now();
  const rows = schedules
    .filter((s) => s.active)
    .map((s) => {
      const asset = assetById.get(s.asset_id);
      if (!asset) return null;
      let daysRemaining: number | null = null;
      let meterRemaining: number | null = null;
      if (s.next_due_at) daysRemaining = Math.round((new Date(s.next_due_at).getTime() - now) / 86400000);
      if (s.next_due_meter_reading != null && asset.meter_value != null) {
        meterRemaining = s.next_due_meter_reading - asset.meter_value;
      }
      if (daysRemaining === null && meterRemaining === null) return null;
      return {
        asset_id: asset.id,
        asset_label: assetLabel(asset),
        schedule_id: s.id,
        schedule_name: s.name,
        days_remaining: daysRemaining,
        meter_remaining: meterRemaining,
        overdue: (daysRemaining !== null && daysRemaining < 0) || (meterRemaining !== null && meterRemaining < 0),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => {
      const rank = (r: typeof a) => Math.min(r.days_remaining ?? Infinity, r.meter_remaining ?? Infinity);
      return rank(a) - rank(b);
    })
    .slice(0, 15);
  return rows;
}

// flag_high_cost_vehicle: sum of actual_cost across every completed/costed
// work order per asset. Only work orders with a non-null actual_cost
// contribute — estimated or in-progress cost is not counted, so this
// reflects real spend, not projections.
function computeHighCostVehicles(workOrders: WorkOrderRow[], assets: AssetRow[]) {
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const totals = new Map<string, { total: number; count: number }>();
  for (const wo of workOrders) {
    if (!wo.asset_id || wo.actual_cost == null) continue;
    const entry = totals.get(wo.asset_id) ?? { total: 0, count: 0 };
    entry.total += wo.actual_cost;
    entry.count += 1;
    totals.set(wo.asset_id, entry);
  }
  return [...totals.entries()]
    .map(([assetId, v]) => {
      const asset = assetById.get(assetId);
      return {
        asset_id: assetId,
        asset_label: asset ? assetLabel(asset) : assetId,
        total_cost: Math.round(v.total * 100) / 100,
        work_order_count: v.count,
      };
    })
    .sort((a, b) => b.total_cost - a.total_cost)
    .slice(0, 15);
}

// The JSON shape the model must return. draft_actions are proposals ONLY —
// this function never writes to the database. Accepting a draft happens
// client-side, under the user's own session, via executeDraftAction()
// (src/lib/afriops/actions.ts), so RLS/has_permission governs it exactly
// like any other write in the app.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    draft_actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['create_work_order', 'prioritise_work_order', 'notify_user'] },
          label: { type: 'string' },
          payload: { type: 'object' },
        },
        required: ['type', 'label', 'payload'],
        additionalProperties: false,
      },
    },
  },
  required: ['answer', 'draft_actions'],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });

  const auth = req.headers.get('Authorization');
  if (!auth) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });

  const body = await req.json().catch(() => ({}));
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question || question.length > 2000) return new Response(JSON.stringify({ error: 'A question between 1 and 2000 characters is required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

  // Every read below goes through the caller's own JWT (set on the client
  // above), so it's RLS-scoped to organisations this user actually belongs
  // to — same enforcement as any other client call, not a service-role
  // bypass.
  const [membership, workOrders, incidents, assets, breaches, events] = await Promise.all([
    supabase.from('organisation_members').select('organisation_id, organisations(industry_mode)').eq('profile_id', user.id).limit(1).maybeSingle(),
    supabase.from('work_orders').select('id,status,priority,category,actual_cost,created_at,due_at,asset_id').limit(500),
    supabase.from('incidents').select('status,severity,created_at,asset_id').limit(500),
    supabase.from('assets').select('id,status,asset_type_id,risk_score,risk_factors,meter_value,registration,asset_number').limit(500),
    supabase.from('sla_breaches').select('severity,acknowledged,breached_at').limit(500),
    supabase.from('domain_events').select('event_type,entity_type,entity_id,payload,created_at').order('created_at', { ascending: false }).limit(100),
  ]);

  const errors = [workOrders.error, incidents.error, assets.error, breaches.error, events.error].filter(Boolean);
  if (errors.length) return new Response(JSON.stringify({ error: 'Unable to read operational data for this organisation' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });

  const industryMode = (membership.data as { organisations?: { industry_mode?: string } } | null)?.organisations?.industry_mode ?? 'general';
  const industryContext = INDUSTRY_PROMPT_CONTEXT[industryMode] ?? INDUSTRY_PROMPT_CONTEXT.general;

  const context: Record<string, unknown> = {
    work_orders: workOrders.data ?? [],
    incidents: incidents.data ?? [],
    assets: assets.data ?? [],
    sla_breaches: breaches.data ?? [],
    recent_events: events.data ?? [],
  };

  let fleetSkillsPromptLine = '';
  if (industryMode === 'fleet') {
    const schedulesRes = await supabase
      .from('maintenance_schedules')
      .select('id,asset_id,name,trigger_type,next_due_at,next_due_meter_reading,active')
      .eq('active', true)
      .limit(500);
    if (!schedulesRes.error) {
      const assetRows = (assets.data ?? []) as AssetRow[];
      const serviceDue = computeServiceDue((schedulesRes.data ?? []) as MaintenanceScheduleRow[], assetRows);
      const highCost = computeHighCostVehicles((workOrders.data ?? []) as WorkOrderRow[], assetRows);
      context.fleet_skills = {
        predict_service_due: serviceDue,
        flag_high_cost_vehicle: highCost,
      };
      fleetSkillsPromptLine =
        " The context includes a fleet_skills object with two pre-computed skills: predict_service_due (maintenance schedules ranked by days or meter distance remaining — negative values are already overdue) and flag_high_cost_vehicle (vehicles ranked by total actual_cost across their work orders). Lean on these directly for service-due and high-cost questions instead of re-deriving them from raw work_orders/assets. If a vehicle in predict_service_due is overdue, consider proposing a create_work_order draft action for it (category matching the schedule's intent, e.g. maintenance) using its asset_id.";
    }
    // If the schedules read fails (e.g. RLS denies it for this role), the
    // co-pilot still answers from the base context — fleet skills are an
    // enhancement, not a hard requirement for the endpoint to function.
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return new Response(JSON.stringify({ error: 'AI provider is not configured. Set OPENAI_API_KEY on the ai-operations function.' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });

  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';
  const systemPrompt = [
    `You are AfriOps Operational Intelligence for a ${industryContext.label} organisation.`,
    `Use this industry's vocabulary where natural: ${industryContext.glossary.join(', ')}.`,
    'Answer using only the supplied operational data. Never invent values. If the data is insufficient, say so.',
    'Prioritise concrete risks, causes, and recommended actions. Keep answers concise and executive-friendly.',
    'When a recommended action would concretely help (e.g. a specific overdue/high-risk asset needs a work order, or a work order should be reprioritised), propose it as a draft_action instead of just describing it in prose. Only propose actions backed by specific IDs present in the supplied data — never invent an asset_id or work_order_id. If nothing warrants an action, return an empty draft_actions array. These are PROPOSALS ONLY — you are not executing anything.',
  ].join(' ') + fleetSkillsPromptLine;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ question, context }) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'operational_response', strict: true, schema: RESPONSE_SCHEMA },
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) return new Response(JSON.stringify({ error: 'AI provider request failed', detail: payload?.error?.message ?? 'Unknown provider error' }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });

  const raw = payload?.choices?.[0]?.message?.content;
  let parsed: { answer: string; draft_actions: unknown[] };
  try {
    parsed = raw ? JSON.parse(raw) : { answer: 'No answer was returned.', draft_actions: [] };
  } catch {
    parsed = { answer: typeof raw === 'string' ? raw : 'No answer was returned.', draft_actions: [] };
  }

  return new Response(JSON.stringify({ answer: parsed.answer, draft_actions: parsed.draft_actions ?? [] }), { headers: { ...cors, 'Content-Type': 'application/json' } });
});
