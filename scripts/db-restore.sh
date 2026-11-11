#!/usr/bin/env bash
# npm run db:restore: put a dump from `npm run db:backup` back into the cluster database.
#   npm run db:restore                      # the newest dump in ~/forge/backups
#   npm run db:restore -- path/to/dump.sql  # a particular one
#   YES=1 npm run db:restore                # do not ask
#   TARGET_URL=postgres://... npm run db:restore -- dump.sql   # restore somewhere else, e.g. a local scratch database
#
# This REPLACES everything in the target database with the dump. In the cluster it stops the app
# first (so the poller is not writing while tables are replaced) and starts it again afterwards.
# The bank sandbox is not touched: our database is the record, and the app re-registers its webhook
# by itself if the sandbox has lost it.
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-$HOME/forge/team13.yaml}"
dir="${BACKUP_DIR:-$HOME/forge/backups}"
file="${1:-$(ls -1t "$dir"/levypass-*.sql 2>/dev/null | head -1 || true)}"
[[ -n "$file" && -f "$file" ]] || { echo "No dump found. Run npm run db:backup first, or pass a file." >&2; exit 1; }
grep -q '^-- PostgreSQL database dump complete' "$file" || { echo "$file is not a complete dump." >&2; exit 1; }

if [[ -n "${TARGET_URL:-}" ]]; then
  echo "==> Restoring $file into the database at TARGET_URL"
  psql "$TARGET_URL" -v ON_ERROR_STOP=1 --single-transaction -q -f "$file" >/dev/null
  echo "==> Done"
  exit 0
fi

echo "This replaces the whole team13 cluster database with:"
echo "  $file ($(du -h "$file" | cut -f1 | tr -d ' '), $(date -r "$file" '+%d %b %H:%M'))"
if [[ "${YES:-}" != 1 ]]; then
  read -r -p "Type restore to go on: " answer
  [[ "$answer" == restore ]] || { echo "Nothing changed."; exit 1; }
fi

echo "==> Stopping the app"
kubectl scale deployment/app --replicas=0 >/dev/null
kubectl rollout status deployment/app --timeout=120s >/dev/null
trap 'echo "==> Starting the app"; kubectl scale deployment/app --replicas=1 >/dev/null; kubectl rollout status deployment/app --timeout=300s' EXIT

echo "==> Restoring"
kubectl exec -i deploy/postgres -- psql -U levypass -d levypass -v ON_ERROR_STOP=1 --single-transaction -q < "$file" >/dev/null
kubectl exec deploy/postgres -- psql -U levypass -d levypass -At -c \
  "select 'Restored: traders ' || (select count(*) from traders) || ', payments ' || (select count(*) from payments) || ', ledger entries ' || (select count(*) from ledger_entries) || ', receipts ' || (select count(*) from receipts)"
