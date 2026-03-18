# Design: Angebotsbausteine 3 bis 5 im IAM gemeinsam abschließen

## Context

Die verbleibenden Angebotsbausteine für Gruppen, Vererbungen, High-Performance-AuthZ und Rechtstext-Enforcement greifen in dieselben Kernmodule ein:

- `iam-access-control` für effektive Berechtigungsentscheidungen
- `iam-organizations` für den vererbbaren Hierarchieinput
- `account-ui` für Gruppen-, Transparenz- und Rechtstext-Flows
- `iam-core` für Login-, Readiness- und Betriebsverhalten
- `iam-auditing` für revisionssichere Nachweise

Die bisherige Aufteilung in vier Changes war fachlich sauber getrennt, erschwert aber die Gesamtsteuerung des Angebots: Paket 3 baut auf Paket 4A auf, Paket 4B setzt Paket 4A und Teile von Paket 3 voraus, und Paket 5 nutzt dieselben IAM- und Audit-Leitplanken.

## Goals

- Gruppen, Geo-Vererbung und strukturierte Permissions zu einem konsistenten Autorisierungsmodell zusammenführen
- Redis-basierte Permission-Snapshots als verbindlichen Laufzeitpfad beschreiben
- Rechtstext-Enforcement und Nachweis-UI in denselben IAM- und Audit-Kontext integrieren
- Aufgaben- und Deliverable-Struktur aus den bisherigen vier Changes erhalten, aber in einer gemeinsamen Änderungslogik bündeln

## Non-Goals

- Keine Mobile-Content-Authoring-Flows
- Keine allgemeine Permission-Editor-Oberfläche
- Keine individuellen Account-Overrides im ersten Schnitt
- Keine Änderungen am Keycloak-Setup
- Keine allgemeinen Governance- oder Workflow-Erweiterungen außerhalb Rechtstexten

## Delivery Slices

1. **Paket 3:** Gruppenmodell, Gruppenzuweisung, Geo-Vererbung, Transparenzdaten und Admin-UI
2. **Paket 4A:** strukturierte Permissions, Org-/Geo-Vererbung, Snapshot-Berechnung, Invalidation-Grundlagen
3. **Paket 4B:** Redis-Snapshot-Store, Eventmatrix, Fail-Closed, Readiness und Performance-Nachweise
4. **Paket 5:** Rechtstext-Enforcement im Login-Pfad, blockierender UI-Flow, Nachweis- und Exportpfade

## Nichtfunktionale Anforderungen

- **Instanzisolation:** Alle Rollen-, Gruppen-, Org-, Geo- und Rechtstext-Auswertungen bleiben auf die aktive `instanceId` begrenzt.
- **Determinismus:** Identischer Eingabekontext führt zu identischer Entscheidung und identischem Reasoning.
- **Performance:** `authorize` bleibt im Zielkorridor; Cache-Hit, Cache-Miss und Recompute werden separat gemessen und dokumentiert.
- **Observability:** Logs enthalten nur zulässige technische Felder wie `workspace_id`, `request_id`, `trace_id`, `component`, `cache_status`, `decision_source`; keine Klartext-PII. Diese Anforderung ist normativ (SHALL) und gilt für alle Komponenten dieses Changes.
- **Auditierbarkeit:** Rechtstext-Akzeptanzen, Permission-Mutationen und sicherheitsrelevante Invalidationen bleiben nachvollziehbar und exportierbar.
- **Migration Safety:** Migrations- und Kompatibilitätspfade für strukturierte Permissions bleiben verifiziert; Seeds bleiben idempotent.
- **Accessibility:** Gruppen- und Rechtstext-UI bleiben tastatur- und screenreader-bedienbar.

## Entscheidungen

### 1. Gruppen werden als eigenständige, instanzgebundene IAM-Entität modelliert

- Gruppen sind fachlich wirksam und keine bloßen UI-Metadaten.
- Effektive Rechte können aus Rollen und Gruppen gemeinsam stammen.
- Herkunft aus Gruppen wird in `GET /iam/me/permissions` und den relevanten Admin-Ansichten sichtbar.

### 2. Geo-Vererbung nutzt ein kanonisches Hierarchie-Read-Modell

- Geo-Scopes werden nicht als bloßer String-Match bewertet.
- Übergeordnete Geo-Freigaben können auf untergeordnete Einheiten wirken.
- Untergeordnete Restriktionen dürfen Parent-Freigaben überschreiben.

### 3. Strukturierte Permissions werden das kanonische Berechtigungsmodell

- Zielbild bleibt `(subject, action, resource_type, resource_id?, scope)`.
- Im ersten Schnitt bleibt `subject` indirekt über Rollen- und Gruppenzuordnungen modelliert.
- Persistiert werden mindestens `action`, `resource_type`, optional `resource_id`, `scope` und `effect`.
- Bestehende `permission_key`-Daten bleiben über Backfill oder Übergangsinterpretation auswertbar.

### 4. Org-, Gruppen- und Geo-Kontext werden gemeinsam ausgewertet

- Priorität bleibt konservativ:
  - `deny` oder Restriktion vor `allow`
  - lokale Regel vor vererbter Parent-Regel
  - konkretere Ressource vor generischer Ressource
  - expliziter Scope vor allgemeinem Scope
- Konflikte zwischen Rollen-, Gruppen-, Org- und Geo-Scope müssen reproduzierbar aufgelöst werden.

### 5. Snapshots bleiben der primäre Read-Pfad und werden anschließend nach Redis verlagert

- Paket 4A definiert Snapshot-Key und Snapshot-Inhalt für Org-/Geo-Kontext.
- Paket 4B macht Redis zum führenden Laufzeit-Cache für diese Snapshots.
- Der Redis-Key ist benutzer-, instanz- und kontextgebunden und trägt TTL-, Versionierungs- und Recompute-Signale.

### 6. Invalidation wird ereignisbasiert und übergreifend beschrieben

- Rollen-, Gruppen-, Membership-, Permission-, Hierarchie- und Geo-Mutationen müssen Redis-Snapshots invalidieren oder versioniert unbrauchbar machen.
- TTL und Recompute begrenzen Staleness bei Eventverlust.
- Invalidation-Events erhalten eine zentrale, testbare Mutationsmatrix.

### 7. Rechtstext-Akzeptanz blockiert fachlichen Zugriff vor geschützten Anwendungspfaden

- Die Prüfung erfolgt **server-seitig in einer TanStack Start Middleware** (analog zum bestehenden Auth-Middleware-Muster in `packages/auth`) — nicht nur als Frontend-Route-Guard.
- Nutzer ohne abgeschlossene Pflichtakzeptanz erhalten `403 Forbidden` auf alle geschützten API-Routen, unabhängig davon, ob die Anfrage aus dem Frontend oder direkt durch einen API-Client gestellt wird.
- Im Frontend erhalten Nutzer mit offener Pflichtakzeptanz zusätzlich einen dedizierenden, blockierenden Interstitial.
- Nach erfolgreicher Akzeptanz wird die Sperre aufgehoben und der angeforderte Pfad fortgesetzt (Deep-Link-Preservation via Session-State).
- Nutzer, die den Rechtstext ablehnen, werden ausgeloggt und landen auf der Login-Seite mit erklärendem Hinweis.

### 8. Nachweis und Export für Rechtstexte werden als explizite Admin-Funktion modelliert

- Export ist kein implizites Nebenprodukt, sondern ein UI- und Audit-Vertrag.
- Einzel- und Sammelnachweise müssen mit Auditspur und UI-Sicht konsistent bleiben.
- Unberechtigte Nutzer sehen keine sensitiven Nachweisdaten.
- Der Export-Endpoint erfordert die Permission `legal-consents:export`; dieser Check erfolgt server-seitig unabhängig vom aufrufenden Client.
- Export-Feedback enthält eine Trefferanzahl-Vorschau vor Download; Format ist JSON oder CSV.

### 9. Gruppen bündeln Rollen im ersten Schnitt (keine direkten Permissions)

- Gruppen sind im ersten Schnitt Rollen-Container — sie befähigen Accounts über Rollenzuweisungen innerhalb der Gruppe, nicht über eigene Permissions.
- Direkte Gruppen-Permissions bleiben Out-of-Scope und werden explizit als technische Schuld dokumentiert.
- Diese Entscheidung vereinfacht das Berechnungsmodell und ermöglicht die Wiederverwendung der bestehenden Rollen-Permission-Hierarchie.

### 10. Geo-Hierarchiequelle ist der kanonische Verwaltungsschlüssel des SvaMainservers

- Die autoritative Geo-Hierarchie stammt aus dem bestehenden Verwaltungsschlüssel des SvaMainservers (Landkreis → Gemeinde → Ortsteil).
- Das Geo-ID-Format folgt dem Schema `{ebene}:{schluessel}` (z. B. `district:09162`, `municipality:09162000`).
- Die Geo-Hierarchie wird als Closure-Table in PostgreSQL persistiert, um effiziente Vorfahren-/Nachfahren-Abfragen in O(1) zu ermöglichen.
- Maximale Hierarchietiefe: 5 Ebenen. Tiefere Strukturen sind nicht vorgesehen und werden abgewiesen.

### 11. Lokaler L1-Cache bleibt erlaubt; Redis ist der primäre Shared-Read-Path

- Ein lokaler In-Memory-Cache bleibt als prozesslokaler L1 erlaubt.
- Redis ist der führende, geteilte Snapshot-Store für Autorisierungspfad und `me/permissions`.
- Bei Redis-Ausfall, Snapshot-Write-Fehler oder Recompute-Fehler im sicherheitskritischen Pfad wird kein Zugriff gewährt (Fail-Closed mit HTTP `503`).
- Sicherheitskritischer Pfad umfasst alle Anfragen, die Berechtigungsentscheidungen fällen — d. h. alle geschützten Routen und API-Endpunkte.
- Redis-Timeout-Szenarien gelten als Ausfall: ein abgelaufener Snapshot darf nach TTL **nicht** als Fallback bei Recompute-Fehler genutzt werden.

### 12. Admin-Zugang für Rechtstext-Nachweise liegt unter `/admin/iam/legal-texts`

- Die Nachweis- und Export-Oberfläche ist unter `/admin/iam/legal-texts` zugänglich.
- Keine separate Rechtstext-Sicht außerhalb der IAM-Admin-Navigation.
- Die bestehende IAM-Admin-Sidebar wird um den Eintrag `legalTexts` erweitert.

## Datenmodell

- Gruppen:
  - instanzgebundene Gruppen-Entität
  - Account-zu-Gruppen-Zuordnung
  - technisch und fachlich nachvollziehbare Herkunft
- Permissions:
  - strukturierte Rollen-Permissions
  - gruppenbasierte Einbeziehung in die effektive Berechnung
  - explizite `effect`-Semantik für Restriktionen
- Geo:
  - hierarchisches Read-Modell für geografische Einheiten
  - vererbbarer Geo-Kontext als zweite Scope-Dimension
- Rechtstexte:
  - bestehende Versionierung und Akzeptanzereignisse bleiben führend
  - Nachweisexport trägt mindestens Benutzerkontext, Text, Version, Zeitpunkt, Ergebnis und Korrelation

## Berechnungsmodell

1. Eingabekontext validieren: `instanceId`, Benutzerkontext, aktiver Org-Kontext, Gruppen- und Geo-Zuschnitte
2. Snapshot lesen oder berechnen
3. Kandidatenrechte aus Rollen und Gruppen bestimmen
4. Org-Hierarchie und Geo-Hierarchie zusammenführen
5. Lokale Regeln vor vererbten Parent-Regeln auswerten
6. Restriktionen (`deny`) anwenden
7. Finale Entscheidung mit nachvollziehbarem Reasoning und Herkunftsdaten liefern

## Cache und Invalidierung

- Snapshot-Key:
  - Benutzerkontext
  - `instanceId`
  - aktiver Org-Kontext
  - Geo-Kontext
  - relevante Versionssignale
- Snapshot-Inhalt:
  - effektive Aktionen pro Ressourcentyp
  - effektive Org-/Geo-Reichweite
  - Herkunft aus Rollen und Gruppen
  - Metadaten für Hit/Miss-/Versionanalyse
- Invalidation-Trigger:
  - Rollenänderungen
  - Gruppen- und Gruppenmitgliedschaftsänderungen
  - Permission-Änderungen
  - Membership-Änderungen
  - Parent-/Hierarchy-Änderungen
  - Geo-Zuordnungsänderungen

## Sicherheit und Mandantenfähigkeit

- Kein Read über Instanzgrenzen hinweg
- Fail-Closed bei Redis- oder Recompute-Problemen im sicherheitskritischen Pfad
- Kein stillschweigender fachlicher Zugriff bei unklarem Pflichttextstatus
- Strukturierte Logs nur mit zulässigen IDs und technischen Scope-Feldern

## Performance und Verifikation

- Cache-Hit bleibt ein reiner Snapshot-Read plus In-Memory-Evaluation.
- Cache-Miss und Recompute werden endpoint-nah gemessen.
- Lieferartefakte unter `docs/reports/` dokumentieren Cache-Hit, Cache-Miss und Recompute.
- Testabdeckung umfasst:
  - Vererbungs- und Konfliktfälle
  - Invalidation und Eventverlust-Fallback
  - Login-Enforcement und Nachweisexport
  - UI-Gates und verweigerte Zustände

## Risiken / Trade-offs

- Das gebündelte Änderungsset ist groß.
  - Mitigation: klare Paket-Slices und Tasks, keine Vermischung mit Mobile Content oder allgemeinen Workflow-Features.
- Mehrere Scope-Dimensionen erschweren Debugging.
  - Mitigation: Reasoning, Herkunft und Denial-Reason explizit in Specs verankern.
- Redis-Ausfall kann den Pfad blockieren.
  - Mitigation: Readiness, Metriken, dokumentierte Fail-Closed-Regeln.
- Harte Login-Sperre kann UX verschlechtern.
  - Mitigation: nur für offene Pflichtversionen und mit klarem Interstitial.

## Migration Plan

1. Bisherige offenen Einzel-Changes fachlich in diesen gemeinsamen Change überführen.
2. Strukturierte Permission- und Gruppen-/Geo-Modelle gemeinsam normieren.
3. Snapshot- und Invalidation-Verträge vervollständigen.
4. Redis-Delivery und Performance-Artefakte darauf aufsetzen.
5. Rechtstext-Enforcement und Nachweis-UI in denselben IAM- und Audit-Vertrag integrieren.

## Open Questions

*Alle offenen Fragen wurden im Approval Gate geschlossen (Entscheidungen 9–12). Keine offenen Punkte verbleiben.*

## Modul-Eventkontrakt für Snapshot-Invalidation

Die folgenden Events werden von ihren jeweiligen Owner-Modulen publiziert und von `iam-access-control` zur Snapshot-Invalidation konsumiert. Der Kanal ist ein transaktionaler Outbox-Mechanismus (Postgres-NOTIFY oder outbox table); at-least-once-Delivery mit Idempotenz-Schutz per Event-ID.

| Event | Publisher | Payload-Pflichtfelder | Consumer-Aktion |
|-------|-----------|----------------------|----------------|
| `GroupMembershipChanged` | `packages/auth` | `instanceId`, `groupId`, `accountId`, `changeType: added\|removed`, `eventId` | Snapshot für `{instanceId}:{accountId}` invalidieren |
| `GroupDeleted` | `packages/auth` | `instanceId`, `groupId`, `affectedAccountIds[]`, `eventId` | Snapshots für alle betroffenen Accounts invalidieren |
| `OrgHierarchyChanged` | `iam-organizations` | `instanceId`, `affectedOrgIds[]`, `changeType: moved\|deleted`, `eventId` | Snapshots aller Nutzer in betroffenen Orgs invalidieren (Batch, max. 200/s) |
| `GeoAssignmentChanged` | `iam-organizations` | `instanceId`, `affectedGeoIds[]`, `eventId` | Snapshots aller Nutzer mit betroffenem Geo-Kontext invalidieren |
| `RolePermissionChanged` | `packages/auth` | `instanceId`, `roleId`, `eventId` | Snapshots aller Nutzer mit dieser Rolle invalidieren |
| `MembershipChanged` | `packages/auth` | `instanceId`, `accountId`, `orgId`, `changeType: joined\|left`, `eventId` | Snapshot für `{instanceId}:{accountId}` invalidieren |

Fanout-Budget: Bei hierarchischen Triggers (OrgHierarchyChanged, GeoAssignmentChanged) erfolgt Invalidation asynchron über eine Job-Queue mit max. 200 Keys pro Batch und 500 ms Delay-Window, um Cache-Stampede zu verhindern.

Bei Eventverlust begrenzen TTL und Recompute die Staleness-Dauer. Stale Snapshots nach TTL-Ablauf sind bei Recompute-Fehler **nicht** als Fallback zulässig (Fail-Closed).
