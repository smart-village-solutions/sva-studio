# iam-server-modularization Specification

## Purpose
TBD - created by archiving change refactor-iam-server-modularization. Update Purpose after archive.
## Requirements
### Requirement: Fachlich fokussierte IAM-Server-Module

Der IAM-Account-Management-Server und angrenzende IAM-Server-Hotspots MUST in mehrere fachlich fokussierte Module mit klar abgegrenzter Verantwortung aufgeteilt werden. Dazu gehören insbesondere Benutzerverwaltung, Rollenverwaltung, Profilverwaltung, Bulk-Operationen, Feature-Flags, Rate-Limiting und Schemadefinitionen.

#### Scenario: Rollenlogik wird erweitert

- **WHEN** neue Logik für Rollenverwaltung oder Rollen-Synchronisation eingeführt oder geändert wird
- **THEN** liegt diese Logik in einem dedizierten Rollen-Modul
- **AND** sie wird nicht erneut in allgemeinen Account-, Routing- oder Governance-Dateien eingebettet

#### Scenario: DSR- oder Governance-Logik wird geändert

- **WHEN** ein Flow für Betroffenenrechte oder Governance angepasst wird
- **THEN** erfolgt die Änderung in einem fachlich passenden DSR- oder Governance-Modul
- **AND** sie vergrößert nicht erneut fachfremde Monolith-Dateien

### Requirement: Klare öffentliche APIs und Modulgrenzen

Jedes IAM-Server-Modul MUST eine wohldefinierte öffentliche API-Schnittstelle besitzen. Interne Details dürfen nur über explizite Modul-Entry-Points konsumiert werden; breite Barrel-Exports ohne fachliche Grenze sind zu vermeiden.

#### Scenario: Anderes IAM-Modul benötigt Funktionalität

- **WHEN** ein anderes IAM-Modul auf fachliche Funktionalität zugreifen muss
- **THEN** nutzt es die dokumentierte öffentliche API des Zielmoduls
- **AND** es importiert keine internen Implementierungsdetails direkt aus beliebigen Dateien

#### Scenario: Exportfläche eines Moduls wächst

- **WHEN** die öffentliche API eines Moduls erweitert wird
- **THEN** ist die neue Exportfläche fachlich begründet
- **AND** der Modul-Entry-Point bleibt reviewbar und klar abgegrenzt

### Requirement: Gemeinsame Hilfslogik wird zentral gekapselt

Gemeinsame Hilfsfunktionen, insbesondere für Maskierung, Parsing, Validierung, Rate-Limit-Logik und Logging-/Request-Kontext, DÜRFEN NICHT mehrfach implementiert werden. Sie MUST in dedizierten Shared-Modulen gekapselt und von Fachmodulen wiederverwendet werden.

#### Scenario: Neues Modul benötigt Rate-Limit-Logik

- **WHEN** ein neues oder refaktoriertes IAM-Modul Rate-Limit-Verhalten benötigt
- **THEN** verwendet es die zentrale Shared-Implementierung
- **AND** es führt keine zweite, abweichende Rate-Limit-Logik ein

#### Scenario: Validierungslogik wird in mehreren Pfaden benötigt

- **WHEN** mehrere IAM-Endpoints dieselben Eingabe- oder Schemaprüfungen benötigen
- **THEN** liegt die Validierung in einem gemeinsamen Schema- oder Shared-Modul
- **AND** die Validierung wird nicht als kopierte Inline-Logik gepflegt

### Requirement: Risikobasierter Refactoring-Fahrplan

Die Modularisierung des IAM-Servers SHALL in einer risikobasierten Reihenfolge erfolgen. Die priorisierten Findings `QUAL-101`, `QUAL-103`, `QUAL-104`, `QUAL-108`, `QUAL-102`, `QUAL-109`, `QUAL-105`, `QUAL-106` und `QUAL-107` bilden die verbindliche Abarbeitungsreihenfolge, solange keine neue Risikobewertung dokumentiert wird.

#### Scenario: Umsetzung der ersten Tranche

- **WHEN** die Modularisierung begonnen wird
- **THEN** werden zuerst die Hotspots `iam-account-management.server.ts`, `iam-data-subject-rights.server.ts` und `iam-governance.server.ts` adressiert
- **AND** die Entscheidung ist mit den Tickets `QUAL-101`, `QUAL-103` und `QUAL-104` nachvollziehbar verknüpft

#### Scenario: Reihenfolge wird geändert

- **WHEN** von der priorisierten Abarbeitungsreihenfolge abgewichen werden soll
- **THEN** wird die geänderte Risikobewertung dokumentiert
- **AND** die betroffenen Tickets und Auswirkungen auf verbleibende Hotspots werden explizit benannt

### Requirement: Zielarchitektur orientiert sich an projektweiten Qualitätsgrenzen

Die modulare Zielarchitektur SHALL einzelne Dateien, Funktionen und Exportflächen auf projektweit gültige Grenzwerte ausrichten. Verbleibende Überschreitungen sind nur zulässig, wenn sie als bewusst dokumentierte Restschuld mit Ticketbezug geführt werden.

#### Scenario: Modul bleibt nach Refactoring über Grenzwert

- **WHEN** ein refaktoriertes Modul weiterhin einen projektweiten Grenzwert überschreitet
- **THEN** ist die Überschreitung mit einem verknüpften Refactoring-Ticket dokumentiert
- **AND** die verbleibende Restschuld ist für Reviewer nachvollziehbar begründet

#### Scenario: Neue Überschreitung entsteht

- **WHEN** durch die Modularisierung oder Folgeänderungen eine neue Grenzwertüberschreitung entsteht
- **THEN** wird sie nicht stillschweigend akzeptiert
- **AND** sie erhält vor Merge einen dokumentierten Nachweis oder wird im selben Change behoben

