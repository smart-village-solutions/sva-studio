# IAM-Service-Architektur

## Ziel und Einordnung

Dieses Dokument bündelt das technische Zielbild für den IAM-Service im SVA Studio. Es ergänzt die arc42-Abschnitte um eine zusammenhängende Detaildarstellung für:

- Gesamtarchitektur des IAM-Service
- Permission Engine inklusive RBAC-/ABAC-Auswertung
- logisches Datenmodell auf Postgres-Basis

Das Dokument ist eine dauerhafte Architekturreferenz. Änderungsbezogene Entwurfsdetails verbleiben zusätzlich in OpenSpec-Changes und ADRs.

## Scope

Im Scope:

- Identity-Kontext aus Keycloak/OIDC als Eingang in den IAM-Pfad
- IAM-Serverbausteine für Nutzer-, Rollen- und Berechtigungsverwaltung
- zentrale Authorize-Strecke (`POST /iam/authorize`, `GET /iam/me/permissions`)
- logisches Datenmodell im `iam`-Schema
- Mandantenisolierung über `instanceId`
- Betriebsrelevante Konzepte für Audit, Logging, Cache und Reconciliation

Außerhalb des Scopes:

- Keycloak-interne Realm-Konfiguration im Detail
- vollständige UI-Spezifikation der Admin-Oberflächen
- konkrete Produktiv-Topologie jenseits der aktuell dokumentierten Betriebsgrenzen

## Architekturprinzipien

- `instanceId` ist der kanonische Mandanten-Scope.
- Identity und fachliche Autorisierung sind getrennt.
- Die Permission Engine bleibt logisch zentral, damit Fachmodule keine eigenen Berechtigungsregeln duplizieren.
- Postgres ist das führende Persistenzsystem für IAM-Daten; Keycloak bleibt führend für Authentifizierung und IdP-nahe Benutzer-/Rollenoperationen.
- Sicherheitskritische Pfade arbeiten fail-closed.
- Operative Nachvollziehbarkeit erfolgt über Dual-Write-Audit und strukturierte Logs.

## Systemkontext

### Externe und angrenzende Systeme

- Keycloak als zentraler Identity Provider für OIDC und administrative IdP-Operationen
- Postgres als persistente IAM-Datenbank
- Redis als Snapshot-Cache für effektive Berechtigungen
- OTEL/Monitoring-Stack für Logs, Metriken und Traces
- SVA-Studio-Frontend als aufrufender Client für Self-Service- und Admin-Flows

### Führende Systeme pro Verantwortung

| Verantwortung | Führendes System |
| --- | --- |
| Authentifizierung, Session-Einstieg, Token-Claims | Keycloak |
| IAM-Fachdaten, Rollenkatalog, Zuordnungen, Audit | Postgres |
| Schnelle Laufzeitauflösung effektiver Rechte | Redis-Cache auf Basis Postgres |
| Fachliche Autorisierungsentscheidung | IAM Permission Engine |

## Bausteinsicht des IAM-Service

### 1. Identity-Eingang

- OIDC-Login und Session-Auflösung liefern den verlässlichen Identity-Kontext.
- Mindestkontext für nachgelagerte Pfade: `sub`, `instanceId`, Session-/Request-Kontext.

### 2. IAM-Account- und Rollenmanagement

- Verwaltet Benutzerprofile, Rollenzuweisungen und Rollen-Lifecycle.
- Nutzt eine IdP-Abstraktionsschicht für Keycloak-Admin-Operationen.
- Führt schreibende Rollenoperationen Keycloak-first mit lokaler Persistenz und Compensation aus.

### 3. Permission Engine

- Zentrale Engine für `GET /iam/me/permissions` und `POST /iam/authorize`.
- Wertet deterministisch RBAC-Basisregeln und nachgelagerte ABAC-/Hierarchie-Regeln aus.
- Liefert `allowed` plus nachvollziehbaren `reason`.

### 4. IAM-Datenhaltung

- Persistiert Rollen, Permissions, Benutzer, Organisationsbezüge und Auditdaten im `iam`-Schema.
- Erzwingt Mandantenisolierung über `instance_id` und RLS-nahe Betriebsregeln.
- Modelliert den Root-Host separat als `platform`-Scope außerhalb von `iam.instances`.

### 5. Audit- und Observability-Pfad

- Sicherheitsrelevante Tenant-Ereignisse werden in `iam.activity_logs` persistiert.
- Sicherheitsrelevante Plattform-Ereignisse werden in `iam.platform_activity_logs` persistiert.
- Operative Logs laufen über den SDK Logger in die OTEL-Pipeline.

### 6. Cache- und Reconcile-Pfad

- Permission-Snapshots beschleunigen die Authorize-Strecke.
- Reconciliation gleicht studioverwaltete Rollen zwischen Postgres und Keycloak ab.

## Laufzeitmodell der Permission Engine

### Eingangsdaten

- Identity-Kontext aus Session/OIDC
- `instanceId` als harter Scope
- optional `organizationId`
- angefragte `action`
- angefragte `resource`
- optionale ABAC-Attribute, z. B. `geoScope`, `timeWindow`, `actingAs`

### Evaluationsreihenfolge

1. Authentifizierung und Auflösung des effektiven Benutzerkontexts
2. Prüfung des Instanz-Scopes (`instanceId`)
3. Validierung des Request-Modells
4. Laden oder Berechnen des Permission-Snapshots
5. RBAC-Basisentscheidung
6. ABAC-Regelauswertung
7. Hierarchie-Vererbung und Restriktionen
8. Finale Entscheidung mit `allowed` und `reason`

### Entscheidungslogik

- Ohne gültigen Instanzkontext wird verweigert.
- RBAC liefert die stabile Basisentscheidung.
- ABAC erweitert oder beschränkt die Basisentscheidung gemäß Regeldefinition.
- Restriktivere Regeln gewinnen bei Konflikten.
- Fehlende Pflichtattribute oder inkonsistenter Kontext führen zu fail-closed.

## Logisches Datenmodell

### Kernentitäten

| Entität | Zweck |
| --- | --- |
| `iam.instances` | Mandantenanker und betriebliche Defaults |
| `iam.accounts` | Studio-seitige Benutzerreferenz zum Keycloak-Subject |
| `iam.organizations` | Untereinheiten innerhalb einer Instanz |
| `iam.roles` | Rollenkatalog pro Instanz inklusive technischer Identität |
| `iam.permissions` | Berechtigungsdefinitionen pro Instanz |
| `iam.activity_logs` | unveränderbare Tenant-Audit- und Compliance-Nachweise |
| `iam.platform_activity_logs` | unveränderbare Plattform-Audit-Nachweise für Root-Host- und Control-Plane-Ereignisse |

### Zuordnungstabellen

| Entität | Zweck |
| --- | --- |
| `iam.instance_memberships` | Instanzmitgliedschaften von Accounts |
| `iam.account_organizations` | Organisationszuordnungen von Accounts |
| `iam.account_roles` | Rollenzuweisungen zu Accounts |
| `iam.role_permissions` | Zuordnung Rollen zu Permissions |

### Modellierungsregeln

- Alle mandantenrelevanten Tabellen tragen `instance_id`.
- `platform` ist ein eigener Runtime-Scope ohne synthetischen `instance_id`-Wert.
- `organizations` sind Untereinheiten einer Instanz, kein eigener Primär-Mandantenscope.
- `role_key` ist die stabile technische Rollenidentität.
- Anzeigenamen bleiben davon getrennt und dürfen editierbar sein.
- Sensible PII-Felder werden als `*_ciphertext` gespeichert.
- Auditdaten sind append-only und werden nicht fachlich überschrieben.

## Mandantenisolation und Sicherheitsgrenzen

- Laufzeitzugriffe arbeiten mit dedizierten App-Rollen ohne `SUPERUSER` und ohne `BYPASSRLS`.
- Ohne gesetzten Instanzkontext greifen Policies fail-closed.
- Service-seitige Guards und Datenbankregeln sichern sich gegenseitig ab.
- Keycloak-Rollen außerhalb des Studio-Managed-Scopes dürfen nicht implizit Wirkung auf den Studio-Rollenkatalog entfalten.

## Synchronisation mit Keycloak

### Zielbild

- Keycloak bleibt System of Record für Authentifizierung.
- Postgres bleibt System of Record für Studio-verwaltete IAM-Fachdaten.
- Studioverwaltete Rollen werden über technische Merkmale eindeutig vom externen Realm-Bestand abgegrenzt.

### Sync-Regeln

- Schreibende Rollenoperationen laufen Keycloak-first.
- Nach erfolgreichem IdP-Write wird das lokale Mapping aktualisiert.
- Bei lokalem Folgefehler wird eine Compensation ausgelöst.
- Reconcile-Läufe erkennen Drift und korrigieren nur den Managed-Scope.
- Orphaned, studio-markierte Keycloak-Rollen werden standardmäßig report-only behandelt.

## Cache- und Invalidierungsmodell

- Effektive Berechtigungen werden als Snapshots pro Benutzer-/Instanzkontext gehalten.
- Der Cache ist eine Optimierung, nicht die fachliche Quelle.
- Änderungen an Rollen, Zuordnungen oder Policies invalidieren Snapshots event-basiert.
- Primärer Mechanismus ist Postgres `NOTIFY` mit TTL-/Recompute-Fallback.
- Bei stale plus Recompute-Fehler bleibt der Authorize-Pfad fail-closed.

## Audit, Logging und Nachvollziehbarkeit

- Sicherheitsrelevante IAM-Ereignisse werden per Dual-Write dokumentiert:
  - DB-Nachweis in `iam.activity_logs`
  - operative Emission über SDK Logger und OTEL
- Pflichtfelder in operativen Logs umfassen mindestens `workspace_id`, `component`, `environment`, `level`; zusätzlich sind im IAM-Pfad `context.request_id` und `context.trace_id` als Kontextfelder zu setzen.
- Klartext-PII, Tokens und Secrets sind weder in Audit- noch in operativen Logs zulässig.

## Offene Architekturgrenzen

Diese Doku beschreibt das Zielbild, ersetzt aber nicht:

- detaillierte OpenAPI-Verträge
- einzelne ADR-Entscheidungen
- migrationsnahe SQL-Details
- umsetzungsspezifische Testmatrizen und Betriebsrunbooks

## Verweise

- `docs/architecture/05-building-block-view.md`
- `docs/architecture/06-runtime-view.md`
- `docs/architecture/08-cross-cutting-concepts.md`
- `docs/architecture/10-quality-requirements.md`
- `docs/adr/ADR-009-keycloak-als-zentraler-identity-provider.md`
- `docs/adr/ADR-010-verschluesselung-iam-core-data-layer.md`
- `docs/adr/ADR-011-instanceid-kanonischer-mandanten-scope.md`
- `docs/adr/ADR-012-permission-kompositionsmodell-rbac-v1.md`
- `docs/adr/ADR-013-rbac-abac-hybridmodell.md`
- `docs/adr/ADR-014-postgres-notify-cache-invalidierung.md`
- `docs/adr/ADR-016-idp-abstraktionsschicht.md`
- `openspec/specs/iam-core/spec.md`
- `openspec/specs/iam-access-control/spec.md`
