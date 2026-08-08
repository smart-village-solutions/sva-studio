## Context

Die aktuelle UI besitzt mehrere Autorisierungssichten:

```text
/auth/me
  -> Identität plus flache, nicht organisationsgebundene Action-Liste
     -> Route-Guards, Sidebar, Admin-Helfer, Plugin-Singleton

/iam/me/permissions?instanceId&organizationId
  -> strukturierte, scope-gebundene effektive Permissions
     -> einzelne Content-Flächen
```

Zusätzlich verwalten mehrere Aufrufer ihren Organisationskontext und Permission-Ladezustand lokal. Ein Scope-Wechsel aktualisiert damit nicht zwangsläufig alle Verbraucher atomar. Einige UI-Pfade behandeln `loading` oder die bloße Verfügbarkeit von Dev-Auth als Freigabe. Detailrouten schützen korrekt den Lesezugriff, während freie React-Aktionsflächen Speichern, Löschen oder operative Tools ohne eigenständige Permission-Prüfung rendern.

Der kanonische Katalog unter `packages/studio-module-iam` bleibt die fachliche Definitionsquelle für bekannte Permissions. Er ist jedoch weder ein Laufzeit-Snapshot noch eine Autorisierungsentscheidung. Der Server bleibt für jede Mutation die verbindliche Sicherheitsgrenze.

## Goals / Non-Goals

### Goals

- Genau eine scope-korrekte UI-Sicht pro Auth-Generation und explizitem Plattform- oder Tenant-Scope; Tenant-Sichten berücksichtigen `instanceId`, aktive `organizationId` und Modulzuweisungen.
- Defensive Zustände ohne Permission-Flash oder Wiederverwendung alter Rechte.
- Derselbe vollständig qualifizierte Action-Bezug für Navigation, Route, UI-Aktion, API-Autorisierung, Diagnose und Audit.
- Read-only-Seiten bleiben nutzbar, ohne Mutationsmöglichkeiten zu suggerieren.
- Host und Plugins erhalten einen typsicheren, testbaren und schrittweise migrierbaren Vertrag.
- Neue oder geänderte UI-Aktionen können nicht unbemerkt ohne katalogisierte Permission eingeführt werden.
- Permission-Snapshots aus L1 und Redis sind nur für einen PostgreSQL-autoritativ bestätigten Revisionsvektor logisch gültig.
- Benutzerbezogene und instanzweite Permission-Änderungen invalidieren deterministisch, auch bei verlorenen Events oder parallelen Recomputes.
- Cache-Reset, Browser-Refetch und Session-Widerruf bleiben getrennt beobachtbar und auslösbar.

### Non-Goals

- Keine neue IAM-Engine, Rollen- oder Permission-Semantik.
- Kein Ersatz serverseitiger `authorize`-Prüfungen durch Client-State.
- Keine automatische Freigabe datensatzbezogener Mutationen allein aufgrund eines global vorkommenden Action-Namens.
- Kein vollständiger Umbau aller Editor- und Design-System-Primitives.
- Kein paralleler zweiter Permission-Katalog neben `studio-module-iam` und den Plugin-Module-IAM-Verträgen und keine zweite `authorize()`-Engine neben `@sva/iam-core`.
- Keine Korrektur vorhandener Rollen-, Gruppen- oder Permission-Daten.
- Kein kurzfristiger Hotfix und keine Änderung des fachlichen Rollen-/Permission-Modells.
- Kein Session-Widerruf als implizite Folge eines Cache-Resets.

## Decisions

### 1. Authentifizierung und UI-Autorisierung bleiben getrennte Verantwortungen

`/auth/me` und `AuthProvider` bleiben für Session, Identität, Instanz und technische Auth-Zustände zuständig. Effektive UI-Berechtigungen werden ausschließlich über den strukturierten Read-Vertrag von `GET /iam/me/permissions` bezogen.

Eine flache `permissionActions`-Liste aus `/auth/me` darf nach der Migration weder Route- noch UI-Autorisierung begründen. Rückwärtskompatible Felder können vorübergehend bestehen bleiben, werden aber als deprecated markiert und nicht als zweite Wahrheit verwendet.

### 2. Ein gemeinsamer Scope- und Effective-Access-State

Der Host stellt einen gemeinsam konsumierten Organisationskontext bereit. Darauf aufbauend verwaltet ein `EffectiveAccessProvider` genau einen aktuellen Snapshot pro Auth-Generation und explizitem Scope-Schlüssel:

```text
platform:
  authGeneration + platform

tenant:
  authGeneration + instanceId + (activeOrganizationId | null) + moduleAssignmentGeneration
```

Der Plattform-Scope ist ausschließlich für dokumentierte Root-Host- und Control-Plane-Flächen zulässig. Seine technischen Plattformrollen stammen aus der validierten Session-Sicht und dürfen keine Tenant-Action freigeben. Der Tenant-Scope verwendet die strukturierte Permission-Sicht aus `GET /iam/me/permissions`; `assignedModules` aus der fail-closed Session-Sicht bleibt ein zusätzliches Gate und wird nicht durch das bloße Vorkommen einer Action ersetzt.

Der Snapshot enthält mindestens:

- den Scope-Schlüssel,
- den Zustand `unresolved | loading | ready | error`,
- die strukturierten effektiven Permission-Einträge,
- eine serverseitige Snapshot-Version, sofern verfügbar,
- eine invalidierbare Generation, damit verspätete Antworten eines alten Scopes verworfen werden.

Beim Session- oder Scope-Wechsel wird der vorherige Snapshot vor dem neuen Request atomar ungültig. Ein Fehler übernimmt niemals Actions oder Entscheidungen aus der vorherigen Generation.

### 3. IAM-Core-Entscheidungsvertrag, hosteigene React-Bindung

Ein kleiner, framework-agnostischer Vertrag modelliert:

- eine explizit öffentliche oder authentifizierte Fläche,
- einen expliziten Plattform- oder Tenant-Scope für autorisierte Flächen,
- eine vollständig qualifizierte Permission-Anforderung,
- eine erforderliche Modulzuweisung für modulgebundene Flächen,
- `allOf` beziehungsweise `anyOf` nur dort, wo ein bestehender fachlicher Vertrag mehrere Actions verlangt,
- optionalen Ressourcen- und Organisationskontext,
- das Ergebnis `allowed | denied | unresolved | error` mit maschinenlesbarem Grund.

Die pure Auswertung liegt entsprechend der Package-Zielarchitektur in `@sva/iam-core` und bleibt von React getrennt. Sie projiziert einen bereits serverautoritativ ermittelten Snapshot, die Session-Scope-Fakten und optionale Ressourcen-Capabilities in einen UI-Zustand; sie berechnet keine Rollen-, Gruppen-, Ownership- oder ABAC-Regeln neu. `@sva/plugin-sdk` darf den schmalen Consumer-Vertrag re-exportieren. Der Host stellt darauf eine React-Bindung wie `useAccessDecision(requirement)` bereit. Gemeinsame UI-Primitives erhalten nur die bereits aufgelöste Entscheidung und enthalten keine eigene IAM- oder Rollenlogik.

### 4. Fail-closed ist der Standard für unbekannte Zustände

- `unresolved` und `loading`: Keine geschützte Aktion wird als ausführbar gerendert. Navigation darf einen neutralen Skeleton-Zustand verwenden.
- `error`: Keine alte Freigabe bleibt aktiv. Insbesondere wird ein `503` von `GET /iam/me/permissions` als nicht erlaubender Fehlerzustand behandelt. Die Oberfläche zeigt einen lokalisierten, zugänglichen Hinweis mit Retry, sofern die Fläche selbst lesbar bleiben darf.
- `denied`: Mutierende und sensitive Aktionen werden ausgeblendet. Ein lesbarer Detailbereich bleibt read-only, wenn das zugehörige Read-Recht besteht.
- Fachliche Nichtverfügbarkeit trotz vorhandener Permission, beispielsweise ein geschütztes Zielobjekt oder ein laufender Prozess, wird deaktiviert und verständlich begründet.
- Serverseitige Verweigerung: Die UI zeigt den stabilen Denial- oder Fehlerzustand. Sie invalidiert den globalen Effective-Access-Snapshot nur bei einem stabilen serverseitigen Stale-, Scope- oder Versionssignal und höchstens einmal pro Snapshot-Generation. Ein erwartbarer ressourcenbezogener `403` invalidiert ohne solches Signal nur die konkrete Ressourcen-Capability und löst keine globale Refetch-Schleife aus.

Dev-Auth darf nur bei einer nachweislich aktiven Dev-Auth-Session einen ausdrücklich dafür vorgesehenen Testvertrag nutzen. Die bloße Konfigurationsverfügbarkeit ist niemals ein Authorization-Bypass.

### 5. Seitenzugriff und Aktionszugriff werden getrennt modelliert

Eine Detailroute kann mit `*.read` erreichbar sein. Daraus folgt ausschließlich die Lesbarkeit der Seite. Erstellen, Speichern, Löschen, Veröffentlichen, Archivieren, Importieren, Reprovisionieren, Benchmark-Ausführung und andere Mutationen besitzen jeweils eine eigene Action-Anforderung.

Formulare im Read-only-Zustand:

- exponieren keine ausführbaren Submit- oder Delete-Controls,
- verhindern Mutationen auch über Tastatur- oder implizite Form-Submits,
- kennzeichnen den Read-only-Zustand zugänglich und lokalisiert,
- verändern keine Formdaten durch automatische Normalisierung oder Seiteneffekte.

### 6. Datensatzbezogene Capabilities bleiben serverautoritativ und fachlich owned

Ein Action-Name im Effective-Access-Snapshot ist nur dann eine ausreichende UI-Freigabe, wenn die Permission im aktuellen Kontext tatsächlich unbeschränkt für die Operation gilt. Bei `own`-, `organization`-, Geo-, Ressourcen- oder anderen ABAC-Bedingungen muss eine ressourcenbezogene Capability aus dem bereits fachlich führenden serverautoritativen Read- oder Authorize-Vertrag hinzukommen.

Fehlt diese Ressourcenaussage, bleibt die konkrete Mutation fail-closed. Ein Projection-, Cache- oder Listentreffer wird nicht als Mutationsfreigabe interpretiert.

Dieser Change definiert keinen generischen zweiten Capability-Endpunkt. Für Mainserver-Inhalte bleibt `use-mainserver-data-provider-as-content-author` mit DataProvider-Bindung, `MutationPrincipalContext`, Same-Credential-Pre-Read und Mainserver-Autorisierung führend. Andere Fachbereiche behalten ebenfalls die Ownership über ihre Ressourcen-Capabilities. `centralize-scoped-ui-access` standardisiert nur deren UI-seitige, fail-closed Auswertung und Übergabe an Host und Plugins.

### 7. Plugin-Vertrag wird explizit und hostgeführt

Autorisierbare Plugin-Beiträge deklarieren einen Access-Bezug ausdrücklich. Für Plugin-Aktionen ist `requiredAction` nach der Migration verpflichtend und vollständig qualifiziert. Admin-Resource-Views und ihre Toolbar-, Row-, Bulk- und Detailaktionen referenzieren ebenfalls katalogisierte Actions.

Der Host:

- validiert Action- und Permission-Referenzen vor Veröffentlichung des Registry-Snapshots,
- prüft die Übereinstimmung von Plugin-Permissions und Module-IAM-Permissions,
- löst die Entscheidungen für den aktuellen Scope auf,
- übergibt Standard-Content-Editoren mindestens Create-, Update- und Delete-Capabilities,
- übergibt benutzerdefinierten Plugin-Flächen eine typsichere Map der von ihnen deklarierten Action-Entscheidungen.

Plugins dürfen daraus UI-Zustände ableiten, aber keine finale IAM-Entscheidung überschreiben und keine Rollenbezeichnung als Ersatz für eine Action-Permission verwenden.

### 8. Katalog- und Registry-Validierung wird schrittweise hart

Die vorhandene report-only Cross-Validation aus `refactor-cross-cutting-runtime-guardrails` wird wiederverwendet. Die Migration verläuft in drei Stufen:

1. Inventur und report-only Befunde für fehlende oder unbekannte Action-Bezüge.
2. Migration aller bestehenden Host- und Plugin-Beiträge mit negativer Testabdeckung.
3. Fail-fast für neue oder verbleibende unvollständige Verträge.

Eine zweite Validierungsimplementierung nur für diesen Change ist nicht vorgesehen.

### 9. PostgreSQL-Revision ist die Korrektheitsquelle für Permission-Snapshots

PostgreSQL speichert monotone Cache-Revisionen für zwei Scopes:

- `instanceRevision` gilt für alle Benutzer- und Kontext-Snapshots einer Instanz.
- `userRevision` gilt zusätzlich für genau einen `keycloakSubject` innerhalb der Instanz.

Jeder L1- und Redis-Snapshot trägt den Revisionsvektor `{ instanceRevision, userRevision }`. Ein Snapshot ist logisch ausschließlich dann gültig, wenn beide Werte exakt den aktuell in PostgreSQL gespeicherten Revisionen entsprechen. Die Revision wird über einen schmalen, indizierten Read geprüft, bevor ein Snapshot als Cache-Hit verwendet wird. Kann die aktuelle Revision nicht belastbar gelesen werden, endet die Autorisierungsanfrage mit `503`; weder ein warmer Cache noch ein künstlich leeres Permission-Set dienen als Fallback.

Berechtigungsrelevante Mutationen und Revisions-Bumps erfolgen in derselben PostgreSQL-Transaktion:

- direkte Rollen-, Gruppen-, Membership-, Delegations- oder Organisationszuordnungen eines bekannten Benutzers erhöhen dessen `userRevision`;
- Rollen-Permissions, Permission-Katalog, Rollen-/Gruppendefinitionen mit nicht vollständig und synchron beweisbarer Betroffenenmenge, Org-/Geo-Hierarchie, Modulzuweisung und instanzweite Einstellungen erhöhen die `instanceRevision`;
- Bulk-Änderungen dürfen mehrere bekannte Benutzerrevisionen gezielt erhöhen; ist die vollständige Menge nicht sicher bestimmbar, wird konservativ die Instanzrevision erhöht.

Der Commit ist die Gültigkeitsgrenze: Jede Autorisierungsanfrage, deren Revisionsread nach dem erfolgreichen Commit beginnt, muss den neuen Vektor sehen und darf keinen Snapshot der vorherigen Revision verwenden. Bereits laufende Autorisierungsanfragen werden an ihrem Revisionsread linearisiert; ihre Recompute-Ergebnisse bleiben durch den abschließenden Recheck vom Publish in eine neuere Revision ausgeschlossen. Scheitert die Mutation, rollen fachliche Änderung, Revisions-Bump und `pg_notify` gemeinsam zurück.

Das System ruft `pg_notify` innerhalb derselben PostgreSQL-Transaktion wie Datenänderung und Revisions-Bump auf; PostgreSQL stellt den Payload mit Scope und neuer Revision erst nach erfolgreichem Commit zu. Listener verwerfen passende L1-Einträge sofort und können alte Redis-Keys best-effort löschen. Verlust, Duplikat oder Verspätung des Events beeinflussen nur Eviction-Latenz und Speicherverbrauch, nicht die logische Gültigkeit.

### 10. Recompute und Snapshot-Publish sind revisionsgebunden

Ein Recompute liest Permission-Daten und den zugehörigen Revisionsvektor aus einem konsistenten PostgreSQL-Snapshot. Vor der Veröffentlichung prüft er die aktuelle Revision erneut. Hat sie sich geändert, wird das Ergebnis verworfen und als `stale_write_discarded` metriert; es darf weder in L1 noch als aktueller Redis-Snapshot veröffentlicht werden.

Gleichzeitige Recomputes desselben Instanz-/Benutzer-/Kontext-/Revisions-Keys sollen pro Replikat zusammengeführt und dürfen replikatübergreifend best-effort koordiniert werden. Diese Koordination begrenzt Last, ist aber keine Korrektheitsgrenze: Jeder Kandidat durchläuft unabhängig den Revisions-Recheck, und ein fehlgeschlagener Koordinationspfad darf keinen alten Snapshot freigeben.

Redis- und L1-Keys enthalten den Revisionsvektor beziehungsweise adressieren einen unveränderlich daran gebundenen Snapshot. Dadurch kann ein verspäteter Recompute für eine alte Revision keinen Snapshot der neuen Revision überschreiben. Sollte die Revision nach dem abschließenden Recheck und vor einem physischen Redis-Write wechseln, kann der alte Payload höchstens unter seinem alten, nicht mehr adressierbaren Revisions-Key verbleiben. Er ist niemals logisch aktuell und läuft über die physische TTL oder asynchrone Bereinigung aus.

Logische Gültigkeit und physische Aufbewahrung sind damit getrennt:

- Revisionsabweichung macht einen Snapshot sofort logisch ungültig.
- Die Redis-TTL bleibt eine Speicher- und Aufräumgrenze, keine Stale-Erlaubnis.
- `SCAN`/Delete und `NOTIFY` verbessern Speicherhygiene und L1-Reaktionszeit, sind aber keine Sicherheitsgrenze.

### 11. Invalidierung, Browser-Refetch und Session-Widerruf bleiben getrennt

- Eine revisionsbasierte Invalidierung erhöht im Rahmen der berechtigungsrelevanten Mutation ausschließlich die passende Permission-Cache-Revision und stößt best-effort Eviction an. Sie verändert keine Sessions oder Refresh-Tokens.
- Ein Browser-Refetch lädt `GET /iam/me/permissions` beziehungsweise den Effective-Access-State neu. Er erhöht keine Serverrevision und widerruft keine Session.
- Ein Session-Widerruf folgt weiterhin dem eigenen Auth-/Session-Vertrag. Er ist weder Voraussetzung noch automatische Folge einer Permission-Invalidierung.

Ein manueller Benutzer- oder Instanzreset, eine neue Reset-Action und eine entsprechende Bedienoberfläche sind nicht Bestandteil dieses Changes. Bei späterem operativem Bedarf benötigen sie einen eigenen, explizit autorisierten und auditierten Vertrag.

### 12. Fehlerverhalten und Performance

- PostgreSQL-Revisionsread nicht möglich: `503`, kein Cache-Hit.
- Redis nicht verfügbar oder revisionsgebundener Snapshot-Write fehlgeschlagen: bestehender fail-closed `503`-Vertrag bleibt erhalten.
- Recompute fehlgeschlagen: `503`, kein alter und kein leerer Snapshot.
- `NOTIFY` verloren oder Listener verzögert: Authorize bleibt durch den Revisionsread korrekt; nur Eviction und Warm-Path-Effizienz sind betroffen.

Der zusätzliche Revisionsread muss die Grenzen Cache-Hit p95 `< 10 ms`, Cache-Miss p95 `< 80 ms` und Recompute p95 `< 300 ms` einhalten. Die Implementierung muss diese Werte mit mehreren App-Replikaten und realistischem PostgreSQL-/Redis-Netzpfad nachweisen. Werden sie nicht erreicht, ist die Umsetzung zu optimieren oder die Architektur erneut zu entscheiden; ein Weglassen der autoritativen Revisionsprüfung ist kein zulässiger Performance-Fallback.

## Data Flow

```text
OIDC-Session
  -> AuthProvider (/auth/me: Identität und Session)
  -> gemeinsamer ScopeContextProvider
       -> platform: validierte technische Plattform-Session-Sicht
       -> tenant: OrganizationContext + assignedModules + /iam/me/permissions
  -> EffectiveAccessProvider (genau eine aktuelle Snapshot-Generation je Scope)
       -> pure Access-Decision-Auswertung
          -> Route-Guards
          -> Sidebar und Host-Seiten
          -> hostaufgelöste Plugin-Capabilities
             -> Plugin-Controls und Read-only-Editoren

Mutation
  -> UI-Entscheidung erlaubt Darstellung
  -> Server autorisiert erneut mit aktuellem Ressourcen- und Scope-Kontext
  -> stabiles Stale-/Scope-/Versionssignal oder Scope-Änderung invalidiert den UI-Snapshot
  -> erwartbarer Ressourcen-403 invalidiert nur die konkrete Capability
```

```text
IAM-Mutation
  -> PostgreSQL-Transaktion
       -> Rollen-/Gruppen-/Permission-Daten ändern
       -> userRevision oder instanceRevision monoton erhöhen
  -> Commit
  -> NOTIFY mit Scope + Revision (Beschleuniger)
       -> L1-Eviction je Replikat
       -> Redis-Cleanup best effort
  -> optional Browser-Refetch; kein impliziter Session-Widerruf

Authorize / me-permissions
  -> aktuelle Revision aus PostgreSQL lesen
  -> L1-Key mit exaktem Revisionsvektor prüfen
  -> Redis-Key mit exaktem Revisionsvektor prüfen
  -> bei Miss aus konsistentem DB-Snapshot recomputen
  -> Revision vor Publish erneut prüfen
       -> gleich: revisionsgebunden nach Redis und L1 publizieren
       -> geändert: Ergebnis verwerfen und neu versuchen oder 503
```

## Migration Slices

### Slice 1: Sofortige Fail-closed-Härtung

- Sidebar-Loading und Dev-Auth-Availability-Bypass entfernen.
- Alte Permission-Werte bei Scope-Wechsel und Fehler verwerfen.
- Characterization-Tests für die bekannten Fehlerbilder ergänzen.

### Slice 2: Revisionsbasierte Permission-Cache-Gültigkeit

- PostgreSQL-Schema und Migration für Instanz-/Benutzerrevisionen einführen.
- Mutationsmatrix transaktional an Revision-Bumps anbinden.
- L1-/Redis-Keys, Read-Pfad und Recompute-Publish revisionsgebunden machen.
- `NOTIFY` auf Beschleunigerrolle reduzieren und Multi-Replikat-/Eventverlust-Tests schließen.
- Revisionsdiagnostik, Metriken und Performance-Nachweis ergänzen; keinen manuellen Reset einführen.

### Slice 3: Gemeinsamer Scope- und Access-State

- Plattform-/Tenant-Scope und Organisationskontext zentralisieren.
- Effective-Access-Snapshot und pure Decision-Logik einführen.
- Modulzuweisung als zusätzliches fail-closed Gate erhalten.
- Route-Guards, Sidebar und Plugin-Snapshot auf diese Quelle umstellen.

### Slice 4: Host-Aktionen migrieren

- IAM-Benutzer, Organisationen, Rollen und Rechtstexte.
- Media, Interfaces und Monitoring.
- Content-Liste, Toolbar-, Row- und Bulk-Aktionen.

### Slice 5: Plugin-Aktionen migrieren

- Standard-Content-Plugins zuerst.
- Danach Surveys und Waste Management als Sonderfälle.
- Rollenbasierte UI-Sonderlogik durch Action-Entscheidungen ersetzen.

### Slice 6: Ressourcen-Capability-Integration und harte Validierung

- Vorhandene datensatzbezogene Mutation-Capabilities und Authorize-Verträge für scope-beschränkte Operationen inventarisieren und konsumieren.
- Fehlende serverseitige Ressourcenverträge als Blocker dem fachlich verantwortlichen Change zuordnen; Mainserver-Fälle werden mit `use-mainserver-data-provider-as-content-author` sequenziert.
- Server-Enforcement-Matrix ohne opportunistische zweite Capability-API schließen.
- Registry- und CI-Validierung auf fail-fast anheben.

## Parallelization Plan

Die revisionsbasierte Cache-Gültigkeit und die zentrale State-/Vertragsarchitektur bleiben jeweils bei einem Owner. Erst nach grünen Slices 2 und 3 werden konfliktarme Subagent-Runs parallelisiert:

1. Host-Shell, Routing und IAM-Seiten.
2. Media, Interfaces, Monitoring und Content-Liste.
3. Standard-Content-Plugins.
4. Surveys, Waste Management und übrige Sonderflächen.

Gemeinsame Dateien in `packages/iam-core`, `packages/plugin-sdk`, `packages/routing`, dem Provider und der Sidebar werden nicht gleichzeitig von mehreren Runs bearbeitet. Ein abschließender eigener Audit-Run vergleicht UI-Matrix, Registry und Server-Endpunkte.

## Alternatives Considered

### Alle Controls lokal patchen

Schnell und gut parallelisierbar, aber die konkurrierenden Permission-Quellen und optionalen Verträge bleiben bestehen. Neue Controls könnten denselben Fehler erneut einführen. Nur als erster Containment-Slice geeignet.

### Gemeinsamer Access-Contract mit schrittweiser Migration

Empfohlen. Er beseitigt die State- und Vertragsursache, lässt Spezialeditoren bestehen und ermöglicht konfliktarme Migrationen. Der Preis ist eine koordinierte Änderung an Host, Routing und Plugin-SDK.

### Sämtliche Aktionen vollständig deklarativ vom Host rendern

Maximale formale Kontrolle, aber hoher Umbauaufwand und unnötige Einschränkung komplexer Fachoberflächen. Nicht Bestandteil dieses Changes.

## Risks / Trade-offs

- Ein fail-closed Ladezustand kann Navigation kurz später sichtbar machen. Gegenmaßnahme: stabile Skeleton-Flächen statt vorzeitiger Freigabe.
- Die Umstellung kann bisher unbemerkte fehlende Grants oder falsche Katalogbezüge aufdecken. Gegenmaßnahme: report-only Inventur und Persona-Tests vor hartem Gate.
- Datensatzbezogene Capabilities erhöhen Integrations- und Testaufwand. Gegenmaßnahme: vorhandene fachliche Authorize-/Read-Modelle wiederverwenden und fehlende Verträge beim zuständigen Fach-Change schließen, statt hier eine generische Parallel-API einzuführen.
- Plattform- und Tenant-Scope könnten versehentlich vermischt werden. Gegenmaßnahme: diskriminierter Scope-Key, Root-Host-Tests und das Verbot, technische Plattformrollen für Tenant-Actions auszuwerten.
- Modul-Permissions könnten trotz entzogener Modulzuweisung sichtbar bleiben. Gegenmaßnahme: Modulzuweisung bleibt ein explizites zusätzliches Gate und Teil der Snapshot-Generation.
- Der SDK-Vertrag wird strenger und ist für unvollständige Plugin-Beiträge brechend. Gegenmaßnahme: stufenweise Migration mit deterministischen Diagnosen.
- Der parallele Guardrail-Change kann dieselben Registry-Dateien berühren. Gegenmaßnahme: Validierungsmechanik dort wiederverwenden und Merge-Reihenfolge vor Implementierungsbeginn festlegen.
- Der autoritative PostgreSQL-Revisionsread kann die Cache-Hit-Latenz erhöhen. Gegenmaßnahme: schmaler indizierter Read, gebündelte Abfrage des Revisionsvektors und verbindlicher Multi-Replikat-Benchmark ohne Abschwächung der Korrektheit.
- Ein verspäteter Recompute kann physisch einen alten revisionsgebundenen Redis-Key hinterlassen. Gegenmaßnahme: Recheck vor Publish, unveränderliche Revisions-Keys, `stale_write_discarded`-Diagnostik und TTL-/Cleanup-Aufbewahrung ohne logische Adressierbarkeit.

## Security, Accessibility and Diagnostics

- UI-Entscheidungen reduzieren irreführende oder sensitive Affordances, ersetzen aber nie Server-Autorisierung.
- Diagnosen enthalten Action-ID, Access-Zustand und sanitisierten Scope-Bezug, aber keine Tokens, Session-IDs oder PII.
- Read-only-, Loading-, Error- und Server-Denied-Zustände werden semantisch und per i18n kommuniziert.
- Ausgeblendete Aktionen hinterlassen keine fokussierbaren oder per Tastatur auslösbaren Controls.
- Deaktivierte Aktionen besitzen eine zugängliche Begründung; reine Permission-Denials exponieren keine unnötigen sensitiven Details.

## Documentation Decisions

Die Umsetzung aktualisiert mindestens:

- `docs/architecture/04-solution-strategy.md`
- `docs/architecture/05-building-block-view.md`
- `docs/architecture/06-runtime-view.md`
- `docs/architecture/08-cross-cutting-concepts.md`
- `docs/architecture/09-architecture-decisions.md`
- `docs/architecture/10-quality-requirements.md`
- `docs/architecture/11-risks-and-technical-debt.md`
- eine neue ADR unter `docs/adr/` für die Trennung von Auth-State und Effective-Access-State, den diskriminierten Plattform-/Tenant-Scope, das additive Modul-Gate und die fachlich owned Ressourcen-Capabilities
- Fortschreibung von ADR-014 für `NOTIFY` als Beschleuniger statt Korrektheitsquelle und ADR-026 für PostgreSQL-autoritativ revisionsgebundene L1-/Redis-Snapshots
- `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` für die Revisionspersistenz
- die relevanten Auth-/Plugin-/Routing-Guides unter `docs/`

## Open Questions

Keine fachlich offenen Fragen für den Proposal-Scope. Der framework-agnostische UI-Decision-Vertrag liegt in `packages/iam-core`; `plugin-sdk` darf den schmalen Consumer-Vertrag re-exportieren, und die React-Bindung bleibt im Host. Plattform- und Tenant-Scope sind diskriminiert, Modulzuweisung bleibt ein eigenes Gate, und Ressourcen-Capabilities werden ausschließlich aus den fachlich führenden Serververträgen konsumiert. PostgreSQL ist die autoritative Quelle des Permission-Cache-Revisionsvektors; Redis und L1 bleiben revisionsgebundene Beschleuniger, `NOTIFY` bleibt ein Eviction-Beschleuniger. Es wird kein neuer Package-Layer und kein generischer zweiter Capability-Endpunkt eingeführt.
