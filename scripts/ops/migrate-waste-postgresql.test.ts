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
});
