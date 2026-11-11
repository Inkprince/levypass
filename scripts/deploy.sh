#!/usr/bin/env bash
# npm run deploy: get the linux/amd64 image for HEAD, apply, wait, report quota.
# The image is built by GitHub Actions (.github/workflows/image.yml) on every push to main and
# tagged with the first 12 characters of the commit SHA. This script waits for that tag, so
# commit and `git push` first. Migrations run in the app pod's init container on every rollout.
#   BUILD=local npm run deploy     # build on this machine instead (slow on Apple Silicon)
#   ALLOW_DIRTY=1 npm run deploy   # deploy uncommitted changes; always a local build, tag gets -dirty
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-$HOME/forge/team13.yaml}"
cd "$(dirname "$0")/.."

image_repo="${IMAGE_REPO:-ghcr.io/inkprince/levypass}"
sha="$(git rev-parse HEAD | cut -c1-12)"
build="${BUILD:-ci}"
if [[ -n "$(git status --porcelain)" ]]; then
  [[ "${ALLOW_DIRTY:-}" == 1 ]] || { echo "Working tree has changes. Commit first, or set ALLOW_DIRTY=1." >&2; exit 1; }
  sha="${sha}-dirty"
  build=local
fi
image="${image_repo}:${sha}"

for s in levypass-db levypass-app huawei-gateway; do
  kubectl get secret "$s" >/dev/null 2>&1 || { echo "Secret $s is missing. Run scripts/create-secrets.sh first." >&2; exit 1; }
done

image_ready() { docker buildx imagetools inspect "$image" >/dev/null 2>&1; }

if [[ "$sha" != *-dirty ]] && image_ready; then
  echo "==> $image is already in the registry"
elif [[ "$build" == local ]]; then
  echo "==> Building $image (linux/amd64) on this machine"
  docker buildx build --platform linux/amd64 -f deploy/Dockerfile -t "$image" --push .
else
  git fetch -q origin main 2>/dev/null || true
  if ! git merge-base --is-ancestor HEAD origin/main 2>/dev/null; then
    echo "HEAD is not on origin/main yet, so GitHub Actions has not built it. Run git push first," >&2
    echo "or build here with BUILD=local npm run deploy." >&2
    exit 1
  fi
  echo "==> Waiting for GitHub Actions to push $image (gh run watch shows progress)"
  for i in $(seq 1 120); do
    image_ready && break
    (( i % 6 == 0 )) && echo "    still building ($((i / 6)) min)"
    sleep 10
  done
  image_ready || { echo "No image after 20 minutes. Check: gh run list --workflow image.yml" >&2; exit 1; }
fi

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
