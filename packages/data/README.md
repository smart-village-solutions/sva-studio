# @sva/data

`@sva/data` ist ein historisches Kompatibilitäts- und Betriebs-Package. Neue Datenzugriffe sollen nicht mehr hier angebunden werden; stattdessen verweist das Package auf die getrennten Zielrollen für Client- und Server-Datenzugriffe und hält weiterhin die etablierten Datenbank-Targets für Migrationen, Seeds und lokale Betriebsabläufe bereit.

## Architektur-Rolle

Nach dem Package-Hard-Cut ist `@sva/data` kein Zielpackage für neue Fachlogik mehr. Die zuvor gebündelten Verantwortlichkeiten wurden auf spezialisierte Workspace-Packages verteilt:

| Aufgabe | Zielpackage |
| --- | --- |
| Client-sicherer HTTP-Client, Cache und Runtime-Schema-Validierung | `@sva/data-client` |
| Serverseitige Postgres-Repositories, DB-Operationen und migrationsnahe Typen | `@sva/data-repositories` |

Neue Consumer importieren die passende Zielrolle direkt. `@sva/data` bleibt relevant für Altpfade, bewusst erhaltene Kompatibilität und die historisch daran gebundenen Datenbank-Workflows.

## Öffentliche API

Die öffentliche API ist bewusst schmal und fungiert vor allem als Re-Export-Fassade:

| Export | Zweck |
| --- | --- |
| `@sva/data` | Re-exportiert `createDataClient` und `DataClientOptions` aus `@sva/data-client` sowie die öffentliche API aus `@sva/data-repositories` |
| `@sva/data/server` | Re-exportiert die Server-API aus `@sva/data-repositories/server` |

Für neue Implementierungen sollten die Zielpackages direkt referenziert werden, damit Abhängigkeiten und Verantwortlichkeiten explizit bleiben.

## Nutzung und Integration

`@sva/data` wird vor allem in zwei Situationen verwendet:

1. Bestehende Consumer benötigen weiterhin kompatible Importpfade.
2. Das Nx-Projekt `data` bleibt Träger der lokalen Datenbank- und Migrations-Targets.

Für neue Integrationen gilt:

- Client-Zugriffe direkt über `@sva/data-client` anbinden.
- Repository- und Server-Zugriffe direkt über `@sva/data-repositories` beziehungsweise `@sva/data-repositories/server` anbinden.
- Datenbank-Migrationen, Seeds und lokale Prüfskripte weiterhin über die Nx-Targets des Projekts `data` ausführen.

## Projektstruktur

Die Struktur des Packages spiegelt sowohl die verbliebene Kompatibilitätsschicht als auch die betriebliche Verantwortung für die Datenbank-Assets wider:

| Pfad | Inhalt |
| --- | --- |
| `src/index.ts` | Öffentliche Compat-Fassade für Client- und Repository-Exporte |
| `src/server.ts` | Serverseitige Compat-Fassade |
| `src/iam/`, `src/instance-registry/`, `src/integrations/` | Historische paketinterne Fach- und Testartefakte rund um IAM, Instanzregister und Integrationen |
| `migrations/` | Kanonische SQL-Migrationen |
| `seeds/` | Idempotente Seed-Daten für lokale und Test-Umgebungen |
| `scripts/` | Shell- und Node-Skripte für Migrationen, Seeds und Datenbank-Checks |

## Nx-Konfiguration

- **Projektname:** `data`
- **Typ:** Library
- **Source Root:** `packages/data/src`
- **Tags:** `scope:data`, `type:lib`

Wichtige Standard-Targets:

| Target | Beschreibung |
| --- | --- |
| `pnpm nx run data:build` | Baut das Package über `tsc -p packages/data/tsconfig.lib.json` |
| `pnpm nx run data:check:runtime` | Prüft die Server-Runtime-Kompatibilität des Packages |
| `pnpm nx run data:lint` | Führt ESLint für `packages/data/src` aus |
| `pnpm nx run data:test:unit` | Startet die paketinternen Node-Unit-Tests |
| `pnpm nx run data:test:coverage` | Führt die Vitest-Coverage-Suite aus |
| `pnpm nx run data:test:integration` | Prüft Seed-Integration über das Shell-Skript des Packages |

Datenbank- und Betriebs-Targets:

| Target | Beschreibung |
| --- | --- |
| `pnpm nx run data:db:up` | Startet Postgres lokal via Docker Compose |
| `pnpm nx run data:db:down` | Stoppt den lokalen Postgres-Container |
| `pnpm nx run data:db:status` | Zeigt den Status des lokalen Postgres-Containers |
| `pnpm nx run data:db:logs` | Gibt die letzten Postgres-Logs aus |
| `pnpm nx run data:db:migrate` | Führt die kanonischen Migrationen aus |
| `pnpm nx run data:db:migrate:up` | Führt Migrationen explizit in Up-Richtung aus |
| `pnpm nx run data:db:migrate:down` | Führt den Rollback bis Version `0` aus |
| `pnpm nx run data:db:migrate:status` | Zeigt den `goose`-Migrationsstatus |
| `pnpm nx run data:db:migrate:validate` | Prüft den Zyklus `up -> down -> up` auf einer temporären Datenbank |
| `pnpm nx run data:db:seed` | Führt die Seed-Skripte aus |
| `pnpm nx run data:db:test:seeds` | Testet die Seeds gegen eine Datenbank |
| `pnpm nx run data:db:test:encryption` | Prüft Verschlüsselungs-bezogene Datenbankpfade |
| `pnpm nx run data:db:test:rls` | Prüft RLS-bezogene Datenbankpfade |
| `pnpm nx run data:db:bootstrap-app-user` | Erstellt beziehungsweise aktualisiert den App-User für lokale Nutzung |
| `pnpm nx run data:db:reset` | Setzt den lokalen Postgres-Container samt Volume zurück |

## Verwandte Dokumentation

- [Package-Zielarchitektur](../../docs/architecture/package-zielarchitektur.md)
- [Bausteinsicht (arc42 §5)](../../docs/architecture/05-building-block-view.md)
- [IAM-Datenklassifizierung](../../docs/architecture/iam-datenklassifizierung.md)
- [Postgres-Setup](../../docs/development/postgres-setup.md)
