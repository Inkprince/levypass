#!/usr/bin/env bash
# npm run db:backup: copy the cluster database to this machine.
#
# Why: the cluster cannot give Postgres a volume yet (see tasks/todo.md, T3), so its data sits on the
# pod's scratch disk and is gone if that pod restarts. The app then rebuilds seed data on its own
# (AUTO_SEED), but everything done since is lost. A dump taken here brings it back in about a minute
# with `npm run db:restore`.
#
# Dumps go to ~/forge/backups (outside the repo, readable by you only). Data is synthetic, but the dump
# holds the demo logins' password hashes and live sessions, so do not share it.
#   BACKUP_DIR=/some/where npm run db:backup
#   EVERY=600 npm run db:backup          # keep running: a dump every 10 minutes (leave it open in a tab on demo day)
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-$HOME/forge/team13.yaml}"
dir="${BACKUP_DIR:-$HOME/forge/backups}"
mkdir -p "$dir"
chmod 700 "$dir"
umask 077

backup() {
  rm -f "$dir"/*.part # left by a dump that lost its connection
  file="$dir/levypass-$(date -u +%Y%m%dT%H%M%SZ).sql"

  # --clean --if-exists: the dump drops and recreates every object, so restoring over a re-seeded
  # database needs no manual clearing (the ledger's append-only trigger blocks DELETE, not DROP).
  kubectl exec deploy/postgres -- pg_dump -U levypass -d levypass --clean --if-exists --no-owner --no-privileges > "$file.part"
  grep -q '^-- PostgreSQL database dump complete' "$file.part" || { echo "The dump is incomplete (lost connection?). Nothing kept. Run it again." >&2; rm -f "$file.part"; return 1; }
  mv "$file.part" "$file"

  counts="$(kubectl exec deploy/postgres -- psql -U levypass -d levypass -At -c \
    "select 'traders ' || (select count(*) from traders) || ', payments ' || (select count(*) from payments) || ', ledger entries ' || (select count(*) from ledger_entries) || ', receipts ' || (select count(*) from receipts)" 2>/dev/null || echo "counts unavailable")"
  echo "Saved $file ($(du -h "$file" | cut -f1 | tr -d ' ')): $counts"
  # Keep the 20 newest.
  ls -1t "$dir"/levypass-*.sql 2>/dev/null | tail -n +21 | while read -r old; do rm -f "$old"; done
}

if [[ -z "${EVERY:-}" ]]; then
  backup
  exit
fi
[[ "$EVERY" =~ ^[0-9]+$ && "$EVERY" -ge 60 ]] || { echo "EVERY is seconds between dumps, at least 60." >&2; exit 1; }
echo "Dumping every $EVERY s into $dir. Ctrl+C to stop."
while true; do
  # The cluster API drops now and then; a failed dump is reported and the next one tries again.
  backup || echo "$(date '+%H:%M:%S') dump failed, trying again in $EVERY s" >&2
  sleep "$EVERY"
done
