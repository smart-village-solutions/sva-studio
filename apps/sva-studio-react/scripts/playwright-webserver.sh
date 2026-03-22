#!/bin/sh

set -eu

PORT="${1:?port required}"
ATTEMPT=1
MAX_ATTEMPTS=2

while [ "$ATTEMPT" -le "$MAX_ATTEMPTS" ]; do
  set +e
  pnpm exec vite dev --port "$PORT"
  STATUS=$?
  set -e

  if [ "$STATUS" -eq 0 ] || [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    exit "$STATUS"
  fi

  echo "[playwright-webserver] vite dev exited early with status $STATUS, retrying once..." >&2
  ATTEMPT=$((ATTEMPT + 1))
  sleep 1
done
