## ADDED Requirements

### Requirement: Modulzuweisungen dürfen asynchrone Fachprovisionierung auslösen

Das System SHALL für Module mit deklarierter Fachprovisionierung nach erfolgreicher Modulzuweisung einen tenantgebundenen, idempotenten Folgejob auslösen und dessen Bereitschaft getrennt von der IAM-Basis führen.

#### Scenario: Waste-Zuweisung stellt genau einen Folgejob ein

- **GIVEN** `waste-management` wurde einer Instanz erfolgreich zugewiesen und die IAM-Basis ist synchronisiert
- **WHEN** die Zuweisungsoperation abgeschlossen wird
- **THEN** stellt das System einen tenantgebundenen Waste-Provisionierungsjob ein
- **AND** wiederholte Events oder Requests erzeugen keinen konkurrierenden zweiten aktiven Sollzustand
- **AND** der Status der Fachprovisionierung bleibt über Instanz und Modul korrelierbar

#### Scenario: Fachprovisionierung scheitert nach erfolgreicher Zuweisung

- **WHEN** der asynchrone Waste-Provisionierungsjob fehlschlägt
- **THEN** bleiben Modulzuweisung und erfolgreiche IAM-Basis erhalten
- **AND** das Modul wird technisch als nicht bereit ausgewiesen
- **AND** seine Fachdatenzugriffe bleiben fail-closed
- **AND** ein berechtigter Retry verwendet denselben tenantbezogenen Sollzustand

#### Scenario: Modul ohne Fachprovisionierung wird zugewiesen

- **WHEN** ein Modul ohne deklarierte Fachprovisionierung zugewiesen wird
- **THEN** bleibt der bestehende Zuweisungs- und IAM-Pfad unverändert
- **AND** das System leitet keinen infrastrukturellen Folgejob aus Plugin-Namen oder UI-Heuristiken ab

## MODIFIED Requirements

### Requirement: Modulzuweisung seedet die IAM-Basis in derselben Operation

Das System SHALL die Zuweisung eines Moduls zu einer Instanz als Studio-Admin-Mutation behandeln, die die fachliche Freigabe und das IAM-Baseline-Seeding fuer `Core + zugewiesene Module` in derselben Operation ausfuehrt. Eine vom Modul deklarierte langlaufende Fachprovisionierung SHALL anschließend asynchron erfolgen und die technische Bereitschaft getrennt ausweisen.

#### Scenario: Modul wird einer Instanz zugewiesen

- **GIVEN** ein global bekanntes Modul ist einer Instanz noch nicht zugewiesen
- **WHEN** der Studio-Admin das Modul der Instanz zuweist
- **THEN** persistiert das System die Modulzuordnung fuer diese Instanz
- **AND** legt es fehlende modulbezogene Permissions idempotent an oder aktualisiert sie
- **AND** bringt es kanonische Systemrollen und `role_permissions` fuer `Core + zugewiesene Module` auf Sollstand
- **AND** ist ein Modul ohne deklarierte Fachprovisionierung nach erfolgreichem Abschluss fachlich sofort nutzbar
- **AND** wird ein Modul mit deklarierter Fachprovisionierung erst nach deren separat ausgewiesener Bereitschaft fachlich nutzbar

#### Scenario: Zuweisung eines nicht global registrierten Moduls wird abgelehnt

- **GIVEN** eine gueltige Instanz existiert
- **WHEN** der Studio-Admin ein Modul zuweist, das nicht in der globalen Plugin-Registrierung bekannt ist
- **THEN** lehnt das System die Operation mit einem Validation-Fehler ab
- **AND** wird keine Modulzuordnung persistiert
- **AND** wird kein IAM-Seeding ausgefuehrt
- **AND** wird kein Fachprovisionierungsjob eingestellt

