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
    supabase.from('assets').select('id,status,asset_type_id,risk_score,risk_factors').limit(500),
    supabase.from('sla_breaches').select('severity,acknowledged,breached_at').limit(500),
    supabase.from('domain_events').select('event_type,entity_type,entity_id,payload,created_at').order('created_at', { ascending: false }).limit(100),
  ]);

  const errors = [workOrders.error, incidents.error, assets.error, breaches.error, events.error].filter(Boolean);
  if (errors.length) return new Response(JSON.stringify({ error: 'Unable to read operational data for this organisation' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });

  const industryMode = (membership.data as { organisations?: { industry_mode?: string } } | null)?.organisations?.industry_mode ?? 'general';
  const industryContext = INDUSTRY_PROMPT_CONTEXT[industryMode] ?? INDUSTRY_PROMPT_CONTEXT.general;

  const context = {
    work_orders: workOrders.data ?? [],
    incidents: incidents.data ?? [],
    assets: assets.data ?? [],
    sla_breaches: breaches.data ?? [],
    recent_events: events.data ?? [],
  };

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return new Response(JSON.stringify({ error: 'AI provider is not configured. Set OPENAI_API_KEY on the ai-operations function.' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });

  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';
  const systemPrompt = [
    `You are AfriOps Operational Intelligence for a ${industryContext.label} organisation.`,
    `Use this industry's vocabulary where natural: ${industryContext.glossary.join(', ')}.`,
    'Answer using only the supplied operational data. Never invent values. If the data is insufficient, say so.',
    'Prioritise concrete risks, causes, and recommended actions. Keep answers concise and executive-friendly.',
    'When a recommended action would concretely help (e.g. a specific overdue/high-risk asset needs a work order, or a work order should be reprioritised), propose it as a draft_action instead of just describing it in prose. Only propose actions backed by specific IDs present in the supplied data — never invent an asset_id or work_order_id. If nothing warrants an action, return an empty draft_actions array. These are PROPOSALS ONLY — you are not executing anything.',
  ].join(' ');

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
