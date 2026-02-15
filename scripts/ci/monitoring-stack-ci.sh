#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILES=("-f" "docker-compose.yml" "-f" "docker-compose.monitoring.yml")
ARTIFACT_DIR="artifacts/monitoring"
PROMETHEUS_URL="http://127.0.0.1:9090"
LOKI_URL="http://127.0.0.1:3100"
GRAFANA_URL="http://127.0.0.1:3001"
PROMTAIL_URL="http://127.0.0.1:3101"
REDIS_TLS_DIR="dev/redis-tls"

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
    if command -v nc >/dev/null 2>&1; then
      if nc -z "${host}" "${port}" >/dev/null 2>&1; then
        echo "[monitoring-ci] ${name} ready (${host}:${port})"
        return 0
      fi
    elif command -v timeout >/dev/null 2>&1; then
      if timeout 1 bash -c "cat </dev/tcp/${host}/${port}" >/dev/null 2>&1; then
        echo "[monitoring-ci] ${name} ready (${host}:${port})"
        return 0
      fi
    else
      if bash -c "cat </dev/tcp/${host}/${port}" >/dev/null 2>&1; then
        echo "[monitoring-ci] ${name} ready (${host}:${port})"
        return 0
      fi
    fi
    sleep "${sleep_seconds}"
  done

  echo "[monitoring-ci] ERROR: ${name} not ready after ${attempts} attempts (${host}:${port})" >&2
  return 1
}

wait_redis() {
  local attempts="${1:-30}"
  local sleep_seconds="${2:-2}"

  for ((i=1; i<=attempts; i+=1)); do
    if docker compose "${COMPOSE_FILES[@]}" exec -T redis sh -lc \
      "redis-cli -p 6379 ping >/dev/null 2>&1 || redis-cli --tls --cacert /etc/redis/certs/ca.pem -p 6380 ping >/dev/null 2>&1"; then
      echo "[monitoring-ci] Redis ready (container check)"
      return 0
    fi
    sleep "${sleep_seconds}"
  done

  echo "[monitoring-ci] ERROR: Redis not ready after ${attempts} attempts (container check)" >&2
  return 1
}

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

wait_redis
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
