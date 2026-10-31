-- Galactic Squadron online leaderboard.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It's safe to run again.
--
-- The website uses a public key, so these rules decide what visitors can do:
-- they can read the board and add a score, but never edit or delete one.

create table if not exists public.galactic_squadron_scores (
  id bigint generated always as identity primary key,
  nickname text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  constraint nickname_length check (char_length(nickname) between 1 and 16),
  constraint nickname_trimmed check (nickname = btrim(nickname)),
  constraint nickname_printable check (nickname !~ '[[:cntrl:]]'),
  constraint score_range check (score between 1 and 999999999)
);

-- Keeps the top 10 query fast as the table grows.
create index if not exists galactic_squadron_scores_rank_idx
  on public.galactic_squadron_scores (score desc, created_at asc);

alter table public.galactic_squadron_scores enable row level security;

-- Column-level grants stop visitors setting their own id or created_at.
revoke all on table public.galactic_squadron_scores from anon, authenticated;
grant select (nickname, score, created_at) on table public.galactic_squadron_scores to anon;
grant insert (nickname, score) on table public.galactic_squadron_scores to anon;

drop policy if exists "Public can read scores" on public.galactic_squadron_scores;
create policy "Public can read scores"
  on public.galactic_squadron_scores
  for select to anon
  using (true);

drop policy if exists "Public can add scores" on public.galactic_squadron_scores;
create policy "Public can add scores"
  on public.galactic_squadron_scores
  for insert to anon
  with check (score > 0);

-- Maintenance. These are examples, so leave them commented out and run them
-- one at a time when you need them.
--
-- See the newest entries, with the id needed to remove one:
--   select id, nickname, score, created_at
--   from public.galactic_squadron_scores
--   order by created_at desc
--   limit 50;
--
-- Remove one entry:
--   delete from public.galactic_squadron_scores where id = 123;
--
-- Wipe the whole board:
--   truncate table public.galactic_squadron_scores restart identity;
