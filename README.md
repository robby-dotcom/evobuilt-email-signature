# EvoBuilt Assets

Static asset hosting for EvoBuilt — team headshots, logos, and signature images.

Served via GitHub Pages at: https://robby-dotcom.github.io/evobuilt-email-signature/

## Structure

```
headshots/    - Team headshots (colour-graded, 450x450)
logos/        - EvoBuilt logos, awards, social icons
golf-app/     - Hollywood golf scorer (built output — see below)
```

## Usage

Reference images via stable URLs:
- `https://robby-dotcom.github.io/evobuilt-email-signature/headshots/Robby.jpg`
- `https://robby-dotcom.github.io/evobuilt-email-signature/logos/evobuilt-logo.png`

Used in the EvoBuilt Email Signature Generator.

## Hollywood golf scorer

https://robby-dotcom.github.io/evobuilt-email-signature/golf-app/

666 golf — four players, partners rotating every six holes, each hole
decided by the better ball of each pair scored as Stableford off playing
handicaps, played for skins at $5 each. Skins come from winning the hole,
a gross birdie, a sandie, closest to the pin on par 3s and long drive on
par 5s, and every skin pays both players on the winning side.

Add to your home screen and it works with no reception — scores are held
on the phone and sync when signal returns. Round links carry a `#`, e.g.
`.../golf-app/#/r/ABC123`; share that and everyone sees the same card.

Source lives on the `claude/app-planning-requirements-cmnilw` branch under
`golf/`. `golf-app/` here is build output only — edit the source, run
`npm run build:pages`, and copy the result across. The API is a Supabase
edge function, so no database credential is ever served to a browser.
