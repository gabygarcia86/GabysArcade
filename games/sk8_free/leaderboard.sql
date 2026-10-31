-- Sk8 Free online leaderboards: one table, with a top 10 for everyone, for
-- runs ended by the Cop, and for runs ended by Karen.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It's safe to run again.
--
-- The website uses a public key, so these rules decide what visitors can do:
-- they can read the boards and add a score, but never edit or delete one.

create table if not exists public.sk8_free_scores (
  id bigint generated always as identity primary key,
  nickname text not null,
  score integer not null,
  meters integer not null,
  pursuer text not null,
  created_at timestamptz not null default now(),
  constraint nickname_length check (char_length(nickname) between 1 and 16),
  constraint nickname_trimmed check (nickname = btrim(nickname)),
  constraint nickname_printable check (nickname !~ '[[:cntrl:]]'),
  constraint score_range check (score between 1 and 2000000000),
  constraint meters_range check (meters between 0 and 2000000000),
  constraint pursuer_known check (pursuer in ('cop', 'karen'))
);

-- Keep the top 10 queries fast as the table grows: one for the ALL tab, and one
-- for the COP and KAREN tabs.
create index if not exists sk8_free_scores_rank_idx
  on public.sk8_free_scores (score desc, created_at asc);
create index if not exists sk8_free_scores_pursuer_rank_idx
  on public.sk8_free_scores (pursuer, score desc, created_at asc);

alter table public.sk8_free_scores enable row level security;

-- Column-level grants stop visitors setting their own id or created_at.
revoke all on table public.sk8_free_scores from anon, authenticated;
grant select (nickname, score, meters, pursuer, created_at) on table public.sk8_free_scores to anon;
grant insert (nickname, score, meters, pursuer) on table public.sk8_free_scores to anon;

drop policy if exists "Public can read scores" on public.sk8_free_scores;
create policy "Public can read scores"
  on public.sk8_free_scores
  for select to anon
  using (true);

drop policy if exists "Public can add scores" on public.sk8_free_scores;
create policy "Public can add scores"
  on public.sk8_free_scores
  for insert to anon
  with check (score > 0);

-- Maintenance. These are examples, so leave them commented out and run them
-- one at a time when you need them.
--
-- See the newest entries, with the id needed to remove one:
--   select id, nickname, score, meters, pursuer, created_at
--   from public.sk8_free_scores
--   order by created_at desc
--   limit 50;
--
-- Remove one entry:
--   delete from public.sk8_free_scores where id = 123;
--
-- Wipe every board:
--   truncate table public.sk8_free_scores restart identity;
