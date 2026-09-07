#!/usr/bin/env bash
set -euo pipefail

package_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(cd "${package_dir}/../.." && pwd)"
container_name="ssf-plugin-postgresql-test-$$"
postgres_password="ssf-postgres-test"

cleanup() {
  docker rm -f "${container_name}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --rm --detach \
  --name "${container_name}" \
  --env "POSTGRES_PASSWORD=${postgres_password}" \
  --publish 127.0.0.1::5432 \
  postgres:16-alpine >/dev/null

for _ in $(seq 1 30); do
  if docker exec "${container_name}" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "${container_name}" pg_isready -U postgres -d postgres >/dev/null

host_port="$(docker port "${container_name}" 5432/tcp | awk -F: 'NR == 1 { print $NF }')"
admin_url="postgresql://postgres:${postgres_password}@127.0.0.1:${host_port}/postgres"

"${repo_dir}/packages/data/scripts/goosew.sh" \
  -dir "${package_dir}/migrations" postgres "${admin_url}" up
"${repo_dir}/packages/data/scripts/goosew.sh" \
  -dir "${package_dir}/migrations" postgres "${admin_url}" up

docker exec -i "${container_name}" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
CREATE USER ssf_plugin_root_test WITH PASSWORD 'ssf-root-test';
CREATE USER ssf_plugin_tenant_test WITH PASSWORD 'ssf-tenant-test';
GRANT ssf_plugin_root TO ssf_plugin_root_test;
GRANT ssf_plugin_tenant_runtime TO ssf_plugin_tenant_test;
SQL

export SSF_TEST_ROOT_DATABASE_URL="postgresql://ssf_plugin_root_test:ssf-root-test@127.0.0.1:${host_port}/postgres"
export SSF_TEST_TENANT_DATABASE_URL="postgresql://ssf_plugin_tenant_test:ssf-tenant-test@127.0.0.1:${host_port}/postgres"

pnpm exec tsx ../../scripts/ci/run-vitest-target.ts tests \
  --testFiles=tests/postgresql.integration.test.ts \
  --reporter=verbose \
  --config vitest.config.ts

"${repo_dir}/packages/data/scripts/goosew.sh" \
  -dir "${package_dir}/migrations" postgres "${admin_url}" down-to 0

schema_after_down="$(docker exec "${container_name}" psql -At -U postgres -d postgres -c "SELECT to_regnamespace('ssf') IS NULL;")"
test "${schema_after_down}" = "t"
