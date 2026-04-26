## ADDED Requirements

### Requirement: Admin-Ressourcen werden ueber einen deklarativen Registrierungsvertrag beschrieben

Die Account-UI SHALL CRUD-artige Admin-Flaechen nicht mehr nur als lose Einzelrouten behandeln, sondern ueber einen expliziten Registrierungsvertrag fuer Admin-Ressourcen materialisieren.

#### Scenario: Host materialisiert kanonische Admin-Flaechen aus einer Ressourcendefinition

- **WHEN** eine Workspace-Erweiterung eine Admin-Ressource registriert
- **THEN** enthaelt der Beitrag mindestens eine Ressourcen-ID, einen Titel-Key, eine Guard-Anforderung und UI-Bindings fuer Liste und Detail
- **AND** die Account-UI kann daraus die zugehoerigen kanonischen Admin-Flaechen ohne separate Sonderverdrahtung pro Ressource aufbauen

#### Scenario: Erstellungsansicht bleibt Teil derselben registrierten Ressource

- **WHEN** eine Ressourcendefinition einen Create-Beitrag liefert
- **THEN** materialisiert die Account-UI die Erstellungsansicht als Teil derselben registrierten Admin-Ressource
- **AND** Liste, Erstellen und Detail bleiben ueber denselben Ressourcenvertrag miteinander verknuepft

### Requirement: Admin-Ressourcen bleiben hostkontrollierte UI-Bausteine

Die Account-UI SHALL Packages fuer Admin-Ressourcen nur deklarative UI-Beitraege erlauben; Guard-Anwendung, Routenform und Shell-Integration bleiben Host-Verantwortung.

#### Scenario: Package liefert nur deklarative Flaechenbeitraege

- **WHEN** ein Package eine Admin-Ressource fuer den Host bereitstellt
- **THEN** beschreibt es Liste, Detail, Erstellen und optionale Historie ueber deklarative Bindings
- **AND** es fuehrt keine eigene zweite Admin-Shell oder parallele Top-Level-Navigation ausserhalb des Host-Vertrags ein

#### Scenario: Host erzwingt konsistente Shell-Integration

- **WHEN** mehrere Admin-Ressourcen registriert sind
- **THEN** integriert die Account-UI diese innerhalb derselben Admin-Shell und derselben Interaktionsmuster
- **AND** Guard-, Titel- und Navigationsdarstellung folgen den hostseitigen Regeln statt ressourcenspezifischer Sonderlogik
