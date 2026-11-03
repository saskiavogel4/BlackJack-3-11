# Blackjack

A browser blackjack game powered by the free [Deck of Cards API](https://deckofcardsapi.com).
Plain HTML, CSS, and JavaScript — no build step.

## How it uses the API

| Action | Endpoint |
| --- | --- |
| Open a new 6-deck shoe | `GET /api/deck/new/shuffle/?deck_count=6` |
| Deal / hit | `GET /api/deck/<deck_id>/draw/?count=N` |
| Reshuffle the shoe (under 75 cards left) | `GET /api/deck/<deck_id>/shuffle/` |
| Card images | `card.image` from each draw, `static/img/back.png` for the dealer's hole card |

## Rules

- Start with a $1,000 bankroll (saved in your browser).
- Bet with $5 / $25 / $100 / $500 chips.
- Hit, stand, or double down on your first two cards.
- Dealer stands on all 17s. Blackjack pays 3:2, wins pay 1:1, ties push.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

## Deploy to Netlify

Connect the repo in Netlify (or drag the folder into Netlify Drop). No build command is needed —
`netlify.toml` publishes the repository root.

## Google sign-in (Supabase)

`auth.js` signs players in with Google through Supabase Auth
(project `cgjqyuyobcgkavdjqtdh`). Signed-in players see a greeting with their first name
and Google profile picture. Signing in is optional — anyone can still play.

Supabase setup checklist:

1. **Authentication → Providers → Google**: enabled, with the Google OAuth client ID and secret.
2. In Google Cloud Console, the OAuth client's authorized redirect URI is
   `https://cgjqyuyobcgkavdjqtdh.supabase.co/auth/v1/callback`.
3. **Authentication → URL Configuration**: set **Site URL** to the Netlify URL and add it
   (plus `http://localhost:8000` for local testing) to **Redirect URLs**.
