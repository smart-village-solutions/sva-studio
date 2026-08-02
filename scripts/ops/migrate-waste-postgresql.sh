#!/usr/bin/env bash
set -Eeuo pipefail

: "${SOURCE_PGSERVICE:?SOURCE_PGSERVICE muss auf den libpq-Service der Supabase-Quelle zeigen}"
: "${TARGET_PGSERVICE:?TARGET_PGSERVICE muss auf den libpq-Service sva_waste zeigen}"
: "${WASTE_MIGRATION_DIR:?WASTE_MIGRATION_DIR muss auf ein leeres, geschütztes Arbeitsverzeichnis zeigen}"

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

source_server_major="$(psql "service=$SOURCE_PGSERVICE" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align --command="SHOW server_version_num" | cut -c1-2)"
source_client_major="$($source_pg_dump --version | sed -E 's/.* ([0-9]+)(\..*)?$/\1/')"
target_server_major="$(psql "service=$TARGET_PGSERVICE" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align --command="SHOW server_version_num" | cut -c1-2)"

if (( source_client_major < source_server_major )); then
  echo "pg_dump $source_client_major kann die PostgreSQL-$source_server_major-Quelle nicht sichern. SOURCE_PG_BIN muss auf einen passenden Client zeigen." >&2
  exit 2
fi

psql "service=$SOURCE_PGSERVICE" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --file=scripts/ops/waste-postgresql-inventory.sql >"$source_inventory"

"$source_pg_dump" "service=$SOURCE_PGSERVICE" \
  --format=custom --compress=9 --no-owner --no-privileges --strict-names \
  --table='public.waste_*' --file="$dump_path"
"$source_pg_restore" --list "$dump_path" >"$dump_contents"

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

echo "Waste-Quellbackup, PG16-kompatibles Datenartefakt und identische Quelltabellen wurden nachgewiesen: $WASTE_MIGRATION_DIR"
