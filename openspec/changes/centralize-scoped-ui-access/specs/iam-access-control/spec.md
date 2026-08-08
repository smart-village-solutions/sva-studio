## MODIFIED Requirements

### Requirement: Cache-basierte Berechtigungs-Snapshots

Das System SHALL effektive Berechtigungen als revisionsgebundene Snapshots im lokalen L1-Cache und in Redis pro Benutzer-, Instanz- und Kontextscope verwalten. Die logische Gültigkeit MUST auf einem PostgreSQL-autoritativ bestätigten Vektor aus `instanceRevision` und `userRevision` beruhen; TTL und physische Aufbewahrung dürfen keine veraltete Entscheidung erlauben.

#### Scenario: Snapshot-Hit

- **WHEN** für den Benutzer-/Instanzkontext ein Snapshot mit exakt der aktuellen `instanceRevision` und `userRevision` vorliegt
- **THEN** wird die Autorisierungsentscheidung auf Basis dieses Snapshots getroffen
- **AND** die P95-Latenz von `POST /iam/authorize` bleibt unter den vereinbarten Cache-Hit-Grenzen

#### Scenario: Logische Gültigkeit und physische Aufbewahrung sind getrennt

- **WHEN** die aktuelle PostgreSQL-Revision von der im Snapshot gespeicherten Revision abweicht
- **THEN** ist der Snapshot sofort logisch ungültig und darf nicht verwendet werden
- **AND** darf sein physischer Redis-Key bis TTL, Eviction oder asynchroner Bereinigung bestehen bleiben
- **AND** ist die TTL ausschließlich eine Speichergrenze und keine tolerierte Stale-Dauer

### Requirement: Event-basierte Invalidierung mit Fallback

Das System SHALL Cache-Einträge bei relevanten Änderungen revisionsbasiert ungültig machen. PostgreSQL `NOTIFY` SHALL schnelle L1-Eviction und best-effort Redis-Cleanup auslösen, darf aber nicht allein für die Korrektheit verantwortlich sein.

#### Scenario: Rollenänderung invalidiert Snapshot

- **WHEN** Rollen oder relevante Kontextzuordnungen eines Benutzers erfolgreich geändert werden
- **THEN** wird die passende Benutzer- oder Instanzrevision in derselben Datenbanktransaktion monoton erhöht
- **AND** eine nachfolgende Anfrage akzeptiert keinen Snapshot der vorherigen Revision
- **AND** die Event-basierte End-to-End-Eviction-Latenz bleibt bei P95 <= 2 Sekunden und P99 <= 5 Sekunden

#### Scenario: Eventverlust wird revisionsbasiert abgefangen

- **WHEN** ein Invalidation-Event verloren geht oder verspätet verarbeitet wird
- **THEN** erkennt der Authorize-Pfad die Revisionsabweichung unabhängig vom Event
- **AND** wird kein Snapshot der alten Revision als erfolgreicher Cache-Hit verwendet
- **AND** beeinflusst der Eventverlust ausschließlich Eviction-Latenz und physische Aufbewahrung

### Requirement: Redis-basierte Permission-Snapshots

Das System SHALL effektive Berechtigungen als serialisierte, revisionsgebundene Snapshots in Redis pro Benutzer-, Instanz- und Kontextscope verwalten. Redis bleibt der primäre Shared-Snapshot-Read-Path nach erfolgreicher Bestätigung der aktuellen PostgreSQL-Revision.

#### Scenario: Snapshot-Key ist normiert, revisionsgebunden und kontextstabil

- **WHEN** ein Permission-Snapshot geschrieben oder gelesen wird
- **THEN** verwendet das System einen versionierten Key-Raum wie `perm:v2:{instanceId}:{userId}:{orgCtxHash}:{geoCtxHash}:ir{instanceRevision}:ur{userRevision}` oder einen semantisch gleichwertigen unveränderlich revisionsgebundenen Vertrag
- **AND** `instanceId` trennt Mandanten strikt
- **AND** `userId` adressiert den effektiven Benutzerkontext
- **AND** `orgCtxHash` und `geoCtxHash` repräsentieren ihre Kontexte deterministisch ohne rohe Kontextdaten unnötig im Key zu exponieren
- **AND** ein Write für eine alte Revision kann keinen Snapshot der aktuellen Revision überschreiben

#### Scenario: Cache-Miss schreibt Snapshot nach Redis

- **WHEN** für den aktuellen Revisions- und Kontextscope kein gültiger Redis-Snapshot existiert
- **THEN** werden die effektiven Berechtigungen aus einem konsistenten Snapshot der führenden IAM-Daten berechnet
- **AND** wird die Revision vor dem Publish erneut geprüft
- **AND** wird nur ein weiterhin aktueller Kandidat revisionsgebunden gespeichert

#### Scenario: Cache-Hit lädt Snapshot aus Redis

- **WHEN** für den Benutzer-/Kontextscope ein integrer Redis-Snapshot mit exakt dem aktuellen Revisionsvektor vorliegt
- **THEN** wird die Autorisierungsentscheidung auf Basis dieses Redis-Snapshots getroffen
- **AND** benötigt der Endpunkt keine erneute vollständige Permission-Berechnung

#### Scenario: TTL, Serialisierung und Eviction sind normiert

- **WHEN** ein Snapshot in Redis persistiert wird
- **THEN** beträgt die physische Basis-TTL 15 Minuten
- **AND** der Snapshot wird als JSON serialisiert
- **AND** das Payload enthält mindestens `schema_version`, `signed_at`, `permissions`, `snapshotVersion`, `instanceRevision`, `userRevision` und `hmac`
- **AND** darf ein Ablauf-, Recompute- oder Eviction-Fenster keine revisionsveraltete Freigabe erzeugen
- **AND** bleibt die Redis-Eviction-Policy Teil des Betriebsmodells, nicht der logischen Gültigkeit

### Requirement: Normierter Lese- und Schreibpfad für Snapshot-Auflösung

Das System SHALL den Snapshot-Pfad für `POST /iam/authorize` und `GET /iam/me/permissions` in definierter, revisionssicherer Reihenfolge ausführen.

#### Scenario: Lese- und Schreibpfad läuft deterministisch ab

- **WHEN** eine Autorisierungsentscheidung effektive Rechte benötigt
- **THEN** liest das System zuerst den aktuellen Revisionsvektor über einen schmalen indizierten PostgreSQL-Pfad
- **AND** prüft danach einen L1-Snapshot mit exakt diesem Vektor
- **AND** liest bei L1-Miss Redis unter dem exakt revisionsgebundenen Key
- **AND** führt erst bei Redis-Miss oder Integritätsfehler einen Recompute gegen die führenden IAM-Daten aus
- **AND** prüft die Revision vor dem Publish erneut
- **AND** schreibt einen weiterhin aktuellen Recompute zuerst revisionsgebunden nach Redis und danach in L1
- **AND** verwirft ein veraltetes Ergebnis mit `stale_write_discarded`, ohne es als aktuellen Snapshot zu veröffentlichen
- **AND** überschreitet ein Recompute maximal 6 Datenbank-Roundtrips

### Requirement: Fail-Closed für Redis- und Recompute-Fehler

Das System MUST bei nicht verifizierbarer Revision sowie bei Redis- oder Recompute-Fehlern fail-closed bleiben.

#### Scenario: Aktuelle Revision kann nicht bestätigt werden

- **WHEN** PostgreSQL für den autoritativen Revisionsread nicht erreichbar ist oder keinen belastbaren Revisionsvektor liefert
- **THEN** antworten `POST /iam/authorize` und `GET /iam/me/permissions` mit HTTP 503
- **AND** wird weder ein warmer L1-/Redis-Snapshot noch ein künstlich leeres Permission-Set als Erfolg verwendet

#### Scenario: Redis-Lookup oder Snapshot-Write schlägt fehl

- **WHEN** Redis im Autorisierungspfad nicht erreichbar ist oder ein revisionsgebundener Snapshot-Write nach Recompute fehlschlägt
- **THEN** antworten `POST /iam/authorize` und `GET /iam/me/permissions` mit HTTP 503
- **AND** wird kein fachlicher Zugriff aus einem teilweisen oder nur lokal vorhandenen Zustand abgeleitet

#### Scenario: Stale Snapshot darf nicht als Fallback dienen

- **WHEN** ein vorhandener Snapshot eine alte Revision trägt und der Recompute scheitert
- **THEN** wird kein leeres oder veraltetes Permission-Set als Notfallantwort ausgeliefert
- **AND** endet die Anfrage mit HTTP 503
- **AND** wird der Fehler als technischer Incident geloggt und metriert

### Requirement: Ereignisbasierte Invalidierung für Snapshot-Kontexte

Das System SHALL relevante IAM-Mutationen durch monotone PostgreSQL-Revisionen logisch invalidieren und L1-/Redis-Einträge ereignisbasiert best-effort entfernen.

#### Scenario: Benutzerbezogene Änderung erhöht gezielte Revision

- **WHEN** eine direkte Rollen-, Gruppen-, Membership-, Delegations- oder Organisationszuordnung eines sicher bestimmten Benutzers erfolgreich geändert wird
- **THEN** wird dessen `userRevision` innerhalb derselben Datenbanktransaktion erhöht
- **AND** bleiben Snapshots anderer Benutzer logisch gültig, sofern keine instanzweite Abhängigkeit geändert wurde

#### Scenario: Rollen- oder instanzweite Änderung erhöht vollständige Revision

- **WHEN** Rollen-Permissions, Permission-Katalog, Rollen-/Gruppendefinitionen mit nicht sicher vollständiger Betroffenenmenge, Org-/Geo-Hierarchie, Modulzuweisung oder instanzweite Einstellungen erfolgreich geändert werden
- **THEN** wird die `instanceRevision` innerhalb derselben Datenbanktransaktion erhöht
- **AND** sind alle älteren Snapshots der Instanz logisch ungültig

#### Scenario: Eventverlust beeinflusst Korrektheit nicht

- **WHEN** ein `NOTIFY`-Event nicht verarbeitet wird
- **THEN** erkennt der Revisionsread trotzdem jeden Snapshot der vorherigen Revision als ungültig
- **AND** bleiben TTL und Cleanup ausschließlich physische Fallbacks

#### Scenario: Commit definiert die Gültigkeitsgrenze

- **WHEN** eine berechtigungsrelevante Mutation einschließlich Revisions-Bump erfolgreich committet wurde
- **THEN** sieht jede danach beginnende Revisionsprüfung den erhöhten Vektor
- **AND** darf keine danach beginnende Autorisierungsanfrage einen Snapshot der vorherigen Revision verwenden
- **AND** werden bereits laufende Recomputes vor dem Publish erneut gegen die aktuelle Revision geprüft

#### Scenario: Fehlgeschlagene Mutation hinterlässt keinen partiellen Reset

- **WHEN** eine berechtigungsrelevante Mutation vor dem Commit scheitert
- **THEN** rollen fachliche Änderung, Revisions-Bump und transaktionaler `pg_notify`-Aufruf gemeinsam zurück
- **AND** wird weder eine neue Revision noch ein Invalidation-Event als erfolgreich bestätigt

#### Scenario: Mutationsmatrix normiert Revision-Scope und Event-Fanout

- **WHEN** relevante IAM-Mutationen auftreten
- **THEN** gilt folgende Matrix verbindlich:

| Mutation                                                                               | Revision-Scope       | Event / Eviction-Scope                             | Fallback-Regel                                    |
| -------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------- | ------------------------------------------------- |
| Rollen-Permission oder Permission-Katalog geändert                                     | gesamte Instanz      | `RolePermissionChanged` / Instanz                  | `instanceRevision` ist führend                    |
| Direkte Rollenzuweisung geändert                                                       | betroffener Benutzer | `account_role_assignment_changed` / Benutzer       | gezielt per `keycloakSubject`                     |
| Gruppenmitgliedschaft geändert                                                         | betroffener Benutzer | `GroupMembershipChanged` / Benutzer                | gezielt per `keycloakSubject`                     |
| Gruppe oder Gruppenrolle mit unklarer vollständiger Betroffenenmenge geändert/gelöscht | gesamte Instanz      | `GroupDeleted` oder entsprechendes Event / Instanz | konservativer Instanz-Bump                        |
| Org-Membership oder aktiver Org-Kontext geändert                                       | betroffener Benutzer | `organization_membership_changed` / Benutzer       | gezielt per `keycloakSubject`                     |
| Organisationshierarchie geändert                                                       | gesamte Instanz      | `OrgHierarchyChanged` / Instanz                    | keine Key-Aufzählung für Korrektheit erforderlich |
| Geo-Zuordnung oder Geo-Hierarchie geändert                                             | gesamte Instanz      | `GeoAssignmentChanged` / Instanz                   | keine Key-Aufzählung für Korrektheit erforderlich |
| Modulzuweisung oder instanzweite IAM-Einstellung geändert                              | gesamte Instanz      | Instanz-Event / Instanz                            | `instanceRevision` ist führend                    |

### Requirement: Eventformat und Consumer-Verhalten für Redis-Invalidierung

Das System SHALL den Modul-Eventkontrakt für schnelle Snapshot-Eviction at-least-once und idempotent konsumieren. Eventverarbeitung SHALL keine Voraussetzung für die logische Snapshot-Gültigkeit sein.

#### Scenario: Event-Payload ist normiert

- **WHEN** nach einem erfolgreichen Revisions-Bump ein Invalidation-Event publiziert wird
- **THEN** enthält es mindestens `eventId`, `event`, `instanceId`, `revisionScope`, `newRevision` und den scopespezifischen Payload
- **AND** user-scoped Events enthalten `keycloakSubject`
- **AND** wird `pg_notify` innerhalb derselben PostgreSQL-Transaktion wie Datenänderung und Revisions-Bump aufgerufen
- **AND** stellt PostgreSQL das Event erst nach erfolgreichem Commit zu

#### Scenario: Consumer verarbeitet Events idempotent

- **WHEN** ein Event mehrfach, verspätet oder in anderer Reihenfolge zugestellt wird
- **THEN** führt der Consumer nur idempotente L1-Eviction und best-effort Redis-Bereinigung aus
- **AND** kann ein Event mit kleinerer Revision keine neuere Revision zurücksetzen
- **AND** führen unbekannte oder unvollständige Payloads nicht zu stiller Snapshot-Freigabe

### Requirement: Observability- und Alerting-Vertrag für Snapshot-Betrieb

Das System SHALL den revisionsbasierten Snapshot-Betrieb mit normierten Metriken, Logs und Infrastruktur-Targets absichern.

#### Scenario: Cache- und Revisionsmetriken sind vollständig

- **WHEN** der Snapshot-Pfad gelesen, recomputet, publiziert, zurückgesetzt oder best-effort bereinigt wird
- **THEN** emittiert das System mindestens OTEL-Metriken für Revision-Read-Latenz/-Fehler, L1-/Redis-Lookups (`hit`/`miss`/`revision_mismatch`), Revisionsscope, Event-Eviction, Recompute-Aktivität und `stale_write_discarded`
- **AND** strukturierte Logs verwenden mindestens die Operationen `revision_read`, `cache_lookup`, `cache_evict`, `cache_recompute`, `cache_publish`, `stale_write_discarded` und die jeweiligen Fehleroperationen
- **AND** enthalten sie Revision-Scope, alte/neue beziehungsweise erwartete/tatsächliche Revision, `instance_id`, Request-ID und Trace-ID, aber keine Tokens, Session-IDs oder PII

#### Scenario: Redis-Exporter ist Bestandteil des Betriebsmodells

- **WHEN** der Monitoring-Stack für die IAM-Autorisierung betrieben wird
- **THEN** ist `redis-exporter` als Prometheus-Scrape-Target vorgesehen
- **AND** korreliert Alerting Applikationsmetriken (`sva_iam_cache_*`) mit Redis- und PostgreSQL-Infrastrukturmetriken

#### Scenario: Lastprofile und Berichtsformat sind verbindlich

- **WHEN** Performance-Nachweise für die revisionsbasierte Snapshot-Strecke erstellt werden
- **THEN** enthalten sie mindestens mehrere App-Replikate, warme L1-/Redis-Caches und `N = 100` gleichzeitige Requests für `lokal` und `Slow-4G`
- **AND** dokumentiert der Bericht Testprofil, Messumgebung, Replikatzahl, Stichprobenzahl, p50/p95/p99, Abnahmegrenzen, verwendete Endpunkte und Abweichungen

### Requirement: Endpoint-nahe Performance-Verifikation für Authorize

Das System SHALL die revisionsbasierte Redis-gestützte Authorize-Strecke endpoint-nah unter Last verifizieren.

#### Scenario: Lastprofil wird mit Bericht nachgewiesen

- **WHEN** die Authorize-Strecke gegen das vereinbarte Lastprofil mit 100 gleichzeitigen Requests, mehreren App-Replikaten und realistischem PostgreSQL-/Redis-Netzpfad getestet wird
- **THEN** werden mindestens revisionsbestätigter L1-/Redis-Hit, Cache-Miss, Recompute, paralleler Revision-Bump und verworfener Stale-Write gemessen
- **AND** gelten die Abnahmegrenzen Cache-Hit p95 < 10 ms, Cache-Miss p95 < 80 ms und Recompute p95 < 300 ms
- **AND** werden die Ergebnisse versioniert als Bericht unter `docs/reports/` mit den Pflichtfeldern Testprofil, Messumgebung, Replikatzahl, Stichprobenzahl und p50/p95/p99 dokumentiert

### Requirement: Normierte Abnahmematrix für Vererbung, Cache, Invalidierung und Migration

Das System SHALL eine tabellarische Abnahmematrix bereitstellen, die Vererbung, Restriktionen, revisionsgebundene L1-/Redis-Snapshots, Event-Eviction und Mixed-State-Migration in einem gemeinsamen Multi-Replikat-Testset normiert.

#### Scenario: Abnahmematrix deckt alle Pflichtkategorien ab

- **WHEN** die technische Abnahme vorbereitet oder nachgewiesen wird
- **THEN** enthält die Matrix mindestens Org-/Geo-Vererbung, Cache-Hit/-Miss, Grant, Revocation, transaktionale Benutzer-/Instanzinvalidierung, verlorene/verspätete/duplizierte Events, parallele Mutationen/Recomputes, Redis-/DB-Ausfälle und Performance
- **AND** dokumentiert jeder Fall Ausgangslage, Revisionsvektor, Mutation oder Anfrage, erwarteten Cache-Status und normatives Ergebnis

#### Scenario: Revisions-Abnahmematrix ist tabellarisch normiert

- **WHEN** die Abnahmematrix erstellt wird
- **THEN** gilt mindestens folgende Tabelle verbindlich:

| Kategorie                                     | Ausgangslage                                        | Mutation / Anfrage                              | Erwarteter Cache-Status                  | Erwartetes Ergebnis                               |
| --------------------------------------------- | --------------------------------------------------- | ----------------------------------------------- | ---------------------------------------- | ------------------------------------------------- |
| Revisionsbestätigter Hit                      | zwei Replikate, L1 und Redis warm, Revision `i1/u1` | wiederholtes `POST /iam/authorize`              | `hit`                                    | identische Entscheidung ohne Permission-Recompute |
| Benutzer-Grant                                | Benutzer-Snapshot `i1/u1` warm                      | direkte Rolle zuweisen und `u2` committen       | `miss`/`recompute` für Benutzer          | Grant sichtbar, andere Benutzer bleiben gültig    |
| Benutzer-Revocation                           | Benutzer-Snapshot `i1/u2` warm                      | direkte Rolle entziehen und `u3` committen      | alter Snapshot `revision_mismatch`       | Revocation sofort wirksam                         |
| Instanzweiter Rollen-Permission-Change        | mehrere Benutzer/Replikate warm                     | Rollen-Permission ändern und `i2` committen     | alle alten Snapshots `revision_mismatch` | vollständiger instanzweiter Recompute bei Bedarf  |
| Verlorenes Event                              | alte L1-Einträge bleiben physisch                   | Revision wird ohne zugestelltes `NOTIFY` erhöht | `revision_mismatch`                      | keine Stale-Freigabe                              |
| Verspätetes/dupliziertes Event                | neuere Revision bereits aktiv                       | altes Event trifft ein                          | unverändert                              | neuere Revision bleibt führend                    |
| Recompute-vs.-Mutation                        | Recompute für `i1/u1` läuft                         | Mutation committet `u2` vor Publish             | `stale_write_discarded`                  | alter Kandidat wird nicht aktuell publiziert      |
| Physisch alter Redis-Key                      | Key für `i1/u1` existiert nach Reset                | Anfrage liest aktuellen Vektor `i1/u2`          | alter Key unadressierbar                 | TTL/Cleanup entfernt ihn später                   |
| Redis-Ausfall                                 | Revision lesbar, Redis nicht erreichbar             | `POST /iam/authorize`                           | Fehler                                   | HTTP 503, kein L1-Fallback-Erfolg                 |
| Datenbankausfall                              | L1 und Redis warm                                   | Revisionsread scheitert                         | Fehler                                   | HTTP 503, kein warmer Cache-Hit                   |
| Mixed-State-Migration                         | v1- und v2-Keys vorhanden                           | Zugriff nach Aktivierung des Revisionsvertrags  | nur v2 revisionsfähig                    | v1 wird nie als aktueller Erfolg verwendet        |

### Requirement: API-Erweiterungskontrakt für Autorisierungsendpunkte

Das System SHALL die Felder in `POST /iam/authorize` und `GET /iam/me/permissions` additiv und nicht-brechend ergänzen. `GET /iam/me/permissions` MUST den tatsächlich ausgewerteten Tenant-Scope ausweisen und bei nicht belastbarer Auflösung mit einem stabilen Fehler antworten, ohne einen partiell erlaubenden oder veralteten Snapshot auszuliefern.

**Normatives JSON-Beispiel `POST /iam/authorize` Response:**

```json
{
  "allowed": true,
  "reason": "allowed_by_abac",
  "instanceId": "de-musterhausen",
  "action": "content.read",
  "resourceType": "content",
  "resourceId": "article-1",
  "cacheStatus": "hit",
  "snapshotVersion": "f84a6f7b9c3d2e10",
  "permissionRevision": {
    "instance": 42,
    "user": 7
  },
  "provenance": {
    "sourceKinds": ["group_role"],
    "inheritedFromGeoUnitId": "geo-bw"
  }
}
```

Bei Verweigerung enthält `reason` einen maschinenlesbaren Code, beispielsweise `geo_scope_mismatch`, `hierarchy_restriction` oder `instance_scope_mismatch`. Ein erwartbarer Ressourcen-Denial ist von einem stabilen Stale-, Scope- oder Snapshot-Versionssignal unterscheidbar. Der bestehende Error-Envelope bleibt für echte `4xx/5xx`-Fehler stabil.

**Normatives JSON-Beispiel `GET /iam/me/permissions` Response (Auszug):**

```json
{
  "instanceId": "de-musterhausen",
  "organizationId": "uuid-org",
  "permissions": [
    {
      "action": "content.write",
      "resourceType": "content",
      "organizationId": "uuid-org",
      "sourceRoleIds": ["uuid-role"],
      "sourceGroupIds": ["uuid-group"],
      "scope": {
        "allowedGeoUnitIds": ["geo-bw"],
        "restrictedGeoUnitIds": ["geo-bw-stuttgart"]
      },
      "provenance": {
        "sourceKinds": ["group_role"]
      }
    }
  ],
  "cacheStatus": "hit",
  "snapshotVersion": "f84a6f7b9c3d2e10",
  "permissionRevision": {
    "instance": 42,
    "user": 7
  },
  "provenance": {
    "hasGroupDerivedPermissions": true,
    "hasGeoInheritance": true
  }
}
```

#### Scenario: Me-Permissions akzeptiert optionalen Geo-Kontext additiv

- **WHEN** `GET /iam/me/permissions` mit `geoUnitId` und `geoHierarchy` aufgerufen wird
- **THEN** werden diese Werte nur als additive Laufzeitdimension für Snapshot-Key, Provenance und Scope-Auswertung verwendet
- **AND** ungültige Geo-Parameter werden mit `400 invalid_request` abgewiesen

#### Scenario: Me-Permissions weist den ausgewerteten Organisationskontext aus

- **WHEN** `GET /iam/me/permissions` für eine aktive Organisation aufgerufen wird
- **THEN** enthält die Antwort die tatsächlich ausgewertete `instanceId` und `organizationId`
- **AND** bleiben Grants anderer Organisationen für diese Antwort wirkungslos

#### Scenario: Permission-Auflösung ist nicht belastbar

- **WHEN** der Server den aktuellen Permission-Snapshot nicht aus führenden Daten oder einem gültigen Cache auflösen kann
- **THEN** antwortet er mit einem stabilen Fehlerstatus, insbesondere `503` bei technischer Nichtverfügbarkeit
- **AND** liefert er weder einen partiell erlaubenden noch einen veralteten Snapshot
- **AND** darf der UI-Consumer daraus keine Action-Freigabe ableiten

#### Scenario: Response weist den bestätigten Revisionsvektor aus

- **WHEN** `POST /iam/authorize` oder `GET /iam/me/permissions` erfolgreich auf einem revisionsbestätigten Snapshot antwortet
- **THEN** enthält die Antwort den verwendeten `permissionRevision`-Vektor aus Instanz- und Benutzerrevision
- **AND** kann ein stabiler Stale-, Scope- oder Versionsfehler erwartete und tatsächliche Revision maschinenlesbar ausweisen
- **AND** darf der Browser daraus nur einen Refetch, aber weder einen Server-Reset noch einen Session-Widerruf ableiten

#### Scenario: Consumer mit strict-parse erhält unbekannte Felder

- **WHEN** ein Consumer `POST /iam/authorize` oder `GET /iam/me/permissions` aufruft und neue optionale Felder im Response erscheinen
- **THEN** bleiben alle bisherigen Felder unverändert und rückwärtskompatibel
- **AND** neue optionale Felder sind additive Erweiterungen

### Requirement: Integrität von Redis-Permission-Snapshots

Das System MUST revisionsgebundene Redis-Snapshots gegen unbefugte Manipulation und eine falsche Zuordnung zu Revision oder Kontext schützen.

#### Scenario: Snapshot wird mitsamt Revision und Kontext signiert

- **WHEN** ein Permission-Snapshot in Redis geschrieben wird
- **THEN** wird der kanonisch serialisierte Payload einschließlich `schema_version`, `signed_at`, `instanceRevision`, `userRevision`, Instanz-, Benutzer- und Kontextbindung sowie Permissions mit HMAC-SHA-256 signiert
- **AND** liegt der Signaturschlüssel außerhalb von Redis

#### Scenario: Integritäts- oder Bindungsprüfung schlägt fehl

- **WHEN** Signatur, Schema-Version, Revisionsvektor oder Kontextbindung eines gelesenen Redis-Snapshots fehlt oder nicht zum angeforderten Key passt
- **THEN** wird der Snapshot verworfen und wie ein Cache-Miss behandelt
- **AND** wird der Vorfall ohne Secrets oder PII als `integrity_check_failed` strukturiert geloggt und metriert

## ADDED Requirements

### Requirement: UI-Consumer projizieren strukturierte Tenant-Permissions ohne neue IAM-Semantik

Das System SHALL strukturierte effektive Permissions aus `GET /iam/me/permissions` über den framework-agnostischen UI-Decision-Vertrag in `@sva/iam-core` auswerten. Diese Auswertung MUST Scope-, Modul- und vorhandene Ressourceninformationen konservativ kombinieren, darf aber keine Rollen-, Gruppen-, Ownership- oder ABAC-Regeln im Client neu berechnen.

#### Scenario: Strukturierter Scope wird nicht verlustbehaftet abgeflacht

- **WENN** eine effektive Permission auf `own`, `organization`, Geo, `resourceId` oder andere ABAC-Bedingungen begrenzt ist
- **DANN** bleibt diese Einschränkung im UI-Read-Modell maschinenlesbar erhalten
- **UND** darf ein Consumer aus dem bloßen Vorkommen der Action-ID keine unbeschränkte Ressourcenfreigabe ableiten

#### Scenario: Modulzuweisung fehlt

- **WENN** eine modulgebundene Action im Permission-Snapshot vorkommt
- **UND** das zugehörige Modul in der fail-closed Session-Sicht nicht zugewiesen ist
- **DANN** projiziert der UI-Decision-Vertrag die Anforderung als nicht erlaubt
- **UND** berechnet er keine alternative Modulfreigabe aus Plugin- oder Katalogmetadaten

#### Scenario: Technische Plattformrolle wird ausgewertet

- **WENN** eine dokumentierte Root-/Control-Plane-Fläche eine technische Plattformrolle verlangt
- **DANN** verwendet der UI-Decision-Vertrag ausschließlich den diskriminierten Plattform-Scope der validierten Session-Sicht
- **UND** darf diese Rolle keine tenantgebundene Action freigeben

### Requirement: Datensatzbezogene UI-Capabilities konsumieren fachlich führende Serververträge

Das System MUST für konkrete Ressourcenmutationen mit `own`-, `organization`-, Geo-, Ressourcen- oder vergleichbaren Bedingungen eine Capability aus dem jeweils fachlich führenden serverautoritativen Read- oder Authorize-Vertrag konsumieren. Ein globaler Action-Name, Listen- oder Projection-Treffer SHALL dafür nicht ausreichen. Dieser Change SHALL keinen generischen zweiten Capability-Endpunkt oder konkurrierende Ownership-Semantik einführen.

#### Scenario: Vorhandenes Read-Modell enthält Mutation-Capabilities

- **WENN** eine Detail- oder Listenfläche Mutationscontrols für eine scope-beschränkte Ressource rendern soll
- **DANN** übernimmt der UI-Decision-Vertrag die konkrete Capability aus dem fachlich führenden serverautoritativen Read-Modell
- **UND** bleibt die Capability an Ressource, Action, Instanz und gegebenenfalls Organisation gebunden

#### Scenario: Bestehender Authorize-Vertrag ist die führende Quelle

- **WENN** ein Fachbereich eine aktuelle Ressourcenentscheidung über seinen bestehenden Authorize-Pfad liefert
- **DANN** konsumiert die UI diese Entscheidung, ohne dieselbe Ownership- oder ABAC-Regel im Client nachzubauen
- **UND** bleibt die Mutation selbst erneut serverseitig autorisiert

#### Scenario: Ressourcen-Capability fehlt

- **WENN** der Client zwar eine passende Action-ID im aktuellen Permission-Snapshot sieht
- **UND** für eine scope-beschränkte Zielressource keine belastbare Capability besitzt
- **DANN** bleibt die konkrete Mutation in der UI fail-closed
- **UND** wird kein generischer Fallback auf `allowed` angenommen

#### Scenario: Mainserver-Inhalt verwendet den führenden DataProvider-Vertrag

- **WENN** eine Mainserver-Ressource mit `own`- oder `organization`-Scope bearbeitet werden soll
- **DANN** bleibt der Vertrag aus `use-mainserver-data-provider-as-content-author` für DataProvider-Bindung, `MutationPrincipalContext`, Same-Credential-Pre-Read und Mainserver-Autorisierung führend
- **UND** fügt dieser Change keine konkurrierende Client-Ownership-Entscheidung hinzu

#### Scenario: Berechtigung wird zwischen Anzeige und Mutation entzogen

- **WENN** eine Capability bei der Anzeige noch erlaubt war
- **UND** die aktuelle serverseitige Autorisierung die Mutation später verweigert
- **DANN** führt der Server die Mutation nicht aus
- **UND** invalidiert der Client ohne stabiles Stale-, Scope- oder Versionssignal nur die konkrete Ressourcen-Capability
