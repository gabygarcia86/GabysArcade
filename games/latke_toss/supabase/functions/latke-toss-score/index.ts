// Latke Toss leaderboard Edge Function. The only way scores get onto the boards.
//
//   POST { action: 'start', difficulty }
//     -> { token }  A single-use ticket for one round on one difficulty, requested when the
//                   round starts.
//   POST { action: 'submit', token, difficulty, nickname, score, events }
//     -> { score }  Replays the round's event log (see verify.js), checks the round really
//                   lasted a full round, then saves the score.
//
// Deploy with JWT verification off, because the game calls it with no signed-in user.
// See the "Online leaderboards" section of the game's README.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyRound, cleanName, isDifficulty, LIMITS } from './verify.js';

const ROUNDS = 'latke_toss_rounds';
const SCORES = 'latke_toss_scores';
const MAX_BODY_BYTES = 128 * 1024;
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
};

// Supabase provides these. Projects on the newer API keys get SUPABASE_SECRET_KEYS (a JSON
// object of named keys); older projects get SUPABASE_SERVICE_ROLE_KEY.
function secretKey(): string {
  const named = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (named) {
    try {
      const keys = JSON.parse(named);
      if (typeof keys.default === 'string') return keys.default;
    } catch {
      // Fall through to the older variable.
    }
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  throw new Error('No Supabase secret key is available to this function.');
}

const db = createClient(Deno.env.get('SUPABASE_URL')!, secretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function startRound(body: Record<string, unknown>): Promise<Response> {
  if (!isDifficulty(body.difficulty)) return reply(400, { error: 'Unknown difficulty.' });
  const now = Date.now();
  // Clears out rounds nobody submitted, so the table stays small.
  const cutoff = new Date(now - LIMITS.roundMaxAgeSeconds * 1000).toISOString();
  const { error: cleanupError } = await db.from(ROUNDS).delete().lt('started_at', cutoff);
  if (cleanupError) console.error('Round cleanup failed', cleanupError);

  // The start time comes from this function's clock, the same one submitRound checks against.
  const { data, error } = await db
    .from(ROUNDS)
    .insert({ difficulty: body.difficulty, started_at: new Date(now).toISOString() })
    .select('id')
    .single();
  if (error) throw error;
  return reply(200, { token: data.id });
}

async function submitRound(body: Record<string, unknown>): Promise<Response> {
  const { token, difficulty, nickname, score, events } = body;
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    return reply(400, { error: 'This round has no leaderboard ticket, so it can\'t be submitted.' });
  }
  const name = cleanName(nickname ?? '');
  if (!name) return reply(400, { error: 'Enter a name first.' });
  if (!Number.isSafeInteger(score) || (score as number) < 1) {
    return reply(400, { error: 'Only scores above zero go on the board.' });
  }

  const result = verifyRound(events, score, difficulty);
  if (!result.ok) return reply(422, { error: `Score rejected: ${result.reason}.` });

  const { data: round, error } = await db
    .from(ROUNDS)
    .select('difficulty, started_at, submitted_at')
    .eq('id', token)
    .maybeSingle();
  if (error) throw error;
  const ageSeconds = round ? (Date.now() - Date.parse(round.started_at)) / 1000 : Infinity;
  if (!round || ageSeconds > LIMITS.roundMaxAgeSeconds) {
    return reply(404, { error: 'This round has expired, so it can\'t be submitted.' });
  }
  if (round.difficulty !== difficulty) {
    return reply(422, { error: 'Score rejected: the round was played on a different difficulty.' });
  }
  if (round.submitted_at) return reply(409, { error: 'This round was already submitted.' });
  if (ageSeconds < result.minSeconds - LIMITS.clockSlackSeconds) {
    // The ticket isn't used up, so a real player who hit a clock hiccup can simply retry.
    return reply(425, { error: 'Score rejected: the round finished sooner than it could have. Try again in a few seconds.' });
  }

  // Marks the ticket used. The submitted_at filter makes this safe if two requests race.
  const { data: claimed, error: claimError } = await db
    .from(ROUNDS)
    .update({ submitted_at: new Date().toISOString() })
    .eq('id', token)
    .is('submitted_at', null)
    .select('id');
  if (claimError) throw claimError;
  if (!claimed || claimed.length === 0) return reply(409, { error: 'This round was already submitted.' });

  const { error: insertError } = await db.from(SCORES).insert({ difficulty, nickname: name, score: result.score });
  if (insertError) throw insertError;
  return reply(200, { score: result.score });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });

  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return reply(413, { error: 'The round log is too long.' });
    body = JSON.parse(text);
    if (!body || typeof body !== 'object') throw new Error('not an object');
  } catch {
    return reply(400, { error: 'The request wasn\'t valid JSON.' });
  }

  try {
    if (body.action === 'start') return await startRound(body);
    if (body.action === 'submit') return await submitRound(body);
    return reply(400, { error: 'Unknown action.' });
  } catch (error) {
    console.error(error);
    return reply(500, { error: 'The leaderboard had a problem. Try again.' });
  }
});
