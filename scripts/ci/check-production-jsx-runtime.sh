#!/usr/bin/env bash
set -euo pipefail

APP_DIR_INPUT="${1:-apps/sva-studio-react}"
APP_DIR="$(cd "${APP_DIR_INPUT}" && pwd)"
SERVER_DIR="${APP_DIR}/.output/server"
SERVER_INDEX_PATH="${SERVER_DIR}/index.mjs"
NITRO_SSR_SERVER_ENTRY_PATH="${SERVER_DIR}/_ssr/ssr.mjs"
LEGACY_SERVER_ENTRY_PATH="${SERVER_DIR}/chunks/build/tanstack-server-entry.mjs"
PATCHED_SERVER_ENTRY_PATH="${NITRO_SSR_SERVER_ENTRY_PATH}"
SERVER_CHUNK_PATH=""

if [ ! -f "${SERVER_INDEX_PATH}" ]; then
  echo "Finaler Server-Entry fehlt: ${SERVER_INDEX_PATH}" >&2
  exit 1
fi

if [ ! -f "${PATCHED_SERVER_ENTRY_PATH}" ]; then
  PATCHED_SERVER_ENTRY_PATH="${LEGACY_SERVER_ENTRY_PATH}"
fi

if [ ! -f "${PATCHED_SERVER_ENTRY_PATH}" ]; then
  echo "Finaler gepatchter Server-Entry fehlt: ${NITRO_SSR_SERVER_ENTRY_PATH} oder ${LEGACY_SERVER_ENTRY_PATH}" >&2
  exit 1
fi

if [ -d "${SERVER_DIR}/chunks/build" ]; then
  SERVER_CHUNK_PATH="$(find "${SERVER_DIR}/chunks/build" -maxdepth 1 -type f -name 'server*.mjs' | head -n 1)"
fi

if [ -z "${SERVER_CHUNK_PATH}" ] && [ -d "${SERVER_DIR}/_ssr" ]; then
  SERVER_CHUNK_PATH="$(find "${SERVER_DIR}/_ssr" -maxdepth 1 -type f -name 'server*.mjs' | head -n 1)"
fi

if [ -z "${SERVER_CHUNK_PATH}" ]; then
  echo "Finaler SSR-Chunk unter .output/server/chunks/build/server*.mjs oder .output/server/_ssr/server*.mjs fehlt." >&2
  exit 1
fi

if grep -E -q 'jsxDEV|jsx-dev-runtime' \
  "${SERVER_INDEX_PATH}" \
  "${PATCHED_SERVER_ENTRY_PATH}" \
  "${SERVER_CHUNK_PATH}"; then
  echo "Finaler Server-Output enthält React Development-JSX und ist nicht production-tauglich." >&2
  exit 1
fi
