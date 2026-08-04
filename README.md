# מספרת לידור — Booking App

Hebrew RTL booking site for **מספרת לידור** (אבנר בן נר 1, אשדוד).  
Stack: Next.js 15 App Router, Supabase Postgres (`postgres`.js), Cloudflare Workers via OpenNext, Resend email, SMS HTTP API.

## Features

- Public booking (service → day → slot → name/phone/optional email)
- Auto-confirm; DB exclusion constraint prevents double-booking
- SMS confirmation + 24h reminder; email when client provides an address (kosher phones)
- Admin: today board, week, services, hours, message log
- Owner password change via email OTP (Resend)

## Setup

1. Create a Supabase project. Use the **pooled** connection string as `DATABASE_URL`.
2. Run migrations:

```bash
# with psql or Supabase SQL editor
psql "$DATABASE_URL" -f supabase/migrations/001_init.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```

3. Copy `.env.example` → `.env.local` and fill secrets.

```bash
# generate password hash
node -e "require('bcryptjs').hash('YOUR_PASSWORD',10).then(console.log)"
```

4. Install & run:

```bash
npm install
npm run dev
```

Open http://localhost:3000 — admin at `/admin`.

## Tests

```bash
npm test
```

Slot generator tests (back-to-back, overlap, Friday/Saturday, DST, lead time) must stay green before changing availability.

## Cron (outbox)

Hit every 5 minutes with shared secret:

```bash
curl -X POST https://YOUR_DOMAIN/api/cron/outbox \
  -H "x-cron-secret: $CRON_SECRET"
```

On Cloudflare Workers, configure a Cron Trigger that calls this route.

## Deploy (Cloudflare)

```bash
npx opennextjs-cloudflare build
npx wrangler deploy
```

See `open-next.config.ts` and `wrangler.toml`.

## Shop

| | |
|---|---|
| Name | מספרת לידור |
| Phone | 053-530-1669 (`+972535301669`) |
| Address | אבנר בן נר 1, אשדוד, ישראל |

## Spec notes

- Never trust `endAt` / price / duration from the client
- Availability is server-side only
- Postgres error `23P01` → “התור נתפס”
