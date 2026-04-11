#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "usage: verify-studio-image.sh <image-ref> [artifact-dir]" >&2
  exit 1
fi

IMAGE_REF="$1"
ARTIFACT_DIR="${2:-artifacts/runtime/image-verify}"
VERIFY_ID="studio-image-verify-$(date +%s)"
NETWORK_NAME="${VERIFY_ID}-net"
POSTGRES_NAME="${VERIFY_ID}-postgres"
REDIS_NAME="${VERIFY_ID}-redis"
APP_NAME="${VERIFY_ID}-app"
APP_PORT="${SVA_IMAGE_VERIFY_PORT:-39080}"
APP_INTERNAL_BASE_URL="http://127.0.0.1:3000"
VERIFY_ATTEMPTS="${SVA_IMAGE_VERIFY_ATTEMPTS:-12}"
VERIFY_SLEEP_SECONDS="${SVA_IMAGE_VERIFY_SLEEP_SECONDS:-1}"
VERIFY_CURL_TIMEOUT_SECONDS="${SVA_IMAGE_VERIFY_CURL_TIMEOUT_SECONDS:-3}"
POSTGRES_PASSWORD="verify-postgres-password"
APP_DB_PASSWORD="verify-app-password"
REDIS_PASSWORD="verify-redis-password"
PII_KEYRING_JSON='{"k1":"MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="}'

mkdir -p "${ARTIFACT_DIR}"
REPORT_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.json"
LOG_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.log"
SUMMARY_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.md"
ENV_FILE="${ARTIFACT_DIR}/${VERIFY_ID}.env"
PHASE_LOG_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.phases.log"

POSTGRES_PHASE_STATUS="pending"
POSTGRES_ROLE_PHASE_STATUS="pending"
REDIS_PHASE_STATUS="pending"
IMAGE_PULL_PHASE_STATUS="pending"
APP_START_PHASE_STATUS="pending"
HEALTH_LIVE_PHASE_STATUS="pending"
HEALTH_READY_PHASE_STATUS="pending"
ROOT_PHASE_STATUS="pending"
FAILED_PHASE=""

cleanup() {
  docker rm -f "${APP_NAME}" "${REDIS_NAME}" "${POSTGRES_NAME}" >/dev/null 2>&1 || true
  docker network rm "${NETWORK_NAME}" >/dev/null 2>&1 || true
  rm -f "${ENV_FILE}"
}
trap cleanup EXIT

fail_with_container_diagnostics() {
  local message="$1"
  shift

  echo "${message}" >&2
  for container in "$@"; do
    docker logs "${container}" > "${ARTIFACT_DIR}/${container}.log" 2>&1 || true
    docker inspect "${container}" > "${ARTIFACT_DIR}/${container}.inspect.json" 2>/dev/null || true
  done
  exit 1
}

mark_phase() {
  local phase="$1"
  local status="$2"
  local detail="${3:-}"

  printf '%s\t%s\t%s\n' "${phase}" "${status}" "${detail}" >> "${PHASE_LOG_PATH}"
}

begin_phase() {
  local phase="$1"
  echo "::group::${phase}"
  mark_phase "${phase}" "started"
}

end_phase() {
  local phase="$1"
  local status="$2"
  local detail="${3:-}"

  mark_phase "${phase}" "${status}" "${detail}"
  echo "::endgroup::"
}

set_phase_status_var() {
  local phase_var="$1"
  local status="$2"

  printf -v "${phase_var}" '%s' "${status}"
}

register_failure() {
  local phase="$1"
  local status_var="$2"
  local detail="$3"

  set_phase_status_var "${status_var}" "error"
  if [ -z "${FAILED_PHASE}" ]; then
    FAILED_PHASE="${phase}"
  fi
  end_phase "${phase}" "error" "${detail}"
}

cat >"${ENV_FILE}" <<EOF
HOST=0.0.0.0
PORT=3000
NODE_ENV=production
SVA_RUNTIME_PROFILE=studio
SVA_PARENT_DOMAIN=studio.example.invalid
SVA_ALLOWED_INSTANCE_IDS=example-instance
SVA_PUBLIC_BASE_URL=${APP_INTERNAL_BASE_URL}
SVA_PUBLIC_HOST=127.0.0.1:3000
SVA_AUTH_ISSUER=https://keycloak.example.invalid/realms/sva-studio
SVA_AUTH_CLIENT_ID=sva-studio
SVA_AUTH_CLIENT_SECRET=verify-auth-client-secret
SVA_AUTH_STATE_SECRET=verify-auth-state-secret
SVA_AUTH_REDIRECT_URI=${APP_INTERNAL_BASE_URL}/auth/callback
SVA_AUTH_POST_LOGOUT_REDIRECT_URI=${APP_INTERNAL_BASE_URL}/
IAM_CSRF_ALLOWED_ORIGINS=${APP_INTERNAL_BASE_URL}
KEYCLOAK_ADMIN_BASE_URL=https://keycloak.example.invalid
KEYCLOAK_ADMIN_REALM=sva-studio
KEYCLOAK_ADMIN_CLIENT_ID=sva-studio-iam-service
KEYCLOAK_ADMIN_CLIENT_SECRET=verify-keycloak-admin-secret
IAM_PII_ACTIVE_KEY_ID=k1
IAM_PII_KEYRING_JSON=${PII_KEYRING_JSON}
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
SVA_MAINSERVER_GRAPHQL_URL=https://mainserver.example.invalid/graphql
SVA_MAINSERVER_OAUTH_TOKEN_URL=https://mainserver.example.invalid/oauth/token
SVA_MAINSERVER_CLIENT_ID=studio-mainserver
SVA_MAINSERVER_CLIENT_SECRET=verify-mainserver-secret
SVA_MAINSERVER_REQUIRED=false
SVA_MIGRATION_STATUS_REQUIRED=false
POSTGRES_DB=sva_studio
POSTGRES_USER=sva
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
APP_DB_USER=sva_app
APP_DB_PASSWORD=${APP_DB_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
IAM_DATABASE_URL=postgres://sva_app:${APP_DB_PASSWORD}@${POSTGRES_NAME}:5432/sva_studio
REDIS_URL=redis://:${REDIS_PASSWORD}@${REDIS_NAME}:6379
SVA_STACK_NAME=studio
QUANTUM_ENDPOINT=sva
ENABLE_OTEL=false
SVA_ENABLE_SERVER_CONSOLE_LOGS=true
SVA_TRUST_FORWARDED_HEADERS=true
IAM_UI_ENABLED=true
IAM_ADMIN_ENABLED=true
IAM_BULK_ENABLED=true
VITE_IAM_UI_ENABLED=true
VITE_IAM_ADMIN_ENABLED=true
VITE_IAM_BULK_ENABLED=true
EOF

begin_phase "postgres-ready"
docker network create "${NETWORK_NAME}" >/dev/null

docker run -d \
  --name "${POSTGRES_NAME}" \
  --network "${NETWORK_NAME}" \
  -e POSTGRES_DB=sva_studio \
  -e POSTGRES_USER=sva \
  -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  postgres:16-alpine >/dev/null

for _ in $(seq 1 30); do
  if docker exec "${POSTGRES_NAME}" sh -lc "pg_isready -U sva -d postgres >/dev/null 2>&1 && psql -U sva -d postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = 'sva_studio'\" | grep -q 1"; then
    postgres_ready="true"
    break
  fi
  sleep 2
done

if [ "${postgres_ready:-false}" != "true" ]; then
  register_failure "postgres-ready" "POSTGRES_PHASE_STATUS" "Postgres wurde nicht bereit."
  fail_with_container_diagnostics "Postgres wurde im Artifact-Verify nicht bereit." "${POSTGRES_NAME}"
fi
set_phase_status_var "POSTGRES_PHASE_STATUS" "ok"
end_phase "postgres-ready" "ok" "Postgres antwortet und die Datenbank sva_studio existiert."

begin_phase "postgres-app-role"
docker exec -i "${POSTGRES_NAME}" psql -v ON_ERROR_STOP=1 -U sva -d sva_studio <<EOF >/dev/null
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sva_app') THEN
    CREATE ROLE sva_app LOGIN PASSWORD '${APP_DB_PASSWORD}';
  ELSE
    ALTER ROLE sva_app WITH LOGIN PASSWORD '${APP_DB_PASSWORD}';
  END IF;
END
\$\$;
GRANT CONNECT ON DATABASE sva_studio TO sva_app;
GRANT USAGE, CREATE ON SCHEMA public TO sva_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sva_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sva_app;
EOF
set_phase_status_var "POSTGRES_ROLE_PHASE_STATUS" "ok"
end_phase "postgres-app-role" "ok" "Runtime-DB-User sva_app ist vorbereitet."

begin_phase "redis-ready"
docker run -d \
  --name "${REDIS_NAME}" \
  --network "${NETWORK_NAME}" \
  redis:7-alpine redis-server --save "" --appendonly no --requirepass "${REDIS_PASSWORD}" >/dev/null

for _ in $(seq 1 30); do
  if docker exec "${REDIS_NAME}" redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" ping | grep -q PONG; then
    redis_ready="true"
    break
  fi
  sleep 2
done

if [ "${redis_ready:-false}" != "true" ]; then
  register_failure "redis-ready" "REDIS_PHASE_STATUS" "Redis wurde nicht bereit."
  fail_with_container_diagnostics "Redis wurde im Artifact-Verify nicht bereit." "${REDIS_NAME}"
fi
set_phase_status_var "REDIS_PHASE_STATUS" "ok"
end_phase "redis-ready" "ok" "Redis antwortet auf PING."

begin_phase "image-pull"
docker pull "${IMAGE_REF}" >/dev/null
set_phase_status_var "IMAGE_PULL_PHASE_STATUS" "ok"
end_phase "image-pull" "ok" "Image wurde erfolgreich gezogen."

begin_phase "app-start"
docker run -d \
  --name "${APP_NAME}" \
  --network "${NETWORK_NAME}" \
  --env-file "${ENV_FILE}" \
  -p "127.0.0.1:${APP_PORT}:3000" \
  "${IMAGE_REF}" >/dev/null
sleep 2

if ! docker inspect -f '{{.State.Running}}' "${APP_NAME}" 2>/dev/null | grep -q true; then
  register_failure "app-start" "APP_START_PHASE_STATUS" "App-Prozess läuft nicht."
  fail_with_container_diagnostics "Die App ist direkt nach dem Start nicht mehr gelaufen." "${APP_NAME}"
fi
set_phase_status_var "APP_START_PHASE_STATUS" "ok"
end_phase "app-start" "ok" "App-Container läuft."

wait_for_endpoint() {
  local path="$1"
  local expected="$2"
  local label="$3"
  local output_file="${ARTIFACT_DIR}/${label}.body.txt"
  local headers_file="${ARTIFACT_DIR}/${label}.headers.txt"
  local trace_file="${ARTIFACT_DIR}/${label}.trace.log"
  local stderr_file="${ARTIFACT_DIR}/${label}.stderr.log"

  for _ in $(seq 1 "${VERIFY_ATTEMPTS}"); do
    if ! docker inspect -f '{{.State.Running}}' "${APP_NAME}" 2>/dev/null | grep -q true; then
      break
    fi

    local status
    status="$(
      docker exec "${APP_NAME}" sh -lc \
        "curl --silent --show-error --max-time ${VERIFY_CURL_TIMEOUT_SECONDS} --dump-header /tmp/verify-headers --output /tmp/verify-response --write-out '%{http_code}' 'http://127.0.0.1:3000${path}' 2>/tmp/verify-stderr" \
        2>/dev/null || true
    )"
    docker exec "${APP_NAME}" cat /tmp/verify-response > "${output_file}" 2>/dev/null || true
    docker exec "${APP_NAME}" cat /tmp/verify-headers > "${headers_file}" 2>/dev/null || true
    docker exec "${APP_NAME}" cat /tmp/verify-stderr > "${stderr_file}" 2>/dev/null || true
    if [ "${status}" = "${expected}" ]; then
      printf '%s\t%s\n' "${path}" "${status}" >> "${LOG_PATH}"
      printf 'attempt-status=%s\n' "${status}" >> "${trace_file}"
      return 0
    fi

    printf '%s\t%s\n' "${path}" "${status}" >> "${LOG_PATH}"
    printf 'attempt-status=%s\n' "${status}" >> "${trace_file}"
    sleep "${VERIFY_SLEEP_SECONDS}"
  done

  return 1
}

VERIFY_STATUS="ok"
begin_phase "health-live"
if ! wait_for_endpoint "/health/live" "200" "health-live"; then
  VERIFY_STATUS="error"
  register_failure "health-live" "HEALTH_LIVE_PHASE_STATUS" "/health/live liefert nicht 200."
else
  set_phase_status_var "HEALTH_LIVE_PHASE_STATUS" "ok"
  end_phase "health-live" "ok" "/health/live liefert 200."
fi
if [ "${VERIFY_STATUS}" = "ok" ]; then
  begin_phase "health-ready"
fi
if [ "${VERIFY_STATUS}" = "ok" ] && ! wait_for_endpoint "/health/ready" "200" "health-ready"; then
  VERIFY_STATUS="error"
  register_failure "health-ready" "HEALTH_READY_PHASE_STATUS" "/health/ready liefert nicht 200."
elif [ "${VERIFY_STATUS}" = "ok" ]; then
  set_phase_status_var "HEALTH_READY_PHASE_STATUS" "ok"
  end_phase "health-ready" "ok" "/health/ready liefert 200."
fi
if [ "${VERIFY_STATUS}" = "ok" ]; then
  begin_phase "root-page"
fi
if [ "${VERIFY_STATUS}" = "ok" ] && ! wait_for_endpoint "/" "200" "root-page"; then
  VERIFY_STATUS="error"
  register_failure "root-page" "ROOT_PHASE_STATUS" "/ liefert nicht 200."
elif [ "${VERIFY_STATUS}" = "ok" ]; then
  set_phase_status_var "ROOT_PHASE_STATUS" "ok"
  end_phase "root-page" "ok" "/ liefert 200."
fi

docker logs "${APP_NAME}" > "${LOG_PATH}.container" 2>&1 || true
docker inspect "${APP_NAME}" > "${LOG_PATH}.inspect.json" 2>/dev/null || true

cat >"${REPORT_PATH}" <<EOF
{
  "imageRef": "${IMAGE_REF}",
  "status": "${VERIFY_STATUS}",
  "failedPhase": "${FAILED_PHASE}",
  "reportId": "${VERIFY_ID}",
  "port": ${APP_PORT},
  "phases": {
    "postgresReady": "${POSTGRES_PHASE_STATUS}",
    "postgresAppRole": "${POSTGRES_ROLE_PHASE_STATUS}",
    "redisReady": "${REDIS_PHASE_STATUS}",
    "imagePull": "${IMAGE_PULL_PHASE_STATUS}",
    "appStart": "${APP_START_PHASE_STATUS}",
    "healthLive": "${HEALTH_LIVE_PHASE_STATUS}",
    "healthReady": "${HEALTH_READY_PHASE_STATUS}",
    "rootPage": "${ROOT_PHASE_STATUS}"
  },
  "artifacts": {
    "log": "$(basename "${LOG_PATH}")",
    "phaseLog": "$(basename "${PHASE_LOG_PATH}")",
    "containerLog": "$(basename "${LOG_PATH}.container")",
    "inspect": "$(basename "${LOG_PATH}.inspect.json")"
  }
}
EOF

cat >"${SUMMARY_PATH}" <<EOF
# Studio Artifact Verify

- Image-Ref: \`${IMAGE_REF}\`
- Status: \`${VERIFY_STATUS}\`
- Fehlphase: \`${FAILED_PHASE:-keine}\`
- Port: \`${APP_PORT}\`
- Report: \`$(basename "${REPORT_PATH}")\`
- Phasenlog: \`$(basename "${PHASE_LOG_PATH}")\`

## Phasen

- \`postgres-ready\`: \`${POSTGRES_PHASE_STATUS}\`
- \`postgres-app-role\`: \`${POSTGRES_ROLE_PHASE_STATUS}\`
- \`redis-ready\`: \`${REDIS_PHASE_STATUS}\`
- \`image-pull\`: \`${IMAGE_PULL_PHASE_STATUS}\`
- \`app-start\`: \`${APP_START_PHASE_STATUS}\`
- \`health-live\`: \`${HEALTH_LIVE_PHASE_STATUS}\`
- \`health-ready\`: \`${HEALTH_READY_PHASE_STATUS}\`
- \`root-page\`: \`${ROOT_PHASE_STATUS}\`
EOF

if [ "${VERIFY_STATUS}" != "ok" ]; then
  echo "Studio artifact verify failed for ${IMAGE_REF}" >&2
  exit 1
fi
