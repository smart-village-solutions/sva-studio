## ADDED Requirements
### Requirement: Waste-Management-Mutationen sind revisionsfähig auditierbar

Das System SHALL für alle Mutationen des Waste-Management-Moduls revisionsfähige Audit-Events erzeugen.

#### Scenario: CRUD- und Zuordnungsoperationen erzeugen Auditspur

- **WHEN** Waste-Masterdaten, Abholorte, Touren, Datumsverschiebungen oder Zuordnungen erstellt, geändert oder gelöscht werden
- **THEN** entsteht jeweils ein Audit-Event mit Zeitpunkt, pseudonymisierter Actor-Referenz, Instanzkontext, fachlicher Operation und Ergebnis
- **AND** Klartext-PII oder rohe Request-Payloads werden nicht unverändert in die Auditspur geschrieben

### Requirement: CSV-Import, Seed und Reset erzeugen erweiterte Auditmetadaten

Das System SHALL für Waste-Management-Data-Tools erweiterte, aber sichere Auditmetadaten protokollieren.

#### Scenario: CSV-Import bleibt nachvollziehbar

- **WHEN** ein Benutzer einen Waste-CSV-Import ausführt
- **THEN** enthält das Audit-Event mindestens Instanzkontext, Action-Namespace, Ergebnis sowie Counts für verarbeitete, übersprungene und fehlgeschlagene Datensätze
- **AND** importierte Freitextinhalte oder PII werden nicht ungefiltert in die Auditdaten geschrieben

#### Scenario: Seed und Reset sind als Hochrisiko-Ereignisse erkennbar

- **WHEN** ein Seed oder Reset für Waste-Daten ausgeführt wird
- **THEN** ist das Audit-Ereignis als Hochrisiko-Operation unterscheidbar
- **AND** es enthält Scope, Ergebnis, best-effort `request_id` und `trace_id`
- **AND** Reviewer können Actor, Instanz und betroffenes Werkzeug revisionssicher nachvollziehen

### Requirement: Historie für Waste-Management basiert auf der Studio-Auditspur

Das System SHALL Verlauf und Historie für Waste-Management auf die zentrale Studio-Auditspur stützen statt ein paralleles Primärsystem einzuführen.

#### Scenario: Verlaufsansicht referenziert zentrale Auditbasis

- **WHEN** Waste-Management eine Historie oder Aktivitätsansicht bereitstellt
- **THEN** basiert sie auf der bestehenden Studio-Audit-Infrastruktur oder daraus abgeleiteten Read-Modellen
- **AND** es wird kein davon fachlich unabhängiges Verlaufssystem als primärer Vertrag eingeführt
