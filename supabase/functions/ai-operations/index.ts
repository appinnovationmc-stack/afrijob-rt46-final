import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  const [workOrders, incidents, assets, breaches] = await Promise.all([
    supabase.from('work_orders').select('status,priority,category,actual_cost,created_at,due_at').limit(500),
    supabase.from('incidents').select('status,severity,created_at').limit(500),
    supabase.from('assets').select('status,asset_type_id').limit(500),
    supabase.from('sla_breaches').select('severity,acknowledged,breached_at').limit(500),
  ]);

  const errors = [workOrders.error, incidents.error, assets.error, breaches.error].filter(Boolean);
  if (errors.length) return new Response(JSON.stringify({ error: 'Unable to read operational data for this organisation' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });

  const context = {
    work_orders: workOrders.data ?? [],
    incidents: incidents.data ?? [],
    assets: assets.data ?? [],
    sla_breaches: breaches.data ?? [],
  };

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return new Response(JSON.stringify({ error: 'AI provider is not configured. Set OPENAI_API_KEY on the ai-operations function.' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });

  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'You are AfriOps Operational Intelligence. Answer using only the supplied organisation operational data. Never invent values. If the data is insufficient, say so. Prioritise concrete risks, causes, and recommended actions. Keep answers concise and executive-friendly.' },
        { role: 'user', content: JSON.stringify({ question, context }) },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) return new Response(JSON.stringify({ error: 'AI provider request failed', detail: payload?.error?.message ?? 'Unknown provider error' }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify({ answer: payload?.choices?.[0]?.message?.content ?? 'No answer was returned.' }), { headers: { ...cors, 'Content-Type': 'application/json' } });
});
