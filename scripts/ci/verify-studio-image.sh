#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ] || [ "${4:-}" = "" ]; then
  echo "usage: verify-studio-image.sh <image-ref> <artifact-dir> <studio|ssf> <expected-revision>" >&2
  exit 1
fi

IMAGE_REF="$1"
ARTIFACT_DIR_INPUT="${2:-artifacts/runtime/image-verify}"
SVA_STUDIO_DISTRIBUTION="${3:-studio}"
EXPECTED_REVISION="$4"
case "${SVA_STUDIO_DISTRIBUTION}" in
  studio|ssf) ;;
  *) echo "invalid_studio_distribution:${SVA_STUDIO_DISTRIBUTION}" >&2; exit 1 ;;
esac
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
TENANT_HOST="example-instance.studio.example.invalid"
TENANT_ORIGIN="http://${TENANT_HOST}:${APP_PORT}"
ROOT_HOST="studio.example.invalid"
ROOT_ORIGIN="http://${ROOT_HOST}:${APP_PORT}"
AUTH_FIXTURE_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/image-verify-auth-fixture.ts"
AUTH_TMP_DIR=""
ROOT_DENIED_TMP_DIR=""
ROOT_ALLOWED_TMP_DIR=""
AUTH_TLS_DIR=""
ENV_TMP_DIR=""
AUTH_STAGE="not-started"
AUTH_HTTP_STATUS="000"

mkdir -p "${ARTIFACT_DIR_INPUT}"
ARTIFACT_DIR="$(cd "${ARTIFACT_DIR_INPUT}" && pwd)"
REPORT_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.json"
SUMMARY_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.md"
PHASES_LOG_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.phases.log"
ENV_TMP_DIR="$(mktemp -d)"
chmod 700 "${ENV_TMP_DIR}"
ENV_FILE="${ENV_TMP_DIR}/app.env"
IMAGE_INSPECT_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.image-inspect.json"
RUNTIME_MANIFEST_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.runtime-manifest.json"
CHUNK_PROVENANCE_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.chunk-provenance.json"
CHUNK_FILES_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.chunk-files.json"
PACKAGE_INVENTORY_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.workspace-packages.txt"
IMAGE_CONTRACT_PATH="${ARTIFACT_DIR}/${VERIFY_ID}.image-contract.json"

FAILURE_CLASS="none"
FAILED_PHASE=""
VERIFY_STATUS="ok"

POSTGRES_READY_STATUS="pending"
POSTGRES_APP_ROLE_STATUS="pending"
SCHEMA_MIGRATIONS_STATUS="pending"
AUTH_FIXTURE_STATUS="pending"
GRAPHILE_WORKER_MIGRATIONS_STATUS="pending"
WORKER_BOOTSTRAP_STATUS="pending"
REDIS_READY_STATUS="pending"
KEYCLOAK_READY_STATUS="pending"
IMAGE_PULL_STATUS="pending"
PLUGIN_INVENTORY_STATUS="pending"
APP_START_STATUS="pending"
HEALTH_LIVE_STATUS="pending"
HEALTH_READY_STATUS="pending"
ROOT_PAGE_STATUS="pending"
SSF_MIGRATIONS_STATUS="skipped"
AUTH_SESSION_STATUS="pending"
MEDIA_AUTH_STATUS="pending"
SSF_AUTH_STATUS="skipped"
ROOT_AUTH_STATUS="skipped"

cleanup() {
  docker rm -f "${APP_NAME}" "${KEYCLOAK_NAME}" "${REDIS_NAME}" "${POSTGRES_NAME}" >/dev/null 2>&1 || true
  docker network rm "${NETWORK_NAME}" >/dev/null 2>&1 || true
  rm -f "${ENV_FILE}" "${IMAGE_INSPECT_PATH}" "${RUNTIME_MANIFEST_PATH}" \
    "${CHUNK_PROVENANCE_PATH}" "${CHUNK_FILES_PATH}" "${PACKAGE_INVENTORY_PATH}"
  rmdir "${ENV_TMP_DIR}" 2>/dev/null || true
  for auth_dir in "${AUTH_TMP_DIR}" "${ROOT_DENIED_TMP_DIR}" "${ROOT_ALLOWED_TMP_DIR}"; do
    if [ -n "${auth_dir}" ]; then
      rm -f "${auth_dir}/login.headers" "${auth_dir}/callback.headers" \
        "${auth_dir}/cookies" "${auth_dir}/cookies.http"
      rmdir "${auth_dir}" 2>/dev/null || true
    fi
  done
  if [ -n "${AUTH_TLS_DIR}" ]; then
    rm -f "${AUTH_TLS_DIR}/mock.crt" "${AUTH_TLS_DIR}/mock.key"
    rmdir "${AUTH_TLS_DIR}" 2>/dev/null || true
  fi
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

if docker pull "${IMAGE_REF}" >/dev/null; then
  set_phase_var IMAGE_PULL_STATUS ok
  mark_phase image-pull ok
else
  fail_verify dependency-failed image-pull "Das Studio-Image konnte fuer das Verify nicht gepullt werden."
  exit 1
fi

docker image inspect "${IMAGE_REF}" > "${IMAGE_INSPECT_PATH}"
docker run --rm --entrypoint cat "${IMAGE_REF}" \
  .output/server/generated/studio-distribution.json > "${RUNTIME_MANIFEST_PATH}"
# Check resolvable packages in both top-level and pnpm-store node_modules. Broken
# links left by pnpm are not deployable packages and must not count as present.
docker run --rm --entrypoint sh "${IMAGE_REF}" -lc '
  find /app/node_modules -path "*/node_modules/@sva/*" -prune |
    while IFS= read -r package_path; do
      if [ -d "${package_path}" ]; then printf "%s\n" "${package_path##*/}"; fi
    done | sort -u
' > "${PACKAGE_INVENTORY_PATH}"

if ! docker run --rm --entrypoint cat "${IMAGE_REF}" \
  .output/server/generated/studio-chunk-provenance.json > "${CHUNK_PROVENANCE_PATH}" ||
  ! docker run --rm --entrypoint node "${IMAGE_REF}" -e '
    const { createHash } = require("node:crypto");
    const { readFileSync, readdirSync } = require("node:fs");
    const { join, relative, sep } = require("node:path");
    const root = ".output";
    const files = [];
    const walk = (directory) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error("chunk_provenance_symlink_present");
        if (entry.isDirectory()) walk(path);
        else if (entry.isFile() && /\.(?:[cm]?js|map)$/.test(entry.name)) {
          files.push({
            path: relative(root, path).split(sep).join("/"),
            sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
          });
        }
      }
    };
    walk(join(root, "public"));
    walk(join(root, "server"));
    process.stdout.write(JSON.stringify(files.sort((a, b) => a.path.localeCompare(b.path))));
  ' > "${CHUNK_FILES_PATH}"
then
  set_phase_var PLUGIN_INVENTORY_STATUS error
  mark_phase plugin-inventory error
  fail_verify artifact-inventory-mismatch plugin-inventory "Chunk-Provenienz oder Image-Dateiinventar fehlt."
  exit 1
fi

if jq -n \
  --arg imageRef "${IMAGE_REF}" \
  --arg expectedRevision "${EXPECTED_REVISION}" \
  --arg distribution "${SVA_STUDIO_DISTRIBUTION}" \
  --slurpfile inspection "${IMAGE_INSPECT_PATH}" \
  --slurpfile manifest "${RUNTIME_MANIFEST_PATH}" \
  --slurpfile chunkProvenance "${CHUNK_PROVENANCE_PATH}" \
  --slurpfile chunkFiles "${CHUNK_FILES_PATH}" \
  --rawfile packages "${PACKAGE_INVENTORY_PATH}" \
  '{imageRef: $imageRef, expectedRevision: $expectedRevision, distribution: $distribution, inspection: $inspection[0], runtimeManifest: $manifest[0], chunkProvenance: $chunkProvenance[0], chunkFiles: $chunkFiles[0], packages: ($packages | split("\n") | map(select(length > 0)))}' |
  node "$(dirname "${BASH_SOURCE[0]}")/verify-studio-image-contract.mjs" > "${IMAGE_CONTRACT_PATH}"
then
  set_phase_var PLUGIN_INVENTORY_STATUS ok
  mark_phase plugin-inventory ok
else
  set_phase_var PLUGIN_INVENTORY_STATUS error
  mark_phase plugin-inventory error
  rm -f "${IMAGE_CONTRACT_PATH}"
  fail_verify artifact-inventory-mismatch plugin-inventory "Image-Identitaet oder Paket-Inventar stimmt nicht mit dem Buildprofil ueberein."
  exit 1
fi

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

run_postgres_sql_with_retry() {
  local database="$1"
  local sql="$2"

  for _ in $(seq 1 10); do
    if docker exec -i "${POSTGRES_NAME}" psql -v ON_ERROR_STOP=1 -U sva -d "${database}" >/dev/null <<EOF
${sql}
EOF
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

allow_loopback_http_cookies() {
  local auth_dir="$1"
  local auth_host="$2"
  # Production sets Secure on the cookies. Curl does not store a Secure cookie
  # received over this temporary HTTP loopback port, so only the private client
  # jar is adapted. The server response and its cookie attributes stay unchanged.
  awk -F '\t' 'BEGIN { OFS="\t" } $6 == "sva_auth_session" { next } NF >= 7 && ($1 ~ /^#HttpOnly_/ || $1 !~ /^#/) { $4="FALSE" } { print }' \
    "${auth_dir}/cookies" > "${auth_dir}/cookies.http" || return 1
  mv "${auth_dir}/cookies.http" "${auth_dir}/cookies"
  if [ -f "${auth_dir}/callback.headers" ]; then
    awk -v host="${auth_host}" '
      tolower($0) ~ /^set-cookie:[[:space:]]*sva_auth_session=/ {
        line = $0;
        sub(/\r$/, "", line);
        lower = tolower(line);
        if (lower !~ /;[[:space:]]*secure([;]|$)/ ||
            lower !~ /;[[:space:]]*httponly([;]|$)/ ||
            lower !~ /;[[:space:]]*path=\/([;]|$)/ ||
            lower ~ /;[[:space:]]*domain=/) exit 1;
        split(line, parts, ";");
        value = substr(parts[1], index(parts[1], "=") + 1);
        if (value !~ /^[A-Za-z0-9_.~-]+$/) exit 1;
        printf "#HttpOnly_%s\tFALSE\t/\tFALSE\t0\tsva_auth_session\t%s\n", host, value;
        found = 1;
      }
      END { if (!found) exit 1 }
    ' "${auth_dir}/callback.headers" >> "${auth_dir}/cookies" || return 1
  fi
}

login_verify_host() {
  local auth_host="$1"
  local auth_origin="$2"
  local auth_realm="$3"
  local auth_dir="$4"
  local login_status auth_url callback_url callback_status
  AUTH_STAGE="login-request"
  login_status="$(curl --noproxy '*' --silent --show-error --max-time 10 \
    --resolve "${auth_host}:${APP_PORT}:127.0.0.1" \
    --dump-header "${auth_dir}/login.headers" \
    --cookie-jar "${auth_dir}/cookies" \
    --output /dev/null --write-out '%{http_code}' \
    "${auth_origin}/auth/login" 2>/dev/null)" || return 1
  AUTH_HTTP_STATUS="${login_status}"
  [ "${login_status}" = "302" ] || return 1
  AUTH_STAGE="login-cookie"
  allow_loopback_http_cookies "${auth_dir}" "${auth_host}" || return 1
  AUTH_STAGE="authorize-url"
  auth_url="$(awk 'tolower($1) == "location:" { print $2; exit }' "${auth_dir}/login.headers" | tr -d '\r')"
  node -e '
    try {
      const url = new URL(process.argv[1]);
      if (url.origin !== process.argv[2] ||
          url.pathname !== `/realms/${process.argv[3]}/protocol/openid-connect/auth`) process.exit(1);
    } catch { process.exit(1); }
  ' "${auth_url}" "https://${KEYCLOAK_NAME}:38080" "${auth_realm}" || return 1
  AUTH_STAGE="authorize-request"
  callback_url="$(docker exec "${KEYCLOAK_NAME}" node -e '
    fetch(process.argv[1], { redirect: "manual" }).then((response) => {
      const location = response.headers.get("location");
      if (response.status !== 302 || !location) process.exit(1);
      process.stdout.write(location);
    }).catch(() => process.exit(1));
  ' "${auth_url}")" || return 1
  AUTH_STAGE="callback-url"
  node -e '
    try {
      const url = new URL(process.argv[1]);
      if (url.origin !== process.argv[2] || url.pathname !== "/auth/callback") process.exit(1);
    } catch { process.exit(1); }
  ' "${callback_url}" "${auth_origin}" || return 1
  AUTH_STAGE="callback-request"
  callback_status="$(curl --noproxy '*' --silent --show-error --max-time 10 \
    --resolve "${auth_host}:${APP_PORT}:127.0.0.1" \
    --cookie "${auth_dir}/cookies" --cookie-jar "${auth_dir}/cookies" \
    --dump-header "${auth_dir}/callback.headers" \
    --output /dev/null --write-out '%{http_code}' "${callback_url}" 2>/dev/null)" || return 1
  AUTH_HTTP_STATUS="${callback_status}"
  [ "${callback_status}" = "302" ] || return 1
  AUTH_STAGE="callback-cookie"
  grep -qi '^Set-Cookie:.*Secure' "${auth_dir}/callback.headers" || return 1
  AUTH_STAGE="callback-session-set-cookie"
  grep -qi '^Set-Cookie: sva_auth_session=' "${auth_dir}/callback.headers" || return 1
  AUTH_STAGE="callback-cookie-jar"
  allow_loopback_http_cookies "${auth_dir}" "${auth_host}" || return 1
  awk -F '\t' -v host="${auth_host}" \
    '$1 == "#HttpOnly_" host && $2 == "FALSE" && $3 == "/" && $4 == "FALSE" && $6 == "sva_auth_session" { found = 1 } END { exit !found }' \
    "${auth_dir}/cookies" || return 1
}

probe_authenticated() {
  local auth_host="$1"
  local auth_origin="$2"
  local auth_dir="$3"
  local path="$4"
  local expected_status="$5"
  local status_code
  for _ in $(seq 1 10); do
    status_code="$(curl --noproxy '*' --silent --show-error --max-time 5 \
      --resolve "${auth_host}:${APP_PORT}:127.0.0.1" \
      --cookie "${auth_dir}/cookies" \
      --output /dev/null --write-out '%{http_code}' \
      "${auth_origin}${path}" 2>/dev/null)" || status_code="000"
    if [ "${status_code}" = "${expected_status}" ]; then return 0; fi
    sleep 1
  done
  printf 'authenticated-probe\t%s\t%s\t%s\n' "${path}" "${expected_status}" "${status_code}" >> "${PHASES_LOG_PATH}"
  return 1
}

permission_cache_revision() {
  docker exec "${POSTGRES_NAME}" psql -X -U sva -d sva_studio -tAc \
    "SELECT COALESCE((SELECT revision FROM iam.permission_cache_instance_revisions WHERE instance_id = 'example-instance'), 0)"
}

assert_revision_advanced() {
  local before="$1"
  local after="$2"
  [[ "${before}" =~ ^[0-9]+$ && "${after}" =~ ^[0-9]+$ ]] && [ "${after}" -gt "${before}" ]
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
  if run_postgres_sql_with_retry "sva_studio" "
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
GRANT CREATE ON DATABASE sva_studio TO sva_app;
GRANT USAGE, CREATE ON SCHEMA public TO sva_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sva_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sva_app;
"; then
    set_phase_var POSTGRES_APP_ROLE_STATUS ok
    mark_phase postgres-app-role ok
  else
    set_phase_var POSTGRES_APP_ROLE_STATUS error
    mark_phase postgres-app-role error
    fail_verify dependency-failed postgres-app-role "Die temporaere App-Rolle fuer das Image-Verify konnte nicht vorbereitet werden."
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
    fail_verify dependency-failed schema-migrations "Die temporaeren IAM-Migrationen fuer das Image-Verify sind fehlgeschlagen."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  if IAM_PII_ACTIVE_KEY_ID=k1 IAM_PII_KEYRING_JSON="${PII_KEYRING_JSON}" \
    pnpm exec tsx "${AUTH_FIXTURE_SCRIPT}" seed "${POSTGRES_NAME}"
  then
    set_phase_var AUTH_FIXTURE_STATUS ok
    mark_phase auth-fixture ok
  else
    set_phase_var AUTH_FIXTURE_STATUS error
    mark_phase auth-fixture error
    fail_verify dependency-failed auth-fixture "Die temporaere Auth-Fixture konnte nicht vorbereitet werden."
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
  KEYCLOAK_MOCK_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/keycloak-verify-mock.cjs"
  AUTH_TLS_DIR="$(mktemp -d)"
  chmod 700 "${AUTH_TLS_DIR}"
  if ! openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
    -subj "/CN=${KEYCLOAK_NAME}" \
    -addext "subjectAltName=DNS:${KEYCLOAK_NAME}" \
    -keyout "${AUTH_TLS_DIR}/mock.key" -out "${AUTH_TLS_DIR}/mock.crt" \
    >/dev/null 2>&1; then
    fail_verify dependency-failed keycloak-ready "Das temporaere Verify-TLS-Zertifikat konnte nicht erstellt werden."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  docker run -d \
    --name "${KEYCLOAK_NAME}" \
    --network "${NETWORK_NAME}" \
    -e PORT=38080 \
    -e KEYCLOAK_REALM=sva-studio \
    -e KEYCLOAK_BASE_URL="https://${KEYCLOAK_NAME}:38080" \
    -e KEYCLOAK_TLS_CERT=/tmp/verify-mock.crt \
    -e KEYCLOAK_TLS_KEY=/tmp/verify-mock.key \
    -e NODE_EXTRA_CA_CERTS=/tmp/verify-mock.crt \
    -e "VERIFY_AUTH_REDIRECT_URI=${TENANT_ORIGIN}/auth/callback" \
    -e "VERIFY_ROOT_REDIRECT_URI=${ROOT_ORIGIN}/auth/callback" \
    -v "${KEYCLOAK_MOCK_SCRIPT}:/tmp/keycloak-verify-mock.cjs:ro" \
    -v "${AUTH_TLS_DIR}/mock.crt:/tmp/verify-mock.crt:ro" \
    -v "${AUTH_TLS_DIR}/mock.key:/tmp/verify-mock.key:ro" \
    node:24.15.0-alpine \
    node /tmp/keycloak-verify-mock.cjs >/dev/null

  KEYCLOAK_HTTPS_READY=false
  for _ in $(seq 1 12); do
    if docker exec "${KEYCLOAK_NAME}" node -e '
      const origin = process.argv[1];
      Promise.all([
        fetch(`${origin}/realms/example-instance/.well-known/openid-configuration`),
        fetch(`${origin}/realms/sva-studio/protocol/openid-connect/token`, {
          method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials"
        })
      ]).then((responses) => {
        if (responses.some((response) => !response.ok)) process.exit(1);
      }).catch(() => process.exit(1));
    ' "https://${KEYCLOAK_NAME}:38080" >/dev/null 2>&1; then
      KEYCLOAK_HTTPS_READY=true
      break
    fi
    sleep 1
  done
  if [ "${KEYCLOAK_HTTPS_READY}" = true ]; then
    set_phase_var KEYCLOAK_READY_STATUS ok
    mark_phase keycloak-ready ok
  else
    set_phase_var KEYCLOAK_READY_STATUS error
    mark_phase keycloak-ready error
    docker logs "${KEYCLOAK_NAME}" > "${ARTIFACT_DIR}/${KEYCLOAK_NAME}.log" 2>&1 || true
    fail_verify dependency-failed keycloak-ready "Der Keycloak-Admin-Mock wurde im Image-Verify nicht bereit."
  fi
fi

cat >"${ENV_FILE}" <<EOF
HOST=0.0.0.0
PORT=3000
NODE_ENV=production
SVA_RUNTIME_PROFILE=studio
SVA_PARENT_DOMAIN=studio.example.invalid
SVA_ALLOWED_INSTANCE_IDS=example-instance
SVA_PUBLIC_BASE_URL=http://127.0.0.1:${APP_PORT}
SVA_PUBLIC_HOST=127.0.0.1:${APP_PORT}
SVA_AUTH_ISSUER=https://${KEYCLOAK_NAME}:38080/realms/sva-studio
SVA_AUTH_CLIENT_ID=sva-studio
SVA_AUTH_CLIENT_SECRET=verify-auth-client-secret
SVA_AUTH_STATE_SECRET=verify-auth-state-secret
SVA_AUTH_REDIRECT_URI=${ROOT_ORIGIN}/auth/callback
SVA_AUTH_POST_LOGOUT_REDIRECT_URI=${ROOT_ORIGIN}/
IAM_CSRF_ALLOWED_ORIGINS=http://127.0.0.1:${APP_PORT}
KEYCLOAK_ADMIN_BASE_URL=https://${KEYCLOAK_NAME}:38080
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
POSTGRES_HOST=${POSTGRES_NAME}
POSTGRES_DB=sva_studio
POSTGRES_USER=sva
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
APP_DB_USER=sva_app
APP_DB_PASSWORD=${APP_DB_PASSWORD}
STUDIO_JOB_WORKER_DB_PASSWORD=verify-worker-password
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_SNAPSHOT_HMAC_SECRET=verify-redis-snapshot-hmac-secret
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
NODE_EXTRA_CA_CERTS=/tmp/verify-mock.crt
EOF

if [ "${SVA_STUDIO_DISTRIBUTION}" = "ssf" ]; then
  cat >>"${ENV_FILE}" <<EOF
SSF_PLUGIN_DATABASE_ENABLED=true
SVA_STUDIO_SSF_DATABASE_URL=postgres://sva_ssf_runtime:verify-ssf-runtime-password@${POSTGRES_NAME}:5432/sva_studio_ssf?options=-c%20role%3Dssf_plugin_tenant_runtime
SVA_STUDIO_SSF_ROOT_DATABASE_URL=postgres://sva_ssf_root:verify-ssf-root-password@${POSTGRES_NAME}:5432/sva_studio_ssf?options=-c%20role%3Dssf_plugin_root
EOF
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  if docker run --rm \
    --network "${NETWORK_NAME}" \
    --env-file "${ENV_FILE}" \
    -v "${AUTH_TLS_DIR}/mock.crt:/tmp/verify-mock.crt:ro" \
    -e "POSTGRES_HOST=${POSTGRES_NAME}" \
    --entrypoint node \
    "${IMAGE_REF}" ./migrate-graphile-worker.mjs >/dev/null
  then
    set_phase_var GRAPHILE_WORKER_MIGRATIONS_STATUS ok
    mark_phase graphile-worker-migrations ok
  else
    set_phase_var GRAPHILE_WORKER_MIGRATIONS_STATUS error
    mark_phase graphile-worker-migrations error
    fail_verify dependency-failed graphile-worker-migrations "Die temporaeren Graphile-Worker-Migrationen fuer das Image-Verify sind fehlgeschlagen."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ] && [ "${SVA_STUDIO_DISTRIBUTION}" = "ssf" ]; then
  if docker run --rm \
    --network "${NETWORK_NAME}" \
    --env-file "${ENV_FILE}" \
    -v "${AUTH_TLS_DIR}/mock.crt:/tmp/verify-mock.crt:ro" \
    --entrypoint ./migrate-entrypoint.sh \
    "${IMAGE_REF}" >/dev/null
  then
    set_phase_var SSF_MIGRATIONS_STATUS ok
    mark_phase ssf-migrations ok
  else
    set_phase_var SSF_MIGRATIONS_STATUS error
    mark_phase ssf-migrations error
    fail_verify dependency-failed ssf-migrations "Die temporaeren SSF-Plugin-Migrationen sind fehlgeschlagen."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  if docker run --rm \
    --network "${NETWORK_NAME}" \
    --env-file "${ENV_FILE}" \
    -v "${AUTH_TLS_DIR}/mock.crt:/tmp/verify-mock.crt:ro" \
    -e "POSTGRES_HOST=${POSTGRES_NAME}" \
    -e SVA_BOOTSTRAP_ENABLE_INSTANCE_RECONCILE=false \
    --entrypoint ./bootstrap-entrypoint.sh \
    "${IMAGE_REF}" >/dev/null
  then
    set_phase_var WORKER_BOOTSTRAP_STATUS ok
    mark_phase worker-bootstrap ok
  else
    set_phase_var WORKER_BOOTSTRAP_STATUS error
    mark_phase worker-bootstrap error
    fail_verify dependency-failed worker-bootstrap "Der temporaere Worker-Bootstrap fuer das Image-Verify ist fehlgeschlagen."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  docker run -d \
    --name "${APP_NAME}" \
    --network "${NETWORK_NAME}" \
    --env-file "${ENV_FILE}" \
    -v "${AUTH_TLS_DIR}/mock.crt:/tmp/verify-mock.crt:ro" \
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

MEDIA_PATH='/api/v1/iam/media?instanceId=example-instance&visibility=public&limit=1'
SSF_TENANT_PATH='/api/v1/plugins/ssf/tenant-configuration'
SSF_SYSTEM_PATH='/api/v1/plugins/ssf/system-configuration'

if [ "${VERIFY_STATUS}" = "ok" ]; then
  AUTH_TMP_DIR="$(mktemp -d)"
  chmod 700 "${AUTH_TMP_DIR}"
  if login_verify_host "${TENANT_HOST}" "${TENANT_ORIGIN}" example-instance "${AUTH_TMP_DIR}"; then
    set_phase_var AUTH_SESSION_STATUS ok
    mark_phase auth-session ok
  else
    set_phase_var AUTH_SESSION_STATUS error
    mark_phase auth-session error
    fail_verify auth-failed auth-session "Die OIDC-Tenant-Session scheiterte im Image-Verify bei ${AUTH_STAGE} (HTTP ${AUTH_HTTP_STATUS})."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ]; then
  MEDIA_REVISION_BEFORE="$(permission_cache_revision)"
  if probe_authenticated "${TENANT_HOST}" "${TENANT_ORIGIN}" "${AUTH_TMP_DIR}" "${MEDIA_PATH}" 200 && \
    pnpm exec tsx "${AUTH_FIXTURE_SCRIPT}" revoke-media "${POSTGRES_NAME}" && \
    MEDIA_REVISION_REVOKED="$(permission_cache_revision)" && \
    assert_revision_advanced "${MEDIA_REVISION_BEFORE}" "${MEDIA_REVISION_REVOKED}" && \
    probe_authenticated "${TENANT_HOST}" "${TENANT_ORIGIN}" "${AUTH_TMP_DIR}" "${MEDIA_PATH}" 403 && \
    pnpm exec tsx "${AUTH_FIXTURE_SCRIPT}" restore-media "${POSTGRES_NAME}" && \
    MEDIA_REVISION_RESTORED="$(permission_cache_revision)" && \
    assert_revision_advanced "${MEDIA_REVISION_REVOKED}" "${MEDIA_REVISION_RESTORED}" && \
    probe_authenticated "${TENANT_HOST}" "${TENANT_ORIGIN}" "${AUTH_TMP_DIR}" "${MEDIA_PATH}" 200
  then
    set_phase_var MEDIA_AUTH_STATUS ok
    mark_phase media-auth ok
  else
    set_phase_var MEDIA_AUTH_STATUS error
    mark_phase media-auth error
    fail_verify authorization-failed media-auth "Der authentifizierte Media-Read-/Deny-Pfad ist im Image nicht korrekt."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ] && [ "${SVA_STUDIO_DISTRIBUTION}" = "ssf" ]; then
  # An active optional assignment without lifecycle evidence must fail closed;
  # this is not the positive tenant-ready acceptance required by #1325.
  if probe_authenticated "${TENANT_HOST}" "${TENANT_ORIGIN}" "${AUTH_TMP_DIR}" "${SSF_TENANT_PATH}" 403 && \
    probe_authenticated "${TENANT_HOST}" "${TENANT_ORIGIN}" "${AUTH_TMP_DIR}" "${SSF_SYSTEM_PATH}" 403
  then
    set_phase_var SSF_AUTH_STATUS ok
    mark_phase ssf-auth ok
  else
    set_phase_var SSF_AUTH_STATUS error
    mark_phase ssf-auth error
    fail_verify authorization-failed ssf-auth "Der SSF-Tenant-Fail-Closed- oder Root-Host-Grenztest ist im Image nicht korrekt."
  fi
fi

if [ "${VERIFY_STATUS}" = "ok" ] && [ "${SVA_STUDIO_DISTRIBUTION}" = "ssf" ]; then
  ROOT_DENIED_TMP_DIR="$(mktemp -d)"
  ROOT_ALLOWED_TMP_DIR="$(mktemp -d)"
  chmod 700 "${ROOT_DENIED_TMP_DIR}" "${ROOT_ALLOWED_TMP_DIR}"
  if login_verify_host "${ROOT_HOST}" "${ROOT_ORIGIN}" sva-studio "${ROOT_DENIED_TMP_DIR}" && \
    probe_authenticated "${ROOT_HOST}" "${ROOT_ORIGIN}" "${ROOT_DENIED_TMP_DIR}" "${SSF_SYSTEM_PATH}" 403 && \
    login_verify_host "${ROOT_HOST}" "${ROOT_ORIGIN}" sva-studio "${ROOT_ALLOWED_TMP_DIR}" && \
    probe_authenticated "${ROOT_HOST}" "${ROOT_ORIGIN}" "${ROOT_ALLOWED_TMP_DIR}" "${SSF_SYSTEM_PATH}" 200
  then
    set_phase_var ROOT_AUTH_STATUS ok
    mark_phase root-ssf-auth ok
  else
    set_phase_var ROOT_AUTH_STATUS error
    mark_phase root-ssf-auth error
    fail_verify authorization-failed root-ssf-auth "Die authentifizierte SSF-Systemroute mit und ohne Plattformrolle scheiterte bei ${AUTH_STAGE} (HTTP ${AUTH_HTTP_STATUS})."
  fi
fi

docker logs "${APP_NAME}" > "${ARTIFACT_DIR}/${APP_NAME}.log" 2>&1 || true
docker inspect "${APP_NAME}" 2>/dev/null | jq 'map({Id,Name,Image,State})' \
  > "${ARTIFACT_DIR}/${APP_NAME}.inspect.json" || true
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
    "ssf-migrations": "${SSF_MIGRATIONS_STATUS}",
    "auth-fixture": "${AUTH_FIXTURE_STATUS}",
    "graphile-worker-migrations": "${GRAPHILE_WORKER_MIGRATIONS_STATUS}",
    "worker-bootstrap": "${WORKER_BOOTSTRAP_STATUS}",
    "redis-ready": "${REDIS_READY_STATUS}",
    "keycloak-ready": "${KEYCLOAK_READY_STATUS}",
    "image-pull": "${IMAGE_PULL_STATUS}",
    "plugin-inventory": "${PLUGIN_INVENTORY_STATUS}",
    "app-start": "${APP_START_STATUS}",
    "health-live": "${HEALTH_LIVE_STATUS}",
    "health-ready": "${HEALTH_READY_STATUS}",
    "root-page": "${ROOT_PAGE_STATUS}",
    "auth-session": "${AUTH_SESSION_STATUS}",
    "media-auth": "${MEDIA_AUTH_STATUS}",
    "ssf-auth": "${SSF_AUTH_STATUS}",
    "root-ssf-auth": "${ROOT_AUTH_STATUS}"
  },
  "artifacts": {
    "summary": "$(basename "${SUMMARY_PATH}")",
    "phasesLog": "$(basename "${PHASES_LOG_PATH}")",
    "imageContract": "$(basename "${IMAGE_CONTRACT_PATH}")",
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
- \`auth-fixture\`: \`${AUTH_FIXTURE_STATUS}\`
- \`ssf-migrations\`: \`${SSF_MIGRATIONS_STATUS}\`
- \`graphile-worker-migrations\`: \`${GRAPHILE_WORKER_MIGRATIONS_STATUS}\`
- \`worker-bootstrap\`: \`${WORKER_BOOTSTRAP_STATUS}\`
- \`redis-ready\`: \`${REDIS_READY_STATUS}\`
- \`keycloak-ready\`: \`${KEYCLOAK_READY_STATUS}\`
- \`image-pull\`: \`${IMAGE_PULL_STATUS}\`
- \`plugin-inventory\`: \`${PLUGIN_INVENTORY_STATUS}\`
- \`app-start\`: \`${APP_START_STATUS}\`
- \`health-live\`: \`${HEALTH_LIVE_STATUS}\`
- \`health-ready\`: \`${HEALTH_READY_STATUS}\`
- \`root-page\`: \`${ROOT_PAGE_STATUS}\`
- \`auth-session\`: \`${AUTH_SESSION_STATUS}\`
- \`media-auth\`: \`${MEDIA_AUTH_STATUS}\`
- \`ssf-auth\`: \`${SSF_AUTH_STATUS}\`
- \`root-ssf-auth\`: \`${ROOT_AUTH_STATUS}\`
EOF

if [ "${VERIFY_STATUS}" != "ok" ]; then
  echo "Studio artifact verify failed for ${IMAGE_REF}" >&2
  exit 1
fi
