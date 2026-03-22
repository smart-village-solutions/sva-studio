#!/bin/sh

set -eu

PORT="${1:?port required}"
ATTEMPT=1
MAX_ATTEMPTS=2
READY_TIMEOUT_SECONDS=30
POLL_INTERVAL_SECONDS=1
BASE_URL="http://127.0.0.1:${PORT}"

cleanup() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

wait_for_server_readiness() {
  elapsed=0

  while [ "$elapsed" -lt "$READY_TIMEOUT_SECONDS" ]; do
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      wait "$SERVER_PID"
      return 1
    fi

    if curl -fsS "${BASE_URL}/@vite/client" >/dev/null 2>&1; then
      return 0
    fi

    sleep "$POLL_INTERVAL_SECONDS"
    elapsed=$((elapsed + POLL_INTERVAL_SECONDS))
  done

  echo "[playwright-webserver] SSR readiness timed out after ${READY_TIMEOUT_SECONDS}s" >&2
  return 1
}

while [ "$ATTEMPT" -le "$MAX_ATTEMPTS" ]; do
  set +e
  pnpm exec vite dev --host 127.0.0.1 --port "$PORT" &
  SERVER_PID=$!
  set -e

  trap cleanup EXIT INT TERM

  if wait_for_server_readiness; then
    trap - EXIT INT TERM
    wait "$SERVER_PID"
    STATUS=$?
  else
    STATUS=1
    cleanup
    trap - EXIT INT TERM
  fi

  if [ "$STATUS" -eq 0 ] || [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    exit "$STATUS"
  fi

  echo "[playwright-webserver] vite dev exited early with status $STATUS, retrying once..." >&2
  ATTEMPT=$((ATTEMPT + 1))
  sleep 1
done
