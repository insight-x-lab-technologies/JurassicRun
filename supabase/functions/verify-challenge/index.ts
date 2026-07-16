// Edge Function (Deno). Re-simula (seed, timeline) de challenge_entries não-verificados
// e marca verified=true nos fiéis. Só o service_role passa pelo trigger lock_verified.
// NÃO testada por unidade (casca) — a lógica vive em _verify.bundle.js (guarda em Vitest).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyChallengeSubmission } from './_verify.bundle.js';

const SCHEMA = 'jurassicrun';
const TABLE = 'challenge_entries';
const BATCH = 100;

interface Row {
  id: number; seed: string; timeline: boolean[];
  score: number; distance: number; food: number; near_misses: number; final_hash: string;
}

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'missing env' }), { status: 500 });
  }
  const supabase = createClient(url, key, { db: { schema: SCHEMA } });

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, seed, timeline, score, distance, food, near_misses, final_hash')
    .eq('verified', false)
    .limit(BATCH);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const rows = (data ?? []) as Row[];
  let verified = 0;
  for (const r of rows) {
    const result = verifyChallengeSubmission({
      seed: r.seed,
      timeline: Array.isArray(r.timeline) ? r.timeline : [],
      score: r.score, distance: r.distance, food: r.food, nearMisses: r.near_misses,
      finalHash: r.final_hash,
    });
    if (result.valid) {
      const upd = await supabase.from(TABLE).update({ verified: true }).eq('id', r.id);
      if (!upd.error) verified += 1;
    }
  }
  return new Response(JSON.stringify({ checked: rows.length, verified }), {
    headers: { 'content-type': 'application/json' },
  });
});
