# Change: DSR-Persistenzprimitiven zentralisieren

## Why

Legal-Hold-Prüfung, DSR-Request-Events und DSR-Audit-Events sind in mehreren produktiven Modulen als identische SQL-Verträge dupliziert. Eine spätere Drift bei Mandantenbindung, Kontextkorrelation oder JSON-Serialisierung würde Datenschutz- und Nachweisrisiken erzeugen.

## What Changes

- `@sva/iam-governance` erhält ein einziges, framework-agnostisches Modul für die drei bestehenden DSR-Persistenzprimitiven.
- Auth-Runtime, DSR-Export und DSR-Wartung verwenden diese Primitiven ohne Änderung an SQL, Parametern, Aufrufreihenfolge oder Fehlerpropagation.
- Characterization-Tests sichern Legal-Hold-, Mandanten-, Kontext-, Fehler- und Reihenfolgeverträge ab.

## Impact

- Affected specs: `iam-server-modularization`
- Affected code: `packages/iam-governance/src/dsr-persistence.ts`, `packages/iam-governance/src/dsr-maintenance.ts`, `packages/iam-governance/src/dsr-export-flows.ts`, `packages/auth-runtime/src/iam-data-subject-rights/core.ts`
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`
- Affected ADR: `ADR-017-modulare-iam-server-bausteine`
- Datenbankschema und öffentliche HTTP-Verträge bleiben unverändert.
