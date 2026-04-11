#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "usage: verify-studio-image.sh <image-ref> [artifact-dir]" >&2
  exit 1
fi

IMAGE_REF="$1"
ARTIFACT_DIR_INPUT="${2:-artifacts/runtime/image-verify}"
VERIFY_ID="studio-image-verify-$(date +%s)"
NETWORK_NAME="${VERIFY_ID}-net"
POSTGRES_NAME="${VERIFY_ID}-postgres"
REDIS_NAME="${VERIFY_ID}-redis"
KEYCLOAK_NAME="${VERIFY_ID}-keycloak"
APP_NAME="${VERIFY_ID}-app"
APP_PORT="${SVA_IMAGE_VERIFY_PORT:-39080}"
POSTGRES_PORT="${SVA_IMAGE_VERIFY_POSTGRES_PORT:-35433}"
POSTGRES_PASSWORD="verify-postgres-password"
APP_DB_PASSWORD="verify-app-password"
REDIS_PASSWORD="verify-redis-password"
PII_KEYRING_JSON='{"k1":"MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="}'

mkdir -p "${ARTIFACT_DIR_INPUT}"
ARTIFACT_DIR="$(cd "${ARTIFACT_DIR_INPUT}" && pwd)"
REPORT_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.json"
SUMMARY_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.md"
PHASES_LOG_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.phases.log"
ENV_FILE="${ARTIFACT_DIR}/${VERIFY_ID}.env"

FAILURE_CLASS="none"
FAILED_PHASE=""
VERIFY_STATUS="ok"

POSTGRES_READY_STATUS="pending"
POSTGRES_APP_ROLE_STATUS="pending"
SCHEMA_MIGRATIONS_STATUS="pending"
REDIS_READY_STATUS="pending"
KEYCLOAK_READY_STATUS="pending"
IMAGE_PULL_STATUS="pending"
APP_START_STATUS="pending"
HEALTH_LIVE_STATUS="pending"
HEALTH_READY_STATUS="pending"
ROOT_PAGE_STATUS="pending"

cleanup() {
  docker rm -f "${APP_NAME}" "${KEYCLOAK_NAME}" "${REDIS_NAME}" "${POSTGRES_NAME}" >/dev/null 2>&1 || true
  docker network rm "${NETWORK_NAME}" >/dev/null 2>&1 || true
  rm -f "${ENV_FILE}"
}
trap cleanup EXIT

mark_phase() {
  local phase="$1"
  local status="$2"
  printf '%s\t%s\n' "${phase}" "${status}" >> "${PHASES_LOG_PATH}"
}

set_phase_var() {
  local variable_name="$1"
  local status="$2"
  printf -v "${variable_name}" '%s' "${status}"
}

fail_verify() {
  local failure_class="$1"
  local failed_phase="$2"
  local message="$3"

  FAILURE_CLASS="${failure_class}"
  FAILED_PHASE="${failed_phase}"
  VERIFY_STATUS="error"
  printf '%s\t%s\t%s\n' "${failed_phase}" "${failure_class}" "${message}" >> "${PHASES_LOG_PATH}"
  echo "${message}" >&2
}

wait_for_postgres() {
  for _ in $(seq 1 20); do
    if \
      docker exec "${POSTGRES_NAME}" pg_isready -U sva -d postgres >/dev/null 2>&1 && \
      docker exec "${POSTGRES_NAME}" psql -U sva -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'sva_studio'" | grep -q 1
    then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_redis() {
  for _ in $(seq 1 20); do
    if docker exec "${REDIS_NAME}" redis-cli --no-auth-warning -a "${REDIS_PASSWORD}" ping | grep -q PONG; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_container_http() {
  local container_name="$1"
  local url="$2"

  for _ in $(seq 1 12); do
    if docker exec "${container_name}" sh -lc "wget -q -O /dev/null '${url}'" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  return 1
}

probe_endpoint() {
  local phase="$1"
  local path="$2"
  local expected_status="$3"
  local body_path="${ARTIFACT_DIR}/${VERIFY_ID}${phase}.body.txt"
  local headers_path="${ARTIFACT_DIR}/${VERIFY_ID}${phase}.headers.txt"
  local stderr_path="${ARTIFACT_DIR}/${VERIFY_ID}${phase}.stderr.txt"

  for _ in $(seq 1 12); do
    if ! docker inspect -f '{{.State.Running}}' "${APP_NAME}" 2>/dev/null | grep -q true; then
      return 2
    fi

    local status_code
    status_code="$(
      curl \
        --silent \
        --show-error \
        --max-time 2 \
        --dump-header "${headers_path}" \
        --output "${body_path}" \
        --write-out '%{http_code}' \
        "http://127.0.0.1:${APP_PORT}${path}" \
        2>"${stderr_path}" || true
    )"

    if [ "${status_code}" = "${expected_status}" ]; then
      return 0
    fi

    printf '%s\t%s\t%s\n' "${phase}" "${path}" "${status_code}" >> "${PHASES_LOG_PATH}"
    sleep 1
  done

  return 1
}

docker network create "${NETWORK_NAME}" >/dev/null

docker run -d \
  --name "${POSTGRES_NAME}" \
  --network "${NETWORK_NAME}" \
  -p "127.0.0.1:${POSTGRES_PORT}:5432" \
  -e POSTGRES_DB=sva_studio \
  -e POSTGRES_USER=sva \
  -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  postgres:16-alpine >/dev/null

if wait_for_postgres; then
  set_phase_var POSTGRES_READY_STATUS ok
  mark_phase postgres-ready ok
else
  set_phase_var POSTGRES_READY_STATUS error
  mark_phase postgres-ready error
  docker logs "${POSTGRES_NAME}" > "${ARTIFACT_DIR}/${POSTGRES_NAME}.log" 2>&1 || true
  fail_verify dependency-failed postgres-ready "Postgres wurde im Image-Verify nicht bereit."
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
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
  set_phase_var POSTGRES_APP_ROLE_STATUS ok
  mark_phase postgres-app-role ok
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  if env \
    POSTGRES_HOST=127.0.0.1 \
    POSTGRES_PORT="${POSTGRES_PORT}" \
    POSTGRES_USER=sva \
    POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
    POSTGRES_DB=sva_studio \
    SVA_LOCAL_POSTGRES_CONTAINER_NAME="${POSTGRES_NAME}" \
    bash packages/data/scripts/run-migrations.sh up >/dev/null
  then
    set_phase_var SCHEMA_MIGRATIONS_STATUS ok
    mark_phase schema-migrations ok
  else
    set_phase_var SCHEMA_MIGRATIONS_STATUS error
    mark_phase schema-migrations error
    fail_verify dependency-failed schema-migrations "Die temporaeren IAM-Migrationen fuer das Image-Verify sind fehlgeschlagen."
  fi
fi

docker run -d \
  --name "${REDIS_NAME}" \
  --network "${NETWORK_NAME}" \
  redis:7-alpine redis-server --save "" --appendonly no --requirepass "${REDIS_PASSWORD}" >/dev/null

if [ "${VERIFY_STATUS}" = "ok" ]; then
  if wait_for_redis; then
    set_phase_var REDIS_READY_STATUS ok
    mark_phase redis-ready ok
  else
    set_phase_var REDIS_READY_STATUS error
    mark_phase redis-ready error
    docker logs "${REDIS_NAME}" > "${ARTIFACT_DIR}/${REDIS_NAME}.log" 2>&1 || true
    fail_verify dependency-failed redis-ready "Redis wurde im Image-Verify nicht bereit."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  docker run -d \
    --name "${KEYCLOAK_NAME}" \
    --network "${NETWORK_NAME}" \
    node:22-alpine sh -lc '
      cat <<'"'"'\'"'"''"'"'NODE'"'"'\'"'"''"'"' > /tmp/keycloak-mock.js
const http = require("node:http");
const port = 38080;
const realm = "sva-studio";
const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  if (req.method === "POST" && url.pathname === `/realms/${realm}/protocol/openid-connect/token`) {
    return json(res, 200, { access_token: "verify-token", token_type: "Bearer", expires_in: 300 });
  }
  if (req.method === "GET" && url.pathname === `/admin/realms/${realm}/roles`) {
    return json(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === `/realms/${realm}/.well-known/openid-configuration`) {
    return json(res, 200, {
      issuer: `http://keycloak-mock:${port}/realms/${realm}`,
      token_endpoint: `http://keycloak-mock:${port}/realms/${realm}/protocol/openid-connect/token`,
      authorization_endpoint: `http://keycloak-mock:${port}/realms/${realm}/protocol/openid-connect/auth`,
      end_session_endpoint: `http://keycloak-mock:${port}/realms/${realm}/protocol/openid-connect/logout`,
      jwks_uri: `http://keycloak-mock:${port}/realms/${realm}/protocol/openid-connect/certs`
    });
  }
  return json(res, 404, { error: "not_found" });
});
server.listen(port, "0.0.0.0");
NODE
      node /tmp/keycloak-mock.js
    ' >/dev/null

  if wait_for_container_http "${KEYCLOAK_NAME}" "http://127.0.0.1:38080/realms/sva-studio/.well-known/openid-configuration"; then
    set_phase_var KEYCLOAK_READY_STATUS ok
    mark_phase keycloak-ready ok
  else
    set_phase_var KEYCLOAK_READY_STATUS error
    mark_phase keycloak-ready error
    docker logs "${KEYCLOAK_NAME}" > "${ARTIFACT_DIR}/${KEYCLOAK_NAME}.log" 2>&1 || true
    fail_verify dependency-failed keycloak-ready "Der Keycloak-Admin-Mock wurde im Image-Verify nicht bereit."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  if docker pull "${IMAGE_REF}" >/dev/null; then
    set_phase_var IMAGE_PULL_STATUS ok
    mark_phase image-pull ok
  else
    set_phase_var IMAGE_PULL_STATUS error
    mark_phase image-pull error
    fail_verify dependency-failed image-pull "Das Studio-Image konnte fuer das Verify nicht gepullt werden."
  fi
fi

cat >"${ENV_FILE}" <<EOF
HOST=0.0.0.0
PORT=3000
NODE_ENV=production
SVA_RUNTIME_PROFILE=studio
SVA_PARENT_DOMAIN=studio.example.invalid
SVA_ALLOWED_INSTANCE_IDS=example-instance
SVA_PUBLIC_BASE_URL=http://127.0.0.1:3000
SVA_PUBLIC_HOST=127.0.0.1:3000
SVA_AUTH_ISSUER=http://${KEYCLOAK_NAME}:38080/realms/sva-studio
SVA_AUTH_CLIENT_ID=sva-studio
SVA_AUTH_CLIENT_SECRET=verify-auth-client-secret
SVA_AUTH_STATE_SECRET=verify-auth-state-secret
SVA_AUTH_REDIRECT_URI=http://127.0.0.1:3000/auth/callback
SVA_AUTH_POST_LOGOUT_REDIRECT_URI=http://127.0.0.1:3000/
IAM_CSRF_ALLOWED_ORIGINS=http://127.0.0.1:${APP_PORT}
KEYCLOAK_ADMIN_BASE_URL=http://${KEYCLOAK_NAME}:38080
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
SVA_SERVER_ENTRY_DEBUG=true
EOF

if [ "${VERIFY_STATUS}" = "ok" ]; then
  docker run -d \
    --name "${APP_NAME}" \
    --network "${NETWORK_NAME}" \
    --env-file "${ENV_FILE}" \
    -p "127.0.0.1:${APP_PORT}:3000" \
    "${IMAGE_REF}" >/dev/null

  for _ in $(seq 1 12); do
    if ! docker inspect -f '{{.State.Running}}' "${APP_NAME}" 2>/dev/null | grep -q true; then
      break
    fi
    if docker exec "${APP_NAME}" sh -lc "wget -q -O /dev/null http://127.0.0.1:3000/health/live" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if docker inspect -f '{{.State.Running}}' "${APP_NAME}" 2>/dev/null | grep -q true; then
    set_phase_var APP_START_STATUS ok
    mark_phase app-start ok
  else
    set_phase_var APP_START_STATUS error
    mark_phase app-start error
    fail_verify runtime-start-failed app-start "Der Containerprozess des Studio-Images startete nicht stabil."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  if probe_endpoint ".health-live" "/health/live" "200"; then
    set_phase_var HEALTH_LIVE_STATUS ok
    mark_phase health-live ok
  else
    set_phase_var HEALTH_LIVE_STATUS error
    mark_phase health-live error
    if docker inspect -f '{{.State.Running}}' "${APP_NAME}" 2>/dev/null | grep -q true; then
      fail_verify http-dispatch-failed health-live "GET /health/live antwortet nicht stabil aus dem Studio-Image."
    else
      fail_verify runtime-start-failed health-live "Der Containerprozess beendete sich waehrend /health/live."
    fi
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  if probe_endpoint ".health-ready" "/health/ready" "200"; then
    set_phase_var HEALTH_READY_STATUS ok
    mark_phase health-ready ok
  else
    set_phase_var HEALTH_READY_STATUS error
    mark_phase health-ready error
    fail_verify http-dispatch-failed health-ready "GET /health/ready antwortet nicht stabil aus dem Studio-Image."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  if probe_endpoint ".root-page" "/" "200"; then
    set_phase_var ROOT_PAGE_STATUS ok
    mark_phase root-page ok
  else
    set_phase_var ROOT_PAGE_STATUS error
    mark_phase root-page error
    fail_verify http-dispatch-failed root-page "GET / liefert keine stabile HTTP-200-Antwort aus dem Studio-Image."
  fi
fi

docker logs "${APP_NAME}" > "${ARTIFACT_DIR}/${APP_NAME}.log" 2>&1 || true
docker inspect "${APP_NAME}" > "${ARTIFACT_DIR}/${APP_NAME}.inspect.json" 2>/dev/null || true
docker logs "${POSTGRES_NAME}" > "${ARTIFACT_DIR}/${POSTGRES_NAME}.log" 2>&1 || true
docker logs "${REDIS_NAME}" > "${ARTIFACT_DIR}/${REDIS_NAME}.log" 2>&1 || true
docker logs "${KEYCLOAK_NAME}" > "${ARTIFACT_DIR}/${KEYCLOAK_NAME}.log" 2>&1 || true

cat >"${REPORT_PATH}" <<EOF
{
  "imageRef": "${IMAGE_REF}",
  "status": "${VERIFY_STATUS}",
  "failureClass": "${FAILURE_CLASS}",
  "failedPhase": "${FAILED_PHASE}",
  "reportId": "${VERIFY_ID}",
  "port": ${APP_PORT},
  "phases": {
    "postgres-ready": "${POSTGRES_READY_STATUS}",
    "postgres-app-role": "${POSTGRES_APP_ROLE_STATUS}",
    "schema-migrations": "${SCHEMA_MIGRATIONS_STATUS}",
    "redis-ready": "${REDIS_READY_STATUS}",
    "keycloak-ready": "${KEYCLOAK_READY_STATUS}",
    "image-pull": "${IMAGE_PULL_STATUS}",
    "app-start": "${APP_START_STATUS}",
    "health-live": "${HEALTH_LIVE_STATUS}",
    "health-ready": "${HEALTH_READY_STATUS}",
    "root-page": "${ROOT_PAGE_STATUS}"
  },
  "artifacts": {
    "summary": "$(basename "${SUMMARY_PATH}")",
    "phasesLog": "$(basename "${PHASES_LOG_PATH}")",
    "appLog": "${APP_NAME}.log",
    "appInspect": "${APP_NAME}.inspect.json",
    "postgresLog": "${POSTGRES_NAME}.log",
    "redisLog": "${REDIS_NAME}.log",
    "keycloakLog": "${KEYCLOAK_NAME}.log"
  }
}
EOF

cat >"${SUMMARY_PATH}" <<EOF
# Studio Artifact Verify

- Image-Ref: \`${IMAGE_REF}\`
- Status: \`${VERIFY_STATUS}\`
- Fehlerklasse: \`${FAILURE_CLASS}\`
- Fehlerphase: \`${FAILED_PHASE:-none}\`
- Port: \`${APP_PORT}\`
- Report: \`$(basename "${REPORT_PATH}")\`

## Phasen

- \`postgres-ready\`: \`${POSTGRES_READY_STATUS}\`
- \`postgres-app-role\`: \`${POSTGRES_APP_ROLE_STATUS}\`
- \`schema-migrations\`: \`${SCHEMA_MIGRATIONS_STATUS}\`
- \`redis-ready\`: \`${REDIS_READY_STATUS}\`
- \`keycloak-ready\`: \`${KEYCLOAK_READY_STATUS}\`
- \`image-pull\`: \`${IMAGE_PULL_STATUS}\`
- \`app-start\`: \`${APP_START_STATUS}\`
- \`health-live\`: \`${HEALTH_LIVE_STATUS}\`
- \`health-ready\`: \`${HEALTH_READY_STATUS}\`
- \`root-page\`: \`${ROOT_PAGE_STATUS}\`
EOF

if [ "${VERIFY_STATUS}" != "ok" ]; then
  echo "Studio artifact verify failed for ${IMAGE_REF}" >&2
  exit 1
fi
