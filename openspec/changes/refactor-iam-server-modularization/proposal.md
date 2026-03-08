# Change: Modulare Zerlegung des IAM-Servers

## Why

Die bestehende IAM-Server-Schicht in `packages/auth` und angrenzend in `packages/data` enthält mehrere Hotspots mit hoher struktureller Komplexität, breiten Exportflächen und fachlich vermischten Verantwortungen. Die bestehende Komplexitäts-Governance macht diese Altlasten sichtbar, löst aber noch nicht die zugrunde liegende Architekturursache.

Besonders `iam-account-management.server.ts`, `iam-data-subject-rights.server.ts` und `iam-governance.server.ts` bündeln heute mehrere fachliche Verantwortungen in einzelnen Dateien. Dadurch steigen Änderungsrisiko, Review-Aufwand, Regression-Risiko und die Wahrscheinlichkeit für doppelt implementierte Hilfslogik in sicherheits- und domänenkritischen Pfaden.

## What Changes

- Einführung einer verbindlichen Zielarchitektur für fachlich fokussierte IAM-Server-Module
- Aufteilung des bisherigen IAM-Account-Management-Servers in dedizierte Module, z. B.:
  - Benutzerverwaltung
  - Rollenverwaltung
  - Profilverwaltung
  - Bulk-Operationen
  - Feature-Flags
  - Rate-Limiting
  - Schemadefinitionen und Payload-Validierung
- Klare öffentliche API-Schnittstellen pro Modul statt breit gestreuter Direktimporte und Barrel-Exports
- Kapselung gemeinsamer Hilfslogik in dedizierten Shared-Modulen, insbesondere für:
  - Maskierung und Redaction
  - Parsing und Input-Reading
  - Validierung und Schemas
  - Rate-Limit-Logik
  - Logging- und Request-Kontext
- Risikobasierter Refactoring-Fahrplan für die bestehenden Findings `QUAL-101` bis `QUAL-109`
- Verankerung der modularen Zielarchitektur in ADR, arc42 und OpenSpec

## Priorisierte Ausgangslage

Die folgenden Hotspots werden nach Risiko priorisiert und als Leitlinie für die Umsetzungsreihenfolge verwendet:

| Priorität | Datei | Ist / Soll | Ticket |
| --- | --- | --- | --- |
| 1 | `packages/auth/src/iam-account-management.server.ts` | `fileLines 4508/350`, `functionLines 327/90`, `cyclomaticComplexity 42/15`, `publicExports 20/12` | `QUAL-101` |
| 2 | `packages/auth/src/iam-data-subject-rights.server.ts` | `fileLines 1999/350`, `functionLines 151/90`, `cyclomaticComplexity 22/15` | `QUAL-103` |
| 3 | `packages/auth/src/iam-governance.server.ts` | `fileLines 1248/350`, `functionLines 126/90`, `cyclomaticComplexity 23/15` | `QUAL-104` |
| 4 | `packages/auth/src/keycloak-admin-client.ts` | `fileLines 804/350` | `QUAL-108` |
| 5 | `packages/auth/src/iam-authorization.server.ts` | `fileLines 564/350`, `functionLines 113/90`, `cyclomaticComplexity 20/15` | `QUAL-102` |
| 6 | `packages/auth/src/routes.server.ts` | `fileLines 524/350`, `functionLines 120/90` | `QUAL-109` |
| 7 | `packages/auth/src/index.server.ts` | `publicExports 65/12` | `QUAL-105` |
| 8 | `packages/auth/src/auth.server.ts` | `cyclomaticComplexity 27/15` | `QUAL-106` |
| 9 | `packages/data/src/iam/repositories.ts` | `fileLines 270/260` | `QUAL-107` |

Hinweis:
- Diese Priorisierung beschreibt die architektonische Remediation-Reihenfolge.
- Die finale technische Abnahme bleibt an die zentrale Policy unter `tooling/quality/complexity-policy.json` gekoppelt.

## Out of Scope

- Keine fachlichen Erweiterungen des IAM-Umfangs
- Keine Änderung der bestehenden IAM-API-Verträge ohne separat dokumentierte Vertragsänderung
- Keine Ablösung der bestehenden Komplexitäts-Governance oder Coverage-Governance
- Keine Big-Bang-Neuschreibung des IAM-Pakets ohne schrittweise Migration und Testabsicherung

## Impact

- **Affected specs**:
  - `iam-server-modularization` (neu)
- **Affected code**:
  - `packages/auth/src/iam-account-management.server.ts`
  - `packages/auth/src/iam-data-subject-rights.server.ts`
  - `packages/auth/src/iam-governance.server.ts`
  - `packages/auth/src/keycloak-admin-client.ts`
  - `packages/auth/src/iam-authorization.server.ts`
  - `packages/auth/src/routes.server.ts`
  - `packages/auth/src/index.server.ts`
  - `packages/auth/src/auth.server.ts`
  - `packages/data/src/iam/repositories.ts`
- **Affected arc42 sections**:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`

## Success Criteria

- Der IAM-Server ist in klar abgegrenzte Fachmodule mit wohldefinierten öffentlichen APIs zerlegt.
- Gemeinsame Hilfslogik für Parsing, Validierung, Redaction, Rate-Limits und Logging-Kontext ist zentral gekapselt und nicht mehrfach implementiert.
- Die priorisierten Findings `QUAL-101` bis `QUAL-109` sind in eine nachvollziehbare Migrationsreihenfolge überführt.
- Die Zielarchitektur ist in ADR, arc42-Bausteinsicht und OpenSpec konsistent dokumentiert.
- Residuale Grenzwertüberschreitungen bleiben nur mit explizitem Ticketbezug und begründeter Restschuld zulässig.
