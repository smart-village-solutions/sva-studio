#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="$(pwd)"
APP_DIR_INPUT="${1:-apps/sva-studio-react}"
ARTIFACT_DIR_INPUT="${2:-artifacts/runtime/runtime-artifact-verify}"
VERIFY_ID="runtime-artifact-verify-$(date +%s)"
POSTGRES_NAME="${VERIFY_ID}-postgres"
REDIS_NAME="${VERIFY_ID}-redis"
POSTGRES_PASSWORD="verify-postgres-password"
APP_DB_PASSWORD="verify-app-password"
REDIS_PASSWORD="verify-redis-password"
PII_KEYRING_JSON='{"k1":"MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="}'

read -r APP_PORT POSTGRES_PORT REDIS_PORT KEYCLOAK_PORT <<EOF
$("${WORKSPACE_ROOT}/scripts/ci/run-workspace-node.sh" <<'NODE'
const net = require('node:net');

const reservePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Ephemerer Port konnte nicht bestimmt werden.')));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(String(port));
      });
    });
  });

(async () => {
  const ports = await Promise.all([reservePort(), reservePort(), reservePort(), reservePort()]);
  process.stdout.write(`${ports.join(' ')}\n`);
})().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
NODE
)
EOF

APP_PORT="${SVA_RUNTIME_ARTIFACT_VERIFY_PORT:-${APP_PORT}}"
POSTGRES_PORT="${SVA_RUNTIME_ARTIFACT_POSTGRES_PORT:-${POSTGRES_PORT}}"
REDIS_PORT="${SVA_RUNTIME_ARTIFACT_REDIS_PORT:-${REDIS_PORT}}"
KEYCLOAK_PORT="${SVA_RUNTIME_ARTIFACT_KEYCLOAK_PORT:-${KEYCLOAK_PORT}}"

APP_DIR="$(cd "${APP_DIR_INPUT}" && pwd)"
mkdir -p "${ARTIFACT_DIR_INPUT}"
ARTIFACT_DIR="$(cd "${ARTIFACT_DIR_INPUT}" && pwd)"

REPORT_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.json"
SUMMARY_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.md"
PHASES_LOG_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.phases.log"
APP_STDOUT_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.app.stdout.log"
APP_STDERR_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.app.stderr.log"
POSTGRES_LOG_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.postgres.log"
REDIS_LOG_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.redis.log"
KEYCLOAK_STDOUT_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.keycloak.stdout.log"
KEYCLOAK_STDERR_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.keycloak.stderr.log"

SERVER_INDEX_PATH="${APP_DIR}/.output/server/index.mjs"
SERVER_CHUNK_PATH=""
PATCHED_SERVER_ENTRY_PATH="${APP_DIR}/.output/server/chunks/build/tanstack-server-entry.mjs"

FAILURE_CLASS="none"
FAILED_PHASE=""
VERIFY_STATUS="ok"
APP_PID=""
KEYCLOAK_PID=""

POSTGRES_READY_STATUS="pending"
POSTGRES_APP_ROLE_STATUS="pending"
SCHEMA_MIGRATIONS_STATUS="pending"
REDIS_READY_STATUS="pending"
KEYCLOAK_READY_STATUS="pending"
ARTIFACT_CONTRACT_STATUS="pending"
APP_START_STATUS="pending"
HEALTH_LIVE_STATUS="pending"
HEALTH_READY_STATUS="pending"
ROOT_PAGE_STATUS="pending"

cleanup() {
  if [ -n "${APP_PID}" ] && kill -0 "${APP_PID}" >/dev/null 2>&1; then
    kill "${APP_PID}" >/dev/null 2>&1 || true
    wait "${APP_PID}" >/dev/null 2>&1 || true
  fi
  if [ -n "${KEYCLOAK_PID}" ] && kill -0 "${KEYCLOAK_PID}" >/dev/null 2>&1; then
    kill "${KEYCLOAK_PID}" >/dev/null 2>&1 || true
    wait "${KEYCLOAK_PID}" >/dev/null 2>&1 || true
  fi
  docker rm -f "${REDIS_NAME}" "${POSTGRES_NAME}" >/dev/null 2>&1 || true
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

assert_artifact_contract() {
  if [ ! -f "${SERVER_INDEX_PATH}" ]; then
    echo "Finaler Server-Entry fehlt: ${SERVER_INDEX_PATH}" >&2
    return 1
  fi

  if [ ! -f "${PATCHED_SERVER_ENTRY_PATH}" ]; then
    echo "Finaler gepatchter Server-Entry fehlt: ${PATCHED_SERVER_ENTRY_PATH}" >&2
    return 1
  fi

  if ! grep -Fq 'dispatchAuthRouteRequest' "${PATCHED_SERVER_ENTRY_PATH}"; then
    echo "Finaler gepatchter Server-Entry enthaelt keinen Auth-Dispatch-Vertrag." >&2
    return 1
  fi

  if ! grep -Fq 'server-entry-transport' "${PATCHED_SERVER_ENTRY_PATH}"; then
    echo "Finaler gepatchter Server-Entry enthaelt keine explizite Server-Entry-Diagnostik." >&2
    return 1
  fi

  if ! grep -Fq 'server-function-transport' "${PATCHED_SERVER_ENTRY_PATH}"; then
    echo "Finaler gepatchter Server-Entry enthaelt keinen Server-Function-Transportvertrag." >&2
    return 1
  fi

  if ! grep -Fq './chunks/build/tanstack-server-entry.mjs' "${SERVER_INDEX_PATH}"; then
    echo 'Finaler Server-Entry delegiert nicht an den finalen gepatchten Server-Entry.' >&2
    return 1
  fi

  SERVER_CHUNK_PATH="$(
    find "${APP_DIR}/.output/server/chunks/build" -maxdepth 1 -type f -name 'server*.mjs' | head -n 1
  )"
  if [ -z "${SERVER_CHUNK_PATH}" ]; then
    echo "Finaler SSR-Chunk unter .output/server/chunks/build/server*.mjs fehlt." >&2
    return 1
  fi

  return 0
}

probe_endpoint() {
  local phase="$1"
  local path="$2"
  local expected_status="$3"
  local body_path="${ARTIFACT_DIR}/${VERIFY_ID}${phase}.body.txt"
  local headers_path="${ARTIFACT_DIR}/${VERIFY_ID}${phase}.headers.txt"
  local stderr_path="${ARTIFACT_DIR}/${VERIFY_ID}${phase}.stderr.txt"

  for _ in $(seq 1 12); do
    if [ -n "${APP_PID}" ] && ! kill -0 "${APP_PID}" >/dev/null 2>&1; then
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

wait_for_http_endpoint() {
  local url="$1"

  for _ in $(seq 1 10); do
    if curl --silent --max-time 1 "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  return 1
}

docker run -d \
  --name "${POSTGRES_NAME}" \
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
  docker logs "${POSTGRES_NAME}" > "${POSTGRES_LOG_PATH}" 2>&1 || true
  fail_verify dependency-failed postgres-ready "Postgres wurde fuer den Final-Artifact-Check nicht bereit."
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  if docker exec -i "${POSTGRES_NAME}" psql -v ON_ERROR_STOP=1 -U sva -d sva_studio <<EOF >/dev/null
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
  then
    set_phase_var POSTGRES_APP_ROLE_STATUS ok
    mark_phase postgres-app-role ok
  else
    set_phase_var POSTGRES_APP_ROLE_STATUS error
    mark_phase postgres-app-role error
    fail_verify dependency-failed postgres-app-role "Die temporaere App-Rolle fuer den Final-Artifact-Check konnte nicht vorbereitet werden."
  fi
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
    fail_verify dependency-failed schema-migrations "Die temporaeren IAM-Migrationen fuer den Final-Artifact-Check sind fehlgeschlagen."
  fi
fi

docker run -d \
  --name "${REDIS_NAME}" \
  -p "127.0.0.1:${REDIS_PORT}:6379" \
  redis:7-alpine redis-server --save "" --appendonly no --requirepass "${REDIS_PASSWORD}" >/dev/null

if [ "${VERIFY_STATUS}" = "ok" ]; then
  if wait_for_redis; then
    set_phase_var REDIS_READY_STATUS ok
    mark_phase redis-ready ok
  else
    set_phase_var REDIS_READY_STATUS error
    mark_phase redis-ready error
    docker logs "${REDIS_NAME}" > "${REDIS_LOG_PATH}" 2>&1 || true
    fail_verify dependency-failed redis-ready "Redis wurde fuer den Final-Artifact-Check nicht bereit."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  KEYCLOAK_PORT="${KEYCLOAK_PORT}" "${WORKSPACE_ROOT}/scripts/ci/run-workspace-node.sh" <<'NODE' >"${KEYCLOAK_STDOUT_PATH}" 2>"${KEYCLOAK_STDERR_PATH}" &
const http = require('node:http');

const port = Number(process.env.KEYCLOAK_PORT || '38080');
const realm = 'sva-studio';

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);

  if (req.method === 'POST' && url.pathname === `/realms/${realm}/protocol/openid-connect/token`) {
    return json(res, 200, {
      access_token: 'verify-token',
      token_type: 'Bearer',
      expires_in: 300,
    });
  }

  if (req.method === 'GET' && url.pathname === `/admin/realms/${realm}/roles`) {
    return json(res, 200, []);
  }

  if (req.method === 'GET' && url.pathname === `/realms/${realm}/.well-known/openid-configuration`) {
    return json(res, 200, {
      issuer: `http://127.0.0.1:${port}/realms/${realm}`,
      token_endpoint: `http://127.0.0.1:${port}/realms/${realm}/protocol/openid-connect/token`,
      authorization_endpoint: `http://127.0.0.1:${port}/realms/${realm}/protocol/openid-connect/auth`,
      end_session_endpoint: `http://127.0.0.1:${port}/realms/${realm}/protocol/openid-connect/logout`,
      jwks_uri: `http://127.0.0.1:${port}/realms/${realm}/protocol/openid-connect/certs`,
    });
  }

  return json(res, 404, { error: 'not_found' });
});

server.listen(port, '127.0.0.1');
NODE
  KEYCLOAK_PID=$!

  if wait_for_http_endpoint "http://127.0.0.1:${KEYCLOAK_PORT}/realms/sva-studio/.well-known/openid-configuration"; then
    set_phase_var KEYCLOAK_READY_STATUS ok
    mark_phase keycloak-ready ok
  else
    set_phase_var KEYCLOAK_READY_STATUS error
    mark_phase keycloak-ready error
    fail_verify dependency-failed keycloak-ready "Der lokale Keycloak-Admin-Mock fuer den Final-Artifact-Check startete nicht stabil."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  if assert_artifact_contract; then
    set_phase_var ARTIFACT_CONTRACT_STATUS ok
    mark_phase artifact-contract ok
  else
    set_phase_var ARTIFACT_CONTRACT_STATUS error
    mark_phase artifact-contract error
    fail_verify artifact-contract-failed artifact-contract "Der finale .output/server-Vertrag ist unvollstaendig."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  (
    cd "${APP_DIR}"
    env \
      HOST=127.0.0.1 \
      PORT="${APP_PORT}" \
      NODE_ENV=production \
      SVA_RUNTIME_PROFILE=studio \
      SVA_PARENT_DOMAIN=studio.example.invalid \
      SVA_ALLOWED_INSTANCE_IDS=example-instance \
      SVA_PUBLIC_BASE_URL="http://127.0.0.1:${APP_PORT}" \
      SVA_PUBLIC_HOST="127.0.0.1:${APP_PORT}" \
      SVA_AUTH_ISSUER="http://127.0.0.1:${KEYCLOAK_PORT}/realms/sva-studio" \
      SVA_AUTH_CLIENT_ID=sva-studio \
      SVA_AUTH_CLIENT_SECRET=verify-auth-client-secret \
      SVA_AUTH_STATE_SECRET=verify-auth-state-secret \
      SVA_AUTH_REDIRECT_URI="http://127.0.0.1:${APP_PORT}/auth/callback" \
      SVA_AUTH_POST_LOGOUT_REDIRECT_URI="http://127.0.0.1:${APP_PORT}/" \
      IAM_CSRF_ALLOWED_ORIGINS="http://127.0.0.1:${APP_PORT}" \
      KEYCLOAK_ADMIN_BASE_URL="http://127.0.0.1:${KEYCLOAK_PORT}" \
      KEYCLOAK_ADMIN_REALM=sva-studio \
      KEYCLOAK_ADMIN_CLIENT_ID=sva-studio-iam-service \
      KEYCLOAK_ADMIN_CLIENT_SECRET=verify-keycloak-admin-secret \
      IAM_PII_ACTIVE_KEY_ID=k1 \
      IAM_PII_KEYRING_JSON="${PII_KEYRING_JSON}" \
      ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
      SVA_MAINSERVER_GRAPHQL_URL=https://mainserver.example.invalid/graphql \
      SVA_MAINSERVER_OAUTH_TOKEN_URL=https://mainserver.example.invalid/oauth/token \
      SVA_MAINSERVER_CLIENT_ID=studio-mainserver \
      SVA_MAINSERVER_CLIENT_SECRET=verify-mainserver-secret \
      SVA_MAINSERVER_REQUIRED=false \
      SVA_MIGRATION_STATUS_REQUIRED=false \
      POSTGRES_DB=sva_studio \
      POSTGRES_USER=sva \
      POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
      APP_DB_USER=sva_app \
      APP_DB_PASSWORD="${APP_DB_PASSWORD}" \
      REDIS_PASSWORD="${REDIS_PASSWORD}" \
      IAM_DATABASE_URL="postgres://sva_app:${APP_DB_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/sva_studio" \
      REDIS_URL="redis://:${REDIS_PASSWORD}@127.0.0.1:${REDIS_PORT}" \
      SVA_STACK_NAME=studio \
      QUANTUM_ENDPOINT=sva \
      ENABLE_OTEL=false \
      SVA_ENABLE_SERVER_CONSOLE_LOGS=true \
      SVA_TRUST_FORWARDED_HEADERS=true \
      IAM_UI_ENABLED=true \
      IAM_ADMIN_ENABLED=true \
      IAM_BULK_ENABLED=true \
      VITE_IAM_UI_ENABLED=true \
      VITE_IAM_ADMIN_ENABLED=true \
      VITE_IAM_BULK_ENABLED=true \
      SVA_SERVER_ENTRY_DEBUG=true \
      node .output/server/index.mjs >"${APP_STDOUT_PATH}" 2>"${APP_STDERR_PATH}"
  ) &
  APP_PID=$!

  for _ in $(seq 1 10); do
    if ! kill -0 "${APP_PID}" >/dev/null 2>&1; then
      break
    fi
    if curl --silent --max-time 1 "http://127.0.0.1:${APP_PORT}/health/live" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if [ -n "${APP_PID}" ] && kill -0 "${APP_PID}" >/dev/null 2>&1; then
    set_phase_var APP_START_STATUS ok
    mark_phase app-start ok
  else
    set_phase_var APP_START_STATUS error
    mark_phase app-start error
    fail_verify runtime-start-failed app-start "Der finale Node-Output startete nicht stabil."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  if probe_endpoint ".health-live" "/health/live" "200"; then
    set_phase_var HEALTH_LIVE_STATUS ok
    mark_phase health-live ok
  else
    set_phase_var HEALTH_LIVE_STATUS error
    mark_phase health-live error
    if [ -n "${APP_PID}" ] && kill -0 "${APP_PID}" >/dev/null 2>&1; then
      fail_verify http-dispatch-failed health-live "GET /health/live antwortet nicht stabil aus dem finalen Node-Output."
    else
      fail_verify runtime-start-failed health-live "Der Node-Prozess beendete sich waehrend /health/live."
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
    fail_verify http-dispatch-failed health-ready "GET /health/ready antwortet nicht stabil aus dem finalen Node-Output."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  if probe_endpoint ".root-page" "/" "200"; then
    set_phase_var ROOT_PAGE_STATUS ok
    mark_phase root-page ok
  else
    set_phase_var ROOT_PAGE_STATUS error
    mark_phase root-page error
    fail_verify http-dispatch-failed root-page "GET / liefert keine stabile HTTP-200-Antwort aus dem finalen Node-Output."
  fi
fi

docker logs "${POSTGRES_NAME}" > "${POSTGRES_LOG_PATH}" 2>&1 || true
docker logs "${REDIS_NAME}" > "${REDIS_LOG_PATH}" 2>&1 || true

cat > "${REPORT_PATH}" <<EOF
{
  "verifyId": "${VERIFY_ID}",
  "status": "${VERIFY_STATUS}",
  "failureClass": "${FAILURE_CLASS}",
  "failedPhase": "${FAILED_PHASE}",
  "appDir": "${APP_DIR}",
  "artifactContract": {
    "serverIndexPath": "${SERVER_INDEX_PATH}",
    "serverChunkPath": "${SERVER_CHUNK_PATH}"
  },
  "phases": {
    "postgres-ready": "${POSTGRES_READY_STATUS}",
    "postgres-app-role": "${POSTGRES_APP_ROLE_STATUS}",
    "schema-migrations": "${SCHEMA_MIGRATIONS_STATUS}",
    "redis-ready": "${REDIS_READY_STATUS}",
    "keycloak-ready": "${KEYCLOAK_READY_STATUS}",
    "artifact-contract": "${ARTIFACT_CONTRACT_STATUS}",
    "app-start": "${APP_START_STATUS}",
    "health-live": "${HEALTH_LIVE_STATUS}",
    "health-ready": "${HEALTH_READY_STATUS}",
    "root-page": "${ROOT_PAGE_STATUS}"
  },
  "artifacts": {
    "summary": "$(basename "${SUMMARY_PATH}")",
    "phasesLog": "$(basename "${PHASES_LOG_PATH}")",
    "appStdout": "$(basename "${APP_STDOUT_PATH}")",
    "appStderr": "$(basename "${APP_STDERR_PATH}")",
    "postgresLog": "$(basename "${POSTGRES_LOG_PATH}")",
    "redisLog": "$(basename "${REDIS_LOG_PATH}")",
    "keycloakStdout": "$(basename "${KEYCLOAK_STDOUT_PATH}")",
    "keycloakStderr": "$(basename "${KEYCLOAK_STDERR_PATH}")"
  }
}
EOF

cat > "${SUMMARY_PATH}" <<EOF
# Final Runtime Artifact Verify

- App-Verzeichnis: \`${APP_DIR}\`
- Status: \`${VERIFY_STATUS}\`
- Fehlerklasse: \`${FAILURE_CLASS}\`
- Fehlerphase: \`${FAILED_PHASE:-none}\`
- Server-Entry: \`${SERVER_INDEX_PATH}\`
- Server-Chunk: \`${SERVER_CHUNK_PATH}\`

## Phasen

- \`postgres-ready\`: \`${POSTGRES_READY_STATUS}\`
- \`postgres-app-role\`: \`${POSTGRES_APP_ROLE_STATUS}\`
- \`schema-migrations\`: \`${SCHEMA_MIGRATIONS_STATUS}\`
- \`redis-ready\`: \`${REDIS_READY_STATUS}\`
- \`keycloak-ready\`: \`${KEYCLOAK_READY_STATUS}\`
- \`artifact-contract\`: \`${ARTIFACT_CONTRACT_STATUS}\`
- \`app-start\`: \`${APP_START_STATUS}\`
- \`health-live\`: \`${HEALTH_LIVE_STATUS}\`
- \`health-ready\`: \`${HEALTH_READY_STATUS}\`
- \`root-page\`: \`${ROOT_PAGE_STATUS}\`
EOF

if [ "${VERIFY_STATUS}" != "ok" ]; then
  exit 1
fi
