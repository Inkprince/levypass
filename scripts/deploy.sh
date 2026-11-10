#!/usr/bin/env bash
# npm run deploy: build linux/amd64, tag with the Git SHA, push, apply, wait, report quota.
# Migrations run in the app pod's init container on every rollout.
#   ALLOW_DIRTY=1 npm run deploy   # deploy uncommitted changes (tag gets a -dirty suffix)
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-$HOME/forge/team13.yaml}"
cd "$(dirname "$0")/.."

image_repo="${IMAGE_REPO:-ghcr.io/inkprince/levypass}"
sha="$(git rev-parse --short=12 HEAD)"
if [[ -n "$(git status --porcelain)" ]]; then
  [[ "${ALLOW_DIRTY:-}" == 1 ]] || { echo "Working tree has changes. Commit first, or set ALLOW_DIRTY=1." >&2; exit 1; }
  sha="${sha}-dirty"
fi
image="${image_repo}:${sha}"

for s in levypass-db levypass-app huawei-gateway; do
  kubectl get secret "$s" >/dev/null 2>&1 || { echo "Secret $s is missing. Run scripts/create-secrets.sh first." >&2; exit 1; }
done

echo "==> Building $image (linux/amd64)"
docker buildx build --platform linux/amd64 -f deploy/Dockerfile -t "$image" --push .

echo "==> Postgres"
if [[ "${PG_EPHEMERAL:-}" == 1 ]]; then
  # Fallback while the cluster cannot provision volumes: data lives on the pod's scratch disk and is
  # lost when the Postgres pod restarts. Re-seed afterwards (kubectl exec deploy/app -- node dist/seed.mjs).
  echo "WARNING: PG_EPHEMERAL=1, Postgres data is lost if its pod restarts." >&2
  sed 's|persistentVolumeClaim: { claimName: postgres-data }|emptyDir: { sizeLimit: 1Gi }|' deploy/postgres.yaml | kubectl apply -f -
else
  kubectl apply -f deploy/postgres.yaml
fi
kubectl rollout status deployment/postgres --timeout=180s

echo "==> App"
sed "s|image: IMAGE|image: ${image}|" deploy/app.yaml | kubectl apply -f -
if ! kubectl rollout status deployment/app --timeout=300s; then
  echo "Rollout failed. Recent events and logs:" >&2
  kubectl get pods -l app=levypass >&2
  kubectl logs deployment/app -c migrate --tail=30 >&2 || true
  kubectl logs deployment/app -c app --tail=30 >&2 || true
  echo "Undo with: kubectl rollout undo deployment/app" >&2
  exit 1
fi

echo "==> Deployed $image"
kubectl describe resourcequota team-quota | sed -n '/Resource/,$p'
