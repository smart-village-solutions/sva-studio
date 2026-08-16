#!/bin/sh

set -eu

PORT="${1:?port required}"

: "${SVA_PARENT_DOMAIN:=studio.localhost}"
: "${SVA_PUBLIC_BASE_URL:=http://studio.localhost:${PORT}}"
# Mock auth is only enabled for credential-free browser suites. It lets tests
# establish a real, server-readable dev session when they exercise full
# document navigations (for example links that open in a new tab). Suites with
# configured tenant credentials continue to use their persisted Keycloak
# session and keep mock auth disabled.
if [ -z "${SVA_MOCK_AUTH+x}" ]; then
  if [ -z "${PLAYWRIGHT_DE_MUSTERHAUSEN_USERNAME:-}" ] && \
    [ -z "${PLAYWRIGHT_DE_MUSTERHAUSEN_PASSWORD:-}" ]; then
    SVA_MOCK_AUTH=true
  else
    SVA_MOCK_AUTH=false
  fi
fi
if [ "$SVA_MOCK_AUTH" = "true" ]; then
  VITE_MOCK_AUTH=true
else
  : "${VITE_MOCK_AUTH:=false}"
fi
: "${PLAYWRIGHT_TEST:=true}"
: "${VITE_PLAYWRIGHT_TEST:=true}"

export SVA_PARENT_DOMAIN
export SVA_PUBLIC_BASE_URL
export SVA_MOCK_AUTH
export VITE_MOCK_AUTH
export PLAYWRIGHT_TEST
export VITE_PLAYWRIGHT_TEST

cleanup() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

start_server() {
  pnpm exec vite dev --host 0.0.0.0 --port "$PORT" --strictPort &
  SERVER_PID=$!
}

trap cleanup EXIT INT TERM

start_server
sleep 2

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  wait "$SERVER_PID" 2>/dev/null || true
  SERVER_PID=""
  start_server
fi

wait "$SERVER_PID"
