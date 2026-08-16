# Plan 029: Waste-Tenant-Datenbankkennungen linear ableiten

## Status

- **Priorität**: P1
- **Aufwand**: S
- **Risiko**: hoch
- **Abhängigkeit**: Plan 027; keine Source-Überschneidung mit #983/#984 vor Start erneut belegen
- **Kategorie**: Datenintegrität / algorithmische Security
- **Geplant auf**: `960955af8`, 15. August 2026
- **Sonar**: `AZ_DlvT3UItUTMcRH3zS`, `typescript:S8786`

## Warum das wichtig ist

Die Normalisierung von `instanceId` bestimmt unveränderliche PostgreSQL-Datenbank- und Rollenkennungen. Ein semantischer Drift könnte bestehende Tenant-Datenbanken unerreichbar machen; zugleich darf sehr lange Eingabe nicht superlinear laufen.

## Aktueller Zustand und Scope

- `packages/server-runtime/src/waste/tenant-database-identifiers.server.ts:15-21`: Nicht-Alphanumerik wird gruppiert ersetzt und Rand-Unterstriche werden per Alternationsregex entfernt.
- `packages/server-runtime/src/waste/tenant-database-identifiers.server.test.ts`: nur ein normaler Stabilitätsfall.
- In Scope ausschließlich diese Source-/Testdatei plus zwingende Doku/Changelog. Out of Scope: Provisioner, Migrationen, Compose, Schema, Rollenrechte, Hashalgorithmus, Namenlängen.

## Characterization und Umsetzung

1. Baseline des fokussierten `server-runtime`-Tests grün.
2. Exakte Ausgaben für ASCII, Unicode/NFKD, nur Trennzeichen, führende/abschließende Trennzeichen, digit-start, leere und sehr lange/adversarial geformte Eingaben charakterisieren; Längen und Identifier-Pattern für alle fünf Namen prüfen. Neue Tests zuerst am Altcode ausführen.
3. Nur den S8786-Auslöser linear ersetzen; Hash, Präfixe, Suffixe und `identifierPattern` unverändert lassen.
4. Gates: fokussierte Unit, Types, Lint, Build, `server-runtime:check:runtime`, `pnpm check:server-runtime`, Fallow-New-only `server-runtime`, OpenSpec strict/all, File Placement, Changelog, `git diff --check`.

## Erwartete Wirkung

1 S8786 verschwindet; alle abgeleiteten DB-/Rollennamen bleiben bytegleich. Fallow PASS ohne neue Findings.

## STOP-Bedingungen

- Ein charakterisierter Name unterscheidet sich nach dem Refactor.
- #983/#984 oder ein aktiver OpenSpec berührt die Kennungsableitung oder Fixtures.
- Schema-/Provisioneränderung wird nötig.

