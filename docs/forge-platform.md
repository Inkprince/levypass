# Forge 2026 sandbox: working digest

Text digest of `docs/forge-platform-guide.pdf` (v1.0, 9 Nov 2026), limited to what LevyPass uses.
The PDF wins on any conflict. The request and response bodies of the bank API are **not** in the
guide; they are in the *Sandbox API Mock Specification v2* (we do not have it yet) and in
`docs/bank-api-notes.md`, which task T4 fills from real calls. Never guess a body shape.

Team ID: `team13` (inferred from the kubeconfig file name; confirm with the team lead).

## Topology

| Endpoint | Reachable from | Purpose |
| --- | --- | --- |
| `https://team13.xtradot.co` | Internet | Our app: Service `app`, port 80 |
| `http://bank-api.ingress-apisix.svc.cluster.local/v1` | Our namespace only | Xtradot Bank sandbox API |
| `http://huawei-maas.ingress-apisix.svc.cluster.local/openai/v1` | Our namespace only | Huawei MaaS, OpenAI-compatible |
| `https://pay.xtradot.co/pay/<token>` | Internet | Hosted checkout page returned by the bank API |
| `http://app.team13.svc.cluster.local` | Inside the cluster | Our internal address, used for webhooks |

- Nodes are `linux/amd64`. Build with `docker build --platform linux/amd64` (this Mac is arm64).
- TLS ends upstream. The pod serves plain HTTP on `0.0.0.0`, fixed port, with `GET /healthz` → 200.
- Exactly one public Service per team, and it must be named `app` on port 80. Other Services are internal.
- `LoadBalancer` and `NodePort` Services are blocked.
- The platform APIs do not answer from a workstation. Test them from a pod in our namespace (below).

## Credentials

- Kubeconfig: `~/forge/team13.yaml`, `chmod 600`, never in Git. `export KUBECONFIG=~/forge/team13.yaml`.
- Team key: secret `huawei-gateway`, field `GATEWAY_KEY`, injected with `envFrom`. One key, two headers:
  `x-api-key` for the bank, `apikey` for Huawei MaaS.
- Never bake the key into an image, source file or log line. Report a leak at once.

## Namespace quota

| Resource | Limit |
| --- | --- |
| Pods | 10 |
| CPU requests / limits | 400m / 2 cores |
| Memory requests / limits | 768Mi / 2Gi |
| Services | 5 |
| Persistent volumes | 1, up to 10Gi |
| Defaults if unset | requests 50m / 64Mi, limits 500m / 512Mi |

Check with `kubectl describe resourcequota team-quota`.

## Bank API conventions

| Item | Value |
| --- | --- |
| Auth | `x-api-key: <team key>` on every request |
| Idempotency | `Idempotency-Key: <uuid>` on every POST that moves money or creates a record. Same key and body replays the original with `Idempotent-Replayed: true`. Same key, different body returns 409 |
| Amounts | NGN, two decimals |
| Timestamps | ISO 8601, UTC |
| Pagination | `?page=1&per_page=20`, max 100 |
| Rate limit | 60 requests a minute per team, **shared with Huawei MaaS**. 429 beyond |
| Gateway timeout | 30 s bank, 120 s MaaS |
| Forced outcomes | header `x-test-outcome: successful \| failed \| pending \| timeout \| reversed` |

Envelope:

```json
{"status":"success","message":"...","data":{},"meta":null,"request_id":"req_..."}
{"status":"error","error":{"code":"INVALID_REQUEST","message":"...","field":"amount"},"request_id":"req_..."}
```

Log `request_id` on every call. Support asks for it.

**On 504 `TIMEOUT`, never resend.** The outcome is unknown. Requery (`GET /transfers/{reference}`,
`POST /transfers/interbank/requery`, `GET /payments/{reference}/verify`) until the status is final.
The guide says resending is "the classic double-debit defect, and it is assessed".

## Endpoints LevyPass uses

Paths only. Where the guide lists a path with a `+`, the full path is inferred and marked so.

| Need | Endpoints |
| --- | --- |
| Virtual account per trader (PY-01) | `POST /virtual-accounts`, `GET /virtual-accounts/{account_number}`, `POST /virtual-accounts/{account_number}/simulate-inflow` |
| Card and transfer checkout (PY-02) | `POST /payments/checkout`, `POST /payments/{reference}/card`, `POST /payments/{reference}/otp`, `POST /payments/{reference}/simulate-transfer` |
| USSD payment (PY-03) | `/payments/{reference}/simulate-ussd` (inferred path), also `/simulate-qr` |
| Verify before value (PY-04) | `GET /payments/{reference}/verify` |
| Settlement and reconciliation (PY-05, AD-05) | `GET /settlements`, `POST /reconciliation`, `POST /admin/settlements/run` |
| Statement cross-check | `GET /accounts/{account_number}/balance`, `GET /transactions`, `GET /transactions/{reference}` |
| Webhooks | `POST /webhooks`, `GET /webhooks`, `DELETE /webhooks/{id}`, `POST /webhooks/test`, `GET /webhooks/deliveries`, `POST /webhooks/deliveries/{event_id}/replay` |
| Reset and fixtures | `POST /admin/reset`, `POST /admin/accounts/{n}/fund`, `POST /admin/accounts/{n}/status` |
| Stretch: identity, credit | `POST /identity/bvn/verify`, `POST /identity/nin/verify`, `POST /loans/applications`, `GET /loans/{loan_id}`, `POST /loans/{loan_id}/accept`, open banking consents |

**Not implemented in the sandbox (404):** merchant onboarding, KYC tiering, mandates, split and
escrow, **refunds and disputes**, cards, cross-border, bills, risk. So PY-07 (refund) and PY-08
(split) cannot run against the sandbox; a double payment is credited forward instead.

Collections notes:

- `payment_url` opens the hosted checkout at `pay.xtradot.co`, which redirects to our `callback_url`
  with `reference` and `status`. That redirect is not proof. Always call
  `GET /payments/{reference}/verify` before giving value.
- Merchant fees: card and POS 1.5% capped at ₦2,000; transfer, USSD and QR ₦50 flat.
- Transfer charges come back as `fee`, `vat`, `stamp_duty`, `total_debit`. The schedule may change
  on demo day. Read charges from the response; never hard-code them.

## Webhooks

- Register a public HTTPS URL or the internal one (`http://app.team13.svc.cluster.local/...`).
- `webhook_secret` is returned **once**, at registration. Store it.
- Headers: `x-forge-event`, `x-forge-timestamp`, `x-forge-signature: sha256=<hex HMAC-SHA256 of "{timestamp}.{raw_body}">`.
- Verify over the raw body with a constant-time compare. Reject timestamps older than 5 minutes.
- Respond 2xx within 10 s. Retries at 1 min, 5 min, 15 min, 1 h, 6 h. De-duplicate on `event_id`.
- Events we care about: `payment.pending|successful|failed|partial|overpaid`,
  `virtual_account.credited`, `settlement.completed`, `webhook.test`. Others exist
  (`transfer.*`, `consent.*`, `loan.*`, `carbon.*`).

## Test data

Team-owned accounts at Xtradot Bank (NIP `000014`, CBN `044`):

| Account | Holder | Type | Tier | Opening balance (₦) |
| --- | --- | --- | --- | --- |
| 0123456789 | Adaeze Chiamaka Okonkwo | Savings | 3 | 1,500,000.00 |
| 0123456790 | Babatunde Olumide Adeyemi | Current | 3 | 5,000,000.00 |
| 0123456791 | Musa Ibrahim Abdullahi | Savings | 2 | 250,000.00 |
| 0123456792 | Efosa Godwin Osagie | Savings | 1 | 40,000.00 |
| 0123456793 | Mama Nkechi Provisions Ltd | Corporate | n/a | 12,000,000.00 |

- Merchants: `mer_204` Mama Nkechi Provisions, `mer_205` Kano Agro Hub, `mer_206` Ọṣun Threads, `mer_900` Forge Carbon Registry.
- Wallets: `wal_adaeze_01` (₦20,000), `wal_musa_01` (₦5,000).
- OTP for cards and consents: `123456`.
- Test cards (any future expiry, CVV `123`, PIN `1234`): `5399830000000008` succeeds,
  `5399830000000016` declines for insufficient funds, `5399830000000024` fails OTP.
- Every team account carries seeded October 2026 history.
- Beneficiary accounts, BVN and NIN fixtures: see PDF page 8 to 9.

Trigger values:

| Trigger | Applies to | Result |
| --- | --- | --- |
| Amount ending `.01` | Transfers, card, POS | `INSUFFICIENT_FUNDS` |
| Amount ending `.02` | Transfers | `TIMEOUT`, then failed and reversed after 30 s |
| Amount ending `.03` | Transfers | Pending 2 min, then successful |
| Amount ending `.04` | Interbank | Successful, then reversed after about 60 s |
| Amount ending `.05` | Transfers | First webhook delivery withheld |
| Reference prefix `DUP-` | Transfers, payments | `DUPLICATE_REQUEST` |
| Account `0000000001` | Name enquiry, bulk | `ACCOUNT_NOT_FOUND` |
| Account `0000000002` | Name enquiry | `TIMEOUT` after 10 s |
| Bank code `999999` | Interbank enquiry | `BANK_UNAVAILABLE` |

**Amounts ending `.00` never trigger.** Seeded levy amounts are whole naira so the happy path is
deterministic. Which triggers fire on collections (as opposed to transfers) is confirmed in T4.

## Error codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `INVALID_REQUEST` | 400 | Malformed or missing field; `field` names it |
| `UNAUTHORIZED` | 401 | Missing or invalid key |
| `INSUFFICIENT_FUNDS` | 402 | Balance below amount plus charges |
| `ACCOUNT_RESTRICTED`, `CONSENT_REQUIRED` | 403 | Source restricted; no consent |
| `ACCOUNT_NOT_FOUND`, `NOT_FOUND` | 404 | Unknown account, record or endpoint |
| `DUPLICATE_REQUEST`, `NAME_ENQUIRY_EXPIRED`, `NAME_ENQUIRY_MISMATCH` | 409 | Reused key, reference or enquiry ref |
| `ACCOUNT_DORMANT`, `BENEFICIARY_FROZEN`, `LIMIT_EXCEEDED`, `BVN_MISMATCH`, `INVALID_OTP` | 422 | Business rule failed |
| `RATE_LIMITED` | 429 | Over 60 requests a minute |
| `BANK_UNAVAILABLE` | 503 | Beneficiary bank down |
| `TIMEOUT` | 504 | Outcome unknown: requery, never resend |

## Huawei MaaS

- Base URL `http://huawei-maas.ingress-apisix.svc.cluster.local/openai/v1`, header `apikey: <team key>`,
  SDK `apiKey` any placeholder such as `unused`.
- Models: `glm-5.3`, `glm-5.2`, `glm-5.1`, `deepseek-v4.1-flash-1017`, `deepseek-v4.1-flash`,
  `deepseek-v4-flash`. If one returns not found, use another.
- Turn reasoning off unless needed: `chat_template_kwargs: { thinking: false }`. `max_tokens` does not cap reasoning.
- Never call a model on page load, in a loop, or from an unauthenticated public endpoint. Cache what is reused.
- Calls can take several seconds. Set client timeouts to match.

## Policies that bind us

- **Synthetic data only.** No real names, phone numbers, account numbers, BVNs or NINs anywhere, including logs and seed files.
- **Public by default.** Anything at `team13.xtradot.co` is open to anyone with the link. Gate admin and officer screens.
- **Sandbox state is volatile.** Bank data lives in memory; a platform restart returns every team to the opening state. Our database is the record. We must be able to re-provision bank-side state (webhook, virtual accounts) on demand.
- **Observability.** Gateway requests are logged and metered per team for support **and judging**.
- **Isolation.** Do not probe other namespaces or platform components.
- **End of event.** Kubeconfig and key are revoked at close. Export what we need before then.

## Operating commands

```bash
export KUBECONFIG=~/forge/team13.yaml
kubectl get pods
kubectl logs deploy/app -f
kubectl logs deploy/app --previous
kubectl set image deployment/app app=<registry>/<image>:<git-sha>
kubectl rollout status deployment/app
kubectl rollout undo deployment/app

# Call a platform API by hand (only works from inside the namespace)
kubectl run curl --image=curlimages/curl --restart=Never -- sleep 3600
kubectl wait pod/curl --for=condition=Ready --timeout=60s
KEY=$(kubectl get secret huawei-gateway -o jsonpath='{.data.GATEWAY_KEY}' | base64 --decode)
kubectl exec curl -- curl -s -H "x-api-key: $KEY" \
  http://bank-api.ingress-apisix.svc.cluster.local/v1/accounts/0123456789/balance
kubectl delete pod curl
```

Tag every image with the Git SHA. Never deploy `latest`.
