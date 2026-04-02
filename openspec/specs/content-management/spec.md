# content-management Specification

## Purpose
Definiert die fachliche Inhaltsverwaltung für SVA Studio mit tabellarischer Admin-Ansicht, erweiterbarem Core-Modell, kontrolliertem Statusmodell, JSON-Payload-Validierung und nachvollziehbarer Historie.

## Requirements
### Requirement: Inhaltsübersicht als tabellarische Admin-Ansicht

Das System MUST eine Seite `Inhalte` bereitstellen, die vorhandene Inhalte in einer tabellarischen Admin-Ansicht darstellt.

#### Scenario: Inhaltsliste wird geladen

- **WENN** ein berechtigter Benutzer die Seite `Inhalte` öffnet
- **DANN** zeigt das System eine semantische Tabelle mit den Spalten Titel, Veröffentlichungsdatum, Erstellungsdatum, Änderungsdatum, Autor, Payload, Status und Historie
- **UND** jede Tabellenzeile repräsentiert genau einen Inhalt
- **UND** der Inhaltstyp ist pro Zeile erkennbar
- **UND** das System zeigt einen Ladezustand, bis die Inhaltsdaten verfügbar sind

### Requirement: Inhalt ist ein erweiterbares Core-Element

Das System MUST `Inhalt` als kanonisches Core-Element modellieren, das über definierte SDK-Erweiterungspunkte für spezielle Datentypen erweitert werden kann.

#### Scenario: Core-Inhalt wird mit Basiskern angelegt

- **WENN** ein Inhalt gespeichert oder geladen wird
- **DANN** enthält er mindestens `contentType`, Titel, Veröffentlichungsdatum, Erstellungsdatum, Änderungsdatum, Autor, Payload, Status und Historie
- **UND** diese Core-Felder bleiben unabhängig vom konkreten Inhaltstyp verfügbar

#### Scenario: SDK erweitert einen speziellen Inhaltstyp

- **WENN** für einen registrierten `contentType` eine SDK-Erweiterung vorhanden ist
- **DANN** kann diese zusätzliche Validierung, UI-Bereiche, Tabelleninformationen oder Aktionen bereitstellen
- **UND** der Core-Vertrag des Inhalts bleibt unverändert gültig

#### Scenario: Plugin überschreibt den Core-Vertrag nicht

- **WENN** ein Plugin oder SDK-Modul einen speziellen Inhaltstyp registriert
- **DANN** darf es die Bedeutung oder Pflichtigkeit der Core-Felder nicht brechen
- **UND** Statusmodell, Historie und Core-Metadaten bleiben systemweit konsistent

### Requirement: Lokaler Migrationspfad für das Inhaltsmodell ist verifiziert

Das System MUST Schemaänderungen für die Inhaltsverwaltung so ausliefern, dass die zugehörigen Datenbankmigrationen lokal reproduzierbar ausgeführt und verifiziert werden können.

#### Scenario: Inhaltsmigration läuft lokal erfolgreich

- **WENN** ein Entwickler die lokale Entwicklungsdatenbank für die Inhaltsverwaltung aufsetzt oder aktualisiert
- **DANN** lassen sich die erforderlichen Inhaltsmigrationen lokal ausführen
- **UND** das resultierende Schema unterstützt die Inhaltsliste, Detailansicht, Bearbeitung und Historie wie spezifiziert

#### Scenario: Up- und Down-Migrationen sind als Paar vorhanden

- **WENN** das Inhaltsmodell eine neue Schemaänderung benötigt
- **DANN** existiert eine versionierte Up-Migration und eine korrespondierende Down-Migration
- **UND** der lokale Migrationspfad ist dokumentiert und im Entwicklungsworkflow verifizierbar

#### Scenario: Inhaltsliste ist leer

- **WENN** noch keine Inhalte vorhanden sind
- **DANN** zeigt die Seite einen verständlichen Empty-State
- **UND** der Einstieg `Neuer Inhalt` bleibt sichtbar

### Requirement: Einstieg zum Anlegen neuer Inhalte

Das System MUST in der Tabellenansicht einen klaren Einstieg zum Anlegen neuer Inhalte bereitstellen.

#### Scenario: Neuer Inhalt wird gestartet

- **WENN** ein berechtigter Benutzer die Tabellenansicht öffnet
- **DANN** ist ein sichtbarer Button `Neuer Inhalt` vorhanden
- **UND** der Button führt in die Erstellungsansicht für einen neuen Inhalt

### Requirement: Design-System- und Tabellenkonsistenz im Admin-Bereich

Das System MUST die Inhaltsverwaltung mit den bestehenden `shadcn/ui`-Patterns und konsistent zu vorhandenen Admin-Tabellen umsetzen.

#### Scenario: Inhaltsliste folgt bestehendem Tabellenmuster

- **WENN** die Seite `Inhalte` gerendert wird
- **DANN** verwendet die Tabelle dieselben grundlegenden UI-Patterns wie bestehende Admin-Tabellen, insbesondere aus der Account-Verwaltung
- **UND** Tabellenkopf, Zellstruktur, Statusdarstellung, Abstände und Aktionsflächen folgen einem konsistenten Admin-Muster
- **UND** es wird keine parallele, inkompatible Tabellen-Basisimplementierung eingeführt

#### Scenario: Formularansicht nutzt bestehende UI-Bausteine

- **WENN** die Erstellungs- oder Bearbeitungsansicht eines Inhalts angezeigt wird
- **DANN** basieren Formularfelder, Buttons, Statusanzeigen, Dialoge und Fehlermeldungen auf den bestehenden `shadcn/ui`-Patterns der Anwendung
- **UND** die Inhaltsverwaltung wirkt visuell und interaktional als Teil derselben Admin-Oberfläche

### Requirement: Erstellungs- und Bearbeitungsansicht für Inhalte

Das System MUST eine Erstellungs- und eine Bearbeitungsansicht für Inhalte bereitstellen.

#### Scenario: Inhalt anlegen

- **WENN** ein berechtigter Benutzer einen neuen Inhalt anlegt
- **DANN** kann er mindestens Inhaltstyp, Titel, Veröffentlichungsdatum, Payload und Status erfassen
- **UND** das System setzt Erstellungsdatum, Änderungsdatum und Autor systemseitig
- **UND** der gespeicherte Inhalt ist nach erfolgreichem Speichern in der Inhaltsliste sichtbar

#### Scenario: Inhalt bearbeiten

- **WENN** ein berechtigter Benutzer einen bestehenden Inhalt bearbeitet
- **DANN** kann er Titel, Veröffentlichungsdatum, Payload und Status gemäß seiner Berechtigungen ändern
- **UND** das Änderungsdatum wird nach erfolgreichem Speichern aktualisiert
- **UND** die Bearbeitungsansicht zeigt die aktuellen Metadaten des Inhalts an

#### Scenario: Typspezifische Erweiterungsfelder werden eingeblendet

- **WENN** ein Inhalt einen registrierten `contentType` mit SDK-Erweiterung besitzt
- **DANN** rendert die Erstellungs- oder Bearbeitungsansicht zusätzlich die zugehörigen typspezifischen UI-Bereiche
- **UND** die Core-Felder bleiben weiterhin sichtbar und konsistent bedienbar

### Requirement: Kontrolliertes Statusmodell für Inhalte

Das System MUST für Inhalte ein kontrolliertes Statusmodell verwenden.

#### Scenario: Gültiger Status wird gespeichert

- **WENN** ein Inhalt gespeichert wird
- **DANN** akzeptiert das System nur die Status `draft`, `in_review`, `approved`, `published` oder `archived`

#### Scenario: Veröffentlichter Inhalt ohne Veröffentlichungsdatum

- **WENN** ein Benutzer versucht, einen Inhalt mit Status `published` ohne Veröffentlichungsdatum zu speichern
- **DANN** weist das System die Speicherung mit einem Validierungsfehler ab

### Requirement: JSON-Payload wird validiert und lesbar dargestellt

Das System MUST das Feld `payload` als JSON-Daten behandeln.

#### Scenario: Gültiges JSON wird gespeichert

- **WENN** ein Benutzer in der Erstellungs- oder Bearbeitungsansicht syntaktisch gültiges JSON eingibt
- **DANN** speichert das System den Payload unverändert als JSON
- **UND** optionale typspezifische Validierungen des registrierten `contentType` werden zusätzlich angewendet

#### Scenario: Ungültiges JSON wird abgewiesen

- **WENN** ein Benutzer syntaktisch ungültiges JSON eingibt
- **DANN** weist das System die Speicherung mit einer feldbezogenen Fehlermeldung ab
- **UND** bestehende persistierte Daten bleiben unverändert

### Requirement: Historie pro Inhalt ist einsehbar

Das System MUST für jeden Inhalt eine lesbare Historie bereitstellen.

#### Scenario: Historie eines Inhalts anzeigen

- **WENN** ein berechtigter Benutzer die Historie eines Inhalts öffnet
- **DANN** zeigt das System die bisherigen Änderungen in chronologischer Reihenfolge an
- **UND** jeder Eintrag enthält mindestens Zeitpunkt, Actor, Aktion und betroffenen Änderungsgegenstand
