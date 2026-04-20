## MODIFIED Requirements

### Requirement: Idempotenter Provisioning-Workflow

Das System SHALL neue Instanzen über einen idempotenten Provisioning-Workflow anlegen, der technische Teilaufgaben, Tenant-Admin-Abhängigkeiten und blockierende Drift im Reconcile- und IAM-Betrieb kontrolliert behandelt.

#### Scenario: Blockerrelevanter Drift verhindert Folgeinkonsistenzen

- **WHEN** eine Instanz zwar aktiv ist, aber blockerrelevanter Drift bei Tenant-Admin-Client, Secret-Ausrichtung oder vergleichbaren IAM-Voraussetzungen besteht
- **THEN** markiert das System diesen Zustand als driftrelevanten Blocker für abhängige Reconcile- oder Sync-Pfade
- **AND** startet keine fachlich irreführenden Folgeaktionen, die ohne tragfähige Voraussetzungen nur Teilfehler oder Inkonsistenzen erzeugen

#### Scenario: Reparaturlauf bleibt idempotent

- **WHEN** ein Provisioning- oder Reparaturlauf für blockerrelevanten Drift erneut ausgeführt wird
- **THEN** wendet das System bereits erfolgreiche Korrekturen nicht unkontrolliert doppelt an
- **AND** erzeugt keine zusätzlichen Driftartefakte oder widersprüchlichen Tenant-Admin-Zustände

### Requirement: Administrativer Steuerungspfad für neue Instanzen

Das System SHALL einen administrativen Steuerungspfad für die Anlage und Verwaltung neuer Instanzen bereitstellen, der aktive Drift- und Reconcile-Blocker für Operatoren klar sichtbar macht.

#### Scenario: Root-Host zeigt driftrelevante IAM-Blocker

- **WHEN** ein Administrator eine aktive Instanz in der Studio-Control-Plane prüft
- **THEN** zeigt die Oberfläche blockerrelevanten Drift für Tenant-Admin-Client, Secret-Ausrichtung und Reconcile-Voraussetzungen explizit an
- **AND** dieser Zustand lässt sich mit User- und Rollen-Sync-Problemen derselben Instanz korrelieren
- **AND** ein grüner Basis-Health-Status überschreibt diese blockerrelevanten Driftbefunde nicht
