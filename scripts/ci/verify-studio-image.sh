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
POSTGRES_PASSWORD="verify-postgres-password"
APP_DB_PASSWORD="verify-app-password"
REDIS_PASSWORD="verify-redis-password"
PII_KEYRING_JSON='{"k1":"MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="}'

mkdir -p "${ARTIFACT_DIR}"
REPORT_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.json"
LOG_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.log"
SUMMARY_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.md"
ENV_FILE="${ARTIFACT_DIR}/${VERIFY_ID}.env"

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

cat >"${ENV_FILE}" <<EOF
HOST=0.0.0.0
PORT=3000
NODE_ENV=production
SVA_RUNTIME_PROFILE=studio
SVA_PARENT_DOMAIN=studio.example.invalid
SVA_ALLOWED_INSTANCE_IDS=example-instance
SVA_PUBLIC_BASE_URL=http://127.0.0.1:${APP_PORT}
SVA_PUBLIC_HOST=127.0.0.1:${APP_PORT}
SVA_AUTH_ISSUER=https://keycloak.example.invalid/realms/sva-studio
SVA_AUTH_CLIENT_ID=sva-studio
SVA_AUTH_CLIENT_SECRET=verify-auth-client-secret
SVA_AUTH_STATE_SECRET=verify-auth-state-secret
SVA_AUTH_REDIRECT_URI=http://127.0.0.1:${APP_PORT}/auth/callback
SVA_AUTH_POST_LOGOUT_REDIRECT_URI=http://127.0.0.1:${APP_PORT}/
IAM_CSRF_ALLOWED_ORIGINS=http://127.0.0.1:${APP_PORT}
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

docker network create "${NETWORK_NAME}" >/dev/null

docker run -d \
  --name "${POSTGRES_NAME}" \
  --network "${NETWORK_NAME}" \
  -e POSTGRES_DB=sva_studio \
  -e POSTGRES_USER=sva \
  -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  postgres:16-alpine >/dev/null

for _ in $(seq 1 30); do
  if docker exec "${POSTGRES_NAME}" pg_isready -U sva -d sva_studio >/dev/null 2>&1; then
    postgres_ready="true"
    break
  fi
  sleep 2
done

if [ "${postgres_ready:-false}" != "true" ]; then
  fail_with_container_diagnostics "Postgres wurde im Artifact-Verify nicht bereit." "${POSTGRES_NAME}"
fi

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
  fail_with_container_diagnostics "Redis wurde im Artifact-Verify nicht bereit." "${REDIS_NAME}"
fi

docker pull "${IMAGE_REF}" >/dev/null

docker run -d \
  --name "${APP_NAME}" \
  --network "${NETWORK_NAME}" \
  --env-file "${ENV_FILE}" \
  -p "127.0.0.1:${APP_PORT}:3000" \
  "${IMAGE_REF}" >/dev/null

wait_for_endpoint() {
  local path="$1"
  local expected="$2"
  local output_file="${ARTIFACT_DIR}/$(echo "${path}" | tr '/:' '__').txt"

  for _ in $(seq 1 30); do
    if ! docker inspect -f '{{.State.Running}}' "${APP_NAME}" 2>/dev/null | grep -q true; then
      break
    fi

    local status
    status="$(curl --silent --show-error --max-time 5 --output "${output_file}" --write-out '%{http_code}' "http://127.0.0.1:${APP_PORT}${path}" || true)"
    if [ "${status}" = "${expected}" ]; then
      printf '%s\t%s\n' "${path}" "${status}" >> "${LOG_PATH}"
      return 0
    fi

    printf '%s\t%s\n' "${path}" "${status}" >> "${LOG_PATH}"
    sleep 2
  done

  return 1
}

VERIFY_STATUS="ok"
if ! wait_for_endpoint "/health/live" "200"; then
  VERIFY_STATUS="error"
fi
if [ "${VERIFY_STATUS}" = "ok" ] && ! wait_for_endpoint "/health/ready" "200"; then
  VERIFY_STATUS="error"
fi
if [ "${VERIFY_STATUS}" = "ok" ] && ! wait_for_endpoint "/" "200"; then
  VERIFY_STATUS="error"
fi

docker logs "${APP_NAME}" > "${LOG_PATH}.container" 2>&1 || true
docker inspect "${APP_NAME}" > "${LOG_PATH}.inspect.json" 2>/dev/null || true

cat >"${REPORT_PATH}" <<EOF
{
  "imageRef": "${IMAGE_REF}",
  "status": "${VERIFY_STATUS}",
  "reportId": "${VERIFY_ID}",
  "port": ${APP_PORT},
  "artifacts": {
    "log": "$(basename "${LOG_PATH}")",
    "containerLog": "$(basename "${LOG_PATH}.container")",
    "inspect": "$(basename "${LOG_PATH}.inspect.json")"
  }
}
EOF

cat >"${SUMMARY_PATH}" <<EOF
# Studio Artifact Verify

- Image-Ref: \`${IMAGE_REF}\`
- Status: \`${VERIFY_STATUS}\`
- Port: \`${APP_PORT}\`
- Report: \`$(basename "${REPORT_PATH}")\`
EOF

if [ "${VERIFY_STATUS}" != "ok" ]; then
  echo "Studio artifact verify failed for ${IMAGE_REF}" >&2
  exit 1
fi
