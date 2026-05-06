## ADDED Requirements
### Requirement: Waste-Management-Mutationen sind revisionsfaehig auditierbar

Das System SHALL fuer alle Mutationen des Waste-Management-Moduls revisionsfaehige Audit-Events erzeugen.

#### Scenario: CRUD- und Zuordnungsoperationen erzeugen Auditspur

- **WHEN** Waste-Masterdaten, Abholorte, Touren, Datumsverschiebungen oder Zuordnungen erstellt, geaendert oder geloescht werden
- **THEN** entsteht jeweils ein Audit-Event mit Zeitpunkt, pseudonymisierter Actor-Referenz, Instanzkontext, fachlicher Operation und Ergebnis
- **AND** Klartext-PII oder rohe Request-Payloads werden nicht unveraendert in die Auditspur geschrieben

### Requirement: CSV-Import, Seed und Reset erzeugen erweiterte Auditmetadaten

Das System SHALL fuer Waste-Management-Data-Tools erweiterte, aber sichere Auditmetadaten protokollieren.

#### Scenario: CSV-Import bleibt nachvollziehbar

- **WHEN** ein Benutzer einen Waste-CSV-Import ausfuehrt
- **THEN** enthaelt das Audit-Event mindestens Instanzkontext, Action-Namespace, Ergebnis sowie Counts fuer verarbeitete, uebersprungene und fehlgeschlagene Datensaetze
- **AND** importierte Freitextinhalte oder PII werden nicht ungefiltert in die Auditdaten geschrieben

#### Scenario: Seed und Reset sind als Hochrisiko-Ereignisse erkennbar

- **WHEN** ein Seed oder Reset fuer Waste-Daten ausgefuehrt wird
- **THEN** ist das Audit-Ereignis als Hochrisiko-Operation unterscheidbar
- **AND** es enthaelt Scope, Ergebnis, best-effort `request_id` und `trace_id`
- **AND** Reviewer koennen Actor, Instanz und betroffenes Werkzeug revisionssicher nachvollziehen

### Requirement: Historie fuer Waste-Management basiert auf der Studio-Auditspur

Das System SHALL Verlauf und Historie fuer Waste-Management auf die zentrale Studio-Auditspur stuetzen statt ein paralleles Primaersystem einzufuehren.

#### Scenario: Verlaufsansicht referenziert zentrale Auditbasis

- **WHEN** Waste-Management eine Historie oder Aktivitaetsansicht bereitstellt
- **THEN** basiert sie auf der bestehenden Studio-Audit-Infrastruktur oder daraus abgeleiteten Read-Modellen
- **AND** es wird kein davon fachlich unabhaengiges Verlaufssystem als primaerer Vertrag eingefuehrt
