# Change: Angebotsbausteine 3 bis 5 im IAM gemeinsam abschließen

## Why

Die noch offenen Angebotsumfänge für Paket 3 `Rollenmodell, Gruppen & Vererbungen`, Paket 4 `Permission Engine & High-Performance AuthZ` und Paket 5 `Rechtstexte & Akzeptanzsystem` sind fachlich eng gekoppelt, werden aktuell aber über vier getrennte OpenSpec-Changes verfolgt.

Diese Trennung erzeugt künstliche Abhängigkeiten genau an den kritischen Stellen:

- Gruppenmodell, Geo-Vererbung und strukturierte Permissions greifen in dieselbe Autorisierungsstrecke ein.
- Snapshot-Key, Invalidation und Redis-Delivery bauen direkt auf derselben effektiven Berechnungslogik auf.
- Rechtstext-Erzwingung und Nachweis-UI hängen an denselben IAM-, Audit- und Admin-UI-Kontrakten.

Für die Angebotsabnahme ist ein zusammenhängender Scope nachvollziehbarer: ein gemeinsamer Change bildet die fachliche Zielstrecke für Pakete 3 bis 5 vollständig ab, ohne Details aus den bisherigen Einzel-Changes zu verlieren.

## What Changes

- Paket 3:
  - Gruppenmodell als zusätzliche IAM-Entität und Berechtigungsquelle konsolidieren
  - Account-zu-Gruppen-Zuordnung und Admin-UI für Gruppenverwaltung spezifizieren
  - Hierarchische Geo-Vererbung inklusive Restriktionen und transparenter Herkunft spezifizieren
- Paket 4:
  - Strukturierte fachliche Permissions als kanonisches Modell normativ festlegen
  - Organisations- und Geo-Hierarchie in `POST /iam/authorize` und `GET /iam/me/permissions` deterministisch auswerten
  - Snapshot-Key, Snapshot-Inhalt, Invalidation und Observability für den erweiterten Scope präzisieren
  - Redis als führenden Laufzeit-Cache für Permission-Snapshots sowie endpoint-nahe Performance-Nachweise spezifizieren
- Paket 5:
  - Rechtstext-Akzeptanz als verbindliche Login-Vorbedingung spezifizieren
  - Blockierenden Akzeptanzflow im Frontend spezifizieren
  - Revisionssicheren Nachweis- und Exportpfad für Rechtstext-Akzeptanzen in Admin-UI und Audit spezifizieren
- Die bisherigen vier Changes werden in diesem einen Change konsolidiert; normative Anforderungen, Designentscheidungen und offene Aufgaben bleiben erhalten.

## In Scope

- Instanzgebundene Gruppen mit Zuweisungen, Herkunft und UI-Verwaltung
- Hierarchische Geo-Vererbung als echte Hierarchieauswertung
- Strukturierte Permissions mit Migrations- oder Kompatibilitätspfad zu `permission_key`
- Deterministische Auswertung von Rollen-, Gruppen-, Org- und Geo-Scopes
- Snapshot-Erweiterung für Org-/Geo-Kontext, Versionierung und Invalidation
- Redis-basierte Permission-Snapshots, TTL-, Recompute- und Fail-Closed-Regeln
- Endpoint-nahe Performance- und Liefernachweise für Cache-Hit, Cache-Miss und Recompute
- Login-Enforcement für offene Pflicht-Rechtstexte
- Blockierende Rechtstext-UI sowie Nachweis-, Filter- und Exportpfade
- Audit-Konsistenz zwischen UI, Export und gespeicherter Spur

## Out of Scope

- Mobile Content-Erstellung
- Vollständige Permission-Editoren oder allgemeine Governance-Workflow-Erweiterungen außerhalb der Rechtstext-Domäne
- Individuelle Account-Overrides als eigener Berechtigungsmodus
- Änderungen am Keycloak-Client-/Realm-Setup
- Vollständige juristische Pflege oder Freigabe der Rechtstexte

## Impact

- Affected specs:
  - `account-ui`
  - `iam-access-control`
  - `iam-organizations`
  - `iam-core`
  - `iam-auditing`
- Affected code:
  - `packages/auth`
  - `packages/core`
  - `packages/data`
  - `apps/sva-studio-react`
  - `docs/guides`
  - `docs/reports`
- Affected arc42 sections:
  - `05-building-block-view`
  - `06-runtime-view`
  - `07-deployment-view`
  - `08-cross-cutting-concepts`
  - `10-quality-requirements`
  - `11-risks-and-technical-debt`

## Dependencies

- Baut auf `iam-organizations`, bestehender `iam-access-control`-API und bestehender Governance-/Legal-Text-Logik auf.
- Bleibt kompatibel zu `add-iam-transparency-ui` und dem vorhandenen Redis-Betriebsprofil.

## Risiken und Gegenmaßnahmen

- Die Bündelung erhöht die fachliche Breite des Changes.
  - Gegenmaßnahme: klare Delivery-Slices für Paket 3, Paket 4A, Paket 4B und Paket 5.
- Mehrere Berechtigungsquellen erschweren Nachvollziehbarkeit und Debugging.
  - Gegenmaßnahme: deterministische Prioritätsregeln, erweiterte Reasoning-Daten und testbare Konfliktmatrix.
- Redis und eventbasierte Invalidation schaffen zusätzliche Fehlermodi.
  - Gegenmaßnahme: TTL, Versionierung, Recompute-Fallback, Readiness und Fail-Closed explizit normieren.
- Harte Rechtstext-Sperren können Supportfälle erzeugen.
  - Gegenmaßnahme: blockierender, aber eindeutiger Interstitial, dokumentierte Fehlerzustände und revisionssichere Nachweise.

## Approval Gate

Vor Start der Umsetzung müssen folgende Punkte bestätigt sein:

1. Gruppen werden als fachlich wirksame, instanzgebundene Berechtigungsquelle eingeführt.
2. Geo-Vererbung wird als echte Hierarchieauflösung und nicht als bloßer String-Match umgesetzt.
3. Strukturierte Rollen-Permissions bleiben das Primärmodell; Gruppen, Redis-Snapshots und UI werden darauf aufgebaut.
4. Redis wird für Permission-Snapshots verbindlich; bei Cache- oder Recompute-Fehlern bleibt der Autorisierungspfad fail-closed.
5. Die Abnahme für Paket 4 basiert auf endpoint-nahen Lastprofilen, nicht nur auf Mikrobenchmarks.
6. Offene Pflicht-Rechtstexte blockieren fachlichen Zugriff bis zur Akzeptanz.
7. Nachweise für Rechtstext-Akzeptanzen bleiben revisionssicher, exportierbar und konsistent zur Auditspur.

## Success Criteria

- Paket 3:
  - Gruppen, Gruppenherkunft und hierarchische Geo-Vererbung sind normativ und UI-seitig vollständig beschrieben.
- Paket 4:
  - `POST /iam/authorize` und `GET /iam/me/permissions` werten Rollen-, Gruppen-, Org- und Geo-Kontext deterministisch aus.
  - Redis-Snapshots decken Benutzer-, Instanz- und Kontextscope vollständig ab.
  - Invalidation umfasst Rollen-, Gruppen-, Membership-, Permission- und Hierarchiemutationen.
  - Performance-Nachweise für Cache-Hit, Cache-Miss und Recompute liegen als Lieferartefakte vor.
- Paket 5:
  - Offene Pflicht-Rechtstexte blockieren fachlichen Zugriff.
  - Der Akzeptanzflow ist nicht über Navigation oder Deep-Links umgehbar.
  - Administratoren können revisionssichere Einzel- und Sammelnachweise filtern und exportieren.
