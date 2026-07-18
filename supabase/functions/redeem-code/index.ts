// Edge Function: valida e resgata um código single-use (8.4).
// service_role: único papel que acessa jurassicrun.redemption_codes (deny-by-default).
import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { db: { schema: 'jurassicrun' } },
    );

    // Quem está resgatando (best-effort; single-use é a proteção real).
    let redeemedBy: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const { data } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      redeemedBy = data.user?.id ?? null;
    }

    const body = (await req.json().catch(() => ({}))) as { code?: unknown };
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (code === '') return json({ ok: false, reason: 'invalid' });

    const { data: row, error: selErr } = await supabase
      .from('redemption_codes')
      .select('sku, redeemed_by')
      .eq('code', code)
      .maybeSingle();
    if (selErr) return json({ ok: false, reason: 'error' });
    if (!row) return json({ ok: false, reason: 'invalid' });
    if (row.redeemed_by) return json({ ok: false, reason: 'used' });

    // Claim atômico: só vence quem ainda vê redeemed_by null.
    const { data: claimed, error: updErr } = await supabase
      .from('redemption_codes')
      .update({ redeemed_by: redeemedBy, redeemed_at: new Date().toISOString() })
      .eq('code', code)
      .is('redeemed_by', null)
      .select('sku');
    if (updErr) return json({ ok: false, reason: 'error' });
    if (!claimed || claimed.length === 0) return json({ ok: false, reason: 'used' });

    return json({ ok: true, sku: row.sku });
  } catch {
    return json({ ok: false, reason: 'error' });
  }
});
