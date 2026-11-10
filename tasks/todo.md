# LevyPass task list

Work top to bottom. Tick a task only when its verification has been run; add one line saying what
you saw. Plan and decisions: `tasks/plan.md`. Rules: `AGENTS.md`. Sizes: S = 1 to 2 files,
M = 3 to 5, L = 5 to 8.

## Phase 0: Unblock (people, in parallel with phase 1)

- [x] **H1 Kubeconfig.** Get the real `team13` kubeconfig (the copy in this folder is 0 bytes), save it as `~/forge/team13.yaml`, `chmod 600`.
  - Verify: `KUBECONFIG=~/forge/team13.yaml kubectl auth can-i create deployments` prints `yes`.
  - Verified 10 Nov: installed from `~/Downloads/team13.yml` (2,760 bytes, namespace `team13`, context `team13@sandbox`); `can-i create deployments` is `yes`; secret `huawei-gateway` exists; quota unused (0 of 400m / 768Mi).
- [ ] **H2 Docker and registry.** Start Docker Desktop. Choose GHCR or Docker Hub, log in, write the image name in `.env.example` as `IMAGE_REPO`.
  - Verify: `docker info` works; `docker login` succeeds.
  - 10 Nov: Docker Desktop started; `docker info` works and buildx lists `linux/amd64`. Registry still to choose; no `docker login` yet.
- [ ] **H3 Rules of the game.** Get the judging rubric, submission format, freeze time and the Sandbox API Mock Specification v2. Put them in `docs/`.
- [ ] **H4 Owners.** Assign lanes A to D from the plan.

## Phase 1: Walking skeleton

- [x] **T1 Scaffold the app.** (M, no dependencies)
  - Next.js App Router, TypeScript strict, Tailwind, ESLint, Vitest; `output: "standalone"`.
  - Every script in `AGENTS.md` exists. `GET /healthz` returns 200. Env parsed by a Zod schema (`src/server/env.ts`); `.env.example` committed.
  - Verify: `npm run typecheck && npm run lint && npm test && npm run build` pass; `curl -i localhost:3000/healthz` is 200.
  - Verified 10 Nov: typecheck, lint, 7 tests and build pass; `/healthz` 200 on `next dev` :3000 and on the standalone server at `0.0.0.0:8080`. TypeScript pinned to 5.9 and ESLint to 9 (typescript-eslint does not support TS 7 yet). `db:*` and `deploy` are placeholders until T2 and T3.
- [x] **T2 Database baseline.** (S, after T1)
  - `docker-compose.yml` with Postgres 16; Drizzle configured; `db:up`, `db:migrate`, `db:seed` run; `/healthz` stays cheap and a separate `/readyz` checks the database.
  - Verify: `npm run db:up && npm run db:migrate` succeed twice in a row; `/readyz` is 200.
  - Verified 10 Nov against Homebrew Postgres 16 (Docker Desktop not running, so `db:up` itself is untested; `docker compose config` is valid): `db:migrate` and `db:seed` twice each, one migration row; `/readyz` 200 with the database, 503 in 0.3 s with a bad URL while `/healthz` stays 200.
  - Re-verified 10 Nov on Docker: `npm run db:up && npm run db:migrate` twice, second seed inserted 0, `levypass_test` created by the init script, 123 tests pass against it.
- [ ] **T3 Deploy pipeline.** (M, after T1, needs H1 and H2)
  - `deploy/Dockerfile` (multi-stage, `node:22-alpine`, non-root, port 8080); `deploy/postgres.yaml` (Deployment, PVC, Service, secret); `deploy/app.yaml` (from the guide's reference manifest, with the budget from the plan and `envFrom` `huawei-gateway`).
  - `npm run deploy` builds `linux/amd64`, tags with the Git SHA, pushes, applies, waits for rollout, runs migrations.
  - Verify: `curl -I https://team13.xtradot.co/healthz` is 200; `kubectl describe resourcequota team-quota` is within budget.
  - 10 Nov, not yet deployed: image builds for linux/amd64 (86 MB, runs as uid 1000); locally the bundled migrate ran twice, the production seed ran, `/healthz` and `/readyz` were 200 on 8080. Manifests pass `kubectl apply --dry-run=server`. Waiting on `scripts/create-secrets.sh` (the agent may not write cluster secrets) and on image pull access (`ghcr-pull` secret or a public package). The public URL is behind Cloudflare Access, so the outside `curl` check will show 302 until the organisers open it.
  - 10 Nov, deployed `fbf5dfa` with `PG_EPHEMERAL=1`: the PVC cannot bind because Linode refuses new volumes ("Cannot create a new Volume with an outstanding balance on your account", organisers' account), so Postgres runs on an emptyDir and must be re-seeded if its pod restarts. Requests 200m/384Mi of 400m/768Mi. Seeded in-cluster. Through `kubectl port-forward`: all pages 200; webhook registered (201); a USSD payment ran checkout 201, simulate-ussd 200, verify 200, settled with the bank's ₦50 fee, and the signed `payment.successful` webhook was stored and processed. Left open: the PVC, and the public URL check.
- [x] **T4 Probe the sandbox.** (S, needs H1)
  - `scripts/probe-sandbox.sh` runs in a throwaway pod and exercises: balance, `POST /virtual-accounts`, `simulate-inflow`, `POST /payments/checkout`, `simulate-ussd`, `verify`, `POST /webhooks`, `POST /webhooks/test`, `GET /settlements`, `POST /reconciliation`, `POST /admin/settlements/run`, one Huawei MaaS chat call.
  - `docs/bank-api-notes.md` records each real request and response (key redacted) and answers the T4 questions in the plan.
  - Verify: the notes file exists with a captured response for every call above; no key in it (`grep` for the key prefix returns nothing).
  - Verified 10 Nov: every listed call captured in `docs/bank-api-notes.md` (webhook bodies via a temporary capture server). Key check done inside the pod against the real key: 0 matches in the notes, the probe log and all repo files. Huawei MaaS returns 401 for the team key (platform issue, request IDs in the notes). Probe webhook, capture server and probe pod removed.

### Checkpoint A

- [ ] Live URL answers; database runs in the cluster; real bank shapes are written down. Commit and tag `checkpoint-a`.

## Phase 2: Money core

- [x] **T5 Schema and seed.** (M, after T2)
  - Tables from PRD 7.2 plus those in the plan. Unique indexes: obligation `(trader_id, levy_type_id, period_start)`; payment `(provider, provider_ref)`; `webhook_events.event_id`; receipt number.
  - A trigger rejects `UPDATE` and `DELETE` on `ledger_entries`.
  - Seed: one authority, one market, two levy types (daily ₦500, weekly ₦2,000), 40 synthetic traders with mixed payment history, 3 officers, 1 admin.
  - Verify: a test proves the trigger rejects an update; `npm run db:seed` is repeatable.
  - Verified 10 Nov: `ledger.db.test.ts` (13 tests) shows UPDATE, DELETE and TRUNCATE rejected, the four unique indexes enforced, a second seed inserting 0 rows, and ledger revenue equal to obligations paid. Dev DB: second `db:seed` inserted 0; a hand `UPDATE` failed with "append-only". Seed period maths is inline until T6.
- [x] **T6 Core domain, test first.** (M, after T1)
  - `src/core`: money (kobo ↔ NGN string), periods in Africa/Lagos, obligation generation, allocation (oldest unpaid first, overpayment to future periods, part payment), double-charge detection, receipt numbers, Ed25519 token sign and verify.
  - Verify: `npm test` covers exact pay, part pay, overpay, pay ahead, second payment for a paid period, the 23:30 and 00:30 Lagos boundary, and a tampered token.
  - Verified 10 Nov: tests written first and seen failing; now 123 pass (99 in `src/core`), covering every case listed. Swapping `lagosDate` to UTC fails 6 tests. Seed now uses `src/core` periods, receipt numbers and account names; dev DB rebuilt and reseeded twice (second run inserted 0).
- [ ] **T7 BankPort and adapters.** (M, after T4 and T6)
  - `BankPort` interface; `fake` adapter with deterministic behaviour and trigger amounts; `xtradot` adapter with one shared rate limiter, timeouts, `Idempotency-Key` persisted in `bank_calls` before the call, Zod-parsed responses, `request_id` logged, 504 mapped to `unknown` and never retried as a new POST.
  - Verify: tests show a replayed key returns the original result, a timeout leads to requery, and the limiter never exceeds 60 a minute; in the cluster, a balance call succeeds through the adapter.
  - 10 Nov: built. Schemas parse every captured sandbox response (6 tests); limiter, Idempotency-Key in bank_calls before the call, 504 or timeout to unknown. Cluster balance check pending deploy.
  - Cluster run 10 Nov, 23:40 to 23:55 Lagos (`1550f8d`, `d2d582c`), real Xtradot sandbox through port-forward: checkout, simulate-ussd, verify, register-webhook and replay-delivery all succeeded through the xtradot adapter with request IDs logged. The balance call itself was not made. Replay and limiter covered by tests.
- [ ] **T8 Webhook to ledger.** (M, after T5 and T7)
  - `POST /api/webhooks/bank`: raw-body HMAC check, 5-minute timestamp window, dedupe on `event_id`, fast 2xx.
  - `settlePayment()` verifies with the bank, then in one transaction allocates, writes ledger entries (including the fee entry), marks obligations, creates the receipt and queues the SMS. Unmatched money goes to `review_items`.
  - Verify: tests for bad signature, stale timestamp, duplicate event, unknown account; in the cluster, `simulate-inflow` on a seeded trader turns today's obligation to paid and the ledger balances to zero.
  - 10 Nov: built. DB tests cover bad signature, stale timestamp, duplicate event, unknown reference, overpayment, double charge and a balanced trader account. Cluster `simulate-inflow` check replaced by checkout + simulate-ussd (virtual accounts never settle, see bank notes); pending deploy.
  - Cluster run 10 Nov, 23:40 to 23:55 Lagos (`1550f8d`, `d2d582c`), real Xtradot sandbox through port-forward: the virtual-account path was replaced by checkouts (notes, design consequences). Checkout webhooks were verified, deduplicated (a replay logged `webhook.duplicate`) and settled into the ledger. A forged one got 401.
- [ ] **T9 Trader registration.** (M, after T7)
  - Web form (name, phone, market, stall or vehicle, business type) → OTP through the outbox → trader created with trader ID, virtual account and signed QR. Pass page shows the QR, the account number and what is due (TR-01 to TR-03, LV-02).
  - Verify: register a new trader on the live URL, see the QR, see a virtual account number that exists in the sandbox.
  - 10 Nov: built (no virtual account, see bank notes). OTP and trader creation covered by a DB test; pages render. Live-URL check pending deploy and Cloudflare Access.
  - Cluster run 10 Nov, 23:40 to 23:55 Lagos (`1550f8d`, `d2d582c`), real Xtradot sandbox through port-forward: registered Bisi Adewale on the live app. The code reached `/sim`, the pass showed NOT PAID and then PAID. Virtual accounts were dropped, so there is no account number. QR not yet seen on a phone.

### Checkpoint B

- [ ] In the cluster: register → simulate inflow → obligation paid → ledger entries → receipt row. Deploy, tag `checkpoint-b`.

## Phase 3: Front doors

- [ ] **T10 Officer app.** (L, after T6 and T5) Lane B
  - Login with staff ID and PIN. Camera scan and manual ID entry. Full-screen **PAID** or **NOT PAID** with icon, name, stall and period; pay-now code when unpaid. Every scan logged with officer, time and GPS when granted (OF-01 to OF-03, OF-06). Installable PWA manifest.
  - `GET /api/verify/trader` responds in under 5 KB.
  - Verify: on the real demo phone over mobile data, scan to result is under 3 seconds, timed; a scan row appears in the database.
  - 10 Nov: built. Verify API answers PAID or NOT PAID in 19 to 42 ms locally and logs each scan. Real-phone timing pending. No fallback decoder library added (manual ID or stall entry instead).
  - Cluster run 10 Nov, 23:40 to 23:55 Lagos (`1550f8d`, `d2d582c`), real Xtradot sandbox through port-forward: the verify API answered PAID, NOT PAID and a forged token in 18 to 57 ms on the server (0.7 to 1.5 s through the port-forward). Each check wrote a scan row. Real-phone camera timing still pending.
- [ ] **T11 Public verification pages.** (M, after T6) Lane B
  - `/v/t/<token>`: limited public view of a trader's status for any phone camera. `/v/o/<token>`: officer name, area and active or suspended (OF-07). `/r/<number>`: receipt check; an unknown or reused number raises a fraud flag (RC-03, FR-02).
  - Rate limit on all three.
  - Verify: scan each QR with a stock phone camera; a made-up receipt number shows "not genuine" and creates a flag.
  - 10 Nov: built. Genuine and made-up receipt numbers checked by curl; the fake one shows NOT GENUINE and raises a flag. Stock-camera check pending the public URL.
  - Cluster run 10 Nov, 23:40 to 23:55 Lagos (`1550f8d`, `d2d582c`), real Xtradot sandbox through port-forward: the officer ID page showed GENUINE OFFICER and then SUSPENDED. The pass link showed PAID. A real receipt showed GENUINE, and two made-up numbers showed NOT GENUINE with `unknown_receipt` flags. Stock-camera scan still pending (public URL is behind Cloudflare Access).
- [x] **T12 Notifier and phone simulator.** (M, after T5) Lane D
  - `Notifier` port with an outbox adapter; poller delivers. `/sim` shows a feature phone with an SMS inbox per number. Receipt SMS carries number, amount, levy, period and link (RC-01, NT-01). Messages come from the `en`, `pcm`, `yo` dictionary.
  - Verify: after a payment the receipt appears in `/sim` within 60 seconds, and its link opens the receipt page.
  - 10 Nov: built. USSD payment to receipt SMS in the simulator inbox in about 4 s locally.
  - Cluster run 10 Nov, 23:40 to 23:55 Lagos (`1550f8d`, `d2d582c`), real Xtradot sandbox through port-forward: the receipt SMS showed in `/sim` 2.7 s after approval once the inbox stopped waiting for the poller (`067b5ee`). The receipt link opens `/r/<number>`.
- [ ] **T13 USSD.** (M, after T8 and T12) Lane D
  - `POST /api/ussd` in the Africa's Talking shape (`sessionId`, `phoneNumber`, `text` → `CON` or `END`). Menu: pay levy, what I owe, last receipt, check an officer, report a collector, change language. Pay creates a reference and completes through `simulate-ussd` (PY-03). Keypad UI in `/sim`.
  - Verify: tests walk each menu branch; on the live URL, paying by USSD produces the SMS receipt and the officer scan flips to PAID.
  - 10 Nov: built. Menu walked by curl: menu, owe, pay, last receipt. Live-URL check pending.
  - Cluster run 10 Nov, 23:40 to 23:55 Lagos (`1550f8d`, `d2d582c`), real Xtradot sandbox through port-forward: a USSD menu payment settled with a receipt. The officer-flip check was done on a web-started payment, not the USSD one.
- [ ] **T14 Hosted checkout.** (S, after T8) Lane A
  - Pay-now link → `POST /payments/checkout` → hosted page → callback → verify → settle (PY-02). The callback alone never marks anything paid.
  - Verify: pay with test card `5399830000000008` and OTP `123456`; the declining card leaves the obligation due.
  - 10 Nov: built into T9: pay page links the hosted checkout; the callback verifies before settling. Sandbox accepts `callback_url`. Test-card run pending deploy.
  - Cluster run 10 Nov, 23:40 to 23:55 Lagos (`1550f8d`, `d2d582c`), real Xtradot sandbox through port-forward: checkout options render with the bank's USSD code and transfer account. The card path was not tested.

### Checkpoint C

- [ ] Demo steps 1 to 3 run on the live URL from a phone, twice in a row. Deploy, tag `checkpoint-c`.

## Phase 4: Admin and fraud

- [x] **T15 Admin dashboard.** (M, after T5) Lane C
  - Admin login. Totals for today, this week and this month, by market and by levy; compliance rate per market; recent payments; refreshes without a reload (AD-01, AD-02). Reads our database only.
  - Verify: totals equal a hand SQL sum over `ledger_entries`; a new payment appears within 5 seconds.
  - 10 Nov: built. Dashboard and summary API render from the ledger, refresh every 3 s. Hand-SQL comparison pending on the cluster data.
  - Cluster run 10 Nov, 23:40 to 23:55 Lagos (`1550f8d`, `d2d582c`), real Xtradot sandbox through port-forward: today's ₦77,300.00 matched a hand SQL sum over today's payments, and new payments appeared on the 3-second refresh. Chart labels fixed (`d2d582c`).
- [x] **T16 Manage levies and officers.** (M, after T15) Lane C
  - Suspend and reinstate an officer at once (OF-08). Create and edit levy types with amount, period, market and legal basis (LV-01, LV-06). Register an officer (AD-03). Every action writes `audit_log`.
  - Verify: suspend an officer, then their login and their ID page both show suspended within one request.
  - 10 Nov: built. Suspend revokes sessions; ID page then shows SUSPENDED and flags. Audited.
  - Cluster run 10 Nov, 23:40 to 23:55 Lagos (`1550f8d`, `d2d582c`), real Xtradot sandbox through port-forward: suspending OTT-001 made his ID page show SUSPENDED on the next request, his scanner got 403 `officer_suspended`, and a flag was raised. Reinstated afterwards. Levy editing not exercised.
- [x] **T17 Fraud and complaints queue.** (M, after T8, T10, T11) Lane C
  - Flags raised for a double charge (FR-01), an unknown or reused receipt (FR-02) and a scan by a suspended or unknown officer (FR-03). Queue with resolve and dismiss, each audited (AD-04). Complaint form on the officer ID page and in USSD.
  - Verify: trigger each of the three flags by hand and see it in the queue.
  - 10 Nov: built. Flags for double charge, unknown receipt and suspended officer; queue with audited resolve and dismiss.
  - Cluster run 10 Nov, 23:40 to 23:55 Lagos (`1550f8d`, `d2d582c`), real Xtradot sandbox through port-forward: double_charge, suspended_officer_scan and unknown_receipt flags were all raised and listed. A Pidgin complaint was triaged by the model.
- [ ] **T18 Reconciliation and safety net.** (M, after T8) Lane A
  - Poller requeries payments in `pending` or `unknown` and settles them. Reconciliation page: run settlement, pull `GET /settlements`, compare with the ledger by day, list any gap with its references (AD-05, PY-05).
  - Verify: pay with the withheld-webhook trigger and watch the poller settle it; the reconciliation page shows ledger equal to settlement, gap ₦0.00.
  - 10 Nov: built. Poller requery proven by the withheld-webhook DB test. Reconciliation page uses the bank's reconciliation and settlements; gap ₦0.00 check pending on the cluster.
  - Cluster run 10 Nov, 23:40 to 23:55 Lagos (`1550f8d`, `d2d582c`), real Xtradot sandbox through port-forward: the withheld-webhook payment settled through the poller in 23 s. Reconciliation matched all 5 LevyPass payments line by line. The gap of -₦5,120.05 is entirely the 8 `LPPROBE-PAY-*` checkouts from T4, which correctly show as only at the bank. Expect ₦0.00 on a day without probes.

### Checkpoint D

- [ ] Demo steps 1 to 6 and 8 run on the live URL. Feature freeze for the core. Deploy, tag `checkpoint-d`.

## Phase 5: Edge and hardening

- [x] **T19 Failure panel.** (M, after T18) Lane A
  - Admin-only page with four buttons: withheld webhook, replayed webhook, forged signature, second payment for a paid day. Each shows what the bank did and what LevyPass did.
  - Verify: each button ends in the correct state with no duplicate ledger entry.
  - 10 Nov: built. All four drills covered by DB tests (no duplicate ledger entry).
  - Cluster run 10 Nov, 23:40 to 23:55 Lagos (`1550f8d`, `d2d582c`), real Xtradot sandbox through port-forward: withheld settled by the poller in 23 s; replay left the ledger at 2,162 entries; forged got 401 bad_signature; second payment flagged and credited to 2026-11-11. No duplicate ledger entries.
- [x] **T20 AI complaint triage.** (S, after T17) Lane D
  - On a new complaint, a queued job asks Huawei MaaS (thinking off, timeout set) for an English summary, category and severity from free text in English, Pidgin or Yoruba. A keyword fallback fills the same fields if the call fails. Result cached on the complaint.
  - Verify: a Pidgin complaint shows a sensible English summary; with the model URL blanked, the complaint still lands with fallback fields.
  - 10 Nov: built. Keyword fallback tested on Pidgin, Yoruba and violence. Model path blocked by the MaaS 401.
  - Verified 10 Nov, 22:50 Lagos, after the organisers fixed the key: on the cluster, a Pidgin complaint filed by USSD was triaged by `deepseek-v4.1-flash` (maas.call 200) as fake_collector, high, "A man without identification collected 2000 naira at Gate 3 without issuing a receipt." `glm-5.3` cannot turn thinking off (notes, Huawei MaaS).
- [ ] **T21 Demo hardening.** (M, after checkpoint D)
  - `npm run demo:reset` restores seed data and re-provisions the webhook and virtual accounts. Self-heal runs on start. `/demo` page lists the script with one-tap entry to each role. Printable QR sticker sheet (TR-07). Admin and officer routes are gated.
  - Verify: call the sandbox reset, run `demo:reset`, then run the full script cleanly; an unauthenticated request to `/admin` redirects to login.
  - 10 Nov: built. `demo:reset`, `/demo`, sticker sheet, route gate. Run after a sandbox reset pending deploy.
- [ ] **T22 Pitch pack.** (M, after H3)
  - README with a one-paragraph pitch, architecture diagram, how to run, and the money rules. Five-minute script mapped to the rubric. Recorded backup video of the full demo. Slides content: problem, live demo, integrity, legal basis (PRD section 9), business model, Access Bank upside.
  - Verify: a teammate who has not seen the build runs the script from the README without help.
  - 10 Nov: README written. Rubric mapping, slides and backup video pending H3 and rehearsal.

### Checkpoint E

- [ ] Three clean full run-throughs on the demo devices. Backup video saved off the cluster. No deploys after this except a fix for a failed run-through.

## Stretch (only after checkpoint E)

- [ ] **S1 Offline officer mode.** Cache the day's paid list and the public key; verify tokens offline; sync scans through `POST /api/scans/sync` (OF-05).
- [ ] **S2 Credit pre-offer.** With recorded consent, turn a trader's payment streak into a loan application through `POST /loans/applications` (FN-01, FN-02).
- [ ] **S3 Hausa and Igbo strings** (NT-03).
