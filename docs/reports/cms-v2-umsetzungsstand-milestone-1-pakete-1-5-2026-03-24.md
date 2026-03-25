# Bericht zum Umsetzungsstand
## CMS-Upgrade Milestone 1, Pakete 1 bis 5

Stand: 24.03.2026

## Ziel und Abgrenzung

Dieser Bericht bewertet den Umsetzungsstand der Punkte 1 bis 5 aus dem Dokument [concepts/konzeption-cms-v2/Auftrag-Milestone-1.md](../../concepts/konzeption-cms-v2/Auftrag-Milestone-1.md).


Die Bewertung basiert auf dem aktuellen Repository-Stand, vorhandenen Tests, Architektur- und Betriebsdokumenten sowie vorhandenen Nachweis- und Staging-Dokumenten.


## 1. Architektur & Basis-IAM-Inkrement

### Anforderungsbeschreibung laut Auftrag

- Architektur-Design: Erstellung des detaillierten technischen Architektur-Designs für den gesamten Identitäts- und Zugriffsmanagement-Service (IAM-Service), die Permission Engine und das notwendige logische Datenbank-Schema (Postgres/Supabase) gemäß dem Zielbild des Konzepts.
- Keycloak-Basis-Setup: Einrichtung des dedizierten Keycloak-Realms für die vereinbarte Test-/Entwicklungsumgebung.
- Client & Token Setup: Konfiguration der spezifischen Clients für das CMS sowie Aufbau des initialen Token-Setups (OIDC-Claims), um die Authentifizierung zu ermöglichen.

### Abnahmekriterien laut Auftrag

- Die Architekturdokumentation (inkl. Logik des DB-Schemas, Schnittstellenkonzept) liegt in finaler, freigegebener Form vor.
- Der dedizierte Keycloak-Realm und die zugehörigen Clients sind in der vereinbarten Testumgebung funktionsfähig eingerichtet.
- Ein erfolgreicher Authentifizierungs-Flow (Login) eines Keycloak-Test-Users über einen der konfigurierten Clients ist nachweisbar.
- Das ausgestellte OIDC-Token enthält die korrekten Claims gemäß dem initialen Token-Setup.

### Bewertung

Weitgehend umgesetzt, aber die Abnahmekriterien zur realen Zielumgebung sind im Repository nicht vollständig nachgewiesen.

### Umgesetzte Elemente

- OIDC-Login mit Keycloak ist als technischer Standardpfad dokumentiert und im Auth-Paket beschrieben.
- Redis-basierte Session-Verwaltung ist dokumentiert und Bestandteil der Architektur.
- Die Architektur beschreibt die Aufgabenteilung Keycloak für technische Identität, Postgres für fachliche IAM-Daten und Redis als Cache.
- Für den Keycloak-Service-Account und Rollen-Sync liegen Betriebs- und Setup-Dokumente vor.

### Einschränkungen

- Ein echter Acceptance-Lauf gegen die vereinbarte Testumgebung mit gültigen Runtime-Secrets war laut Bericht noch nicht möglich.
- Damit ist die funktionsfähige Einrichtung von dediziertem Realm, Clients und realem Login-Flow nicht allein durch Repo-Artefakte final abgenommen.

### Fundstellen

- Ausgangsanforderung: [concepts/konzeption-cms-v2/Auftrag-Milestone-1.md](../../concepts/konzeption-cms-v2/Auftrag-Milestone-1.md)
- Architekturstrategie: [docs/architecture/04-solution-strategy.md](../architecture/04-solution-strategy.md)
- Building-Block-Sicht: [docs/architecture/05-building-block-view.md](../architecture/05-building-block-view.md)
- Cross-Cutting Concepts: [docs/architecture/08-cross-cutting-concepts.md](../architecture/08-cross-cutting-concepts.md)
- Auth-Paket-Überblick: [packages/auth/README.md](../../packages/auth/README.md)
- Keycloak-Service-Account-Setup: [docs/guides/keycloak-service-account-setup-iam.md](../guides/keycloak-service-account-setup-iam.md)
- Acceptance-Runbook: [docs/guides/iam-acceptance-runbook.md](../guides/iam-acceptance-runbook.md)
- Verifikationsbericht mit offenem Umgebungsnachweis: [docs/reports/iam-foundation-acceptance-baseline-2026-03-17.md](./iam-foundation-acceptance-baseline-2026-03-17.md)

## 2. Accounts & Organisationen

### Anforderungsbeschreibung laut Auftrag

- Datenmodelle Implementierung: Implementierung des im Architekturkonzept entworfenen Postgres-Datenbank-Schemas (im IAM-Schema) für die Kernentitäten `iam.accounts` und `iam.organizations`.
- Organisations-Hierarchie & Mandantenfähigkeit: Implementierung der Logik zur Abbildung der hierarchischen Organisationsstrukturen (z. B. Stadt → Stadtteil) sowie die Sicherstellung der Mandantenfähigkeit auf Datenebene.
- Minimaler IAM-Service (Core-Sync): Implementierung der Synchronisations-Logik, die die Keycloak-User-ID (`sub`) nach dem Login oder bei Neuregistrierung mit dem entsprechenden `iam.accounts`-Datensatz verknüpft und synchronisiert.
- Basis-CRUD-Operationen: Implementierung der Backend-Endpunkte (API-Schnittstellen) für die Erstellung, das Lesen, die Aktualisierung und das Löschen (CRUD) von Accounts und Organisationen, die vom CMS-UI genutzt werden.
- Admin-UI Integration: Erweiterung der Admin-UI Basics um funktionale Komponenten zur Anzeige, Bearbeitung und Verwaltung der Accounts und Organisationsstrukturen inklusive Onboarding-Status.

### Abnahmekriterien laut Auftrag

- Die Datenbanktabellen `iam.accounts` und `iam.organizations` sind im Postgres-Schema der Testumgebung angelegt und entsprechen dem freigegebenen Design.
- Die Synchronisations-Logik funktioniert fehlerfrei: Nach einem Login über Keycloak existiert ein korrekter Datensatz in `iam.accounts` mit korrekter Verknüpfung zur Keycloak-ID.
- Die hierarchische Abbildung ist funktional: Die Anlage einer neuen Organisation kann erfolgreich einer übergeordneten Organisation zugewiesen werden.
- Die CRUD-Operationen für Accounts und Organisationen sind über die Backend-API durch einen Test-Administrator erfolgreich durchführbar.
- Die Admin-UI bildet die Benutzerliste und die Organisationsstruktur korrekt ab und ermöglicht die Zuweisung eines Accounts zu einer Organisation.

### Bewertung

Weitgehend umgesetzt.

### Umgesetzte Elemente

- Backend-Handler für Benutzerverwaltung sind vorhanden, einschließlich Listen-, Detail-, Erstellen-, Aktualisieren-, Deaktivieren- und Sync-Funktionen.
- Keycloak-User-Sync nach `iam.accounts` ist implementiert.
- Organisationsverwaltung mit CRUD, Hierarchie, Mitgliedschaften und aktivem Organisationskontext ist implementiert.
- Die Admin-UI stellt Seiten für Benutzer und Organisationen bereit.
- Das Datenmodell und die Verträge für Accounts, Rollen, Gruppen und Organisationen sind typisiert.

### Beobachtungen

- Für den Abgleich "nach Login oder Neuregistrierung existiert korrekter Datensatz in `iam.accounts`" gibt es starke Implementierungshinweise über Import-/Sync- und Actor-Resolution-Pfade.
- Ein vollständig dokumentierter End-to-End-Abnahmebeleg in einer realen Zielumgebung ist auch hier nicht zentral abgelegt, die Implementierung selbst ist aber deutlich vorhanden.

### Fundstellen

- Benutzer-API und Exporte: [packages/auth/src/iam-account-management/users.ts](../../packages/auth/src/iam-account-management/users.ts)
- Core-Handler-Bindings: [packages/auth/src/iam-account-management/core.ts](../../packages/auth/src/iam-account-management/core.ts)
- Keycloak-Import-Sync: [packages/auth/src/iam-account-management/user-import-sync-handler.ts](../../packages/auth/src/iam-account-management/user-import-sync-handler.ts)
- User-Detail-Abfrage: [packages/auth/src/iam-account-management/user-detail-query.ts](../../packages/auth/src/iam-account-management/user-detail-query.ts)
- Organisations-API: [packages/auth/src/iam-organizations/index.ts](../../packages/auth/src/iam-organizations/index.ts)
- Organisations-Core: [packages/auth/src/iam-organizations/core.ts](../../packages/auth/src/iam-organizations/core.ts)
- Organisations-Tests: [packages/auth/src/iam-organizations.server.test.ts](../../packages/auth/src/iam-organizations.server.test.ts)
- User-Liste UI: [apps/sva-studio-react/src/routes/admin/users/-user-list-page.tsx](../../apps/sva-studio-react/src/routes/admin/users/-user-list-page.tsx)
- User-Detail UI: [apps/sva-studio-react/src/routes/admin/users/-user-edit-page.tsx](../../apps/sva-studio-react/src/routes/admin/users/-user-edit-page.tsx)
- Organisations-UI: [apps/sva-studio-react/src/routes/admin/organizations/-organizations-page.tsx](../../apps/sva-studio-react/src/routes/admin/organizations/-organizations-page.tsx)
- Frontend-API-Fassade: [apps/sva-studio-react/src/lib/iam-api.ts](../../apps/sva-studio-react/src/lib/iam-api.ts)
- Typvertrag: [packages/core/src/iam/account-management-contract.ts](../../packages/core/src/iam/account-management-contract.ts)

## 3. Rollenmodell, Gruppen & Vererbungen

### Anforderungsbeschreibung laut Auftrag

- Rollen-Implementierung: Implementierung der verschiedenen System-Personas (z. B. System-Administrator, Redakteur) als feste Rollen sowie die Architektur zur Anlage mandantenspezifischer Custom-Rollen in der Tabelle `iam.roles`.
- Gruppen-Modell: Implementierung des Backend-Modells (`iam.groups`) und der zugehörigen Logik zur Bündelung von Permissions und zur Zuweisung zu Accounts.
- Feingranulare Permissions: Implementierung der Datenbank-Modelle zur Speicherung der feingranularen Berechtigungen gemäß der Struktur `(subject, action, resource_type, resource_id?, scope)`.
- Hierarchische Vererbung (RBAC/ABAC): Implementierung der komplexen Vererbungslogik, die Rollenberechtigungen über die Organisations-Hierarchie und über geografische Attribute korrekt auflöst.
- Verwaltungs-UI: Erweiterung der CMS-UI um die notwendigen Oberflächen zur Anlage, Bearbeitung und Zuweisung von System- und Custom-Rollen, Gruppen sowie zur Verknüpfung von Accounts mit Rollen und Gruppen.

### Abnahmekriterien laut Auftrag

- Die Datenbankmodelle für Rollen, Gruppen und Berechtigungen (`iam.roles`, `iam.groups`, `iam.role_permissions`) sind angelegt und mit den notwendigen CRUD-Funktionen hinterlegt.
- Die System-Personas sind angelegt und mit einem initialen Set an Berechtigungen versehen.
- Die Rollen-Vererbung ist funktional: Ein Test-User mit einer Rolle auf Stadtebene erhält automatisch die korrekten effektiven Berechtigungen für alle zugeordneten Stadtteile.
- Die Geo-Vererbung ist funktional: Die Zuweisung einer `geographicPermission` zu einer Region resultiert in der korrekten Auflösung der Berechtigung für alle untergeordneten geografischen Entitäten.
- Die Admin-UI ermöglicht die korrekte Zuweisung von Rollen und Gruppen zu einem Account und spiegelt die effektiven vererbten Rollen korrekt wider.

### Bewertung

Backend-seitig weitgehend umgesetzt, UI-seitig teilweise umgesetzt.

### Umgesetzte Elemente

- Rollenverwaltung ist serverseitig vorhanden, einschließlich Create/Update/Delete, Reconcile und Keycloak-Sync.
- Gruppenverwaltung mit Gruppenrollen und Gruppenmitgliedschaften ist implementiert.
- Rollen- und Gruppenbeziehungen fließen in die Berechtigungsauflösung ein.
- Organisationsvererbung und Geo-Vererbung sind in der Autorisierungslogik und den zugehörigen Tests abgebildet.
- Für Gruppen, Rollen und Vererbungslogik liegen Unit- und Server-Tests vor.

### Einschränkungen

- Die UI für Rollen erlaubt nach aktuellem Stand vor allem Metadatenpflege, nicht aber eine vollwertige Pflege feingranularer Permissions aus der Oberfläche heraus.
- Damit ist der fachliche Anspruch "Verwaltungs-UI für System- und Custom-Rollen, Gruppen und effektive vererbte Rollen" nur teilweise erfüllt.

### Fundstellen

- Rollen-API: [packages/auth/src/iam-account-management/roles.ts](../../packages/auth/src/iam-account-management/roles.ts)
- Gruppen-API: [packages/auth/src/iam-groups/index.ts](../../packages/auth/src/iam-groups/index.ts)
- Gruppen-Handler-Details: [packages/auth/src/iam-account-management/groups-handlers.ts](../../packages/auth/src/iam-account-management/groups-handlers.ts)
- Keycloak-Admin-Client: [packages/auth/src/keycloak-admin-client/core.ts](../../packages/auth/src/keycloak-admin-client/core.ts)
- Rollen-UI: [apps/sva-studio-react/src/routes/admin/roles/-roles-page.tsx](../../apps/sva-studio-react/src/routes/admin/roles/-roles-page.tsx)
- Gruppen-UI: [apps/sva-studio-react/src/routes/admin/groups/-groups-page.tsx](../../apps/sva-studio-react/src/routes/admin/groups/-groups-page.tsx)
- Autorisierungs-Engine: [packages/core/src/iam/authorization-engine.ts](../../packages/core/src/iam/authorization-engine.ts)
- Autorisierungs-Engine-Tests: [packages/core/src/iam/authorization-engine.test.ts](../../packages/core/src/iam/authorization-engine.test.ts)
- Geo-Hierarchie-Tests: [packages/auth/src/iam-organizations/geo-hierarchy.test.ts](../../packages/auth/src/iam-organizations/geo-hierarchy.test.ts)
- Routing-/Guard-Schutz für Admin- und Content-Bereiche: [packages/routing/src/account-ui.routes.ts](../../packages/routing/src/account-ui.routes.ts)
- Rollen-Sync-Runbook: [docs/guides/keycloak-rollen-sync-runbook.md](../guides/keycloak-rollen-sync-runbook.md)
- Architekturkontext: [docs/architecture/05-building-block-view.md](../architecture/05-building-block-view.md)

## 4. Permission Engine & High-Performance AuthZ

### Anforderungsbeschreibung laut Auftrag

- Permission Engine API: Entwicklung des zentralen IAM-Service-Endpunkts, der als einzige Quelle für Berechtigungsentscheidungen im CMS dient, einschließlich Algorithmus zur Berechtigungsberechnung.
- High-Performance Cache: Aufbau und Konfiguration eines Redis-basierten Caches zur Speicherung von vorberechneten Permission Snapshots.
- Caching-Logik: Implementierung der Logik für Cache-Hits (In-Memory-Checks) und Cache-Misses (Datenbankabfrage, Berechnung und Speichern in Redis).
- Basiskommunikation: Implementierung eines Mechanismus zur Cache-Invalidierung bei Änderungen der Kernentitäten durch Events.
- Performance-Tuning: Analyse und Optimierung des Berechnungsalgorithmus zur Einhaltung der kritischen Latenzanforderung kleiner 100 ms für den Endpunkt.

### Abnahmekriterien laut Auftrag

- Der zentrale Autorisierungs-Endpunkt ist in der Entwicklungs-/Testumgebung erreichbar und liefert korrekte Entscheidungen.
- Die Redis-Integration ist nachweisbar funktionsfähig: Berechtigungs-Snapshots werden nach dem ersten Aufruf im Redis gespeichert und beim zweiten Aufruf von dort geladen.
- Latenztest Performanz: Die Berechtigungsprüfung im Cache-Hit-Szenario überschreitet die zugesicherte Latenz von 100 ms als P95 bei den vereinbarten Lastbedingungen nicht.
- Die Basis-Cache-Invalidierung funktioniert: Eine Änderung der Rolle eines Test-Users führt nachweislich zur Löschung des zugehörigen Permission-Snapshots in Redis.

### Bewertung

Weitgehend umgesetzt, End-to-End-Abnahme nur teilweise belegt.

### Umgesetzte Elemente

- Ein zentraler Authorize-Pfad ist vorhanden.
- Effektive Permissions werden aus Rollen, Gruppen, Delegationen und Organisationskontext zusammengesetzt.
- Redis-basierte Permission-Snapshots sind implementiert.
- Ein lokaler In-Memory-L1-Cache und ein Redis-Shared-Read-Path sind vorgesehen und implementiert.
- Cache-Invalidierung und Snapshot-Handling sind als eigene Bausteine vorhanden.
- Architektur-, Qualitäts- und Benchmark-Dokumente für Performance und Cache-Verhalten liegen vor.

### Einschränkungen

- Der evaluator-nahe Benchmark liegt vor und erfüllt den Zielwert deutlich.
- Für die Arbeitspaket-Abnahme gefordert ist aber insbesondere ein belastbarer Endpunkt-/Umgebungsnachweis, einschließlich Cache-Hit, Cache-Miss, Redis-Nutzung und Lastbedingungen. Dieser Nachweis ist im Repository nur teilweise als operative Evidenz vorhanden.

### Fundstellen

- Authorize-Handler: [packages/auth/src/iam-authorization/authorize.ts](../../packages/auth/src/iam-authorization/authorize.ts)
- Permission-Store: [packages/auth/src/iam-authorization/permission-store.ts](../../packages/auth/src/iam-authorization/permission-store.ts)
- Redis-Snapshot-Implementierung: [packages/auth/src/iam-authorization/redis-permission-snapshot.server.ts](../../packages/auth/src/iam-authorization/redis-permission-snapshot.server.ts)
- Snapshot-Invalidierung: [packages/auth/src/iam-authorization/snapshot-invalidation.server.ts](../../packages/auth/src/iam-authorization/snapshot-invalidation.server.ts)
- Me-Permissions-Handler: [packages/auth/src/iam-authorization/me-permissions.ts](../../packages/auth/src/iam-authorization/me-permissions.ts)
- Autorisierungsvertrag: [packages/core/src/iam/authorization-contract.ts](../../packages/core/src/iam/authorization-contract.ts)
- Autorisierungslogik: [packages/core/src/iam/authorization-engine.ts](../../packages/core/src/iam/authorization-engine.ts)
- Integrations- und Cache-Tests: [packages/auth/src/iam-authorization.integration.test.ts](../../packages/auth/src/iam-authorization.integration.test.ts)
- Cache-Tests: [packages/auth/src/iam-authorization.cache.test.ts](../../packages/auth/src/iam-authorization.cache.test.ts)
- Qualitätsanforderungen: [docs/architecture/10-quality-requirements.md](../architecture/10-quality-requirements.md)
- Baseline-Bericht Authorize: [docs/reports/iam-authorize-baseline-2026-02-27.md](./iam-authorize-baseline-2026-02-27.md)
- ABAC-/Cache-Benchmark: [docs/reports/iam-authorize-abac-cache-baseline-2026-02-28.md](./iam-authorize-abac-cache-baseline-2026-02-28.md)
- Dashboard-/Observability-Hinweise: [docs/reports/iam-cache-grafana-dashboard-template-2026-02-28.md](./iam-cache-grafana-dashboard-template-2026-02-28.md)

## 5. Rechtstexte & Akzeptanzsystem

### Anforderungsbeschreibung laut Auftrag

- Datenmodell Rechtstexte: Implementierung der Tabellen in der Datenbank zur Speicherung von Rechtstexten (AGB, Datenschutzerklärung) inklusive Versionsverwaltung.
- Akzeptanz-Workflow: Implementierung einer Logik, die beim Login-Prozess prüft, ob der angemeldete Benutzer die neueste Version der notwendigen Rechtstexte akzeptiert hat.
- Erzwingung der Akzeptanz: Bereitstellung eines Redirects beziehungsweise einer IAM-Hook-Funktion, die den Benutzer zur Akzeptanz zwingt, bevor der Zugang zum System gewährt wird.
- Nachweis & Export: Implementierung einer Funktion im Admin-UI, die einen revisionssicheren Nachweis liefert, wann und welche Version eines Rechtstextes von einem Benutzer akzeptiert wurde.

### Abnahmekriterien laut Auftrag

- Das Datenmodell ermöglicht die Anlage und Versionsverwaltung von mindestens zwei unterschiedlichen Rechtstexten.
- Die Erzwingungslogik ist funktional: Ein Test-User, der eine neue Version eines Rechtstextes noch nicht akzeptiert hat, wird beim Login zur Akzeptanz gezwungen.
- Nach der Akzeptanz wird der Akzeptanz-Vorgang mit Datum und Versionsnummer unveränderbar protokolliert.
- Die Nachweisfunktion im Admin-UI liefert für einen beliebigen Benutzer einen Export der akzeptierten Rechtstexte, der die Einhaltung der Nachweispflichten belegt.

### Bewertung

Weitgehend umgesetzt, fachlicher End-to-End-Nachweis noch offen.

### Umgesetzte Elemente

- Datenmodell und CRUD-Pfade für versionierte Rechtstexte sind vorhanden.
- Eine Admin-Oberfläche für Liste, Suche, Filter, Erstellen und Bearbeiten von Rechtstexten ist vorhanden.
- Eine serverseitige Erzwingung offener Rechtstext-Akzeptanzen ist implementiert.
- Ein Exportpfad für Zustimmungs-/Consent-Nachweise ist vorhanden.
- Im Frontend existieren API-Helfer für ausstehende Rechtstexte und deren Akzeptanz.

### Einschränkungen

- Die Staging-Testprotokolle markieren die Rechtstext- und Login-Szenarien noch als offen.
- Im Repository ist kein abgeschlossener fachlicher End-to-End-Nachweis für Login-Umleitung, vollständiges Lesen, Akzeptieren und Rückkehr zum Ursprungspfad als abgeschlossen dokumentiert.

### Fundstellen

- Rechtstext-API: [packages/auth/src/iam-legal-texts/index.ts](../../packages/auth/src/iam-legal-texts/index.ts)
- Rechtstext-Core: [packages/auth/src/iam-legal-texts/core.ts](../../packages/auth/src/iam-legal-texts/core.ts)
- Rechtstext-Schemas: [packages/auth/src/iam-legal-texts/schemas.ts](../../packages/auth/src/iam-legal-texts/schemas.ts)
- HTML-Sanitizing: [packages/auth/src/iam-legal-texts/html.ts](../../packages/auth/src/iam-legal-texts/html.ts)
- Rechtstext-UI: [apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.tsx](../../apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.tsx)
- Frontend-Hooks: [apps/sva-studio-react/src/hooks/use-legal-texts.ts](../../apps/sva-studio-react/src/hooks/use-legal-texts.ts)
- Frontend-API: [apps/sva-studio-react/src/lib/iam-api.ts](../../apps/sva-studio-react/src/lib/iam-api.ts)
- Erzwingung offener Akzeptanzen: [packages/auth/src/legal-text-enforcement.server.ts](../../packages/auth/src/legal-text-enforcement.server.ts)
- Consent-Export: [packages/auth/src/iam-auditing/legal-consent-export.server.ts](../../packages/auth/src/iam-auditing/legal-consent-export.server.ts)
- Rechtstext-Tests: [packages/auth/src/legal-text-enforcement.test.ts](../../packages/auth/src/legal-text-enforcement.test.ts)
- Rechtstext-Repository-Tests: [packages/auth/src/iam-legal-texts.repository.test.ts](../../packages/auth/src/iam-legal-texts.repository.test.ts)
- Manueller Testkatalog: [docs/staging/2026-03/cms-v2-manueller-testkatalog-2026-03-22.md](../staging/2026-03/cms-v2-manueller-testkatalog-2026-03-22.md)
- Testprotokoll-Vorlage mit offenen Szenarien: [docs/staging/2026-03/cms-v2-testprotokoll-vorlage-2026-03-22.md](../staging/2026-03/cms-v2-testprotokoll-vorlage-2026-03-22.md)

## Technische Verifikation

Zum Repository-Stand wurden die relevanten Nx-Testtargets geprüft:

- `pnpm nx run core:test:unit`
- `pnpm nx run routing:test:unit`
- `pnpm nx run auth:test:unit`
- `pnpm nx run sva-studio-react:test:unit`

Ergebnis: grün. Die Ausführung kam aus dem Nx-Cache, es wurden keine neuen Laufzeitnachweise gegen eine externe Zielumgebung erzeugt.

## Fazit

Für die Punkte 1 bis 5 ist im Repository ein substanzieller Umsetzungsstand vorhanden. Besonders stark ausgeprägt sind Auth-Grundlagen, Accounts/Organisationen, zentrale Autorisierungslogik, Rollen-/Gruppen-Backend sowie Rechtstext-Backend und zugehörige Admin-Oberflächen.

Nicht vollständig belegt oder nur teilweise umgesetzt sind vor allem:

- die formale Umgebungsabnahme für Punkt 1
- die vollständige UI-Pflege feingranularer Rollen-/Permission-Zuordnungen in Punkt 3
- belastbare End-to-End-Abnahmen unter Zielumgebungsbedingungen für Punkt 4
- der vollständig dokumentierte fachliche E2E-Nachweis für Login-/Akzeptanzszenarien in Punkt 5
