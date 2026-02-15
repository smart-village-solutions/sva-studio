#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILES=("-f" "docker-compose.yml" "-f" "docker-compose.monitoring.yml")
ARTIFACT_DIR="artifacts/monitoring"
PROMETHEUS_URL="http://127.0.0.1:9090"
LOKI_URL="http://127.0.0.1:3100"
GRAFANA_URL="http://127.0.0.1:3001"
PROMTAIL_URL="http://127.0.0.1:3101"

mkdir -p "${ARTIFACT_DIR}"

cleanup() {
  docker compose "${COMPOSE_FILES[@]}" down >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_http() {
  local name="$1"
  local url="$2"
  local attempts="${3:-30}"
  local sleep_seconds="${4:-2}"

  for ((i=1; i<=attempts; i+=1)); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      echo "[monitoring-ci] ${name} ready (${url})"
      return 0
    fi
    sleep "${sleep_seconds}"
  done

  echo "[monitoring-ci] ERROR: ${name} not ready after ${attempts} attempts (${url})" >&2
  return 1
}

wait_tcp() {
  local name="$1"
  local host="$2"
  local port="$3"
  local attempts="${4:-30}"
  local sleep_seconds="${5:-2}"

  for ((i=1; i<=attempts; i+=1)); do
    if nc -z "${host}" "${port}" >/dev/null 2>&1; then
      echo "[monitoring-ci] ${name} ready (${host}:${port})"
      return 0
    fi
    sleep "${sleep_seconds}"
  done

  echo "[monitoring-ci] ERROR: ${name} not ready after ${attempts} attempts (${host}:${port})" >&2
  return 1
}

echo "[monitoring-ci] Validate compose files"
docker compose "${COMPOSE_FILES[@]}" config >/dev/null

echo "[monitoring-ci] Start monitoring stack"
docker compose "${COMPOSE_FILES[@]}" up -d redis prometheus loki grafana otel-collector promtail

wait_tcp "Redis" "127.0.0.1" "6379"
wait_http "Prometheus" "${PROMETHEUS_URL}/-/healthy"
wait_http "Loki" "${LOKI_URL}/ready"
wait_http "Grafana" "${GRAFANA_URL}/api/health"
wait_http "Promtail" "${PROMTAIL_URL}/ready"
wait_tcp "OTEL Collector" "127.0.0.1" "13133"

echo "[monitoring-ci] Validate label schema"
LABELS_JSON="${ARTIFACT_DIR}/loki-labels.json"
curl -fsS "${LOKI_URL}/loki/api/v1/labels" > "${LABELS_JSON}"

PROMTAIL_CONFIG="dev/monitoring/promtail/promtail-config.yml"
OTEL_CONFIG_FILE="packages/monitoring-client/src/otel.server.ts"

for required in workspace_id component environment level; do
  if ! rg -q "${required}" "${PROMTAIL_CONFIG}"; then
    echo "[monitoring-ci] ERROR: required label '${required}' missing in ${PROMTAIL_CONFIG}" >&2
    exit 1
  fi

  if ! rg -q "'${required}'" "${OTEL_CONFIG_FILE}"; then
    echo "[monitoring-ci] ERROR: required label '${required}' missing in ${OTEL_CONFIG_FILE}" >&2
    exit 1
  fi
done

for forbidden in user_id session_id email request_id token authorization api_key secret ip; do
  if ! rg -q "${forbidden}" "${PROMTAIL_CONFIG}"; then
    echo "[monitoring-ci] ERROR: forbidden label '${forbidden}' missing in ${PROMTAIL_CONFIG} labeldrop list" >&2
    exit 1
  fi

  if ! rg -q "'${forbidden}'" "${OTEL_CONFIG_FILE}"; then
    echo "[monitoring-ci] ERROR: forbidden label '${forbidden}' missing in ${OTEL_CONFIG_FILE}" >&2
    exit 1
  fi
done

echo "[monitoring-ci] Export performance metrics"
UP_QUERY_FILE="${ARTIFACT_DIR}/prometheus-up.json"
CPU_QUERY_FILE="${ARTIFACT_DIR}/prometheus-cpu-seconds.json"
MEM_QUERY_FILE="${ARTIFACT_DIR}/prometheus-memory-bytes.json"

curl -fsS "${PROMETHEUS_URL}/api/v1/query" --data-urlencode 'query=up' > "${UP_QUERY_FILE}"
curl -fsS "${PROMETHEUS_URL}/api/v1/query" --data-urlencode 'query=process_cpu_seconds_total' > "${CPU_QUERY_FILE}"
curl -fsS "${PROMETHEUS_URL}/api/v1/query" --data-urlencode 'query=process_resident_memory_bytes' > "${MEM_QUERY_FILE}"

echo "[monitoring-ci] Monitoring CI checks passed"
