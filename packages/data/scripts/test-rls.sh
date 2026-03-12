#!/usr/bin/env bash
set -euo pipefail

POSTGRES_DB="${POSTGRES_DB:-sva_studio}"
POSTGRES_USER="${POSTGRES_USER:-sva}"

if [ -z "$(docker compose ps -q postgres)" ]; then
  echo "Postgres container is not running. Start it with: pnpm nx run data:db:up"
  exit 1
fi

bash packages/data/scripts/run-migrations.sh up

docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
TRUNCATE iam.activity_logs, iam.role_permissions, iam.account_roles, iam.account_organizations,
  iam.instance_memberships, iam.permissions, iam.roles, iam.organizations, iam.accounts, iam.instances
  RESTART IDENTITY CASCADE;

INSERT INTO iam.instances(id, display_name)
VALUES
  ('instance-a', 'Instance A'),
  ('instance-b', 'Instance B');

INSERT INTO iam.organizations(id, instance_id, organization_key, display_name)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'instance-a', 'orga', 'Org A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'instance-b', 'orgb', 'Org B');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iam_escalation_target') THEN
    CREATE ROLE iam_escalation_target NOLOGIN NOINHERIT;
  END IF;
END
$$;

REVOKE iam_escalation_target FROM iam_app;
SQL

visible_for_a=$(docker compose exec -T postgres psql -tA -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
SET ROLE iam_app;
SET app.instance_id = 'instance-a';
SELECT count(*) FROM iam.organizations;
SQL
)
visible_for_a="$(echo "${visible_for_a}" | tail -n 1 | tr -d '[:space:]')"

if [ "${visible_for_a}" != "1" ]; then
  echo "RLS isolation failed: expected 1 organization for instance A, got ${visible_for_a}"
  exit 1
fi

visible_without_context=$(docker compose exec -T postgres psql -tA -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
SET ROLE iam_app;
RESET app.instance_id;
SELECT count(*) FROM iam.organizations;
SQL
)
visible_without_context="$(echo "${visible_without_context}" | tail -n 1 | tr -d '[:space:]')"

if [ "${visible_without_context}" != "0" ]; then
  echo "Fail-closed check failed: expected 0 rows without instance context, got ${visible_without_context}"
  exit 1
fi

role_hardening=$(docker compose exec -T postgres psql -tA -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
SELECT CASE WHEN rolsuper OR rolbypassrls THEN 'bad' ELSE 'ok' END
FROM pg_roles
WHERE rolname = 'iam_app';
SQL
)
role_hardening="$(echo "${role_hardening}" | tail -n 1 | tr -d '[:space:]')"

if [ "${role_hardening}" != "ok" ]; then
  echo "Role hardening failed: iam_app must not be SUPERUSER or BYPASSRLS"
  exit 1
fi

superuser_visibility=$(docker compose exec -T postgres psql -tA -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
SELECT count(*) FROM iam.organizations;
SQL
)
superuser_visibility="$(echo "${superuser_visibility}" | tail -n 1 | tr -d '[:space:]')"

if [ "${superuser_visibility}" != "2" ]; then
  echo "Superuser bypass expectation failed: expected superuser to see 2 organizations, got ${superuser_visibility}"
  exit 1
fi

membership_guard=$(docker compose exec -T postgres psql -tA -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
SELECT CASE
  WHEN pg_has_role('iam_app', 'iam_escalation_target', 'member') THEN 'bad'
  WHEN (SELECT rolcreaterole FROM pg_roles WHERE rolname = 'iam_app') THEN 'bad'
  ELSE 'ok'
END;
SQL
)
membership_guard="$(echo "${membership_guard}" | tail -n 1 | tr -d '[:space:]')"

if [ "${membership_guard}" != "ok" ]; then
  echo "Privilege escalation check failed: iam_app must not have CREATEROLE or privileged role memberships"
  exit 1
fi

if docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
SET ROLE iam_app;
CREATE ROLE iam_escalation_probe;
SQL
then
  echo "Privilege escalation check failed: iam_app must not be able to CREATE ROLE"
  exit 1
fi

echo "RLS tests passed (isolation, fail-closed, role hardening, superuser-bypass risk awareness, privilege-escalation guards)."
