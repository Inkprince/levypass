# LevyPass

Market and motor-park traders pay their levies by USSD, transfer or card. The money settles straight to the
government's bank account, and an officer confirms payment with one QR scan. No cash changes hands, a receipt
cannot be faked, and every naira can be traced from the trader's phone to the bank's settlement report. LevyPass
is Team FET's entry for Access Youth Tech Forge 2026, Track 01 (Payments and Financial Infrastructure).

## What you can do with it

| Who | Where | What happens |
| --- | --- | --- |
| Trader | `/register`, `/pass`, or USSD `*347*13#` | Registers with a phone OTP and gets a signed QR pass. Pays what is due. The SMS receipt arrives in seconds. |
| Officer | `/officer` (installable) | Scans a trader's QR: full-screen **PAID** or **NOT PAID** in under a second, with a pay-now code. Every scan is logged with GPS. |
| Anyone | phone camera, `/r` | Scans a trader's QR or an officer's ID, or checks a receipt number. A fake receipt or a suspended officer raises a flag. |
| Revenue office | `/admin` | Live collections, compliance, fraud and complaint queue, officer suspension, levies with their legal basis, reconciliation with the bank, failure drills. |
| Demo | `/demo`, `/sim` | The five-minute script with one tap into each role, and a feature-phone simulator with SMS inbox and USSD keypad. |

## Architecture

```
 Trader phone / feature-phone sim     Officer phone (PWA)        Admin laptop
            |                                |                       |
            +--------------- https://team13.xtradot.co --------------+
                                     |
                     Next.js, one container (Service app :80 -> pod :8080)
                     routes, API, webhook, in-process poller
                     src/core: money, Lagos periods, allocation, tokens
                                     |
              +----------------------+----------------------+
              |                      |                      |
      Postgres 16 (PVC)      Xtradot Bank sandbox     Huawei MaaS
      append-only ledger     checkout, verify,        complaint triage
                             settlement, reconcile    (keyword fallback)
```

Every payment, whatever the rail, is a checkout under the collection merchant. The bank confirms by signed
webhook. LevyPass verifies it server to server, then allocates, posts the ledger, issues the receipt and queues
the SMS in one database transaction. A poller requeries anything unconfirmed, so a lost webhook still settles.

## Money rules (what a banker will ask)

1. Integer kobo inside. NGN with two decimals only at the bank boundary, converted in one file.
2. Double-entry ledger, append-only: a database trigger rejects UPDATE, DELETE and TRUNCATE. Every total on the
   dashboard is recomputed from it.
3. Verify before value: a webhook or a redirect is only a hint until `GET /payments/{ref}/verify` confirms it.
4. Idempotent both ways: an `Idempotency-Key` on every bank POST, written down before the call. Incoming
   webhooks are de-duplicated on `event_id`.
5. On a timeout or 504, never resend. The payment is marked unknown and requeried until final.
6. One obligation per trader, levy and period (unique index). A second payment for a paid period is flagged as
   a double charge and credited to the next period.
7. Nothing is silently lost: unmatched money and unsettled overpayments go to a review queue.
8. Webhook signatures: HMAC-SHA256 over `{timestamp}.{raw_body}`, constant-time compare, 5-minute window.
9. Fees come from the bank's response, booked as their own ledger entries.
10. Allocation, ledger, obligation update, receipt and SMS happen in one transaction.
11. Periods are computed in Africa/Lagos time, so "paid today" turns over at midnight in Lagos, not 01:00.

The failure drills (`/admin/failures`) prove rules 3, 4, 6 and 8 live: a withheld webhook, a replayed webhook,
a forged signature and a second payment for a paid day.

## Run it locally

Needs Node 22 and Docker. Local runs use a fake bank that copies the sandbox's recorded behaviour.

```bash
npm install
cp .env.example .env.local
npm run db:up && npm run db:migrate && npm run db:seed
npm run dev                         # http://localhost:3000, then open /demo
```

Seeded logins (local only): admin `revenue@levypass.test` / `levypass-admin`, officers `OTT-001` to `OTT-003`
with PIN `1357`. Seeded traders use phone numbers `+2347000000101` to `+2347000000140`.

| Command | What it does |
| --- | --- |
| `npm test` | 155 tests: core money logic, bank shapes, webhook to ledger, failure drills (needs `db:up`) |
| `npm run typecheck && npm run lint` | strict TypeScript and lint |
| `npm run demo:reset` | rebuild the database, re-seed, drop the old bank webhook (the app re-registers it) |
| `npm run deploy` | build linux/amd64, tag with the Git SHA, push, apply, wait for rollout |

## Deploy (Forge cluster, namespace team13)

1. Once: `scripts/create-secrets.sh` (generates and applies the app's secrets without printing them; demo
   logins go to `~/forge/levypass-demo-logins.txt`), and image pull access for `ghcr.io/inkprince/levypass`.
2. `npm run deploy`, then `kubectl exec deploy/app -- node dist/seed.mjs` the first time.
3. Before the public URL opens: `kubectl port-forward svc/app 8080:80` and use `http://localhost:8080`.

## Honest limits

- Synthetic data only. The authority, market and people are invented.
- The collection merchant is the sandbox's `mer_204`. Per-trader virtual accounts work in the sandbox but their
  money never reaches settlement, so payments go through checkouts (details in `docs/bank-api-notes.md`).
- Huawei MaaS rejected our team key during the build. Complaint triage falls back to keyword rules and says so.
- SMS and USSD run through the built-in simulator. Going live is an adapter swap (Africa's Talking shape).

Plan and decisions: `tasks/plan.md`. Sandbox facts: `docs/forge-platform.md`. Recorded bank shapes:
`docs/bank-api-notes.md`. Product requirements: `docs/PRD.md`.
