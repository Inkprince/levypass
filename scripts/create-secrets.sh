#!/usr/bin/env bash
# Creates the app's Kubernetes secrets in team13, once. Run it yourself; values are generated here,
# applied straight to the cluster and never printed. Existing secrets are left alone, so the database
# password never changes under a running Postgres. Demo logins are written to a 600 file in ~/forge.
#
#   scripts/create-secrets.sh            # levypass-db and levypass-app
#   scripts/create-secrets.sh ghcr       # also ghcr-pull, from a read:packages token on stdin:
#                                        #   pbcopy-paste | scripts/create-secrets.sh ghcr
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-$HOME/forge/team13.yaml}"
here="$(cd "$(dirname "$0")/.." && pwd)"
logins="$HOME/forge/levypass-demo-logins.txt"

exists() { kubectl get secret "$1" >/dev/null 2>&1; }

if exists levypass-db; then
  echo "levypass-db exists; keeping it."
else
  db_password="$(openssl rand -hex 24)"
  kubectl create secret generic levypass-db --from-literal=POSTGRES_PASSWORD="$db_password" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  echo "levypass-db created."
fi

if exists levypass-app; then
  echo "levypass-app exists; keeping it."
else
  db_password="$(kubectl get secret levypass-db -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 --decode)"
  qr_key="$(cd "$here" && node -e "const {generateKeyPairSync}=require('node:crypto');process.stdout.write(generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'der'}).toString('base64'))")"
  admin_password="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
  officer_pin="$(printf '%04d' $((RANDOM % 10000)))"
  kubectl create secret generic levypass-app \
    --from-literal=DATABASE_URL="postgres://levypass:${db_password}@postgres:5432/levypass" \
    --from-literal=QR_SIGNING_KEY="$qr_key" \
    --from-literal=SESSION_SECRET="$(openssl rand -base64 48)" \
    --from-literal=SEED_ADMIN_PASSWORD="$admin_password" \
    --from-literal=SEED_OFFICER_PIN="$officer_pin" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  umask 077
  printf 'LevyPass demo logins (team13)\nAdmin: revenue@levypass.test / %s\nOfficers OTT-001 to OTT-003, PIN: %s\n' "$admin_password" "$officer_pin" > "$logins"
  echo "levypass-app created. Demo logins written to $logins"
fi

if [[ "${1:-}" == ghcr ]]; then
  echo "Paste a GitHub token with read:packages only, then Enter:" >&2
  IFS= read -rs token
  kubectl create secret docker-registry ghcr-pull --docker-server=ghcr.io --docker-username=Inkprince \
    --docker-password="$token" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  echo "ghcr-pull created."
fi
