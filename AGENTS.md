# LevyPass: agent and contributor guide

LevyPass lets market and motor-park traders pay levies digitally, settles the money to the
government's bank account, and lets an officer confirm payment with one QR scan. It is Team FET's
entry for Access Youth Tech Forge 2026, Track 01 (Payments and Financial Infrastructure).

**Deadline.** Build phase ends 11 Nov 2026. Demo day is 13 Nov 2026. Anything that does not serve
the demo script in `tasks/plan.md` waits.

## Read first

| File | Use it for |
| --- | --- |
| `tasks/plan.md` | Decisions, architecture, demo script, cut order |
| `tasks/todo.md` | The ordered task list. Work the next unchecked task; tick it when verified |
| `docs/forge-platform.md` | Sandbox facts: URLs, quota, bank API rules, triggers, test data |
| `docs/bank-api-notes.md` | Real request and response shapes captured from the sandbox (created in T4) |
| `docs/PRD.md` | Product intent and requirement IDs (TR-01, PY-04 ...). Load only the section you need |

Where the PRD and the plan disagree on stack or integrations, the plan wins: the PRD was written
before the Forge sandbox guide arrived. Do not add Paystack, Flutterwave, Supabase, Vercel, Redis
or Africa's Talking.

## Stack

- Next.js (App Router) with TypeScript in strict mode, one app, one container. Node 22.
- PostgreSQL 16 with Drizzle ORM and SQL migrations.
- Tailwind CSS. Zod at every boundary (HTTP input, bank responses, env).
- Vitest for tests.
- npm (not pnpm or yarn).
- Deployed to the Forge Kubernetes namespace `team13` as Service `app`. Public URL `https://team13.xtradot.co`.

## Commands

T1 creates these scripts. If one is missing, add it rather than inventing a different name.

```bash
npm run dev          # Next.js on :3000 with the fake bank adapter
npm run db:up        # local Postgres (docker compose)
npm run db:migrate   # apply migrations
npm run db:seed      # one market, levies, traders, officers (synthetic)
npm run typecheck    # tsc --noEmit
npm run lint
npm test             # vitest run
npm run build
npm run deploy       # build linux/amd64 image tagged with the Git SHA, push, roll out
```

Before calling a task done: `npm run typecheck && npm run lint && npm test` pass, and you have
exercised the change (curl, browser, or a test) and can say what you saw.

## Layout

```
src/app/            routes: (trader) (officer) (admin) sim/ v/ api/
src/core/           pure domain logic, no I/O: money, periods, allocation, tokens, fraud rules
src/server/db/      Drizzle schema, migrations, queries
src/server/bank/    BankPort interface, xtradot adapter, fake adapter
src/server/notify/  Notifier port, outbox adapter
src/server/ai/      Huawei MaaS client and prompts
src/server/jobs/    in-process poller: outbox, pending payments, reconciliation
deploy/             Kubernetes manifests, Dockerfile
scripts/            seed, deploy, sandbox probe, demo reset
```

`src/core` imports nothing from `src/server` or `src/app`. Route handlers stay thin: parse with
Zod, call a function in `src/server` or `src/core`, map the result.

## Money rules

These are the rules judges check. Breaking one is a bug even if the demo still passes.

1. **Integer kobo inside, NGN two decimals at the bank boundary.** Never a float for money.
   Convert in one place (`src/core/money.ts`).
2. **The ledger is append-only.** `ledger_entries` is never updated or deleted; a database trigger
   enforces it. Corrections are new entries. Every balance and dashboard total is recomputable
   from it.
3. **Verify before value.** A webhook or a checkout redirect is a hint. Mark an obligation paid
   only after `GET /payments/{reference}/verify` (or the virtual-account equivalent recorded in
   `docs/bank-api-notes.md`) confirms it server to server.
4. **Idempotent in both directions.** Send `Idempotency-Key` on every bank POST that moves money or
   creates a record, and persist the key before the call. De-duplicate incoming webhooks on
   `event_id`; processing the same event twice changes nothing.
5. **On 504 or a client timeout, never resend.** Mark the payment `unknown`, requery until the
   status is final.
6. **One obligation per trader, levy and period,** enforced by a unique index. A second payment
   for a paid period raises a `double_charge` fraud flag and is credited to the next period.
7. **Nothing is silently lost.** Money that cannot be matched goes to the review queue with its
   provider reference.
8. **Verify webhook signatures** over the raw body (`{timestamp}.{raw_body}`, HMAC-SHA256,
   constant-time compare) and reject timestamps older than 5 minutes.
9. **Read charges from the bank response.** Never hard-code a fee, VAT or stamp duty.
10. **Allocation, ledger write, obligation update and receipt happen in one database transaction.**
11. **Periods are computed in Africa/Lagos time and stored in UTC.** "Paid today" means the Lagos
    calendar day. Levy amounts are whole naira (sandbox amounts ending `.00` never fire a trigger).

## Platform rules

- The bank and Huawei APIs answer only inside the cluster. Local development and tests use the
  fake adapter (`BANK_ADAPTER=fake`). Both adapters implement `BankPort`; the fake copies shapes
  from `docs/bank-api-notes.md`. Never invent a bank field: if a shape is not in the notes, capture
  it from the sandbox first.
- 60 requests a minute, shared by the bank and Huawei. All outbound calls go through one rate
  limiter. Pages read our database; no page load may fan out to the bank or a model.
- Sandbox bank state can reset at any time. Our database is the record. Keep `scripts/demo-reset`
  able to re-register the webhook and re-create virtual accounts.
- Namespace quota is 400m CPU and 768Mi memory in requests. Every pod sets explicit requests and
  limits from the budget in `tasks/plan.md`. No Redis, no extra services.
- Images are `linux/amd64`, tagged with the Git SHA. The container listens on `0.0.0.0:8080` and
  serves `GET /healthz`.
- Synthetic data only: no real names, phone numbers, BVNs or account numbers in seeds, logs,
  fixtures or screenshots.
- Model calls set `chat_template_kwargs: { thinking: false }`, a timeout, and a deterministic
  fallback. No feature may fail because a model call failed.

## Secrets

- `GATEWAY_KEY` comes from the `huawei-gateway` secret through `envFrom`. Never print it, never
  write it to a file, never put it in an image or a client bundle.
- The kubeconfig lives at `~/forge/team13.yaml`, outside the repo.
- Local secrets go in `.env.local` (ignored). `.env.example` lists names only.
- QR signing key and session secret are Kubernetes secrets in production, generated values locally.

## Conventions

- TypeScript strict; no `any`, no `@ts-ignore`, no skipped tests to get to green.
- Named exports. Server-only modules start with `import "server-only"`.
- Database names are `snake_case`; TypeScript is `camelCase`. IDs are prefixed strings
  (`trd_`, `off_`, `pay_`, `rcp_`) so a pasted ID says what it is.
- Every outbound call has a timeout and logs the bank `request_id`. Logs are structured JSON with
  no secrets and no full phone numbers.
- Errors returned to users are plain sentences. Status screens show an icon and a word, never
  colour alone (PRD section 5, accessibility).
- Tests sit next to the code (`allocation.ts`, `allocation.test.ts`). Write the test first for
  anything in `src/core` and for webhook handling.
- UI text goes through the message dictionary (`en`, `pcm`, `yo`) from day one; no hard-coded
  strings in USSD or SMS.

## Workflow

- Take the next unchecked task in `tasks/todo.md`. One task per commit. Message:
  `T7: match virtual account inflow to obligations`.
- Keep each change a thin vertical slice that leaves `main` deployable.
- Deploy at every checkpoint in the plan and run the demo script as far as it goes.
- If the sandbox behaves differently from the guide, write it in `docs/bank-api-notes.md` in the
  same change.

## Ask before

- Changing the schema of `ledger_entries`, `payments` or `obligations` after T5 lands.
- Adding a dependency, a service, or a pod.
- Anything that calls `POST /admin/reset` on the sandbox, or deletes cluster resources.
- Weakening a money rule to make something pass.
- Committing, pushing or deploying, unless the person in the session has said to.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
