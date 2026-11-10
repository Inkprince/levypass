# Implementation plan: LevyPass for Forge 2026

Written 10 Nov 2026, about 16:40 WAT. Tasks are tracked in `tasks/todo.md`.

## Where we stand

- The repo holds the PRD and the sandbox guide. There is no code yet.
- The PRD scheduled registration, payments and the ledger for day 1 (9 Nov). That work has not
  started, so the PRD's three-day plan is compressed here into what is left: tonight and 11 Nov
  for building, 12 Nov for rehearsal, 13 Nov demo.
- Four things block deployment and need a person (Phase 0 below). Local work can start without them.

## How we win

We do not have the judging rubric yet (H3). Until we do, the plan aims at what the sandbox guide
itself says is observed: gateway calls are "logged and metered per team for ... judging", and the
resend-on-timeout double debit "is assessed". So the bet is:

1. **A complete loop, live, that a judge can run on their own phone.** Trader QR codes encode a
   public URL on `team13.xtradot.co`, so any phone camera can scan one and see Paid or Not paid.
   No slides standing in for features.
2. **Bank-grade money handling that we can show, not just claim.** Append-only double-entry
   ledger, idempotency in both directions, verify before value, requery on timeout, and a
   reconciliation screen where ledger and bank settlement match to the kobo.
3. **Deep use of the platform.** Virtual accounts, checkout, USSD simulation, signed webhooks,
   settlements, reconciliation and Huawei MaaS all appear in our gateway logs.
4. **A failure demo.** Most teams show the happy path. We withhold a webhook, replay one, forge a
   signature and pay twice in front of the judges, and show each one handled.
5. **A reason for Access Bank to care.** Collection balances, a route to unbanked traders, and
   payment history that can feed credit, with consent.

No plan guarantees a win. This one removes the usual ways hackathon teams lose: a demo that
breaks, a feature list with no working loop, and money logic that fails a banker's first question.

## Changes from the PRD

The PRD predates the sandbox guide. These replace PRD section 7.1 and 8.

| PRD said | We do | Why |
| --- | --- | --- |
| Paystack or Flutterwave test mode | Xtradot Bank sandbox API | It is the event's own rail, it is metered for judging, and it has virtual accounts, checkout, USSD, settlements and reconciliation |
| Supabase | Postgres 16 in our namespace on the one allowed volume | Pods may not reach the internet reliably; the bank sandbox is cluster-internal anyway; no outside dependency on demo day |
| Vercel | Forge Kubernetes namespace, Service `app` | Required by the platform |
| BullMQ and Redis | Postgres outbox table and an in-process poller | Quota is 400m CPU and 768Mi; one fewer moving part |
| Africa's Talking USSD and SMS | Built-in phone simulator at `/sim`; `/api/ussd` keeps the Africa's Talking request shape | Self-contained demo; going live later is an adapter swap |
| Refunds through the provider (PY-07) | Credit forward only | Refunds and disputes return 404 in the sandbox |
| Reconciliation is P1 (AD-05) | P0 | The sandbox supports it and it is our strongest proof of integrity |
| html5-qrcode | Native `BarcodeDetector`, with a small JS decoder as fallback | Faster on Android Chrome, smaller bundle; pick the fallback library in T10 |
| Day-by-day plan in section 11.1 | The phases below | One day already gone |

Unchanged: the product, personas, journeys A to E, the requirement IDs and priorities, and
section 6 (security) and 9 (legal), which feed the pitch.

## Architecture

```
 Trader phone / feature-phone sim     Officer phone (PWA)        Admin laptop
            |                                |                       |
            +--------------- https://team13.xtradot.co --------------+
                                     |
                         Service app :80 -> pod :8080
                     +-------------------------------+
                     |  Next.js (one container)      |
                     |  routes + API + webhook       |
                     |  src/core   pure domain       |
                     |  BankPort   Notifier   AI     |
                     |  poller (outbox, requery,     |
                     |          reconciliation)      |
                     +---------------+---------------+
                                     |
              +----------------------+----------------------+
              |                      |                      |
      Postgres 16 (PVC)      Xtradot Bank API        Huawei MaaS
      ledger is the record   x-api-key, 60/min       apikey, same 60/min
                                     |
                         webhooks -> http://app.team13.svc.cluster.local/api/webhooks/bank
```

Decisions:

- **One Next.js app** serves the trader, officer and admin front doors and the API. `output: "standalone"`.
- **Drizzle, not Prisma.** No engine binary to cross-compile from an arm64 Mac to `linux/amd64`.
- **`BankPort` with two adapters.** `xtradot` runs in the cluster. `fake` runs locally and in tests,
  because the sandbox does not answer from a workstation. The fake copies shapes captured in T4.
- **Signed QR tokens use Ed25519** (Node built-in crypto, no dependency). The QR holds
  `https://team13.xtradot.co/v/t/<token>`. An officer app can later verify offline with the public
  key (stretch S1) without re-issuing stickers.
- **Ledger accounts:** `trader:<id>`, `levy_revenue:<authority>`, `bank_fees`, `suspense`,
  `collection:<account>`. Merchant fees (₦50 flat on transfer, USSD and QR; 1.5% on card) are their
  own entries, or reconciliation will never match settlement.
- **Periods are computed in Africa/Lagos time** and stored in UTC. "Paid today" must not flip at 01:00.
- **Levy amounts are whole naira**, because amounts ending `.00` never fire a sandbox trigger.
- **Sessions:** signed httpOnly cookies. Officer logs in with staff ID and PIN, admin with email and
  password, trader with phone and OTP. OTPs go to the outbox and show in the simulator inbox.
- **Self-healing against sandbox resets.** On start and on demand the app checks that its webhook
  is registered and its virtual accounts exist, and re-creates what is missing.

### Quota budget

| Pod | Requests (CPU / memory) | Limits (CPU / memory) |
| --- | --- | --- |
| `app` | 100m / 192Mi | 500m / 512Mi |
| `app` surge during a rollout | 100m / 192Mi | 500m / 512Mi |
| `postgres` | 100m / 192Mi | 500m / 512Mi |
| debug `curl` pod | 50m / 64Mi | 100m / 64Mi |
| **Total** | **350m / 640Mi** of 400m / 768Mi | **1600m / 1600Mi** of 2 cores / 2Gi |

One replica of each. The debug pod must set limits explicitly; the default limit would break the budget.

### Payment paths

| Rail | Flow | Requirement |
| --- | --- | --- |
| Virtual account | Trader transfers to their own account number (`simulate-inflow` in the demo) → `virtual_account.credited` webhook → verify → allocate | PY-01 |
| USSD | Our menu creates a payment reference → `simulate-ussd` → `payment.successful` webhook → verify → allocate | PY-03 |
| Checkout | `POST /payments/checkout` → hosted page → redirect to our callback → verify → allocate | PY-02 |
| Safety net | Poller requeries every payment still `pending` or `unknown`, so a withheld webhook or a timeout still settles | PY-04 |

All four end in the same function: one database transaction that allocates the amount to the
oldest unpaid obligation first, writes ledger entries, marks obligations paid, issues the receipt
and queues the SMS. Anything unmatched goes to the review queue.

### Tables beyond PRD section 7.2

`webhook_events` (unique `event_id`), `outbox` (SMS and jobs), `bank_calls` (idempotency key,
request id, outcome), `otp_codes`, `review_items`, `sessions`.

## Demo script (target five minutes)

1. Mama Bisi registers on the feature-phone simulator. The OTP lands in the simulator inbox. She
   gets a QR pass and a virtual account number.
2. She pays today's ₦500 market levy by USSD. The receipt SMS arrives; show the elapsed seconds.
3. Officer Musa scans her QR on a real phone: **PAID**, under three seconds. He scans an unpaid
   trader: **NOT PAID**, with a pay-now code.
4. A judge scans Musa's officer ID with their own phone: genuine and active. The admin suspends
   him; the next scan shows **SUSPENDED** and a fraud flag appears.
5. Someone types a made-up receipt number into the public check page: not genuine, flagged.
6. Mama Bisi is charged again for today. The second payment is flagged as a double charge and
   credited to tomorrow.
7. Break it: withhold a webhook (the poller settles it), replay a webhook (no double credit),
   send a forged signature (rejected).
8. Dashboard: today's total has moved, compliance rate is up, and reconciliation shows the ledger
   equal to the bank settlement with a gap of ₦0.00.
9. Close: what the government recovers and what Access Bank gains.

Steps 1 to 3 and 8 are the core. Steps 4 to 7 are what set us apart.

## Phases

| Phase | Tasks | Outcome | When |
| --- | --- | --- | --- |
| 0 Unblock | H1 to H4 | Cluster access, registry, rubric, owners | Now, in parallel with phase 1 |
| 1 Walking skeleton | T1 to T4 | `/healthz` live on `team13.xtradot.co`; real bank shapes captured | 10 Nov evening |
| 2 Money core | T5 to T9 | Register → inflow → ledger → paid, in the cluster | 10 Nov night |
| 3 Front doors | T10 to T14 | PRD journeys A to D work from a phone | 11 Nov morning |
| 4 Admin and fraud | T15 to T18 | Dashboard, flags, reconciliation | 11 Nov afternoon |
| 5 Edge and hardening | T19 to T22 | Failure demo, AI triage, reset, pitch | 11 Nov evening |
| Rehearsal | none | Three clean run-throughs, backup video | 12 Nov |

The times assume the build phase ends at the end of 11 Nov. H3 confirms the real freeze time; if
it is earlier, apply the cut order.

### Parallel lanes

After T7 the interfaces are fixed and the seed data exists, so four sessions (people or agents)
can work at once without touching the same files:

| Lane | Tasks | Owns |
| --- | --- | --- |
| A Money | T8, T14, T18, T19 | `src/server/bank`, webhook, poller, reconciliation |
| B Officer and public | T10, T11 | `src/app/(officer)`, `src/app/v`, verify API |
| C Admin | T15, T16, T17 | `src/app/(admin)`, fraud queue |
| D Phone | T9, T12, T13, T20 | registration, `/sim`, USSD, notifier, AI |

Migrations are the one shared resource: only lane A adds them after T5, on request.

### Cut order

If time runs short, drop from the top. Never cut below the line.

1. S2 credit pre-offer, S1 offline officer mode
2. T20 AI complaint triage
3. T14 hosted checkout (virtual account and USSD already cover payment)
4. T16 management screens beyond "suspend officer" (seed data covers the rest)
5. T19 failure panel, reduced to the double-payment and replayed-webhook cases

---- never cut ----

T1 to T13, T15, T17, T18, T21, T22.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Kubeconfig in the repo folder is an empty file | Cannot deploy or probe the sandbox | H1 first. T1, T2, T5, T6 need no cluster |
| Bank body shapes are unknown without the Mock Specification v2 | Rework in the adapter | T4 captures real shapes before T7 writes the adapter; ask for the spec (H3) |
| Sandbox restart wipes bank state before or during the demo | Virtual accounts and webhook vanish | Our database is the record; self-heal on start; `demo:reset` rehearsed (T21) |
| 60 requests a minute shared with Huawei | 429 during the demo | One limiter for all outbound calls; pages never call the bank; AI is asynchronous and cached |
| Tariff or fee schedule changes on demo day | Reconciliation gap | Fees read from responses and booked as their own ledger entries |
| Pods cannot reach the internet | No external SMS or fonts | Nothing in the demo needs egress; assets are bundled |
| Camera scanning fails on the demo phone | Core moment fails | Manual trader ID entry (OF-03); test on the actual phone in T10; printed stickers |
| Quota rejects a pod during a rollout | Deploy stuck | Budget above; `kubectl describe resourcequota team-quota` in the deploy script |
| A late change breaks the live demo | Lost demo | Git SHA image tags, `kubectl rollout undo`, feature freeze before rehearsal, recorded backup video |
| Time | Unfinished loop | Vertical slices; deploy at each checkpoint; cut order above |

## Open questions

- [x] H1: Team ID is `team13`. The real kubeconfig was `~/Downloads/team13.yml`; it is now at `~/forge/team13.yaml`.
- [ ] H2: Which registry (GHCR or Docker Hub) and whose account?
- [ ] H3: What are the judging criteria, the submission format, and the exact freeze time? Can we get the Sandbox API Mock Specification v2?
- [ ] H4: Who is on the team and which lane does each person take?
- [x] T4 answers (details in `docs/bank-api-notes.md`): merchant `mer_204` settling to `0123456793` stands in for the collection account; virtual-account inflows do not appear in any settlement; no triggers fired on collections; pods have egress.
- [ ] New from T4: `team13.xtradot.co` is behind Cloudflare Access (302 to a login page). Ask the organisers to open it before the demo; the judge-scans-a-QR moment depends on it.
- [ ] New from T4: Huawei MaaS returns 401 `ModelArts.81003` for the team key. Report with the request IDs in the notes.
- [ ] New from T4: settle the collection rail (checkout under `mer_204` versus per-trader virtual accounts); see "Design consequences" in the notes.
- [ ] Languages: who on the team writes the Pidgin and Yoruba strings? They are hand-written, not machine-translated.
