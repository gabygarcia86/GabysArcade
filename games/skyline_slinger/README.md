## Online leaderboard

The top 10 is stored in Supabase, ranked by distance. More stars breaks a tie. Open it from **Leaderboard** on the start screen or **View leaderboard** after a run. If a run covered any distance, the game over screen lets the player enter a name and submit. Each run can be submitted once.

**Setup:** run `leaderboard.sql` once in the Supabase SQL Editor. It creates the `skyline_slinger_scores` table and its access rules. The project address and publishable key are at the top of `leaderboard.js`.

The publishable key is public by design. Visitors can read the board and add scores, but can't edit or delete them. Scores are sent from the browser, so someone determined could still post a fake one. `leaderboard.sql` ends with commented examples for reviewing and removing entries.

If Supabase can't be reached, the game still plays and the leaderboard screens show an error.

When you change `script.js`, `leaderboard.js` or `styles.css`, raise the `?v=` number on its link in `index.html` so browsers fetch the new file instead of a cached copy.

## TODO
