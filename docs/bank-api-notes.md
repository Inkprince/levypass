# Xtradot Bank sandbox: captured shapes

Captured on 10 Nov 2026, 16:34 to 16:45 UTC, from the throwaway `probe` pod in `team13`
(`scripts/probe-sandbox.sh`). Every request and response below is real. The team key never left the pod and
the one webhook secret was scrubbed in the pod before printing. The names in responses are the sandbox's own
fixture identities (guide pages 8 and 9), not real people.

Where a field is **not** listed here, we have not seen it. Do not add it to the adapter or the fake without
capturing it first (AGENTS.md).

Base URL `http://bank-api.ingress-apisix.svc.cluster.local/v1`, header `x-api-key`.

## Answers to the T4 questions in the plan

| Question | Answer |
| --- | --- |
| Which merchant or account is the government collection account? | **Use merchant `mer_204`.** Checkout payments under it settle to corporate account `0123456793` (Mama Nkechi Provisions Ltd). No merchant represents a government body; `mer_204` stands in for the authority's collection merchant. Decision recorded for the team, see "Design consequences". |
| Where do virtual-account inflows settle? | **Nowhere we can see.** Two inflows (₦500, ₦700) to VA `9900445566` raised its `total_received`, but they were not in `GET /settlements` for any merchant we queried and the BVN holder's balance (`0123456789`) did not move. Checkout payments did settle (corporate balance rose by exactly the ₦1,350.05 net of settlement `stl_0091`). |
| Which trigger amounts apply to collections? | **None observed.** `.05` on a USSD checkout did not withhold the webhook. `x-test-outcome: timeout` and `pending` were ignored by `simulate-ussd` and `simulate-transfer` (both returned 200 successful). Triggers apply to transfers. `.01` on card was not tested. |
| Do pods have internet egress? | **Yes.** `https://example.com` returned 200 from the probe pod. |

## Other findings that change the build

1. **Virtual accounts need a BVN whose record matches `customer_name`.** A made-up name or an unknown BVN gives
   422 `BVN_MISMATCH`. Only the four fixture BVNs `22200000001` to `22200000004` work, with their exact names.
   **One BVN can hold any number of virtual accounts** (two created for `22200000001`), each named
   `FORGE / <BVN HOLDER NAME>`.
2. **Overpayment is not settled.** Checkout `LPPROBE-PAY-011` for ₦500 paid ₦800: `amount_paid` 800,
   `merchant_fee` 50, `settlement_amount` 450, and its settlement line shows `amount` 500. The extra ₦300 is not
   in settlement. Credit the obligation with `amount` only and send the excess to `review_items`
   (money rule 7), or reconciliation will show a ₦300 gap.
3. **Partial payment keeps the checkout pending** (`status: pending`, `amount_paid: 300`, fee 0). A
   `payment.partial` webhook fires. Nothing settles until it is complete.
4. **Fees come back on the payment**: `merchant_fee` and `settlement_amount`. Observed ₦50 flat for USSD and
   transfer, 1.5% for card (₦30 on ₦2,000). Virtual-account inflows report **no fee** at all.
5. **`payment.pending` fires as soon as a checkout is created**, before anyone pays.
6. **Webhook retries are real.** An event first attempted while nothing listened arrived again 1 minute later
   with `"attempt": 2`, the same `event_id`.
7. **`team13.xtradot.co` is behind Cloudflare Access.** `curl -I https://team13.xtradot.co/healthz` returns
   302 to `centrictech.cloudflareaccess.com/.../login/team13.xtradot.co`, from a Mac and from a pod. The guide
   says the URL is public. Until the organisers open it, a judge's phone cannot reach `/v/t/<token>` and T3's
   check (`/healthz` 200 from outside) cannot pass. **Raise with the organisers.**
8. **Huawei MaaS rejected the team key (fixed 10 Nov evening, see Huawei MaaS below).** Every call returns 401 `ModelArts.81003 Invalid authorization header`
   from upstream, for `glm-5.3`, `glm-5.2` and `deepseek-v4.1-flash`, with or without `Authorization: Bearer
   unused`, while the same key works for the bank. The gateway does not seem to inject our Huawei key.
   Request IDs for support: `bbaf024510284f7abd97421d2ef91f1b`, `c046b2c2ca81541e28f8703d72ce1708`,
   `f978bda1d32a3eee1fd032cc794ee38c`, `e38800d7580ac2786a39ee50b5da387b`. T20's fallback covers this.

## Conventions confirmed

- Envelope as in the guide. Success: `{"status":"success","message":...,"data":...,"meta":null,"request_id":"req_..."}`.
  Error: `{"status":"error","error":{"code":...,"message":...,"field"?:...,"nip_response_code"?:...},"request_id":...}`.
- **Amounts are JSON numbers**, for example `500.0`, `500.05`, `1500000.0`. Parse with `ngnToKobo` (never `* 100`).
  We send numbers with two decimals.
- Every response carries `X-RateLimit-Limit: 60`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (seconds,
  fractional). MaaS responses carry `X-Request-Id` instead.
- Validation reports one missing field at a time, in order, as `error.field` (dotted for nested: `customer.name`, `card.number`).
- `Idempotency-Key` behaves as documented: same key and body replays the original response, **status 201
  again**, header `idempotent-replayed: true`, **same `request_id`**. Same key with a different body: 409
  `DUPLICATE_REQUEST` "Idempotency-Key was already used with a different body". A reused `reference` with a new
  key: 409 `DUPLICATE_REQUEST` "Reference LPPROBE-PAY-002 has already been used".
- Unknown reference: 404 `NOT_FOUND`, `nip_response_code: "25"`.

## Accounts

### GET /accounts/{account_number}/balance

```json
200 {"status":"success","message":"Request completed","data":{"account_number":"0123456789","account_name":"ADAEZE CHIAMAKA OKONKWO","available_balance":1500000.0,"ledger_balance":1500000.0,"currency":"NGN","kyc_level":3,"status":"active"},"meta":null,"request_id":"req_942ccbc9"}
```

Corporate account: `"kyc_level":"corporate"` (a string, not a number).

### GET /transactions?page=1&per_page=2

Lists the team's statement lines; `meta` carries pagination.

```json
200 {"data":[{"reference":"STL_0091","account":"0123456793","type":"settlement","direction":"credit","amount":1350.05,"fee":0.0,"vat":0.0,"stamp_duty":0.0,"balance_after":12001350.05,"counterparty_name":"MERCHANT SETTLEMENT 2026-11-10","channel":"settlement","status":"successful","at":"2026-11-10T16:40:21Z"},{"reference":"OPENING-BAL","account":"0123456793","type":"opening_balance","direction":"credit","amount":12000000.0,"fee":0.0,"vat":0.0,"stamp_duty":0.0,"balance_after":12000000.0,"counterparty_name":null,"channel":null,"status":"successful","at":"2026-11-09T07:00:00Z"}],"meta":{"page":1,"per_page":2,"total":6,"total_pages":3},"request_id":"req_2e44e1a0"}
```

`GET /transactions/LPPROBE-PAY-006` (a checkout reference) returned 404: payments are not statement transactions.

## Virtual accounts (PY-01)

### POST /virtual-accounts

Required, in the order the API asked: `customer_name`, `bvn`, `reference`. `customer_name` must match the BVN record.

```json
request  {"customer_name":"Adaeze Chiamaka Okonkwo","bvn":"22200000001","reference":"LPPROBE-VA-003"}
201      {"status":"success","message":"Virtual account created","data":{"account_number":"9900445566","account_name":"FORGE / ADAEZE CHIAMAKA OKONKWO","bank_name":"Xtradot Bank","nip_code":"000014","type":"dedicated","reference":"LPPROBE-VA-003","status":"active","created_at":"2026-11-10T16:35:36Z","customer_name":"Adaeze Chiamaka Okonkwo","total_received":0.0,"expected_amount":null,"expires_at":null},"meta":null,"request_id":"req_e9b815a4"}

request  {"customer_name":"Probe Trader One","bvn":"22200000001","reference":"LPPROBE-VA-001"}
422      {"status":"error","error":{"code":"BVN_MISMATCH","message":"customer_name does not match the BVN record"},"request_id":"req_bdd3b7e6"}
```

`{"type":"dynamic","expected_amount":500.00}` without `bvn` still gives 400 `bvn is required`.

### GET /virtual-accounts/{account_number}

The verify-before-value path for inflows: the inflow's `session_id` must appear in `inflows`.

```json
200 {"data":{"account_number":"9900445566","account_name":"FORGE / ADAEZE CHIAMAKA OKONKWO","bank_name":"Xtradot Bank","nip_code":"000014","type":"dedicated","reference":"LPPROBE-VA-003","status":"active","created_at":"2026-11-10T16:35:36Z","customer_name":"Adaeze Chiamaka Okonkwo","total_received":500.0,"expected_amount":null,"expires_at":null,"inflows":[{"session_id":"100004261110173636701939241561","amount":500.0,"sender":{"name":"IFEOLUWA GRACE ADEBAYO","account_number":"8031234506","bank_name":"OPay"},"narration":"","received_at":"2026-11-10T16:36:36Z"}]},"meta":null,"request_id":"req_66906bb3"}
```

### POST /virtual-accounts/{account_number}/simulate-inflow

Required: `amount` (positive number), `sender_name`, `sender_account`, `sender_bank_code` (a CBN or NIP code).

```json
request  {"amount":500.00,"sender_name":"Ifeoluwa Grace Adebayo","sender_account":"8031234506","sender_bank_code":"100004"}
200      {"status":"success","message":"Inflow received","data":{"session_id":"100004261110173636701939241561","amount":500.0,"sender":{"name":"IFEOLUWA GRACE ADEBAYO","account_number":"8031234506","bank_name":"OPay"},"narration":"","received_at":"2026-11-10T16:36:36Z","account_number":"9900445566","reference":"LPPROBE-VA-003"},"meta":null,"request_id":"req_a30b592f"}
```

`session_id` is the provider reference for an inflow (unique per inflow). No fee is reported.

## Checkout and collections (PY-02, PY-03)

### POST /payments/checkout

Required, in order: `merchant_id`, `amount`, `reference`, `customer.name`. Not yet tried: `callback_url`,
`metadata`, `customer.email` (all appear elsewhere or in the guide; capture before use).

```json
request  {"merchant_id":"mer_204","amount":500.00,"reference":"LPPROBE-PAY-001","customer":{"name":"Probe Trader One"}}
201      {"status":"success","message":"Checkout created","data":{"reference":"LPPROBE-PAY-001","amount":500.0,"currency":"NGN","status":"pending","payment_url":"https://pay.xtradot.co/pay/QNVqK8sxAY9-T2ON","expires_at":"2026-11-10T17:07:24Z","ussd":{"code":"*7272*000*8455#","bank":"Xtradot Bank"},"qr":{"payload":"0002010102122678A8CF52457351134E4FA7CFBDD0FB8B630449A8","image":null},"bank_transfer":{"account_number":"9900445568","account_name":"FORGE / MAMA NKECHI PROVISIONS LTD","bank_name":"Xtradot Bank","amount":500.0,"expires_at":"2026-11-10T17:07:24Z"}},"meta":null,"request_id":"req_9663e460"}
```

A checkout expires 30 minutes after creation and offers four ways to pay: hosted page, USSD code, QR payload
and a one-off transfer account under the merchant.

### GET /payments/{reference}/verify

```json
pending     {"data":{"reference":"LPPROBE-PAY-001","status":"pending","amount":500.0,"amount_paid":0.0,"currency":"NGN","channel":null,"merchant_id":"mer_204","customer":{"name":"Probe Trader One","email":null},"merchant_fee":0.0,"settlement_amount":0.0,"paid_at":null,"card":null,"metadata":null},"meta":null,"request_id":"req_4c80a294"}
successful  {"data":{"reference":"LPPROBE-PAY-002","status":"successful","amount":500.0,"amount_paid":500.0,"currency":"NGN","channel":"ussd","merchant_id":"mer_204","customer":{"name":"Probe Trader One","email":null},"merchant_fee":50.0,"settlement_amount":450.0,"paid_at":"2026-11-10T16:37:57Z","card":null,"metadata":null},"meta":null,"request_id":"req_d9c50562"}
unknown     404 {"status":"error","error":{"code":"NOT_FOUND","message":"No payment with reference LPPROBE-NOPE","nip_response_code":"25"},"request_id":"req_cb5904ae"}
```

Statuses seen: `pending`, `successful`. Channels seen: `ussd`, `bank_transfer`, `card`.

### POST /payments/{reference}/simulate-ussd and /simulate-transfer

Body `{}`. Both return the verify shape. `simulate-transfer` also takes `{"amount": n}`:

```json
ussd       200 {"message":"Payment successful","data":{"reference":"LPPROBE-PAY-001","status":"successful","amount":500.0,"amount_paid":500.0,"channel":"ussd","merchant_fee":50.0,"settlement_amount":450.0,"paid_at":"2026-11-10T16:37:34Z",...}}
transfer   200 {"message":"Payment successful","data":{"reference":"LPPROBE-PAY-007","status":"successful","channel":"bank_transfer","merchant_fee":50.0,"settlement_amount":450.0,...}}
part 300   200 {"message":"Partial payment received; payment stays pending","data":{"reference":"LPPROBE-PAY-010","status":"pending","amount":500.0,"amount_paid":300.0,"channel":"bank_transfer","merchant_fee":0.0,"settlement_amount":0.0,"paid_at":null,...}}
over 800   200 {"message":"Payment successful","data":{"reference":"LPPROBE-PAY-011","status":"successful","amount":500.0,"amount_paid":800.0,"channel":"bank_transfer","merchant_fee":50.0,"settlement_amount":450.0,...}}
```

### POST /payments/{reference}/card, then /otp

`card` is an object. `{"card":{}}` gives 400 `card.number is not a valid card number`. Accepted (whether the
expiry fields are validated is not confirmed):

```json
request  {"card":{"number":"5399830000000008","expiry_month":"12","expiry_year":"2028","cvv":"123","pin":"1234"}}
200      {"message":"Enter the OTP sent to +23480******00","data":{"reference":"LPPROBE-PAY-006","status":"otp_required","otp_expires_at":"2026-11-10T16:51:15Z"},"request_id":"req_79eaac39"}

request  {"otp":"123456"}
200      {"message":"Payment successful","data":{"reference":"LPPROBE-PAY-006","status":"successful","amount":2000.0,"amount_paid":2000.0,"channel":"card","merchant_fee":30.0,"settlement_amount":1970.0,"paid_at":"2026-11-10T16:41:24Z","card":{"last4":"0008","scheme":"mastercard","issuer":"Xtradot Bank"},"metadata":null}}

request  {}   ->  422 {"error":{"code":"INVALID_OTP","message":"Wrong or expired OTP"}}
```

LevyPass sends card payers to the hosted `payment_url` and never handles card data itself.

## Settlement and reconciliation (PY-05, AD-05)

### GET /settlements?merchant_id=mer_204

`merchant_id` is required. Before the run, one pending batch per sales date:

```json
200 {"data":[{"settlement_id":null,"merchant_id":"mer_204","merchant_name":"Mama Nkechi Provisions Ltd","sales_date":"2026-11-10","settled_at":null,"status":"pending","scheduled_for":"2026-11-10T22:00:00Z","settlement_account":"0123456793","transaction_count":3,"gross_amount":1500.05,"fees":150.0,"net_amount":1350.05,"transactions":[{"reference":"LPPROBE-PAY-001","channel":"ussd","amount":500.0,"fee":50.0,"customer":"Probe Trader One"}, ...]}],"meta":null,"request_id":"req_9bb0e3cd"}
```

Scheduled for 22:00 UTC (23:00 Lagos). Payments after a run start a new pending batch for the same sales date.

### POST /admin/settlements/run

Body `{}`. Pays every pending batch at once:

```json
200 {"message":"1 settlement batch(es) paid","data":[{"settlement_id":"stl_0091","merchant_id":"mer_204","merchant_name":"Mama Nkechi Provisions Ltd","sales_date":"2026-11-10","settled_at":"2026-11-10T16:40:21Z","settlement_account":"0123456793","transaction_count":3,"gross_amount":1500.05,"fees":150.0,"net_amount":1350.05,"status":"settled","transactions":[...]}],"request_id":"req_ac29ddeb"}
```

The corporate account's statement then shows a credit with reference `STL_0091` for the net amount.

### POST /reconciliation

Required: `merchant_id`, `date`, `records` (a list). Records are `{reference, amount}`:

```json
request  {"merchant_id":"mer_204","date":"2026-11-10","records":[{"reference":"LPPROBE-PAY-001","amount":500.00},{"reference":"LPPROBE-PAY-002","amount":700.00},{"reference":"LPPROBE-GHOST","amount":500.00}]}
200      {"data":{"merchant_id":"mer_204","date":"2026-11-10","matched":[{"reference":"LPPROBE-PAY-001","amount":500.0}],"amount_mismatch":[{"reference":"LPPROBE-PAY-002","yours":700.0,"ours":500.0}],"missing_in_ledger":[{"reference":"LPPROBE-GHOST","amount":500.0}],"missing_in_yours":[{"reference":"LPPROBE-PAY-005","amount":500.05}]},"request_id":"req_995edc9c"}
```

## Webhooks

### POST /webhooks, GET /webhooks, DELETE /webhooks/{id}, POST /webhooks/test, GET /webhooks/deliveries

```json
POST     {"url":"http://app.team13.svc.cluster.local/api/webhooks/bank","events":["*"]}
201      {"message":"Webhook registered. Store webhook_secret now; it is shown only once.","data":{"webhook_id":"whk_f4c05f9d","url":"http://app.team13.svc.cluster.local/api/webhooks/bank","events":["*"],"webhook_secret":"[redacted]"},"request_id":"req_f14f20ed"}
GET      200 {"data":[],...}   (before registering)
test     200 {"message":"Test event queued","data":{"event_id":"evt_28CDFAD33F"},"request_id":"req_0f4f2380"}
deliveries 200 {"data":[{"event_id":"evt_D789D6AE29","event":"virtual_account.credited","url":"http://app.team13.svc.cluster.local/api/webhooks/bank","attempt":1,"status_code":0,"success":false,"at":"2026-11-10T16:36:36Z"}],...}
```

`GET /webhooks/deliveries` does not include the payload. The webhook registered during the probe was deleted
afterwards; the app registers its own and stores the secret in the database (T21 self-heal).

### Delivery

Captured by a temporary server behind Service `app` (`deploy/webhook-capture.yaml`, removed after T4).

Headers: `content-type: application/json`, `user-agent: python-httpx/0.28.1`, `x-forge-event: <event>`,
`x-forge-timestamp: <unix seconds>` (for example `1794328737`), `x-forge-signature: sha256=<64 hex>`.
The guide's reference check (page 10) is `hmac_sha256(secret, f"{ts}.{raw}")`, compared with
`"sha256=" + hex`, rejecting `abs(now - ts) > 300`.

Body: `{"event", "event_id", "created_at", "data", "attempt"}`.

```json
{"event":"webhook.test","event_id":"evt_28CDFAD33F","created_at":"2026-11-10T16:39:47Z","data":{"message":"Signed sample event from the Forge sandbox"},"attempt":1}
{"event":"virtual_account.credited","event_id":"evt_AE1E7BA754","created_at":"2026-11-10T16:39:48Z","data":{"session_id":"100004261110173948422348465407","amount":700.0,"sender":{"name":"IFEOLUWA GRACE ADEBAYO","account_number":"8031234506","bank_name":"OPay"},"narration":"","received_at":"2026-11-10T16:39:48Z","account_number":"9900445566","reference":"LPPROBE-VA-003"},"attempt":1}
{"event":"payment.pending","event_id":"evt_1D0FB67F6C","created_at":"2026-11-10T16:39:50Z","data":{"reference":"LPPROBE-PAY-005","amount":500.05,"amount_paid":0.0,"currency":"NGN","status":"pending","channel":null,"merchant_id":"mer_204","metadata":null},"attempt":1}
{"event":"payment.successful","event_id":"evt_340029BFE5","created_at":"2026-11-10T16:39:51Z","data":{"reference":"LPPROBE-PAY-005","amount":500.05,"amount_paid":500.05,"currency":"NGN","status":"successful","channel":"ussd","merchant_id":"mer_204","metadata":null},"attempt":1}
{"event":"payment.partial","event_id":"evt_145670F121","created_at":"...","data":{"reference":"LPPROBE-PAY-010","amount":500.0,"amount_paid":300.0,"currency":"NGN","status":"pending","channel":"bank_transfer","merchant_id":"mer_204","metadata":null},"attempt":1}
{"event":"payment.overpaid","event_id":"evt_C471FF0AC9","created_at":"...","data":{"reference":"LPPROBE-PAY-011","amount":500.0,"amount_paid":800.0,"currency":"NGN","status":"successful","channel":"bank_transfer","merchant_id":"mer_204","metadata":null},"attempt":1}
{"event":"settlement.completed","event_id":"evt_8FB95A7E35","created_at":"...","data":{"settlement_id":"stl_0091","merchant_id":"mer_204","sales_date":"2026-11-10","gross_amount":1500.05,"fees":150.0,"net_amount":1350.05},"attempt":1}
```

An overpaid checkout sends both `payment.successful` and `payment.overpaid`, with different `event_id`s.
Payment webhooks carry no fee: the fee comes only from verify.

## Huawei MaaS

`POST /openai/v1/chat/completions` and `GET /openai/v1/models` with `apikey: <team key>`:

```json
401 {"error":{"code":"ModelArts.81003","message":"Invalid authorization header.","param":null,"type":"Unauthorized"},"error_code":"ModelArts.81003","error_msg":"Invalid authorization header.","span_id":"c046b2c2ca81541e28f8703d72ce1708"}
```

Same result with `Authorization: Bearer unused` added and for models `glm-5.3`, `glm-5.2`, `deepseek-v4.1-flash`.
See finding 8.

**Update 10 Nov, 22:40 Lagos: the organisers fixed the key.** From the app pod, `GET /models` is 200 and lists
`deepseek-v4-flash`, `glm-5.1`, `glm-5.2`, `glm-5.3`, `deepseek-v4.1-flash`, `deepseek-v4.1-flash-1017`.

- `glm-5.3` rejects `chat_template_kwargs: { thinking: false }` with 400 `ModelArts.81001 unsupported thinking
  type for the current model: disabled` (also for `thinking: {type: "disabled"}`). Without it, it always returns
  `reasoning_content`. It cannot meet the "thinking off" rule.
- Every other listed model accepts `thinking: false` and returns `content` with no `reasoning_content`.
- With our triage prompt, `deepseek-v4.1-flash` took 0.8 to 1.3 s and classified English, Pidgin and Yoruba
  complaints correctly. `glm-5.2` gave the same answers in 4 to 5 s. **We use `deepseek-v4.1-flash`.**

## Design consequences (for the team to confirm)

- **Collection rail:** settlement and reconciliation work only for checkout payments under a merchant. Plan the
  demo's USSD, transfer and card payments as checkouts under `mer_204` (reference = our payment ID). The trader
  dials the checkout's `ussd.code` or pays its `bank_transfer` account.
- **Per-trader virtual accounts** can still be created (one fixture BVN, many accounts, our trader ID as
  `reference`), and inflows can be verified through `GET /virtual-accounts/{n}`. But that money never appears
  in settlement, so the reconciliation screen cannot show it as settled, and every account is named after the
  fixture identity. Either keep virtual accounts as a demo of PY-01 with its money shown as "held at bank, not
  settled", or drop them in favour of checkouts.
- **Fees:** book `merchant_fee` from verify as its own ledger entry; book no fee for virtual-account inflows.
- **Overpayment:** allocate `amount` (what settles), send `amount_paid - amount` to review.

## Addendum (10 Nov, 19:35 UTC)

- `POST /payments/checkout` accepts `callback_url` (201, `LPPROBE-PAY-CB1`). The response shape is unchanged.
- References in our own format (`pay_` plus 20 lower-case characters) work for checkout and verify (201, then 200).

## Addendum (11 Nov, 09:26 UTC): a payment below the fee settles negative

Seen on the cluster during the end-to-end run (`ab1999f`), checkout `pay_b1e02avxd15mtnzphc83` for ₦20.00 paid
through `simulate-ussd`:

```json
200  {"status":"success","message":"Payment successful","data":{"reference":"pay_b1e02avxd15mtnzphc83","status":"successful","amount":20,"amount_paid":20,"channel":"ussd","merchant_fee":50,"settlement_amount":-30,"paid_at":"2026-11-11T09:26:09Z",...},"request_id":"req_bcf1d66a"}
```

- The ₦50 flat fee is charged whatever the amount, so **`settlement_amount` goes negative** when a payment is
  under ₦50. `verify` returns the same body. The settlement run includes it (batch `stl_0095`, gross ₦20, fee ₦50).
- At the time our schema (`src/server/bank/schemas.ts`, `ngn` is `nonnegative`) rejected that body as
  `UNEXPECTED_SHAPE`. The effect, all observed on `ab1999f`: USSD tells the trader "We could not start the
  payment" although the bank took the money; the webhook fails to process; the poller retries `verify` every
  8 s for 6 hours; the payment stays `pending` with no ledger entry, receipt or review item; reconciliation
  shows "1 only at the bank", gap ₦30.00.
- Fixed the same day: `settlement_amount` (and a settlement's `net_amount`, by the same arithmetic, though not
  yet captured below zero) may be negative, and migration 0004 lets `payments.fee_kobo` exceed `amount_kobo`.
  Such a payment now settles like any other: inflow ₦20, fee ₦50, receipt issued.
- How a ₦20 payment came about: a daily levy "Motor park Ticket" at ₦20 was added on the cluster (11 Nov,
  02:13 UTC), so every trader who is paid up is offered "Pay ahead ₦20.00".

### An expired checkout reports `status: "expired"`

Checkout `pay_8s36wzmcwna7bw6sq5yj` (₦800.00, opened and never paid), asked 3 minutes after `expires_at`:

```json
200  {"status":"success","message":"Request completed","data":{"reference":"pay_8s36wzmcwna7bw6sq5yj","status":"expired","amount":800.0,"amount_paid":0.0,"currency":"NGN","channel":null,"merchant_id":"mer_204","customer":{"name":"Taiwo Popoola","email":null},"merchant_fee":0.0,"settlement_amount":0.0,"paid_at":null,"card":null,"metadata":null},"meta":null,"request_id":"req_760f615d"}
```

- Statuses seen are now `pending`, `successful` and `expired`. At the time our verify schema allowed `pending`,
  `successful`, `failed` and `reversed`, so this body was also rejected as `UNEXPECTED_SHAPE`: every pay page
  that was opened and left became, 30 minutes later, a payment that stayed `pending` and was re-verified every
  8 s for 6 hours.
- Fixed the same day: `expired` is accepted and closes our payment as `failed` (the bank's word is kept in
  `provider_data.bankStatus`). If `amount_paid` is above zero when a checkout expires, the payment also goes to
  the review queue as `expired_part_paid`; that case has not been seen in the sandbox.
