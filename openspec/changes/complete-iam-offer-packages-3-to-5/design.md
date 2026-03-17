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
- **Observability:** Logs enthalten nur zulässige technische Felder wie `workspace_id`, `request_id`, `trace_id`, `component`, `cache_status`, `decision_source`; keine Klartext-PII.
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

- Die Prüfung erfolgt vor fachlichem Zugriff auf geschützte `/auth/me`-basierte Anwendungspfade.
- Nutzer mit offener Pflichtakzeptanz erhalten einen dedizierten, blockierenden Interstitial.
- Nach erfolgreicher Akzeptanz wird die Sperre aufgehoben und der angeforderte Pfad fortgesetzt.

### 8. Nachweis und Export für Rechtstexte werden als explizite Admin-Funktion modelliert

- Export ist kein implizites Nebenprodukt, sondern ein UI- und Audit-Vertrag.
- Einzel- und Sammelnachweise müssen mit Auditspur und UI-Sicht konsistent bleiben.
- Unberechtigte Nutzer sehen keine sensitiven Nachweisdaten.

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

- Bündeln Gruppen im ersten Schnitt direkt Permissions, Rollen oder beides?
- Welche Geo-Hierarchiequelle ist im ersten Schnitt autoritativ?
- Bleibt neben Redis ein lokaler Fallback-Cache zulässig oder wird ausschließlich Redis genutzt?
- Liegt der Admin-Zugang für Rechtstext-Nachweise primär in `/admin/iam`, in einer dedizierten Rechtstext-Sicht oder in beiden?
