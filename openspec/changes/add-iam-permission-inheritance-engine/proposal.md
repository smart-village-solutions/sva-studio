# Change: Fine-grained Permissions und Hierarchie-Vererbung im IAM

## Why

Mit dem Organisations-Change ist die strukturelle Grundlage für Mehrfach-Zugehörigkeiten, Org-Kontext und Hierarchien vorhanden. Im Authorize-Pfad wird diese Struktur aber noch nicht fachlich ausgewertet. Dadurch bleiben zentrale Milestone-1-Themen wie vererbte Rechte über Landkreis → Gemeinde → Ortsteil, org-spezifische Berechtigungen und kontextbezogene Permission-Snapshots nur teilweise umgesetzt.

## Kontext

Die aktuelle IAM-Access-Control-Strecke liefert bereits eine zentrale `authorize`-API, RBAC-/ABAC-Basislogik, Permission-Snapshots und Invalidation-Grundlagen. Die Persistenz ist jedoch noch stark `permission_key`-orientiert und bildet feingranulare fachliche Berechtigungen nicht in der Zielstruktur `(subject, action, resource_type, resource_id?, scope)` ab. Für die nächste Ausbaustufe braucht das System ein belastbares Read-/Compute-Modell, das Organisationshierarchie, Geo-Scopes und Restriktionen deterministisch in effektive Berechtigungen überführt.

## What Changes

- Strukturiertes Berechtigungsmodell für IAM-Rollen und spätere Overrides spezifizieren
- Organisations- und Geo-Hierarchien als Eingangsgrößen der Autorisierungsberechnung verankern
- Effektive Berechtigungsauflösung für `POST /iam/authorize` und `GET /iam/me/permissions` um Vererbung und Restriktionen erweitern
- Snapshot- und Invalidation-Modell an den erweiterten Kontext anpassen
- Test-, Performance- und Dokumentationsanforderungen für die neue Berechnungsstrecke festlegen

### In Scope

- Strukturierte Persistenz von Permissions mit mindestens `action`, `resource_type`, optional `resource_id`, `scope` und `effect`
- Migrationspfad vom bestehenden `permission_key`-Modell auf das neue Read-/Compute-Modell
- Organisationshierarchie als vererbbare Scope-Dimension innerhalb einer `instanceId`
- Geo-Scope als zweite fachliche Scope-Dimension für ABAC-Entscheidungen
- Restriktive Untergrenzen auf untergeordneten Ebenen (`deny`/Restriktion überschreibt vererbte Freigabe)
- Erweiterung der effektiven Berechtigungsauflösung in `authorize` und `me/permissions`
- Cache-Snapshot-Schlüssel und Snapshot-Inhalt für aktiven Org-Kontext, Hierarchiepfad und Geo-Kontext
- Invalidation bei Änderungen an Rollen, Permissions, Memberships und Organisations-/Geo-Hierarchien
- Tests, Benchmarks und arc42-Dokumentation für die erweiterte Berechtigungsstrecke

### Out of Scope

- Neues Gruppen-Modell (`iam.groups`) als eigene Berechtigungsquelle
- Vollständige Account-Overrides für individuelle Sonderrechte
- Redis-basierte Snapshot-Speicherung als eigene Delivery-Scheibe
- Role-Management-UI oder Permission-Editoren im CMS
- Keycloak-Client-/Realm-Setup
- Delegierte Organisationsadministration und Governance-Approval-Flows

### Delivery-Slices

1. **Schema Slice:** strukturierte Permission-Felder, Migrationspfad und Seed-Anpassungen
2. **Engine Slice:** effektive Berechtigungsauflösung über Org-/Geo-Hierarchie und Restriktionen
3. **Cache Slice:** Snapshot-Format, Cache-Key und Invalidation-Regeln
4. **Quality Slice:** Tests, Benchmarks, Rollback und Architekturdoku

## Impact

- Affected specs: `iam-access-control`, `iam-organizations`
- Affected code: `packages/data`, `packages/core`, `packages/auth`
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `10-quality-requirements`, `11-risks-and-technical-debt`

## arc42-Referenzen (Dateien)

- `docs/architecture/05-building-block-view.md`
- `docs/architecture/06-runtime-view.md`
- `docs/architecture/08-cross-cutting-concepts.md`
- `docs/architecture/10-quality-requirements.md`
- `docs/architecture/11-risks-and-technical-debt.md`

## Dependencies

- Requires: `iam-organizations`, bestehende `iam-access-control`-API, bestehende Snapshot-/Invalidation-Basis
- Enables later: Gruppen-Modell, Redis-Snapshots, Permission-Editoren, delegierte Org-Administration

## Nichtfunktionale Leitplanken

- **Sicherheit und Mandantenfähigkeit:** Autorisierung bleibt strikt instanzgebunden; Hierarchie- und Geo-Auswertungen dürfen niemals über `instanceId`-Grenzen hinweg lesen.
- **Determinismus:** Identischer Eingabekontext muss zu identischer effektiver Permission-Menge und identischem `reason` führen.
- **Performance:** Die erweiterte `authorize`-Strecke muss das bestehende Ziel `P95 < 50 ms` erhalten; Cache-Miss- und Cache-Hit-Pfade werden separat gemessen.
- **Observability und Audit:** Cache-Hits, Cache-Misses, Restriktions-Denials und Invalidationen werden strukturiert mit `request_id`, `trace_id`, `workspace_id` und `component` geloggt; keine Klartext-PII in operativen Logs.
- **Qualität:** Neue Compute-Logik benötigt Unit- und Integrationsabdeckung für Positiv-, Negativ- und Konfliktpfade; Performance-Nachweis wird versioniert dokumentiert.
- **Rollback:** Schemaänderungen brauchen einen verifizierten Down-Migrationspfad; Permission-Seeds bleiben idempotent.
- **Abwärtskompatibilität:** Bestehende Permission-Keys dürfen nur kontrolliert abgelöst oder über einen Übergangspfad interpretiert werden.

## Risiken und Gegenmaßnahmen

- **Zu breites Permission-Zielmodell im ersten Schnitt:** auf Rollen-Permissions plus Snapshot-Berechnung begrenzen; Gruppen und Account-Overrides explizit verschieben
- **Vererbungslogik wird schwer nachvollziehbar:** klare Prioritätsreihenfolge (`deny` vor `allow`, lokale Restriktion vor Parent-Vererbung) dokumentieren und testen
- **Organisations- und Geo-Scope widersprechen sich:** effektive Scope-Auflösung als expliziten Schnitt im Design definieren und mit Konfliktszenarien absichern
- **Cache liefert veraltete Entscheidungen:** Invalidation auf Hierarchie- und Permission-Mutationen erweitern und TTL-Grenzen beibehalten
- **Migrationspfad bricht bestehende Rollen:** Übergangsinterpretation oder Backfill für bestehende `permission_key`-Daten festlegen
- **Performance kippt bei tiefen Hierarchien:** Hierarchiepfade und vorberechnete Scopes in Read-Modellen/Snapshots nutzen statt rekursiver Laufzeitabfragen

## Approval Gate

Vor Start der Implementierung müssen folgende Punkte geklärt sein:

1. Der erste Schnitt priorisiert strukturierte Rollen-Permissions und effektive Vererbung, nicht Gruppen oder UI-Editoren.
2. `instanceId` bleibt führend; Org- und Geo-Hierarchien werden nur innerhalb des aktiven Instanzkontexts ausgewertet.
3. Restriktionen auf untergeordneten Ebenen dürfen vererbte Freigaben einschränken.
4. Das Snapshot-Modell wird erweitert, aber nicht im selben Change auf Redis umgestellt.
5. Bestehende `permission_key`-Daten erhalten einen klaren Migrations- oder Kompatibilitätspfad.
6. Performance-, Logging- und Audit-Leitplanken werden als Teil der Umsetzung mitgetragen.

## Akzeptanzkriterien (Change-Ebene)

- Rollen-Permissions liegen in strukturierter Form vor und sind für die Berechnungsstrecke nutzbar.
- `POST /iam/authorize` berücksichtigt aktiven Org-Kontext, Organisationshierarchie, Geo-Kontext und Restriktionen deterministisch.
- `GET /iam/me/permissions` liefert effektive Berechtigungen mit den erweiterten Scope-Dimensionen.
- Vererbte Berechtigungen aus Parent-Organisationen werden korrekt auf untergeordnete Organisationen angewendet.
- Restriktionen auf untergeordneten Ebenen überschreiben vererbte Freigaben nachvollziehbar.
- Snapshot-Key und Snapshot-Inhalt bilden Org-/Geo-Kontext vollständig ab.
- Invalidation greift bei Rollen-, Permission-, Membership- und Hierarchieänderungen.
- Performance- und Qualitätsnachweise für Cache-Hit und Cache-Miss liegen vor.

## Status

🟢 Accepted Proposal (Review abgeschlossen, freigegeben zur Umsetzung am 2026-03-09)
