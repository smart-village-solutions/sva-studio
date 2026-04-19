## ADDED Requirements

### Requirement: Admin-Ressourcen werden deklarativ registriert

Das System SHALL Admin-Ressourcen über einen deklarativen Registrierungsvertrag aus Workspace-Packages entgegennehmen, statt Listen-, Detail- und Editorflächen jeweils individuell im Host zu verdrahten.

#### Scenario: Package liefert vollständige Admin-Ressource

- **WHEN** ein Workspace-Package eine neue Admin-Ressource bereitstellt
- **THEN** deklariert es mindestens Identität, Titel, Guard-Anforderung und die verfügbaren Flächen für Liste, Detail, Erstellen, Bearbeiten oder Historie
- **AND** der Host kann diese Ressource ohne package-spezifische Sonderlogik materialisieren

#### Scenario: Host rendert kanonische Ressource im Admin

- **WHEN** eine registrierte Admin-Ressource im Studio verfügbar ist
- **THEN** erscheint sie innerhalb des bestehenden Admin-Arbeitsbereichs
- **AND** Shell, Seitentitel, Breadcrumbs und Fokusregeln bleiben hostgeführt

### Requirement: Admin-Ressourcen folgen einem kanonischen Flächenmodell

Das System SHALL für Admin-Ressourcen ein einheitliches Flächenmodell für Liste, Detail, Erstellen, Bearbeiten und Historie verwenden.

#### Scenario: Ressource stellt nur unterstützte Flächen bereit

- **WHEN** eine Admin-Ressource registriert wird
- **THEN** verwendet sie nur die kanonischen Flächenarten des Vertrags
- **AND** nicht deklarierte Sonderflächen gelten nicht als Teil des Grundvertrags
