# Design: Fine-grained Permissions und Hierarchie-Vererbung im IAM

## Kontext

Die bestehende IAM-Access-Control-Strecke bietet bereits zentrale Authorize-Endpunkte, Permission-Snapshots und eine erste RBAC-/ABAC-Auswertung. Mit dem Organisations-Change steht nun eine belastbare Hierarchiestruktur zur Verfügung. Für Milestone 1 fehlt aber die fachliche Kopplung zwischen strukturierten Berechtigungen, Organisations-/Geo-Hierarchien und den effektiven Berechtigungsentscheidungen.

## Ziele

- Strukturierte fachliche Permissions statt ausschließlich flacher `permission_key`-Strings modellieren
- Effektive Berechtigungen deterministisch über Organisations- und Geo-Hierarchie auflösen
- Restriktionen auf untergeordneten Ebenen sauber in die finale Entscheidung einbeziehen
- Snapshot- und Invalidation-Modell an den erweiterten Kontext anpassen
- Performance- und Observability-Leitplanken der bestehenden Access-Control-Strecke erhalten

## Nicht-Ziele

- Keine Einführung eines vollständigen Gruppen-Modells
- Keine UI zur Verwaltung einzelner Permissions
- Keine Redis-Migration für Snapshots im selben Change
- Keine vollständigen individuellen Account-Overrides
- Keine Änderung des Keycloak-Setups

## Nichtfunktionale Anforderungen

- **Instanzisolation:** Alle Hierarchie-, Scope- und Permission-Reads bleiben auf die aktive `instanceId` begrenzt.
- **Determinismus:** Entscheidungen müssen bei identischem Request- und Snapshot-Kontext stabil reproduzierbar sein.
- **Performance:** `authorize` bleibt auf `P95 < 50 ms`; Cache-Hit und Cache-Miss werden getrennt gemessen.
- **Observability:** Logs enthalten `workspace_id`, `request_id`, `trace_id`, `component`, `decision_source`, `cache_status`; keine Klartext-PII.
- **Auditierbarkeit:** Änderungen an Permission-Daten und relevante Invalidationen bleiben auditierbar.
- **Migration Safety:** Up- und Down-Migrationen sind verifiziert; Seeds bleiben idempotent.

## Entscheidungen

### 1. Strukturierte Permissions werden als kanonisches Modell eingeführt

- Das Zielmodell orientiert sich fachlich an `(subject, action, resource_type, resource_id?, scope)`.
- Für den ersten Schnitt bleibt `subject` indirekt über die Rollen-/Zuordnungsquelle modelliert.
- Persistiert werden mindestens:
  - `action`
  - `resource_type`
  - optional `resource_id`
  - `scope` als strukturierter Kontext
  - `effect` (`allow` oder `deny`)

### 2. Vererbung wird entlang der Organisationshierarchie berechnet

- Der aktive Organisationskontext liefert den Einstiegspunkt.
- Parent-Berechtigungen können auf untergeordnete Organisationen vererbt werden.
- Untergeordnete Restriktionen dürfen vererbte Freigaben einschränken.
- Vererbung ist immer instanzgebunden; instanzfremde Hierarchiepfade sind unzulässig.

### 3. Geo-Scope wird als zweite Scope-Dimension behandelt

- Geo-Scopes werden getrennt von der Organisationshierarchie modelliert, aber in dieselbe effektive Berechnung einbezogen.
- Eine effektive Freigabe benötigt Konsistenz zwischen Org- und Geo-Scope, sofern beide für die angefragte Ressource relevant sind.
- Konflikte zwischen Org- und Geo-Scope führen deterministisch zu einer Verweigerung.

### 4. Prioritätsreihenfolge wird explizit und konservativ gehalten

- `deny`/Restriktion vor `allow`
- lokale Regel vor vererbter Parent-Regel
- konkretere Ressource vor generischer Ressource
- expliziter Scope vor allgemeinem Scope

### 5. Snapshots bleiben der primäre Read-Pfad

- Der Snapshot-Key wird um aktiven Org-Kontext und relevante Scope-Dimensionen erweitert.
- Der Snapshot-Inhalt enthält bereits aufgelöste effektive Berechtigungen und Scope-Daten, damit `authorize` im Hit-Pfad reine In-Memory-Checks ausführt.
- Die Redis-Auslagerung bleibt Folgearbeit; dieser Change erweitert nur das bestehende Snapshot-Modell.

### 6. Invalidation reagiert auch auf Strukturänderungen

- Änderungen an Rollen oder Permissions invalidieren betroffene Snapshots.
- Änderungen an Organisationshierarchie, Memberships oder Geo-Zuordnungen invalidieren ebenfalls betroffene Snapshots.
- Invalidation bleibt event-basiert mit bestehendem Fallback über TTL/Recompute.

## Datenmodell

Zielbild im `iam`-Schema:

- Rollen-Permissions werden von einem flachen `permission_key`-Read-Modell auf strukturierte Felder erweitert.
- Scope-Daten sind maschinenlesbar und für Snapshot-Backfills nutzbar.
- Bestehende Rollen- und Account-Zuordnungen bleiben erhalten.

Zusätzliche Regeln:

- Strukturierte Permissions sind instanzgebunden.
- `resource_id` bleibt optional, damit generische und konkrete Rechte kombiniert werden können.
- `effect = deny` wird nur für explizite Restriktionen genutzt.
- Bestehende `permission_key`-Daten erhalten entweder einen Backfill oder eine Übergangsinterpretation, bis alle relevanten Seeds migriert sind.

## Berechnungsmodell

Eingangsgrößen der effektiven Berechnung:

- aktive `instanceId`
- aktiver Benutzer bzw. impersonierter Zielkontext
- aktiver Organisationskontext
- verfügbare Rollen-Permissions
- Organisationshierarchiepfad
- Geo-Kontext
- aktive Delegationen, soweit bereits Bestandteil des bestehenden Modells

Vereinfachte Auswertungsreihenfolge:

1. Eingabekontext validieren (`instanceId`, Org-Zugehörigkeit, Scope-Form)
2. relevante Snapshot-Daten lesen oder berechnen
3. Kandidaten-Permissions für `action` und `resource_type` bestimmen
4. direkte/lokale Regeln vor vererbten Parent-Regeln auswerten
5. Geo- und Org-Scope zusammenführen
6. Restriktionen (`deny`) anwenden
7. finale Entscheidung mit `reason` und optionalem Scope-Kontext zurückgeben

## Cache und Invalidierung

- Snapshot-Key: mindestens Benutzerkontext, `instanceId`, aktiver Org-Kontext und weitere scope-relevante Dimensionen
- Snapshot-Inhalt:
  - effektive Aktionen pro Ressourcentyp
  - effektive Org-/Geo-Reichweite
  - Metadaten für Hit/Miss-/Version-Analyse
- Invalidation-Trigger:
  - Rollenänderungen
  - strukturierte Permission-Änderungen
  - Membership-Änderungen
  - Parent-/Hierarchy-Änderungen
  - Geo-Zuordnungsänderungen

## Sicherheit und Mandantenfähigkeit

- Kein Hierarchie- oder Scope-Read über Instanzgrenzen hinweg
- Verweigerung bei ungültigem aktivem Org-Kontext oder inkonsistenter Scope-Kombination
- Strukturierte Logs nur mit zulässigen IDs und technischen Scope-Angaben
- Audit-Events für Permission-Mutationen und sicherheitsrelevante Invalidationen

## Performance und Verifikation

- Cache-Hit-Pfad muss reine In-Memory-Evaluation bleiben
- Cache-Miss-Pfad muss Hierarchie- und Scope-Daten möglichst ohne rekursive N+1-Abfragen laden
- Verifikation umfasst:
  - Unit-Tests für Vererbungs- und Konfliktregeln
  - Integrationsläufe für Migrations- und Invalidation-Pfade
  - dokumentierte Performance-Messungen für Hit und Miss

## Risiken / Trade-offs

- Strukturierte Permissions erhöhen die Modellkomplexität.
  - Mitigation: Scope auf Rollen-Permissions begrenzen, Gruppen und Account-Overrides verschieben.
- Restriktionslogik kann fachlich uneindeutig werden.
  - Mitigation: feste Prioritätsreihenfolge im Spec und im Code dokumentieren.
- Cache-Keys können zu grob oder zu fein geschnitten werden.
  - Mitigation: Schlüssel explizit definieren und mit Hit/Miss-Metriken überwachen.
- Migration kann bestehende Seeds oder Tests brechen.
  - Mitigation: Backfill-/Kompatibilitätspfad und Rollback-Nachweis verpflichtend machen.

## Migration Plan

1. Strukturierte Permission-Felder oder Zieltabellen rückwärtskompatibel ergänzen.
2. Bestehende Basis-Permissions über Backfill oder Seed-Neuschreibung in das Zielmodell überführen.
3. Snapshot-Berechnung parallel auf das neue Modell umstellen.
4. Tests, Benchmarks und Invalidationen auf den neuen Kontext erweitern.
5. Down-Migration und Seed-Wiederholbarkeit vor Implementierungsfreigabe verifizieren.
