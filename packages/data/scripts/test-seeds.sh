#!/usr/bin/env bash
set -euo pipefail

POSTGRES_DB="${POSTGRES_DB:-sva_studio}"
POSTGRES_USER="${POSTGRES_USER:-sva}"

if ! docker compose config --services >/tmp/data-compose-services.txt 2>/tmp/data-compose-services.err; then
  echo "Failed to read docker compose services:"
  cat /tmp/data-compose-services.err
  exit 1
fi

if command -v rg >/dev/null 2>&1; then
  service_exists_cmd=(rg -qx 'postgres' /tmp/data-compose-services.txt)
else
  service_exists_cmd=(grep -qx 'postgres' /tmp/data-compose-services.txt)
fi

if ! "${service_exists_cmd[@]}"; then
  echo "Postgres service not found in docker compose configuration."
  exit 1
fi

if [ -z "$(docker compose ps -q postgres)" ]; then
  echo "Postgres container is not running. Starting it via docker compose..."
  docker compose up -d postgres
fi

echo "Wait for Postgres readiness..."
for _ in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker compose exec -T postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
  echo "Postgres did not become ready in time."
  exit 1
fi

echo "Apply migrations..."
bash packages/data/scripts/run-migrations.sh up

echo "Reset IAM tables for seed integration test..."
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
TRUNCATE iam.activity_logs, iam.role_permissions, iam.account_roles, iam.account_organizations,
  iam.instance_memberships, iam.permissions, iam.roles, iam.organizations, iam.accounts, iam.instances
  RESTART IDENTITY CASCADE;
SQL

echo "Run seeds twice..."
bash packages/data/scripts/run-seeds.sh
bash packages/data/scripts/run-seeds.sh

echo "Validate seed idempotency counts..."
assert_count() {
  local sql="$1"
  local expected="$2"
  local label="$3"

  local actual
  actual=$(docker compose exec -T postgres psql -tA -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "$sql")

  if [ "${actual}" != "${expected}" ]; then
    echo "[FAIL] ${label}: expected ${expected}, got ${actual}"
    exit 1
  fi

  echo "[OK] ${label}: ${actual}"
}

assert_count "SELECT COUNT(*) FROM iam.instances WHERE instance_key = 'seed-instance-default';" "1" "instance count"
assert_count "SELECT COUNT(*) FROM iam.organizations WHERE organization_key = 'seed-org-default';" "1" "organization count"
assert_count "SELECT COUNT(*) FROM iam.roles WHERE instance_id = '11111111-1111-1111-1111-111111111111';" "7" "role count"
assert_count "SELECT COUNT(*) FROM iam.permissions WHERE instance_id = '11111111-1111-1111-1111-111111111111';" "13" "permission count"
assert_count "SELECT COUNT(*) FROM iam.accounts WHERE keycloak_subject LIKE 'seed:%';" "7" "account count"
assert_count "SELECT COUNT(*) FROM iam.instance_memberships WHERE instance_id = '11111111-1111-1111-1111-111111111111';" "7" "instance memberships"
assert_count "SELECT COUNT(*) FROM iam.account_roles WHERE instance_id = '11111111-1111-1111-1111-111111111111';" "7" "account roles"
assert_count "SELECT COUNT(*) FROM iam.account_organizations WHERE instance_id = '11111111-1111-1111-1111-111111111111';" "7" "account organizations"
assert_count "SELECT COUNT(*) FROM iam.role_permissions WHERE instance_id = '11111111-1111-1111-1111-111111111111';" "33" "role permissions"

echo "Seed idempotency integration test passed."
