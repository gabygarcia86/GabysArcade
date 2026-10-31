-- Touch the Beat online leaderboards: one top 10 per song and difficulty.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It's safe to run again.
--
-- The website uses a public key, so these rules decide what visitors can do:
-- they can read the boards and add a score, but never edit or delete one.

create table if not exists public.touch_the_beat_scores (
  id bigint generated always as identity primary key,
  song text not null,
  difficulty text not null,
  nickname text not null,
  score integer not null,
  accuracy numeric(5, 2) not null,
  created_at timestamptz not null default now(),
  constraint song_format check (song ~ '^[a-z0-9-]{1,80}$'),
  constraint difficulty_known check (difficulty in ('easy', 'normal', 'hard')),
  constraint nickname_length check (char_length(nickname) between 1 and 16),
  constraint nickname_trimmed check (nickname = btrim(nickname)),
  constraint nickname_printable check (nickname !~ '[[:cntrl:]]'),
  constraint score_range check (score between 1 and 2000000000),
  constraint accuracy_range check (accuracy between 0 and 100)
);

-- Keeps each board's top 10 query fast as the table grows.
create index if not exists touch_the_beat_scores_rank_idx
  on public.touch_the_beat_scores (song, difficulty, score desc, created_at asc);

alter table public.touch_the_beat_scores enable row level security;

-- Column-level grants stop visitors setting their own id or created_at.
revoke all on table public.touch_the_beat_scores from anon, authenticated;
grant select (song, difficulty, nickname, score, accuracy, created_at) on table public.touch_the_beat_scores to anon;
grant insert (song, difficulty, nickname, score, accuracy) on table public.touch_the_beat_scores to anon;

drop policy if exists "Public can read scores" on public.touch_the_beat_scores;
create policy "Public can read scores"
  on public.touch_the_beat_scores
  for select to anon
  using (true);

drop policy if exists "Public can add scores" on public.touch_the_beat_scores;
create policy "Public can add scores"
  on public.touch_the_beat_scores
  for insert to anon
  with check (score > 0);

-- Maintenance. These are examples, so leave them commented out and run them
-- one at a time when you need them.
--
-- See the newest entries, with the id needed to remove one:
--   select id, song, difficulty, nickname, score, accuracy, created_at
--   from public.touch_the_beat_scores
--   order by created_at desc
--   limit 50;
--
-- Remove one entry:
--   delete from public.touch_the_beat_scores where id = 123;
--
-- Wipe one song's boards, for example after recompiling its shipped charts:
--   delete from public.touch_the_beat_scores where song = 'neon-drive';
--
-- Wipe every board:
--   truncate table public.touch_the_beat_scores restart identity;
