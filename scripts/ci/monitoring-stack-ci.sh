#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.monitoring.yml"
ARTIFACT_DIR="${ROOT_DIR}/artifacts/monitoring"

SERVICES=(
  prometheus
  loki
  grafana
  otel-collector
  promtail
)

cleanup() {
  docker compose -f "${COMPOSE_FILE}" down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[monitoring-ci] Missing required command: $1" >&2
    exit 1
  fi
}

wait_for_http() {
  local name="$1"
  local url="$2"
  local deadline=$((SECONDS + 120))

  while (( SECONDS < deadline )); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      echo "[monitoring-ci] ${name} ready: ${url}"
      return 0
    fi
    sleep 2
  done

  echo "[monitoring-ci] ${name} did not become ready in time: ${url}" >&2
  return 1
}

wait_for_metric() {
  local query="$1"
  local deadline=$((SECONDS + 120))
  local response

  while (( SECONDS < deadline )); do
    response="$(curl -fsS --get --data-urlencode "query=${query}" "http://localhost:9090/api/v1/query")"
    if echo "${response}" | grep -Eq '"result":\[[^]]'; then
      echo "${response}"
      return 0
    fi
    sleep 2
  done

  echo "[monitoring-ci] metric query timed out: ${query}" >&2
  return 1
}

validate_label_schema() {
  local config_file="${ROOT_DIR}/dev/monitoring/promtail/promtail-config.yml"

  local allowed_labels=("component" "environment" "workspace_id" "level")
  local forbidden_labels=("user_id" "session_id" "email" "token" "api_key" "password")

  for label in "${allowed_labels[@]}"; do
    grep -Eq "^[[:space:]]*-[[:space:]]*${label}$" "${config_file}" || {
      echo "[monitoring-ci] missing allowed label in promtail config: ${label}" >&2
      return 1
    }
  done

  for label in "${forbidden_labels[@]}"; do
    grep -Eq "^[[:space:]]*-[[:space:]]*${label}$" "${config_file}" || {
      echo "[monitoring-ci] missing forbidden labeldrop in promtail config: ${label}" >&2
      return 1
    }
  done

  echo "[monitoring-ci] label schema validation passed"
}

main() {
  require_command docker
  require_command curl
  require_command grep
  require_command pnpm

  mkdir -p "${ARTIFACT_DIR}"

  echo "[monitoring-ci] starting monitoring stack"
  docker compose -f "${COMPOSE_FILE}" up -d --wait --wait-timeout 120

  wait_for_http "prometheus" "http://localhost:9090/-/healthy"
  wait_for_http "loki" "http://localhost:3100/ready"
  wait_for_http "grafana" "http://localhost:3001/api/health"

  validate_label_schema

  echo "[monitoring-ci] running OTEL metrics smoke"
  (
    cd "${ROOT_DIR}"
    pnpm --filter @sva/monitoring-client exec node scripts/otel-metrics-smoke.mjs
  )

  local metric_response
  metric_response="$(wait_for_metric "sva_business_events_total")"
  echo "${metric_response}" > "${ARTIFACT_DIR}/prometheus-metric-query.json"

  curl -fsS "http://localhost:9090/api/v1/targets" > "${ARTIFACT_DIR}/prometheus-targets.json"
  curl -fsS "http://localhost:3100/loki/api/v1/labels" > "${ARTIFACT_DIR}/loki-labels.json"

  echo "[monitoring-ci] metrics exported to ${ARTIFACT_DIR}"
}

main "$@"
