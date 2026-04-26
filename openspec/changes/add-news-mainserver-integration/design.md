# Design: Mainserver-backed News Plugin

## Context

`@sva/sva-mainserver` stellt bereits die serverseitige Delegationskette bereit: Instanzkonfiguration, Keycloak-Credentials, OAuth2-Token, GraphQL-Transport, Caches, Timeouts, Retry, Logging und OTEL. Bisher nutzt diese Schicht nur Diagnoseoperationen (`__typename`).

`@sva/plugin-news` ist dagegen bereits eine fachliche Studio-Oberfläche mit Liste, Formular, Validierung und CRUD-Aktionen. Die API-Fassade ruft aktuell `/api/v1/iam/contents` im Browser auf und speichert `news.article` als lokalen Studio-Content. Für den Zielzustand "Studio als GUI für den SVA Mainserver" muss diese Fassade auf eine hostseitige Mainserver-Anbindung umgestellt werden.

## Goals

- News ist der erste fachliche Mainserver-Content-Flow im Studio.
- Browser und Plugin-Code sehen keine Mainserver-URLs, Tokens oder Secrets.
- GraphQL-Dokumente und DTO-Mapping sind typisiert und fachlich begrenzt.
- Mainserver-Fehler werden in stabile Studio-/Plugin-Fehler übersetzt.
- Die bestehende News-UI bleibt nutzbar und wird nicht durch eine generische GraphQL-Konsole ersetzt.
- Lokale Legacy-Inhalte werden bewusst behandelt, nicht nebenbei mit Mainserver-Daten vermischt.

## Non-Goals

- Kein generischer GraphQL-Executor als Public API.
- Kein Dual-Write in lokale IAM-Contents und Mainserver.
- Keine vollständige Content-Core-Migration aller Fachdomänen.
- Keine Runtime-Generierung von Plugin-Formularen aus dem GraphQL-Schema.

## Decisions

### Typisierte Mainserver-News-Adapter

`@sva/sva-mainserver/server` erhält fachliche Funktionen wie:

- `listSvaMainserverNews`
- `getSvaMainserverNews`
- `createSvaMainserverNews`
- `updateSvaMainserverNews`
- `deleteOrArchiveSvaMainserverNews`

Die konkreten Namen sind Implementierungsdetail, müssen aber pro Operation typisierte Inputs/Outputs, `instanceId`, `keycloakSubject` und Operation-Namen für Logging/Tracing führen. Sie verwenden den bestehenden internen GraphQL-Transport, ohne ihn allgemein zu exportieren.

### Hostseitige News-Server-Funktionen

Die App stellt Server-Funktionen oder vergleichbare serverseitige Handler für das Plugin bereit. Diese Handler:

- authentifizieren die aktuelle Session,
- prüfen lokale Content-/Plugin-Berechtigungen,
- lösen `instanceId` und `keycloakSubject` auf,
- rufen die News-Adapter in `@sva/sva-mainserver/server` auf,
- geben nur das pluginnahe News-Modell an die UI zurück.

`@sva/plugin-news` importiert keine Server-Runtime- oder Mainserver-Pakete. Die API-Fassade im Plugin wird entweder gegen diese Host-Funktionen abstrahiert oder in eine host-injizierte Data-Source umgebaut.

### Status- und Payload-Mapping

Das Plugin-Modell muss auf den Mainserver-Vertrag gemappt werden. Dafür wird vor Implementierung anhand des eingecheckten Schema-Snapshots und optional eines aktuellen Staging-Diffs entschieden:

- welche Mainserver-Felder `title`, `teaser`, `body`, `imageUrl`, `externalUrl`, `category` und `publishedAt` abbilden,
- ob `draft`, `in_review`, `approved`, `published`, `archived` direkt unterstützt oder übersetzt werden,
- ob Löschen technisch ein Delete, Archive oder Statuswechsel ist.

Abweichungen werden in `docs/development/runbook-sva-mainserver.md` oder einer dedizierten Entwicklungsdoku dokumentiert.

### Legacy-Content

Bestehende lokale `news.article`-Datensätze dürfen nicht still mit Mainserver-Daten zusammengeführt werden. Der Change verlangt eine bewusste Entscheidung:

- expliziter Migrationsjob mit Report,
- oder Legacy-Read-only-Anzeige mit klarer Kennzeichnung,
- oder harter Schnitt mit dokumentierter manueller Nachpflege.

Der produktive Schreibpfad nach Umsetzung ist Mainserver-only.

## Risks / Trade-offs

- Das Mainserver-Schema kann von den Annahmen des Plugin-Formulars abweichen. Mitigation: Schema-Snapshot prüfen, GraphQL-Dokumente gezielt generieren, Schema-Diff-Gate verwenden.
- Per-User-Credentials können in Keycloak fehlen oder andere Rechte als lokale Studio-Rechte haben. Mitigation: lokale Checks vorab, Mainserver-Fehler sichtbar und deterministisch mappen.
- Die bestehende Plugin-API ist browserseitig. Mitigation: Host-Server-Funktionen als Data-Source-Grenze einführen, bevor `news.api.ts` fachlich auf Mainserver umgestellt wird.
- Lokale Inhalte könnten nach Umstellung nicht mehr sichtbar sein. Mitigation: expliziter Legacy-/Migrationsplan mit Operator-Report.

## Migration Plan

1. Mainserver-Schema für News-Querys und Mutations aus dem Snapshot ableiten und gegen Staging validieren.
2. Typisierte GraphQL-Dokumente und Mapper in `@sva/sva-mainserver` ergänzen.
3. Hostseitige News-Server-Funktionen mit Auth, Rollenprüfung und Error-Mapping bereitstellen.
4. Plugin-News-API-Fassade auf die Host-Server-Funktionen umstellen.
5. Legacy-Content-Entscheidung implementieren oder dokumentiert blockieren.
6. Tests, Schema-Diff, Server-Runtime-Check und relevante App-/Plugin-Tests ausführen.

## Open Questions

- Welche konkreten Mainserver-Mutationsnamen sind kanonisch für News-Create, Update und Delete/Archive?
- Unterstützt der Mainserver den aktuellen Plugin-Statusumfang vollständig oder ist ein Mapping auf weniger Status nötig?
- Sollen bestehende lokale `news.article`-Inhalte migriert werden, und falls ja: einmalig operatorgeführt oder als wiederholbarer Job?
