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

### End-to-end run, 11 Nov, 10:00 to 10:50 Lagos (`ab1999f` on the cluster)

Driven with a headless Chrome through `kubectl port-forward`, real Xtradot sandbox, every result checked
against the cluster database. The public URL was checked from a browser signed in to Cloudflare Access.
The uncommitted UI changes in the working tree were not part of this run.

- Passed, twice for steps 1 to 3: register with OTP, QR pass, USSD payment (receipt SMS in 2.1 s and 3.5 s),
  receipt page GENUINE, officer PAID and NOT PAID with pay code (server 19 to 24 ms), tampered QR refused.
- Passed once: officer ID GENUINE, suspend (SUSPENDED, flag, scanner 403, login refused), reinstate; made-up
  receipt NOT GENUINE with a flag; Pidgin complaint triaged by the model in 5 s; double charge flagged and
  credited to 12 Nov; withheld webhook settled by the poller in 22 s; replay 3 times, ledger 2,183 to 2,183;
  three forgeries refused with 401; dashboard equal to `ledger_entries` and to `payments`; a new payment on
  the open dashboard in 3.6 s; reconciliation ₦0.00 with 5 of 5 matched (before F2 below happened).
- Passed once, beyond the script: trader login by OTP; card payment on the bank's hosted page (₦800, fee
  ₦12.00 read from the bank); camera scan with a fake camera feed (PAID, 1.10 s including camera start);
  21 pages at 390 px and 1440 px with no script errors and no sideways scroll; `/admin` and `/officer` gated.
- Public URL, signed-in browser: `/`, `/demo`, `/sim`, `/register`, both logins and the three QR targets
  load in 0.5 to 1.0 s and show Paid, Genuine officer, Genuine.
- Not covered: a real phone (camera timing, stock-camera QR scan), the declining card (the hosted page offers
  only the good card), a sandbox reset followed by `demo:reset`, levy editing.
- The cluster API dropped the port-forward several times (5 to 70 s each). The app and the public URL stayed up.

Fixes this run asked for. All eight are in the working tree, not yet committed or deployed, so the
cluster still runs `ab1999f` and shows the old behaviour until the next deploy.
Verified 11 Nov, 11:00 to 11:25 Lagos: `npm run typecheck && npm run lint && npm test` pass (187 tests,
24 of them new); the image builds; the browser checks below ran against `next dev` with the fake bank.

- [x] **F1 Registration code cannot be read in the simulator.** The code pages (register and login) open
  `/sim?phone=<that number>`; the SIM list starts with numbers sent an SMS in the last 10 minutes that are not
  traders yet.
  - Verified in a browser: register, click "Open the phone simulator", the SIM reads "New number, …" and the
    code is on screen; a plain `/sim` opens on that number too; the code completes the registration.
- [x] **F2 A payment under ₦50 never settles.** `settlement_amount` and a settlement's `net_amount` may be
  negative; migration `0004` drops the "fee no larger than amount" half of `payments_fee_range` (approved in
  the session).
  - Verified: schema test on the captured body; DB test; in a browser, a ₦20 payment settled with inflow ₦20,
    fee ₦50, allocation ₦20, a receipt SMS, and reconciliation at ₦0.00 with 7 of 7 payments on both sides.
- [x] **F3 An abandoned pay page never closes, and open payments eat the bank quota.** `expired` is accepted
  and closes the payment as `failed` (part-paid ones also go to review); the poller asks every tick for
  2 minutes, every 30 s to 10 minutes, then every 2 minutes (`src/core/requery.ts`), and a payment goes to the
  back of the queue whatever the answer; the open pay page turns to NOT PAID.
  - Verified: schema test on the captured body; unit test (38 calls in 30 minutes, was 225); DB tests for
    expiry, the review item, the back-off and a throwing payment no longer blocking the next one; in a
    browser, an open pay page changed to NOT PAID when its payment was closed.
  - Seen on the cluster after deploying `886d327` (11 Nov, 11:55 Lagos): no payment left open; 731
    successful, 1 failed. Migration `0004` applied and `/icon.svg` is 200.
- [x] **F4 Pidgin and Yoruba do nothing.** Both dictionaries now cover every SMS and USSD string, and the
  English fragments that were built in code ("what you owe", "weekly from", "+ 2 more") moved into them.
  - Verified in a browser session: OTP, welcome SMS, menu, pay prompt and receipt in Pidgin; menu, balance,
    pay-ahead prompt and double-charge SMS in Yoruba.
  - The strings were written by Huawei MaaS (`deepseek-v4.1-flash`), called from the app pod: one call to
    translate each language, a review call for Pidgin (4 lines changed), and for Yoruba 12 lines sent back
    with a note on what was wrong. The model's own Yoruba review missed a dropped negative ("you owe nothing"
    read as "you owe"), so a fluent speaker must still read both files before the demo.
- [x] **F5 Step 6 cannot pick the trader from step 1.** The drill pickers list the 12 newest app-registered
  traders first, then the seeded ones. A drill run with no trader chosen still uses a seeded trader.
  - Verified in a browser: the trader just registered was first in the list; the double-charge drill ran
    against her, flagged it and credited the next day.
- [x] **F6 `/icon.svg` is 404 on the cluster.** `deploy/Dockerfile` copies `public/`.
  - Verified: local image build; `public/icon.svg` and migration `0004` are inside the image.
- [x] **F7 Forms empty themselves after a refused submit.** `ActionForm` sends the action itself.
  - Verified in a browser: registration kept name, stall and language after "already registered"; officer
    and admin login kept the staff ID and email after a wrong PIN and password.
- [x] **F8 Script and data disagree.** `tasks/plan.md` steps 1, 2 and 6 now match the app: no virtual account
  number, ₦2,500.00 on seeded data, pick the trader by name. `demo:reset` removes the ₦20 levy from the cluster.

### Finals (top 10, 12 Nov)

- [x] **T23 Officer cash floats.** (L) Cash payers without a bank. The officer pays a float into the
  government account first (request → revenue office approves → bank-verified deposit loads it), then
  takes cash from traders only up to that float. Each cash levy is tied to a fresh scan, paid from the
  float in one transaction, and SMS-receipted naming the officer. Each float is accounted first in,
  first out (`src/core/floats.ts`). Enum additions (`cash`, `float_load`, `cash_collection`) approved
  in the session.
  - 12 Nov, in progress (uncommitted): core + 7 unit tests, migration 0005, settlement changes,
    `src/server/floats/floats.ts` + 13 DB tests (passed three runs in a row). Full suite and lint not
    yet re-run after the change.
  - Built 12 Nov: scan API returns `scanId`; scanner "No bank? Take ₦X cash" with confirm;
    `/officer/float` (balance, request, pay in, statement per float); `/admin/floats` (approve or
    decline, audited; balances; statements); dashboard counts `cash_collection`; receipt page says
    "Cash to officer OTT-001"; `/v/o` copy; PRD section 6; demo step 3b in the plan and speaker script.
  - Verified 12 Nov, 16:05 to 16:08 Lagos, `next dev` with the fake bank, headless Chrome at 390 px and
    1440 px, twice: request ₦20,000 → admin approves (audit row `float.approve`) → pay in → sandbox
    approve → float ₦20,000 → stall D-40 NOT PAID → take ₦500 cash → PAID IN CASH, float ₦19,500 →
    receipt page GENUINE, "Cash to officer OTT-001" → SMS names OTT-001 in the trader's language
    (Yoruba and English seen). Second run reloaded while the first float had money: held ₦39,000.
    `npm run typecheck && npm run lint && npm test` pass (207 tests). Only console error: the old
    `/favicon.ico` 404. Not yet deployed (cluster access pending). Pidgin and Yoruba cash SMS need a
    fluent read.
  - Renamed for the finals, 12 Nov: on screen it is an **advance remittance**, the balance is the
    officer's **Advance**, labels read `OTT-001-R01`, pages are `/officer/advance` and
    `/admin/remittances`. Code and database keep the name `float`. Re-verified in the browser
    (stall A-05, ₦1,000 cash, receipt page and admin totals) and 207 tests pass.
  - Pay ahead in cash and the LevyPass card, 12 Nov. A trader who is paid today can hand cash for
    tomorrow or the next 7 days; the amount is quoted in allocation order (`aheadQuote`, 5 unit tests)
    so it settles exactly the quoted days, with no double-charge flag (2 more DB tests). The trader's
    QR prints as a bank-card-size **LevyPass card** (`/pass/card`, and a tab on the admin stickers
    page). Verified in headless Chrome: A-01 PAID → "Take cash to pay ahead" → 7 days ₦5,500.00
    (seven daily levies plus next week's ₦2,000 sanitation levy) → paid ahead to 19 Nov → a second
    try says the week is already paid; card measures 85.6 × 54 mm, 8 per A4 page; OTP login → pass
    page → "Print my LevyPass card". 218 tests pass.
  - TR-08 re-issue a lost card, 12 Nov: the trader (`/pass/card`, confirm step) or the revenue office
    (cards tab, search, confirm step) makes a new token ID; the old QR shows **CANCELLED CARD** on the
    public page and in the officer scan (logged against the trader, "do not take cash"); audit row
    `card.reissue` without token IDs; SMS to the trader each time. 3 DB tests. Verified in headless
    Chrome on a freshly restarted dev server (the running one had served a stale `status.ts` to the
    scan route): old card PAID → trader re-issues → old card CANCELLED, new card PAID, officer scan of
    the old card `cancelled: true` → admin re-issues → trader's card CANCELLED, newest PAID.

- [x] **F10 Usability pass (Krug).** NOT PAID screen no longer closes on a stray tap while cash
  can still be taken (the scan was lost); `/demo` lists step 3b and its arrow links have names on
  phones; admin sidebar promo that repeated "Failure drills" removed; dashboard names itself
  "Collections" with the Lagos date instead of "Good afternoon."; fraud buttons read "Dealt with" and
  "False alarm"; shorter drills intro and "Daily levy" hint; officer ID page says "Report this
  officer"; focus rings on the admin receipt search and the USSD reply box.
  - Verified 12 Nov, `next dev` with the fake bank, headless Chrome at 390 px and 1440 px: stall B-02
    NOT PAID stayed open after a background tap and closed on "Scan the next trader"; no page errors.
    `npm run typecheck && npm run lint && npm test` pass (207 tests).
- [x] **F10 The phone sim cannot type an officer's staff ID.** Keypad keys only added digits. USSD
  option 4 now accepts `OTT-001`, `ott001`, `OTT 001` or the number alone (`001`, `1`); a bare
  number matches only the trader's own authority and asks again if two officers share it
  (`src/core/staff-id.ts`). The sim keypad does multi-tap in replies: `#` cycles 123/abc/ABC, the
  red key deletes while there is text. Prompt updated in all five languages.
  - Verified 12 Nov, `next dev` with the fake bank: curl `/api/ussd` with `4*001`, `4*1`,
    `4*ott001`, `4*OTT 001`, `4*ott-002` all named the right officer, `4*999` warned, `4*-` and
    `4*-*002` re-asked then matched. Headless Chrome on `/sim`: keyed `OTT-0011`, Del to `OTT-001`,
    Send showed Musa Danjuma ACTIVE. `npm run typecheck && npm run lint && npm test` pass (211 tests).

- [x] **F11 Public home page shows no revenue data.** The "Collections in the ledger" band (naira totals,
  compliance rate, scans today, daily revenue chart) is now "LevyPass so far": all-time counts of traders,
  markets, receipts and officer checks (`src/server/public/stats.ts`). "How a trader pays" no longer shows
  a real receipt number or today's paid count. Footer lists only the two staff logins.
  - Verified 12 Nov at 390 px and 1440 px: no ₦ in the band, no page errors, no sideways scroll; lint and
    218 tests pass.

- [x] **F12 Usability check of the pay-ahead, card and re-issue work.** On a PAID scan, "Take cash to pay
  ahead" is a quiet link so "Scan the next trader" stays the obvious next step; both cash error messages
  lose their semicolon; both re-issue confirm steps (trader and revenue office) now say the stall sticker
  stops working too, since the sticker, the card and the pass share one QR; the pass page's "No
  smartphone?" line no longer splits into three columns at 390 px.
  - Verified 12 Nov in headless Chrome: D-40 PAID with the pay-ahead link and picker, trader OTP login to
    `/pass` and `/pass/card?replace=1`, admin cards tab confirm. No page errors; lint and tests pass.
    Not done: `sms.card_reissued` still says only "the old card" in all five languages.

- [x] **F13 Igbo and Hausa switched on, re-issue SMS names the sticker.** `ig` and `ha` join `locales`;
  USSD language menu lists 4 Igbo and 5 Hausa in every language and saves them; register form offers
  both; complaint box says "in any language"; triage prompt and keyword fallback know Igbo and Hausa
  (Igbo is checked before Yoruba because both use ọ; 3 new tests written first); fraud page shows the
  language name, not the code. `sms.card_reissued` says the stall sticker stops working too, in all five
  languages (it was missing from Igbo and Hausa). Dictionary tests now cover `ig` and `ha`.
  - Verified 12 Nov: migration 0006 applied locally (locale enum en, pcm, yo, ig, ha); the real
    `ussdReply` switched a trader to Igbo then Hausa and showed each menu, then back to Yoruba;
    `/register` lists Igbo and Hausa. Lint and 234 tests pass. The running `next dev` still served the
    old USSD route until restarted. New Yoruba, Pidgin, Igbo and Hausa sentences need a fluent read.

- [x] **F14 Home page hero card anonymised.** Still live, but `page.tsx` strips each payment on the server to
  channel, time, amount and bank fee before it reaches the client carousel: the card reads "A trader", the
  receipt shows as `LP-••••-•••••`, and "Check receipt" opens the blank check page `/r`.
  - Verified 12 Nov: the home page HTML (including the client payload) contains none of the 12 latest
    payments' trader names, receipt numbers or payment IDs; card seen at 390 px; lint and 234 tests pass.

- [x] **F15 Cash payments sync between trader and officer.** Cash was officer-only: the trader could not say
  "I will pay cash", their pass did not say who took their cash, and nobody asked them to confirm it. New
  `cash_handovers` table (migration 0007, no change to ledger, payments or obligations) and
  `src/server/cash/handovers.ts`. Trader taps **Pay cash to an officer** on `/pass` (or USSD option 7) →
  officers of that market see **Waiting to pay cash** on `/officer` (refreshes every 8 s), tap **Open** →
  overlay says "Asked in the app at 23:07" → **Take ₦X cash**. The cash collection marks the request
  `recorded` in the same transaction as the settlement (cash nobody asked for gets a new `recorded` row);
  a bank payment closes a waiting request; requests end with the Lagos day. `/pass` refreshes every 5 s,
  flips to PAID and asks **Did you hand ₦X cash to Musa Danjuma (OTT-001)?** Yes → confirmed; No →
  `cash_disputed` fraud flag on the officer with the receipt. Receipts list says "cash to OTT-001";
  `/admin/remittances` shows trader confirmed / trader denies / not confirmed per cash levy.
  - Verified 12 Nov, restarted `next dev`, headless Chrome, two 390 px phones: B-06 asked → OTT-001 list
    showed her (₦3,500.00, asked 23:07) → Open → took cash → trader's pass flipped to PAID TODAY with the
    confirm card 2.3 s later, no reload → Yes → receipt line "cash to OTT-001", gone from officer list.
    B-18 cash with no request → trader said No → fraud page "Cash the trader denies", remittances shows
    both answers. 11 new DB tests; `npm run typecheck && npm run lint && npm test` pass (245 tests). New
    USSD strings in pcm, yo, ig, ha need a fluent read. Not deployed; migration 0007 must run on the cluster.

- [x] **F16 Traders hear back on reports; USSD traders can deny cash.** Closing a complaint or a cash dispute
  ("Dealt with" / "False alarm") now SMSes the trader who raised it in their language, once
  (`src/server/admin/cases.ts`, closes only open cases, dedupe `case:<id>`); `/pass` lists **Your reports**
  (being looked at / dealt with / no problem found). The web report form names the trader when they are
  logged in, so they get the answer. USSD option 8 **Confirm cash paid** asks "Did you hand ₦X cash to
  officer OTT-001 on <date>? 1 Yes 2 No"; No raises the same `cash_disputed` flag. The cash receipt SMS
  ends "Did not pay this? Dial *347*13#, choose 8."
  - Verified 12 Nov: 4 new DB tests (249 pass), typecheck and lint clean. Headless Chrome: B-18 pass showed
    LP-ZT29-NBJC3 "Being looked at" → admin "Dealt with" → SMS "the revenue office has dealt with your
    report LP-ZT29-NBJC3" → pass showed "Dealt with" without a reload, no page errors. `curl /api/ussd`
    shows option 8. New pcm, yo, ig, ha strings need a fluent read.

- [x] **F17 Only the officer standing with the trader can take their cash.** The F15 "Waiting to pay cash"
  list showed every officer in the market, and an officer could record cash from anywhere by typing a
  stall. Now nobody sees a list; recording cash needs the request's 4-digit **cash code**, which exists only
  on the trader's phone (pass page, USSD option 7 reply, SMS). A trader who asked holds the code already;
  otherwise the officer's "Take cash" texts it to the trader, valid 10 minutes and for that officer only.
  Five wrong codes cancel the request. Code = HMAC of the request ID with the server secret (never stored),
  checked in constant time inside the cash transaction. Migration 0008 adds `code_attempts`, `expires_at`.
  `collectCash` split into `startCashCollection` (same checks, then the code) and `collectCash` (needs the
  code). New SMS `sms.cash_code`; `ussd.cash_asked` now gives the code, in all five languages.
  - Verified 12 Nov: 253 tests pass (16 handover tests: far officer with a wrong code refused and counted,
    code sent for one officer refused for another, 10-minute expiry, lock after five, no code before "Take
    cash"); typecheck and lint clean. Headless Chrome, two 390 px phones: B-26 tapped "Pay cash", code 8542
    on screen and by SMS; OTT-001 home showed no list; overlay "Asked in the app at 23:33"; wrong code →
    "That code is wrong… (4 tries left)", attempt counted; 8542 → PAID IN CASH; trader's phone PAID TODAY.
    B-38 not asked: "Take cash" → SMS code 2015 → typed → PAID IN CASH. No page errors. Demo step 3b and
    `/demo` updated. New pcm, yo, ig, ha strings need a fluent read. Not deployed (migrations 0007, 0008).

- [x] **F18 Traders print their own stall sticker.** `/pass/card` has two tabs, **LevyPass card** and **Stall
  sticker**. The sticker is the revenue office's design (`src/app/_ui/stall-sticker.tsx`, now shared with
  `/admin/stickers`) printed at A6 width: 100 mm, QR 70 mm. `PageShell printBare` leaves the header and title
  off the paper. Pass page link reads "Print my card or stall sticker"; after a re-issue the page tells the
  trader to print a new sticker here instead of asking the revenue office.
  - Verified 12 Nov, headless Chrome: B-06 pass → link → Stall sticker tab, sticker 100.0 mm wide, QR 70.0 mm,
    no sideways scroll at 390 px; print media hides header, title, tabs and button; A4 PDF shows only the
    sticker; card tab still prints the card; `/admin/stickers` renders 24 stickers. No page errors; typecheck,
    lint and 253 tests pass.

### Checkpoint E

- [ ] Three clean full run-throughs on the demo devices. Backup video saved off the cluster. No deploys after this except a fix for a failed run-through.

## Stretch (only after checkpoint E)

- [ ] **S1 Offline officer mode.** Cache the day's paid list and the public key; verify tokens offline; sync scans through `POST /api/scans/sync` (OF-05).
- [ ] **S2 Credit pre-offer.** With recorded consent, turn a trader's payment streak into a loan application through `POST /loans/applications` (FN-01, FN-02).
- [ ] **S3 Hausa and Igbo strings** (NT-03).
