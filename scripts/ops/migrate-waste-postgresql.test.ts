import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./migrate-waste-postgresql.sh', import.meta.url), 'utf8');

describe('Waste-PostgreSQL-Cutover-Skript', () => {
  it('sichert ausschließlich Waste-Tabellen mit einem zur Quelle passenden Client', () => {
    expect(source).toContain('source_client_major < source_server_major');
    expect(source).toContain("--table='public.waste_*'");
    expect(source).toContain('--format=custom');
    expect(source).toContain('--strict-names');
  });

  it('trennt das unveränderte Quellbackup vom datenorientierten Zielimport', () => {
    expect(source).toContain('--format=plain --data-only --column-inserts');
    expect(source).toContain("sed '/^SET transaction_timeout = 0;$/d'");
    expect(source).toContain('--single-transaction --file="$target_data"');
    expect(source).not.toContain('pg_restore "service=$TARGET_PGSERVICE"');
  });

  it('verweigert den Import in eine bereits befüllte Waste-Zieldatenbank', () => {
    expect(source).toContain('if [[ "$target_rows" != "0" ]]');
    expect(source).toContain('Die vorbereitete Zieldatenbank enthält bereits Waste-Daten');
  });

  it('bindet den Einmallauf an Registry, Instanz, Datenbank und Migrationsrolle von bb-prignitz', () => {
    expect(source).toContain("expected_instance_id='bb-prignitz'");
    expect(source).toContain('iam.instance_waste_provisioning');
    expect(source).toContain('status = \'ready\'');
    expect(source).toContain('registry_database" != "$target_database');
    expect(source).toContain('expected_target_user="${target_database%_db}_migrator"');
  });

  it('prüft Erweiterungen, Schemaausgangszustand und freien Speicher vor dem Import', () => {
    expect(source).toContain('comm -23 "$source_extensions" "$target_extensions"');
    expect(source).toContain('comm -23 "$source_tables" "$target_tables"');
    expect(source).toContain('required_bytes="$((dump_bytes * 3))"');
    expect(source.indexOf('WASTE_TARGET_AVAILABLE_BYTES < required_bytes')).toBeLessThan(
      source.indexOf('--single-transaction --file="$target_data"')
    );
  });

  it('schreibt redigierte tenantbezogene Migrationsevidenz', () => {
    expect(source).toContain('migration-evidence.json');
    expect(source).toContain('instanceId');
    expect(source).toContain('databaseName');
    expect(source).not.toContain('SUPABASE_SECRET_KEY');
  });
});
