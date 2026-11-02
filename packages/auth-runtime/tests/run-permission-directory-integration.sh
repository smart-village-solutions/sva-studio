#!/usr/bin/env bash
set -euo pipefail
package_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(cd "${package_dir}/../.." && pwd)"
cd "$repo_dir"
container="identity-iam-postgresql-test-$$"
work_dir="$(mktemp -d)"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$work_dir"
}
trap cleanup EXIT
docker run --rm -d --name "$container" -e POSTGRES_PASSWORD=identity-test --publish 127.0.0.1::5432 postgres:16-alpine >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$container" pg_isready -U postgres >/dev/null
port=$(docker port "$container" 5432/tcp | awk -F: 'NR==1 { print $NF }')
url="postgresql://postgres:identity-test@127.0.0.1:${port}/postgres"
packages/data/scripts/goosew.sh -dir packages/data/migrations postgres "$url" up
docker exec "$container" pg_dump --schema-only --no-owner --no-privileges -U postgres -d postgres > "$work_dir/schema.sql"
DIRECTORY_SCHEMA_ACTUAL_FILE="$work_dir/schema.sql" pnpm exec tsx -e "import {readFileSync} from 'node:fs'; import {createSchemaSnapshotVerificationReport} from './scripts/ci/check-db-schema-snapshot.ts'; const report=createSchemaSnapshotVerificationReport(readFileSync(process.env.DIRECTORY_SCHEMA_ACTUAL_FILE,'utf8'),readFileSync('docs/development/studio-db-schema-final.sql','utf8')); console.log(report); if(report.status!=='ok') process.exit(1);"
cd "$package_dir"
IAM_DATABASE_URL="$url" IAM_DIRECTORY_TEST_DATABASE_URL="$url" IAM_PII_ACTIVE_KEY_ID=identity-test IAM_PII_KEYRING_JSON='{"identity-test":"MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="}' pnpm exec vitest run src/iam-authorization/permission-directory.integration.test.ts --config vitest.config.ts
