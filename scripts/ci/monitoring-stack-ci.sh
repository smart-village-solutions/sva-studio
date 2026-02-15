#!/usr/bin/env bash

set -euo pipefail

<<<<<<< HEAD
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.monitoring.yml"
ARTIFACT_DIR="${ROOT_DIR}/artifacts/monitoring"
=======
COMPOSE_FILES=("-f" "docker-compose.yml" "-f" "docker-compose.monitoring.yml")
ARTIFACT_DIR="artifacts/monitoring"
PROMETHEUS_URL="http://127.0.0.1:9090"
LOKI_URL="http://127.0.0.1:3100"
GRAFANA_URL="http://127.0.0.1:3001"
PROMTAIL_URL="http://127.0.0.1:3101"
REDIS_TLS_DIR="dev/redis-tls"
>>>>>>> 070b835 (fix(ci): stabilize monitoring and coverage checks)

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

<<<<<<< HEAD
validate_label_schema() {
  local config_file="${ROOT_DIR}/dev/monitoring/promtail/promtail-config.yml"

  local allowed_labels=("component" "environment" "workspace_id" "level")
  local forbidden_labels=("user_id" "session_id" "email" "token" "api_key" "password")
=======
ensure_redis_tls_material() {
  mkdir -p "${REDIS_TLS_DIR}"

  local ca_key="${REDIS_TLS_DIR}/ca-key.pem"
  local ca_cert="${REDIS_TLS_DIR}/ca.pem"
  local redis_key="${REDIS_TLS_DIR}/redis-key.pem"
  local redis_csr="${REDIS_TLS_DIR}/redis.csr"
  local redis_cert="${REDIS_TLS_DIR}/redis.pem"
  local redis_ext="${REDIS_TLS_DIR}/redis.ext"

  if [[ -f "${ca_cert}" && -f "${redis_key}" && -f "${redis_cert}" ]]; then
    return 0
  fi

  if ! command -v openssl >/dev/null 2>&1; then
    echo "[monitoring-ci] ERROR: openssl is required to generate Redis TLS material" >&2
    return 1
  fi

  echo "[monitoring-ci] Generate Redis TLS material for CI"
  openssl genrsa -out "${ca_key}" 2048 >/dev/null 2>&1
  openssl req -new -x509 -days 3650 -key "${ca_key}" -subj "/CN=sva-redis-ca" -out "${ca_cert}" >/dev/null 2>&1
  openssl genrsa -out "${redis_key}" 2048 >/dev/null 2>&1
  openssl req -new -key "${redis_key}" -subj "/CN=localhost" -out "${redis_csr}" >/dev/null 2>&1
  cat > "${redis_ext}" <<EOF
subjectAltName=DNS:localhost,IP:127.0.0.1
extendedKeyUsage=serverAuth
EOF
  openssl x509 -req -days 3650 -in "${redis_csr}" -CA "${ca_cert}" -CAkey "${ca_key}" -CAcreateserial -extfile "${redis_ext}" -out "${redis_cert}" >/dev/null 2>&1
}

echo "[monitoring-ci] Validate compose files"
docker compose "${COMPOSE_FILES[@]}" config >/dev/null

ensure_redis_tls_material

echo "[monitoring-ci] Start monitoring stack"
docker compose "${COMPOSE_FILES[@]}" up -d redis prometheus loki grafana otel-collector promtail
>>>>>>> 070b835 (fix(ci): stabilize monitoring and coverage checks)

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
