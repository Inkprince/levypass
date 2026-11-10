#!/usr/bin/env bash
# npm run start: run the production build locally, the way the container runs it.
# The standalone server needs the static assets beside it and does not read .env.local itself.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -f .next/standalone/server.js ]] || { echo "No production build yet. Run: npm run build" >&2; exit 1; }
mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/
cp -R public .next/standalone/
exec node --env-file-if-exists=.env.local .next/standalone/server.js
