#!/usr/bin/env bash
set -Eeuo pipefail

: "${SOURCE_PGSERVICE:?SOURCE_PGSERVICE muss auf den libpq-Service der Supabase-Quelle zeigen}"
: "${STUDIO_PGSERVICE:?STUDIO_PGSERVICE muss auf die zentrale Studio-Datenbank zeigen}"
: "${TARGET_PGSERVICE:?TARGET_PGSERVICE muss auf die provisionierte Waste-Zieldatenbank zeigen}"
: "${WASTE_TENANT_INSTANCE_ID:?WASTE_TENANT_INSTANCE_ID muss gesetzt sein}"
: "${WASTE_MIGRATION_DIR:?WASTE_MIGRATION_DIR muss auf ein leeres, geschütztes Arbeitsverzeichnis zeigen}"
: "${WASTE_TARGET_AVAILABLE_BYTES:?WASTE_TARGET_AVAILABLE_BYTES muss den vorab auf dem PostgreSQL-Host ermittelten freien Speicher angeben}"

expected_instance_id='bb-prignitz'
if [[ "$WASTE_TENANT_INSTANCE_ID" != "$expected_instance_id" ]]; then
  echo "Dieser Einmalmigrationslauf ist ausschließlich an bb-prignitz gebunden." >&2
  exit 2
fi
if [[ ! "$WASTE_TARGET_AVAILABLE_BYTES" =~ ^[0-9]+$ ]]; then
  echo "WASTE_TARGET_AVAILABLE_BYTES muss eine nichtnegative Ganzzahl sein." >&2
  exit 2
fi

SOURCE_PG_BIN="${SOURCE_PG_BIN:-}"
source_pg_dump="${SOURCE_PG_BIN:+$SOURCE_PG_BIN/}pg_dump"
source_pg_restore="${SOURCE_PG_BIN:+$SOURCE_PG_BIN/}pg_restore"

for command_path in "$source_pg_dump" "$source_pg_restore" psql node; do
  if ! command -v "$command_path" >/dev/null 2>&1; then
    echo "Erforderliches Werkzeug fehlt: $command_path" >&2
    exit 2
  fi
done

if [[ ! -d "$WASTE_MIGRATION_DIR" ]] || [[ -n "$(find "$WASTE_MIGRATION_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
  echo "WASTE_MIGRATION_DIR muss existieren und leer sein." >&2
  exit 2
fi

dump_path="$WASTE_MIGRATION_DIR/waste-source.dump"
dump_contents="$WASTE_MIGRATION_DIR/waste-source.contents"
source_data="$WASTE_MIGRATION_DIR/waste-data.sql"
target_data="$WASTE_MIGRATION_DIR/waste-data-target.sql"
source_inventory="$WASTE_MIGRATION_DIR/source-inventory.json"
target_inventory="$WASTE_MIGRATION_DIR/target-inventory.json"
source_extensions="$WASTE_MIGRATION_DIR/source-extensions.txt"
target_extensions="$WASTE_MIGRATION_DIR/target-extensions.txt"
migration_evidence="$WASTE_MIGRATION_DIR/migration-evidence.json"
source_tables="$WASTE_MIGRATION_DIR/source-tables.txt"
target_tables="$WASTE_MIGRATION_DIR/target-tables.txt"

source_server_major="$(psql "service=$SOURCE_PGSERVICE" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align --command="SHOW server_version_num" | cut -c1-2)"
source_client_major="$($source_pg_dump --version | sed -E 's/.* ([0-9]+)(\..*)?$/\1/')"
target_server_major="$(psql "service=$TARGET_PGSERVICE" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align --command="SHOW server_version_num" | cut -c1-2)"
registry_database="$(psql "service=$STUDIO_PGSERVICE" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align --command="SELECT database_name FROM iam.instance_waste_provisioning WHERE instance_id = 'bb-prignitz' AND status = 'ready'")"
target_database="$(psql "service=$TARGET_PGSERVICE" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align --command='SELECT current_database()')"
target_user="$(psql "service=$TARGET_PGSERVICE" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align --command='SELECT current_user')"

if [[ -z "$registry_database" ]] || [[ "$registry_database" != "$target_database" ]]; then
  echo "Die Zieldatenbank stimmt nicht mit der ready-Registry von bb-prignitz überein." >&2
  exit 2
fi
expected_target_user="${target_database%_db}_migrator"
if [[ "$target_user" != "$expected_target_user" ]]; then
  echo "TARGET_PGSERVICE muss die tenantgebundene Migrationsrolle verwenden." >&2
  exit 2
fi

if (( source_client_major < source_server_major )); then
  echo "pg_dump $source_client_major kann die PostgreSQL-$source_server_major-Quelle nicht sichern. SOURCE_PG_BIN muss auf einen passenden Client zeigen." >&2
  exit 2
fi

psql "service=$SOURCE_PGSERVICE" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --file=scripts/ops/waste-postgresql-inventory.sql >"$source_inventory"
psql "service=$SOURCE_PGSERVICE" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --command="SELECT extname FROM pg_extension WHERE extname <> 'plpgsql' ORDER BY extname" >"$source_extensions"
psql "service=$TARGET_PGSERVICE" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --command="SELECT extname FROM pg_extension WHERE extname <> 'plpgsql' ORDER BY extname" >"$target_extensions"
if [[ -n "$(comm -23 "$source_extensions" "$target_extensions")" ]]; then
  echo "In der Zieldatenbank fehlen von der Quelle benötigte PostgreSQL-Erweiterungen." >&2
  exit 2
fi
psql "service=$SOURCE_PGSERVICE" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --command="SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'waste\_%' ESCAPE '\\' ORDER BY table_name" >"$source_tables"
psql "service=$TARGET_PGSERVICE" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --command="SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'waste\_%' ESCAPE '\\' ORDER BY table_name" >"$target_tables"
if [[ ! -s "$source_tables" ]] || [[ -n "$(comm -23 "$source_tables" "$target_tables")" ]]; then
  echo "Das provisionierte Zielschema enthält nicht alle Waste-Quelltabellen." >&2
  exit 2
fi

"$source_pg_dump" "service=$SOURCE_PGSERVICE" \
  --format=custom --compress=9 --no-owner --no-privileges --strict-names \
  --table='public.waste_*' --file="$dump_path"
"$source_pg_restore" --list "$dump_path" >"$dump_contents"
dump_bytes="$(wc -c <"$dump_path" | tr -d ' ')"
required_bytes="$((dump_bytes * 3))"
if (( WASTE_TARGET_AVAILABLE_BYTES < required_bytes )); then
  echo "Der vorab ermittelte freie Zielspeicher reicht für Dump, Restore und Sicherheitsreserve nicht aus." >&2
  exit 2
fi

"$source_pg_dump" "service=$SOURCE_PGSERVICE" \
  --format=plain --data-only --column-inserts --no-owner --no-privileges --strict-names \
  --table='public.waste_*' --file="$source_data"

if (( target_server_major < 17 )); then
  sed '/^SET transaction_timeout = 0;$/d' "$source_data" >"$target_data"
else
  cp "$source_data" "$target_data"
fi

target_rows="$(psql "service=$TARGET_PGSERVICE" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align <<'SQL'
SELECT COALESCE(sum((xpath('/row/count/text()', query_to_xml(
  format('SELECT count(*) AS count FROM %I.%I', table_schema, table_name),
  false, true, ''
)))[1]::text::bigint), 0)
FROM information_schema.tables
WHERE table_schema = current_schema()
  AND table_type = 'BASE TABLE'
  AND table_name LIKE 'waste\_%' ESCAPE '\';
SQL
)"
if [[ "$target_rows" != "0" ]]; then
  echo "Die vorbereitete Zieldatenbank enthält bereits Waste-Daten ($target_rows Zeilen)." >&2
  exit 2
fi

psql "service=$TARGET_PGSERVICE" --no-psqlrc --set=ON_ERROR_STOP=1 \
  --single-transaction --file="$target_data"

psql "service=$TARGET_PGSERVICE" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --file=scripts/ops/waste-postgresql-inventory.sql >"$target_inventory"

node --import tsx scripts/ops/verify-waste-postgresql-migration.ts \
  "$source_inventory" "$target_inventory"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$dump_path" "$source_data" "$target_data" >"$WASTE_MIGRATION_DIR/sha256sums.txt"
else
  shasum -a 256 "$dump_path" "$source_data" "$target_data" >"$WASTE_MIGRATION_DIR/sha256sums.txt"
fi

node -e '
const [path, instanceId, databaseName, sourceMajor, targetMajor, dumpVersion, dumpBytes, availableBytes] = process.argv.slice(1);
const evidence = {
  version: 1,
  status: "verified",
  instanceId,
  databaseName,
  sourceServerMajor: Number(sourceMajor),
  targetServerMajor: Number(targetMajor),
  dumpClientVersion: dumpVersion,
  dumpBytes: Number(dumpBytes),
  targetAvailableBytes: Number(availableBytes),
  completedAt: new Date().toISOString(),
};
require("node:fs").writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
' "$migration_evidence" "$WASTE_TENANT_INSTANCE_ID" "$target_database" "$source_server_major" "$target_server_major" "$($source_pg_dump --version)" "$dump_bytes" "$WASTE_TARGET_AVAILABLE_BYTES"

echo "Waste-Quellbackup, tenantgebundenes Ziel und identische Quelltabellen wurden für bb-prignitz nachgewiesen: $WASTE_MIGRATION_DIR"
