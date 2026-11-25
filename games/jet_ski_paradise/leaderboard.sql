-- Jet Ski Paradise online leaderboard: one table, the game shows its top 10.
-- Scores come from Stunt Showdown (the 2-minute freestyle mode in the Stunt Arena).
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It's safe to run again.
--
-- The website uses a public key, so these rules decide what visitors can do:
-- they can read the board and add a score, but never edit or delete one.
-- Scores are calculated in the browser, so the limits below reject impossible
-- entries but can't prove that a believable one was honestly earned.
--
-- Column meanings:
--   score       Stunt points banked during the session.
--   tricks      Tricks landed.
--   best_combo  Most tricks chained into one combo.
--   ski         The jet ski model ridden.
--   seconds     Session length (Stunt Showdown is 120 seconds).

create table if not exists public.jet_ski_paradise_scores (
  id bigint generated always as identity primary key,
  nickname text not null,
  score integer not null,
  tricks integer not null,
  best_combo integer not null,
  ski text not null,
  seconds integer not null,
  created_at timestamptz not null default now(),
  constraint nickname_length check (char_length(nickname) between 1 and 16),
  constraint nickname_trimmed check (nickname = btrim(nickname)),
  constraint nickname_printable check (nickname !~ '[[:cntrl:]]'),
  constraint seconds_range check (seconds between 100 and 140),
  -- Even the shortest trick takes over half a second of air, so 300 is far beyond reach.
  constraint tricks_range check (tricks between 1 and 300),
  constraint combo_range check (best_combo between 1 and tricks),
  -- The best trick is worth 1,500, times a x5 combo, times a x2 ring bonus,
  -- plus a 250 perfect-landing bonus.
  constraint score_possible check (score between 1 and tricks * 15250),
  constraint ski_known check (ski in ('paradise100', 'waverunner', 'oceanbeast', 'turbosplash', 'aquaracer', 'stormchaser', 'hydrox', 'ultimatepro'))
);

-- Keeps the top 10 query fast as the table grows.
create index if not exists jet_ski_paradise_scores_rank_idx
  on public.jet_ski_paradise_scores (score desc, created_at asc, id asc);

alter table public.jet_ski_paradise_scores enable row level security;

-- Column-level grants stop visitors setting their own id or created_at.
-- id and created_at are readable only so that tied scores sort consistently.
revoke all on table public.jet_ski_paradise_scores from anon, authenticated;
grant select (id, nickname, score, tricks, best_combo, ski, seconds, created_at)
  on table public.jet_ski_paradise_scores to anon;
grant insert (nickname, score, tricks, best_combo, ski, seconds)
  on table public.jet_ski_paradise_scores to anon;

drop policy if exists "Public can read scores" on public.jet_ski_paradise_scores;
create policy "Public can read scores"
  on public.jet_ski_paradise_scores
  for select to anon
  using (true);

drop policy if exists "Public can add scores" on public.jet_ski_paradise_scores;
create policy "Public can add scores"
  on public.jet_ski_paradise_scores
  for insert to anon
  with check (score > 0);

-- Tells the API about the new table straight away.
notify pgrst, 'reload schema';

-- Maintenance. These are examples, so leave them commented out and run them
-- one at a time when you need them.
--
-- See the newest entries, with the id needed to remove one:
--   select id, nickname, score, tricks, best_combo, ski, seconds, created_at
--   from public.jet_ski_paradise_scores
--   order by created_at desc
--   limit 50;
--
-- Remove one entry:
--   delete from public.jet_ski_paradise_scores where id = 123;
--
-- Wipe the whole board:
--   truncate table public.jet_ski_paradise_scores restart identity;
