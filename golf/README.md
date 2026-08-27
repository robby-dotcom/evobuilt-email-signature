# Hollywood

666 golf — four players, rotating partners, scored as 4BBB Stableford, played
for skins.

## The game

Partners rotate every six holes so everyone partners everyone once:

| Holes | | |
|---|---|---|
| 1–6 | P1 & P2 | v P3 & P4 |
| 7–12 | P1 & P3 | v P2 & P4 |
| 13–18 | P1 & P4 | v P2 & P3 |

Each hole goes to the **better ball of each pair, scored as Stableford** off
playing handicaps — highest points wins. Every skin pays **both players on the
winning side**, funded by the two losers: winners +$5 each, losers −$5 each, so
the ledger always nets to zero.

Five ways to win a skin:

| Skin | Trigger |
|---|---|
| Hole | Best team Stableford points |
| Birdie | **Gross** score under par |
| Sandie | In a bunker and **gross** par or better |
| Closest to the pin | Par 3s only |
| Long drive | Par 5s only |

Junk is gross on purpose: handicaps decide who wins the hole, junk rewards real
golf. A net birdie takes the hole but collects no birdie skin.

A **halved hole carries its hole skin** to the next — hole 7 can be worth 3.
Junk never carries; it always pays on the hole it happens.

## Running it

```bash
npm install
npm run dev          # vite on :5173, proxying /api to :3000
node server/index.js # api + built app on :3000
npm test             # scoring engine — 37 cases
npm run build && npm start
```

`DATABASE_URL` is optional. Without it the app runs **phones-only**: everything
still works, nothing is persisted and the header says so.

## Deploying to Railway

1. New Railway project → deploy from this repo.
2. **Set the root directory to `golf`** — the repo root is a static asset host,
   not this app.
3. Add one variable, `DATABASE_URL`, from Supabase → Connect → **Transaction
   pooler** (the pooler, not the direct connection — Railway needs IPv4).
4. Deploy. The `golf` schema is created on first boot; there is no migration
   step to remember.

`PORT` is supplied by Railway. Nothing else is needed.

## How it's put together

**Only facts are stored.** The database holds gross scores and a few taps.
Skins, Stableford points, carryover and the money are derived on every read by
`src/lib/scoring.ts`. That is what lets a score mistyped on the 3rd be corrected
from the 17th and have the whole weekend recompute. Never persist the dollars.

**The phone is the source of truth mid-round.** Every change writes to
localStorage first; the network write is queued behind it and flushed when
signal returns. Score entry can never block on a dead spot, which matters on a
course. A service worker caches the shell so the app opens with no bars.

**No credential reaches the browser.** All database access goes through the
Express server. The client only ever talks to `/api`.

**Courses are data.** Enter a card's pars and stroke index once — validated as a
real permutation of 1–18 — and it's kept and reused. That's how any other course
gets added.

## Tests

```bash
npm test                       # engine: rotation, handicaps, carryover, ledger
node e2e/smoke.mjs             # full round in a real browser (needs playwright)
node e2e/sync.mjs              # two devices + offline queue (needs DATABASE_URL)
```

The engine suite includes a property test asserting the ledger sums to exactly
zero across randomised rounds, and a regression guard on the one bug that would
be invisible and expensive: Stableford is **highest wins**, the inverse of gross
better-ball.
