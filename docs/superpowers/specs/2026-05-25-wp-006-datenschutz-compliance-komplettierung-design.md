# WP-006 Komplettierung: Datenschutz und Compliance

## Ziel

Diese Spezifikation beschreibt, wie `WP-006` technisch und repo-seitig so komplettiert wird, dass das Arbeitspaket funktional vollständig, nachvollziehbar testbar und für eine formale Abnahme sauber vorbereitet ist.

Der Scope umfasst:

- funktionale Komplettierung der Consent-, Compliance- und Nachweisexportpfade
- repo-seitige Test- und Nachweisartefakte für Enforcement, Export und PII-Schutz
- vorbereitete Struktur für externe Betriebs- und Zielumgebungs-Evidence

Der Scope umfasst nicht:

- das Erzeugen fingierter Betriebsnachweise
- organisatorische Datenschutzprozesse außerhalb des Repos
- allgemeine Retention-, Incident- oder Governance-Programme, soweit sie nicht direkt `WP-006` blockieren

## Ausgangslage

Der aktuelle Stand deckt große Teile von `WP-006` bereits ab:

- tenantgebundene Datenschutz- und Governance-Pfade
- serverseitige Legal-Compliance-Enforcement-Logik
- Self-Service-Datenschutzfläche für DSR- und Löschregelfunktionen
- Governance-Compliance-Export
- PII-Redaction und verschlüsselte Verarbeitung sensibler IAM-Daten

Die verbleibenden funktionalen Lücken liegen vor allem in drei Bereichen:

1. Consent-Auditdaten werden nicht vollständig und konsistent in `iam.legal_text_acceptances` geschrieben.
2. Der eigentliche Zustimmungsnachweisexport ist als Library-Logik angelegt, aber nicht end-to-end als Runtime- und UI-Pfad verdrahtet.
3. Legaltexte können noch nicht zielgruppenspezifisch an Rollen und Gruppen gebunden werden.
4. Die repo-seitigen Nachweise für Enforcement und Export sind noch nicht als vollständiges Abnahmepaket konsolidiert.

## Zielbild

`WP-006` gilt nach dieser Komplettierung als technisch vollständig, wenn folgende Bedingungen gleichzeitig erfüllt sind:

1. Datenschutz- und Compliance-Pfade bleiben tenant-scoped und fail-closed abgesichert.
2. Offene Pflicht-Rechtstexte blockieren geschützte IAM-Pfade serverseitig deterministisch.
3. Akzeptanz-, Widerrufs- und gegebenenfalls Prompt-Zustände werden revisionsrelevant vollständig persistiert.
4. Zielgruppenspezifische Legaltexte können Rollen und Gruppen zugewiesen werden.
5. Nur passende Zielgruppen sehen offene Legaltexte und werden durch sie blockiert.
6. Zustimmungsnachweise können über einen dedizierten, berechtigungsgebundenen Exportpfad eingesehen oder exportiert werden.
7. Consent-Nachweisexport und DSR-Datenexport sind fachlich und technisch sauber getrennt.
8. Die relevanten Pfade sind durch Tests, Reports und Abnahmedokumente repo-seitig belastbar belegt.

## Scope-Schnitt

Die Umsetzung wird in drei zusammenhängende, aber klar trennbare Bereiche zerlegt.

### 1. Consent- und Compliance-Kern

- vollständige Auditbefüllung von `iam.legal_text_acceptances`
- semantisch konsistente Abbildung von `accepted`, `revoked` und optional `prompted`
- zielgruppenspezifische Zuordnung von Legaltexten zu Rollen und Gruppen
- dedizierter Consent-Nachweisexport mit Tenant-Scope und Rollenbindung

### 2. Admin-/UI- und API-Anbindung

- Integration des Consent-Nachweisexports in bestehende IAM-/Legal-Text-Flächen
- klare Trennung zwischen DSR-Export, Governance-Export und Consent-Nachweisexport
- keine ausschließlich UI-basierte Berechtigungslogik

### 3. Abnahme- und Evidence-Paket

- gezielte Tests für Enforcement, Export und Negativpfade
- aktualisierte oder ergänzte Reports für `WP-006`
- strukturierte Liste extern nachzureichender Betriebsnachweise

## Architektur

Die Komplettierung baut auf den bestehenden Bausteinen auf und führt keine parallelen Grundstrukturen ein.

### Führende Datenquelle

`iam.legal_text_acceptances` bleibt die führende Quelle für Akzeptanz- und Widerrufsnachweise.

Die Tabelle soll nach der Komplettierung nicht nur das minimale Akzeptanzereignis speichern, sondern die für Nachweis und Export benötigten auditrelevanten Felder vollständig und konsistent befüllen:

- `instance_id`
- `legal_text_version_id`
- `account_id`
- `accepted_at`
- `revoked_at`
- `request_id`
- `trace_id`
- `workspace_id`
- `subject_id`
- `legal_text_version`
- `action_type`

### Zielgruppenmodell für Legaltexte

Legaltexte können optional einer oder mehreren Rollen und/oder Gruppen zugewiesen werden.

Die Semantik ist:

- keine Zielgruppen hinterlegt: der Legaltext gilt tenantweit wie bisher
- mindestens eine Rolle oder Gruppe hinterlegt: nur Benutzer mit mindestens einer passenden Rolle oder Gruppe sind betroffen
- mehrere Rollen und Gruppen werden mit `OR`-Logik ausgewertet

Für die Modellierung werden getrennte relationale Zuordnungstabellen für Rollen und Gruppen verwendet. Eine generische JSON- oder Freitextmodellierung ist nicht zulässig, weil die Zielgruppen serverseitig prüfbar, exportierbar und tenant-sicher referenzierbar bleiben müssen.

### Führender Schreibpfad

Der bestehende Governance-Workflow bleibt der einzige fachliche Schreibpfad für:

- `accept_legal_text`
- `revoke_legal_acceptance`

Dadurch bleiben Auditspur, Frontend-Verhalten und Governance-Ereignisse konsistent.

### Führende Lesepfade

Es gibt künftig drei getrennte Nachweis-/Exportpfade:

1. DSR-Datenexport für Self-Service-Datenexporte
2. Governance-Compliance-Export für Governance-Auditdaten
3. Consent-Nachweisexport für Rechtstext-Akzeptanz- und Widerrufsnachweise

Der Consent-Nachweisexport wird nicht in den DSR-Export integriert und nicht als bloße Variante des Governance-Exports modelliert.

## Soll-Datenfluss

### Legal-Compliance-Enforcement

1. Ein geschützter IAM-Request läuft durch die Auth-Middleware.
2. `shouldEnforceLegalTextCompliance` entscheidet pfadspezifisch, ob Enforcement greift.
3. `withLegalTextCompliance` prüft, ob für den Benutzer im Tenant offene aktive und für ihn relevante Rechtstextversionen existieren.
4. Bei offenen Akzeptanzen endet der Request fail-closed mit `403 legal_acceptance_required`.
5. Der Fehler enthält ein sicheres `return_to`, aber keine unnötigen sensitiven Details.

### Consent-Akzeptanz

1. Das Frontend lädt offene und für den Benutzer relevante Rechtstexte über den bestehenden Pending-Legal-Texts-Pfad.
2. Akzeptanzen werden über den Governance-Workflow ausgelöst.
3. Der Workflow schreibt einen vollständigen Consent-Auditdatensatz.
4. Nach erfolgreicher Akzeptanz wird der Nutzerpfad entsperrt und Permissions werden invalidiert bzw. neu geladen.

### Consent-Widerruf

1. Ein Widerruf erfolgt über den bestehenden Governance-Schreibpfad.
2. Der bestehende Datensatz wird semantisch konsistent als widerrufen markiert.
3. Export und Nachweislogik müssen Widerrufe als eigene Nachweisart auslesen können.

### Consent-Nachweisexport

1. Ein berechtigter Benutzer ruft einen dedizierten Consent-Export-Endpoint auf.
2. Der Handler validiert Authentifizierung, Tenant-Scope und Exportberechtigung `legal-consents:export`.
3. Der Export liest die Consent-Nachweisdaten tenant-scoped aus.
4. JSON- und CSV-Ausgabe werden mit stabilen Pflichtfeldern und den zugehörigen Zielgruppeninformationen bereitgestellt.
5. Benutzer ohne Berechtigung erhalten einen expliziten Negativpfad.

## Fehler- und Sicherheitsverhalten

Alle neuen oder angepassten Pfade arbeiten fail-closed.

### Tenant-Scope

- fehlender Instanzkontext führt zu `400` oder `403`
- abweichender Benutzer- und Request-Tenant führt zu `403`
- kein stilles Tenant-Fallback bei Admin-/Exportpfaden

### Exportberechtigung

- Consent-Nachweisexport erfordert serverseitig `legal-consents:export`
- reine UI-Sichtbarkeit ersetzt keinen Permission-Check
- fehlende Berechtigung ergibt einen expliziten Negativpfad

### Compliance-Check

- Fehler in der Rechtstextprüfung führen zu `503`
- es gibt kein stilles Durchlassen bei DB- oder Konsistenzfehlern

### PII-Schutz

- Exportdaten enthalten nur erforderliche Nachweisfelder
- Logpfade verwenden bestehende Redaction-Regeln
- keine zusätzlichen Klartext-PII-Felder in Export- oder Fehlerdetails

## Funktionale Änderungen

### A. Consent-Auditfelder vollständig schreiben

Der Governance-Workflow für `accept_legal_text` und `revoke_legal_acceptance` wird so erweitert, dass die durch Migration und Exportmodell erwarteten Felder vollständig befüllt werden.

Mindestanforderungen:

- `workspace_id` wird aus dem Tenant-/Instanzkontext gesetzt
- `subject_id` wird stabil aus dem Akteurkontext oder der fachlich definierten Subject-Referenz gesetzt
- `legal_text_version` wird redundant für Export- und Nachweiszwecke gespeichert
- `action_type` wird konsistent gesetzt:
  - `accepted` bei Akzeptanz
  - `revoked` bei Widerruf
  - `prompted` nur dann, wenn ein fachlich realer Prompt-Nachweis eingeführt wird

Wenn `prompted` in diesem Scope nicht sauber fachlich abbildbar ist, bleibt dieser Zustand außer Betrieb und wird nicht halb eingeführt.

### A2. Zielgruppenbindung für Legaltexte

Legaltexte werden um relationale Zielgruppenzuordnungen erweitert.

Mindestanforderungen:

- getrennte Zuordnungstabellen für Rollen und Gruppen pro Legaltextversion
- tenant-sichere Referenzen auf bestehende Rollen und Gruppen
- `OR`-Logik bei der Wirksamkeitsprüfung
- Pending-Legal-Texts und Compliance-Enforcement berücksichtigen nur relevante Zielgruppentreffer
- Legaltexte ohne Zielgruppenzuordnung bleiben global im Tenant wirksam

Die Auswertung basiert auf serverseitig aufgelösten Rollen- und Gruppenmitgliedschaften des Benutzers im aktuellen Tenant-Kontext.

### B. Consent-Nachweisexport end-to-end verdrahten

Die bestehende Exportlogik in `legal-consent-export.ts` wird um einen Runtime-Handler und eine Routenverdrahtung ergänzt.

Mindestanforderungen:

- eigener Runtime-Handler
- Routing-Eintrag im Auth-/Runtime-Router
- Tenant-Scope-Prüfung
- Permission-Check `legal-consents:export`
- JSON- und CSV-Ausgabe
- Negativtest ohne Berechtigung

### C. UI-/Admin-Zugang zum Nachweisexport

Der Consent-Nachweisexport wird an bestehender Stelle in die IAM-/Legal-Text-Verwaltung eingebunden.

Prinzipien:

- kein neuer, fachlich paralleler Datenschutzbereich
- klare Abgrenzung zu DSR-Export und Governance-Export
- Zielgruppen von Legaltexten sind in der Verwaltung sichtbar und bearbeitbar
- nur berechtigte Benutzer sehen die Aktion
- Server bleibt die letzte Autoritätsinstanz

### D. Repo-seitige Abnahmeartefakte

Die vorhandenen Reports und Nachweisdokumente werden so ergänzt, dass sie die neue Funktionalität sauber abbilden.

Mindestumfang:

- aktualisierte `WP-006`-Abnahmeeinordnung
- ein gezielter Nachweisreport oder eine definierte Ergänzung für:
  - `403 legal_acceptance_required`
  - Akzeptanz hebt Blockade auf
  - zielgruppenspezifischer Legaltext ist nur für passende Rollen/Gruppen sichtbar und blockierend
  - nicht passende Benutzer sehen den Legaltext nicht und werden nicht blockiert
  - erfolgreicher Consent-Export
  - Negativtest ohne `legal-consents:export`
  - Konsistenzabgleich Exportdaten gegen Auditspur

## Teststrategie

### Unit- und Modultests

Die folgenden Tests sind verpflichtend anzupassen oder zu ergänzen:

- Governance-Workflow-Tests für vollständige Consent-Auditwrites
- Repository-/Read-Modell-Tests für Zielgruppenzuordnungen von Legaltexten
- Runtime-Handler-Tests für Consent-Export
- Mapping-/Exporttests für Consent-Nachweisfelder
- Negativtests für fehlende Permission und Tenant-Mismatch

### UI- und API-Tests

Die folgenden Pfade müssen repo-seitig end-to-end geprüft werden:

- geschützter Request ohne Akzeptanz -> `legal_acceptance_required`
- Akzeptanzdialog / Akzeptanzworkflow -> geschützter Pfad anschließend erlaubt
- zielgruppenspezifischer Legaltext trifft Benutzer mit passender Rolle oder Gruppe -> sichtbar und blockierend
- zielgruppenspezifischer Legaltext trifft Benutzer ohne passende Rolle oder Gruppe nicht -> unsichtbar und nicht blockierend
- berechtigter Consent-Nachweisexport -> erfolgreich
- unberechtigter Consent-Nachweisexport -> verweigert
- UI zeigt keine irreführende Vermischung von DSR-Export und Consent-Nachweisexport

### Pflichtprüfungen

Vor Abschluss der Umsetzung müssen mindestens die betroffenen Unit- und Type-Tests grün sein. Betroffene Nx-Targets und fokussierte Dateitests sind gezielt auf die angepassten Module auszurichten.

## Abnahme- und Evidence-Paket

Repo-seitig werden nur echte Nachweise erzeugt.

### Im Repo zu erzeugen

- aktualisierte oder ergänzte `WP-006`-Abnahmedokumentation
- Testprotokoll oder Report für Consent-Enforcement
- Testprotokoll oder Report für Consent-Export inklusive Negativpfad
- klare Referenz auf PII-/Redaction-Nachweise

### Außerhalb des Repos nur vorzubereiten

Die Spezifikation fordert eine saubere Struktur für folgende externen Nachweise, ohne sie im Repo vorzutäuschen:

- Staging-/Zielumgebungsexporte mit geschwärzten Testdaten
- produktionsnahe Rollen-/RLS-Prüfprotokolle
- echte Log-/OTEL-Stichproben für Redaction
- ggf. ergänzende Betriebsfreigaben oder DSB-/Legal-Abnahmen

## Nicht-Ziele

Folgende Themen sind nicht Teil dieser Komplettierung:

- vollständige organisatorische Datenschutz-Governance
- globale Nachrüstung aller Nicht-IAM-Datenobjekte auf dieselbe Nachweiskette
- Aufbau eines umfassenden Incident-Management-Programms
- Simulation externer Betriebsbelege im Repository

## Umsetzungserfolg

Die Komplettierung ist erfolgreich, wenn:

1. die funktionalen Lücken im Consent-Audit und Consent-Export geschlossen sind,
2. Legaltexte zielgruppenspezifisch an Rollen und Gruppen gebunden werden können,
3. nur passende Zielgruppen offene Legaltexte sehen und akzeptieren müssen,
4. Consent-Nachweise serverseitig tenant-scoped und permission-gesichert exportierbar sind,
5. die UI diese Funktion sauber und fachlich getrennt anbietet,
6. die Tests Enforcement, Zielgruppenlogik, Export, Negativpfade und Auditkonsistenz belegen,
7. das Repo ein konsolidiertes, ehrliches Abnahmepaket für `WP-006` enthält.
