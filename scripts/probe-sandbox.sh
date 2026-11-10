#!/usr/bin/env bash
# T4: call the Forge sandbox from the throwaway `probe` pod (deploy/probe-pod.yaml).
#
#   scripts/probe-sandbox.sh up                       # create the pod and wait for it
#   scripts/probe-sandbox.sh bank GET /accounts/0123456789/balance
#   scripts/probe-sandbox.sh bank POST /virtual-accounts '{"...":"..."}' [extra curl header...]
#   scripts/probe-sandbox.sh maas POST /chat/completions '{"model":"glm-5.3",...}'
#   scripts/probe-sandbox.sh down                     # delete the pod
#
# The key reaches the pod through envFrom and is expanded only inside it (single quotes below),
# so it never touches this machine. Output is scrubbed of the key and of any webhook secret.
# Every bank POST gets a fresh Idempotency-Key unless one is passed as an extra header.
set -euo pipefail

export KUBECONFIG="${KUBECONFIG:-$HOME/forge/team13.yaml}"
here="$(cd "$(dirname "$0")/.." && pwd)"
bank_url="http://bank-api.ingress-apisix.svc.cluster.local/v1"
maas_url="http://huawei-maas.ingress-apisix.svc.cluster.local/openai/v1"

scrub='awk -v k="$GATEWAY_KEY" '\''{ while (k != "" && (i = index($0, k)) > 0) $0 = substr($0, 1, i - 1) "[redacted]" substr($0, i + length(k)); print }'\'' | sed -E '\''s/"(webhook_secret|secret|signing_secret)" *: *"[^"]*"/"\1":"[redacted]"/g'\'''

call() {
  local target="$1" method="$2" path="$3" body="${4:-}"
  shift 4 || shift $#
  local base header
  if [[ "$target" == bank ]]; then base="$bank_url"; header='x-api-key'; else base="$maas_url"; header='apikey'; fi
  local extra=()
  for h in "$@"; do extra+=(-H "$h"); done
  if [[ "$target" == bank && "$method" == POST ]] && ! printf '%s\n' "$@" | grep -qi '^idempotency-key:'; then
    extra+=(-H "Idempotency-Key: $(uuidgen | tr 'A-Z' 'a-z')")
  fi
  local args=(-sS -m 130 -D /tmp/h -o /tmp/b -w '%{http_code}' -X "$method" -H 'content-type: application/json' ${extra[@]+"${extra[@]}"})
  [[ -n "$body" ]] && args+=(--data "$body")
  # shellcheck disable=SC2016 # $GATEWAY_KEY must expand inside the pod, not here.
  kubectl exec probe -- sh -c '
    code=$(curl "$@" -H "'"$header"': $GATEWAY_KEY" "'"$base$path"'")
    echo "HTTP $code"
    grep -iE "^(idempotent-replayed|x-request-id|retry-after|x-ratelimit-[a-z]+|content-type):" /tmp/h | tr -d "\r" | '"$scrub"'
    cat /tmp/b | '"$scrub"'; echo
  ' sh "${args[@]}"
}

case "${1:-}" in
  up)
    kubectl apply -f "$here/deploy/probe-pod.yaml"
    kubectl wait pod/probe --for=condition=Ready --timeout=120s ;;
  down) kubectl delete pod probe --ignore-not-found ;;
  bank | maas) target="$1"; shift; call "$target" "$@" ;;
  *) sed -n '2,12p' "$0"; exit 1 ;;
esac
