## MODIFIED Requirements

### Requirement: Standardisierte Runtime-Kommandos pro Profil

Das System SHALL für jedes Runtime-Profil standardisierte Befehle für `up`, `down`, `update`, `status`, `smoke` und `migrate` bereitstellen. Der kanonische Migrationspfad SHALL über einen repository-lokalen, versionsgepinnnten `goose`-Wrapper laufen und keine globale Tool-Installation voraussetzen.

#### Scenario: Root-Scripts bilden das Operations-Interface ab

- **WHEN** `package.json` im Repository geprüft wird
- **THEN** existieren `env:*:<profil>`-Skripte für alle drei Runtime-Profile
- **AND** die Skripte delegieren an eine gemeinsame Implementierung statt an profilindividuelle Ad-hoc-Kommandos

#### Scenario: Migrationspfad nutzt gepinnten Goose-Wrapper

- **WHEN** ein lokaler oder Acceptance-`migrate`-Pfad ausgelöst wird
- **THEN** ruft das System nur einen repository-lokalen `goose`-Wrapper auf
- **AND** der Wrapper installiert bzw. verwendet eine gepinnte `goose`-Version
- **AND** es ist keine globale `goose`-Installation Voraussetzung

### Requirement: Standardisierter Runtime-Doctor pro Profil

Das System SHALL für jedes kanonische Runtime-Profil ein offizielles `doctor`-Kommando bereitstellen, das nicht nur Erreichbarkeit, sondern auch Schema-, Kontext- und Migrationsdiagnostik ausführt.

#### Scenario: Root-Scripts bilden den Diagnosepfad ab

- **WHEN** `package.json` im Repository geprüft wird
- **THEN** existieren `env:doctor:<profil>`-Skripte für `local-keycloak`, `local-builder` und `acceptance-hb`
- **AND** die Skripte delegieren an eine gemeinsame Implementierung statt an profilindividuelle Ad-hoc-Debug-Kommandos

#### Scenario: Doctor-Ausgabe ist maschinenlesbar

- **WHEN** ein `env:doctor:<profil>`-Befehl mit `--json` ausgeführt wird
- **THEN** liefert das System pro Check mindestens `status`, `code`, `message` und optionale `details`
- **AND** die Ausgabe enthält keine Secrets oder PII

#### Scenario: Doctor meldet Goose-Migrationsstatus

- **WHEN** ein `env:doctor:<profil>`-Befehl ausgeführt wird
- **THEN** enthält die Diagnose einen separaten Check für `goose`-Verfügbarkeit und Migrationsstatus
- **AND** `details` enthalten mindestens die verwendete `goose`-Version oder den Remote-Status

### Requirement: Standardisierte Deploy-Evidenz für Acceptance

Das System SHALL für jeden orchestrierten Acceptance-Deploy maschinenlesbare und menschenlesbare Evidenz erzeugen.

#### Scenario: Deploy schreibt Evidenz-Artefakte

- **WHEN** `env:deploy:acceptance-hb` ausgeführt wird
- **THEN** schreibt das System JSON- und Markdown-Artefakte unter `artifacts/runtime/deployments/`
- **AND** die Artefakte enthalten mindestens Image-Referenz, Actor, Workflow, Release-Modus, Schrittstatus und Stack-Zusammenfassung
- **AND** die Artefakte enthalten keine Secrets oder PII

#### Scenario: Migrations-Evidenz enthält Goose-Status

- **WHEN** ein Acceptance-Deploy mit oder ohne Migrationsschritt dokumentiert wird
- **THEN** enthalten die Artefakte den `goose`-Status der Migration
- **AND** die Migrationsevidenz kann die verwendete `goose`-Version ausweisen
