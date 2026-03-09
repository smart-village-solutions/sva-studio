# Change: IAM Organisationshierarchie und Organisationsverwaltung

## Why

Das aktuelle IAM verfügt zwar über Instanz-Scoping, Basis-Organisationen und User-/Rollenverwaltung, aber es fehlt ein belastbares Organisationsmodell mit Hierarchie, Organisationsarten, Mehrfach-Zugehörigkeiten, Org-Kontextwechsel und einer verwaltbaren Admin-Oberfläche. Dadurch bleiben zentrale Milestone-1-Themen wie Organisationsstruktur, organisationsbezogene Mandantenfähigkeit, Attribution im Organisationskontext und Organisationspflege im CMS nur teilweise umgesetzt.

## Kontext

Die bestehenden IAM-Bausteine decken Authentifizierung, JIT-Provisioning, Rollenverwaltung, Permissions und User-Administration bereits weitgehend ab. Für die nächste Ausbaustufe wird die fehlende Organisationsschicht benötigt, damit Accounts mehreren Organisationen zugeordnet, Organisationen strukturiert verwaltet, Organisationskontexte aktiv gewählt und spätere Hierarchie-/Vererbungsentscheidungen auf persistierten Daten aufbauen können.

## What Changes

- Hierarchisches Organisationsdatenmodell im `iam`-Schema ergänzen
- Organisationsarten und organisationsbezogene Basispolicies spezifizieren
- Mehrfach-Zugehörigkeiten von Accounts zu Organisationen fachlich absichern
- Organisationskontextwechsel (`acting_as_org`) fachlich verankern
- Organisations-CRUD-API für Admin-Nutzung definieren
- API für Organisationszuordnungen von Accounts definieren
- Erste Admin-UI für Organisationen und Org-Kontextwechsel im CMS spezifizieren
- Such-, Filter- und Strukturansicht für Organisationspflege spezifizieren

### In Scope

- Organisationen als hierarchische Knoten innerhalb einer `instanceId`
- Parent-/Child-Beziehungen und konsistente Hierarchiepfade
- Organisationsarten für kommunale und nicht-kommunale Einheiten (`county`, `municipality`, `district`, `company`, `agency`, `other` oder äquivalente Taxonomie)
- Organisationsbezogene Basispolicies wie `content_author_policy`
- Mehrfach-Zugehörigkeit eines Accounts zu mehreren Organisationen
- Mitgliedschaftsmetadaten für Organisationszuordnungen (mindestens Default-Kontext und interne/externe Sicht)
- Endpunkte und Session-Contract für aktiven Organisationskontext innerhalb der Instanz
- Admin-Endpunkte für Liste, Detail, Erstellen, Bearbeiten und Deaktivieren/Löschen von Organisationen
- Endpunkte für Account-zu-Organisation-Zuordnung und -Entzug
- Admin-UI für Organisationsliste, Detailpflege und Zuordnungen
- UI-Komponente für Org-Kontextwechsel bei Multi-Org-Accounts
- Tests, Seeds und Dokumentation für die neue Organisationsschicht

### Out of Scope

- Fachliche Hierarchie-Vererbung in `POST /iam/authorize`
- Delegierbare Organisationsadministration und feingranulare Org-Admin-Policies
- Vollständiger Bewerbungs-/Beitrittsprozess für Organisationen
- Externe Synchronisation mit Drittsystemen
- Vollständiges Organisations-Branding oder White-Label-Konfigurationen
- Graph-/Tree-Visualisierung jenseits einer einfachen Baum-/Listenansicht

### Delivery-Slices

1. **Schema Slice:** Hierarchiemodell, Organisationsarten, Policy-Felder sowie Migrations- und Seed-Anpassungen
2. **API Slice:** Organisations-CRUD, Membership-Endpunkte und Org-Kontext-Endpunkte
3. **UI Slice:** Organisationsverwaltung im Admin-Bereich plus Org-Kontextwechsel
4. **Quality Slice:** Tests, RLS-/Scope-Verifikation, Session-Contracts und Doku

## Impact

- Affected specs: `iam-organizations`, `account-ui`
- Affected code: `packages/data`, `packages/auth`, `packages/core`, `apps/sva-studio-react`
- Affected arc42 sections: `04-solution-strategy`, `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `10-quality-requirements`, `11-risks-and-technical-debt`

## arc42-Referenzen (Dateien)

- `docs/architecture/04-solution-strategy.md`
- `docs/architecture/05-building-block-view.md`
- `docs/architecture/06-runtime-view.md`
- `docs/architecture/08-cross-cutting-concepts.md`
- `docs/architecture/10-quality-requirements.md`
- `docs/architecture/11-risks-and-technical-debt.md`

## Dependencies

- Requires: bestehende IAM-Basis (`iam-core`, `iam-access-control`, `account-ui`)
- Enables later: belastbare Hierarchie-Vererbung im Access-Control-Modul, delegierte Org-Administration, Beitrittsprozesse und organisationsbezogene Branding-/Policy-Erweiterungen

## Nichtfunktionale Leitplanken

- **Sicherheit und Privacy:** Mutierende Organisations- und Kontext-Endpunkte bleiben instanzgebunden, validieren den bestehenden CSRF-Contract (`X-Requested-With`) und protokollieren keine Klartext-PII.
- **Audit und Observability:** Sicherheitsrelevante Organisationsmutationen und Org-Kontextwechsel werden als Audit-Events mit korrelierbaren IDs erfasst; IAM-Server-Code nutzt dafür den SDK-Logger statt `console.*`.
- **Accessibility und i18n:** Neue UI-Flows sind vollständig über i18n-Keys abgebildet, WCAG-2.1-AA-konform und auf 320 px, 768 px und 1024 px funktionsfähig.
- **Performance und Stabilität:** Der Change darf die bestehende Leitplanke `POST /iam/authorize` P95 < 50 ms nicht regressiv beeinflussen; Organisationslisten und Kontextwechsel werden so geschnitten, dass sie ohne unnötige Hierarchierekursion oder N+1-Reads auskommen.
- **Qualitätsgates:** Umsetzung erfordert Unit-/Integrationstests, grüne Typ-, Lint- und Qualitätsläufe sowie einen verifizierten Rollback-Pfad für DB-Migrationen.
- **Dokumentation:** Betroffene arc42-Abschnitte, i18n-/Betriebsdokumentation und relevante Runbooks werden gemeinsam mit der Umsetzung fortgeschrieben.

## Risiken und Gegenmaßnahmen

- **Hierarchie wird fachlich zu breit modelliert:** Scope auf generisches Parent-/Child-Modell mit klaren Validierungsregeln begrenzen
- **RLS und Service-Guards driften auseinander:** Instanzgrenzen in Schema, Queries und Handlern redundant absichern und mit Integrationstests prüfen
- **Org-Kontext wird ohne Membership-Prüfung gesetzt:** aktiven Kontext nur für zulässige Organisationszuordnungen akzeptieren und serverseitig erzwingen
- **Taxonomie der Organisationstypen wird zu starr:** kontrollierte, aber erweiterbare Typenliste dokumentieren und Default `other` vorsehen
- **Neue Org-Views verletzen Projektstandards für i18n/A11y:** Review und Tests explizit gegen Hardcoded-Text-, WCAG- und Responsive-Anforderungen ausrichten
- **Mutierende Endpunkte erzeugen blinde Betriebsstellen:** Audit-Dual-Write, Pflichtfelder im Logging und Negativtests für Fehler- und Denial-Pfade verbindlich vorsehen
- **UI wird zu komplex im ersten Schnitt:** initiale Oberfläche auf Liste, Detailpflege und Zuordnungen begrenzen; keine komplexe Visualisierung im ersten Slice
- **Spätere Access-Control-Erweiterung erwartet andere Felder:** stabile Hierarchiefelder (`parent_organization_id`, Pfad/Level) und dokumentierte Contracts vorsehen

## Approval Gate

Vor Start der Implementierung müssen folgende Punkte geklärt sein:

1. ✅ Das Zielmodell für Organisationen bleibt instanzzentriert; `instanceId` ist weiterhin der primäre Mandanten-Scope.
2. ✅ Der erste Schnitt umfasst Organisationsverwaltung und Org-Kontextwechsel, aber noch nicht die fachliche Vererbungslogik im Authorize-Pfad.
3. ✅ Organisationsarten und Basispolicies werden jetzt festgelegt, ohne vollständige Branding- oder Workflow-Domäne vorzuziehen.
4. ✅ Die Admin-UI wird als einfache Organisationsliste mit Detail-/Zuordnungsfunktionen und einem kleinen Org-Switcher geplant, nicht als vollständiges IAM-Backoffice.
5. ✅ `DELETE` wird im ersten Schnitt als kontrollierte Deaktivierung modelliert; physische Löschung bleibt Folgearbeit oder Admin-Maintenance-Pfad.
6. ✅ Der aktive Organisationskontext wird im ersten Schnitt sessionsbasiert geführt; ein expliziter Request-Override bleibt Folgearbeit.
7. ✅ `content_author_policy` ist im ersten Schnitt die einzige fachliche Organisations-Basispolicy; weitere Policies folgen nur bei nachgewiesenem Bedarf.
8. ✅ Nichtfunktionale Projektregeln zu i18n, Accessibility, Logging, CSRF, Qualitätsgates und Migrations-Rollback werden im Change explizit mitgeführt.
9. ✅ Betroffene arc42-Abschnitte werden im Zuge der Umsetzung aktualisiert.

## Akzeptanzkriterien (Change-Ebene)

- Organisationen können instanzgebunden als Hierarchie angelegt und geändert werden.
- Organisationen tragen einen validierten Organisationstyp und definierte Basispolicies für organisationsbezogene Attribution.
- Accounts können mehreren Organisationen derselben Instanz zugeordnet werden.
- Multi-Org-Accounts können einen aktiven Organisationskontext innerhalb ihrer zulässigen Mitgliedschaften setzen und wechseln.
- Das Backend stellt belastbare CRUD- und Zuordnungsendpunkte für Organisationen bereit.
- Das Backend stellt einen belastbaren Contract für aktiven Organisationskontext bereit.
- Die Admin-Oberfläche erlaubt mindestens das Anzeigen, Anlegen, Bearbeiten und Zuordnen von Organisationen sowie den Wechsel des Org-Kontexts.
- Instanzübergreifende Zugriffe auf Organisationen und Memberships werden auf Service- und Datenbankebene verhindert.
- Mutierende Organisations- und Kontextvorgänge erfüllen Audit-, Logging- und CSRF-Leitplanken des IAM.
- Neue Organisations-Views sind vollständig internationalisiert, tastaturbedienbar und auf definierte Responsive-Breakpoints ausgelegt.
- Migrationen für das Organisationsmodell besitzen einen dokumentierten und verifizierbaren Rollback-Pfad.
- Seeds und Migrationen bleiben idempotent und reproduzierbar.

## Status

🟢 Accepted Proposal (Review abgeschlossen, freigegeben zur Umsetzung am 2026-03-09)
