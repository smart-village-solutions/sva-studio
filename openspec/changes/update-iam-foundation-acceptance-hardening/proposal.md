# Change: Abnahme- und Readiness-Härtung für IAM-Basis und Organisationsverwaltung

## Why

Die Angebotsbausteine 1 und 2 sind im Code weitgehend vorhanden, aber ihr Abnahmestand ist nicht als reproduzierbarer, automatisierter Nachweis im Projekt verankert. Es fehlen verbindliche Acceptance-Gates für Keycloak-Realm, OIDC-Claims, Login-zu-Account-Sync sowie Organisations- und Membership-Smokes in der vereinbarten Testumgebung.

## What Changes

- Verbindlichen Abnahmenachweis für Paket 1 als automatisierbaren Smoke- und Readiness-Flow spezifizieren
- Verbindlichen Abnahmenachweis für Paket 2 als API-, UI- und Datenmodell-Smoke spezifizieren
- Testumgebungs- und Seed-Kontrakt für Keycloak-Realm, Test-User, Instanz und Organisationshierarchie präzisieren
- Versionierte Abnahmeberichte und CI-/lokale Gate-Ausführung als Lieferartefakt festlegen

## Impact

- Affected specs:
  - `iam-core`
  - `iam-organizations`
- Affected code:
  - `packages/auth`
  - `packages/data`
  - `apps/sva-studio-react`
  - `docs/reports`
  - `docs/guides`
- Affected arc42 sections:
  - `05-building-block-view`
  - `06-runtime-view`
  - `07-deployment-view`
  - `08-cross-cutting-concepts`
  - `10-quality-requirements`

## Dependencies

- Nutzt den bestehenden Stand aus `iam-core`, `add-keycloak-user-import-sync` und `add-iam-organization-management-hierarchy`
- Erzeugt keine neue Fachfunktion, sondern schließt Liefer- und Abnahmefähigkeit

## Risiken und Gegenmaßnahmen

- Unterschied zwischen lokaler und echter Testumgebung: ein einheitlicher Environment-Kontrakt mit Pflichtdaten reduziert Drift
- Falsches Sicherheitsgefühl durch rein unit-testbasierte Nachweise: nur kombinierte Runtime-Smokes gelten als Abnahmebeleg
- Flaky externe Keycloak-Abhängigkeit: klare Retry-/Timeout-Regeln und dokumentierte Failure-Codes werden Teil des Acceptance-Gates

## Approval Gate

Vor Start der Implementierung müssen folgende Punkte bestätigt sein:

1. Paket 1 und 2 werden über automatisierte Abnahmeflüsse finalisiert, nicht nur über manuelle Stichproben.
2. Die vereinbarte Testumgebung enthält einen dedizierten Keycloak-Realm, Test-Clients und stabile Seed-Daten.
3. Der Abnahmenachweis gilt erst dann als erbracht, wenn API, UI und Datenbankzustand gemeinsam verifiziert sind.
4. Abnahmeberichte werden versioniert unter `docs/reports/` abgelegt.
