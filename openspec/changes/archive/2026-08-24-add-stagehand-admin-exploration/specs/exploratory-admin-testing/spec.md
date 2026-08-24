## ADDED Requirements

### Requirement: Separate lokale Stagehand-Explorationsschicht für Admin-Flows

Das System SHALL eine separate, lokal ausführbare Stagehand-Explorationsschicht für reale Admin-Flows rund um Benutzer-, Rollen- und Rechteverwaltung bereitstellen.

#### Scenario: Lokaler Explorationslauf startet getrennt von bestehenden Gates

- **WHEN** ein Entwickler das definierte Stagehand-Target ausführt
- **THEN** startet ein separater Explorationslauf außerhalb von `test:e2e` und `test:acceptance`
- **AND** der Lauf verwendet die laufende lokale Studio-App gegen den echten IAM-/Backend-Stack
- **AND** der Lauf endet mit einem eindeutigen Missionsstatus

### Requirement: Vollständige IAM-Story-Loop mit reviewbarem Result-Overlay

Das System SHALL den vollständigen IAM-User-Story-Katalog aus `concepts/konzeption-cms-v2/02_Anforderungen/user-stories.json` in einem lokalen Story-Loop verarbeiten und die Ergebnisse als separates Overlay erzeugen.

#### Scenario: Voll-Lauf klassifiziert Stories über Overlay

- **WHEN** der lokale Stagehand-Story-Loop ausgeführt wird
- **THEN** liest der Lauf alle IAM-Stories aus `user-stories.json`
- **AND** gruppiert sie in technische Cluster statt zwingend in Einzellauf-Missionen
- **AND** schreibt die resultierenden `studioCheck`-Entscheidungen deterministisch in ein separates Overlay
- **AND** hinterlässt pro klassifizierter Story belastbare Notes oder Artefaktverweise

### Requirement: Lokaler Env-Vertrag für echte Admin-Laufzeitpfade

Das System SHALL einen klaren lokalen Env-Vertrag für Base-URL, Readiness, dedizierte Admin-Credentials und externe LLM-Zugangsdaten definieren.

#### Scenario: Pflichtkonfiguration fehlt

- **WHEN** ein Stagehand-Explorationslauf ohne erforderliche Umgebungsvariablen gestartet wird
- **THEN** bricht der Lauf früh und deterministisch ab
- **AND** die Fehlermeldung nennt die fehlenden Konfigurationsschlüssel

### Requirement: Missionen für read-mostly Admin-Exploration

Das System SHALL im Pilot mindestens read-mostly Missionen für Benutzerübersicht, Rechteinspektion und Rollen-Navigation bereitstellen.

#### Scenario: Mission `admin-users-overview`

- **WHEN** die Mission `admin-users-overview` ausgeführt wird
- **THEN** meldet sich der dedizierte Admin über den echten lokalen Auth-Pfad an
- **AND** der Lauf erreicht `/admin/users`
- **AND** die Mission bestätigt Benutzerliste oder fachlich gültigen Leerzustand ohne Login- oder Forbidden-Redirect

#### Scenario: Mission `admin-user-permissions-inspection`

- **WHEN** die Mission `admin-user-permissions-inspection` ausgeführt wird
- **THEN** öffnet der Lauf eine Nutzerdetailansicht
- **AND** dokumentiert sichtbare Rollen-, Berechtigungs- oder Rechteherkunftsinformationen
- **AND** protokolliert das Ergebnis strukturiert

#### Scenario: Mission `admin-role-management-navigation`

- **WHEN** die Mission `admin-role-management-navigation` ausgeführt wird
- **THEN** erreicht der Lauf `/admin/roles` und mindestens einen Rollen-Kontext
- **AND** bestätigt die Sichtbarkeit zentraler Rollenverwaltungsinformationen oder protokolliert einen fachlich gültigen Leerzustand

### Requirement: Pflichtartefakte pro Explorationsmission

Das System SHALL pro Explorationsmission nachvollziehbare Artefakte für Diagnose und Review erzeugen.

#### Scenario: Missionsartefakte werden geschrieben

- **WHEN** eine Stagehand-Mission endet
- **THEN** erzeugt der Lauf mindestens einen strukturierten Status, einen deutschsprachigen Bericht, Screenshots und ein Transcript oder Schrittprotokoll
- **AND** die Artefakte sind einem klaren Missionsnamen zugeordnet

#### Scenario: Story-Loop-Artefakte werden geschrieben

- **WHEN** ein Stagehand-Story-Loop endet
- **THEN** erzeugt der Lauf mindestens einen strukturierten Status, einen deutschsprachigen Bericht, Screenshots und ein Transcript oder Schrittprotokoll
- **AND** der Lauf erzeugt zusätzlich einen Aggregatbericht und einen Aggregatstatus für den gesamten Story-Katalog
- **AND** die Artefakte bleiben für jede Story-Entscheidung referenzierbar

### Requirement: Nicht-blockende Pilot-Nutzung

Das System SHALL die Stagehand-Explorationsschicht im Pilot nicht als verpflichtendes CI- oder PR-Gate behandeln.

#### Scenario: Explorationsschicht bleibt ergänzend

- **WHEN** reguläre PR- oder App-Smoke-Gates ausgeführt werden
- **THEN** bleiben `test:e2e` und `test:acceptance` funktional getrennt
- **AND** die Stagehand-Exploration wird nicht automatisch als blockierender Pflichtlauf erzwungen
