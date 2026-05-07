## ADDED Requirements

### Requirement: Zentraler Admin-Bereich fuer instanzbezogene Modulzuweisung auf Studio-Root-Ebene

Das System SHALL einen zentralen Bereich `Module` auf Studio-Root-Ebene bereitstellen, der ausschliesslich fuer den Studio-Admin zugaenglich ist und ueber den Module Instanzen zugewiesen oder entzogen werden.

#### Scenario: Studio-Admin weist einer Instanz ein Modul zu

- **GIVEN** ein Studio-Admin oeffnet den zentralen Bereich `Module` auf Studio-Root-Ebene
- **WHEN** er eine konkrete Instanz auswaehlt und ein Modul zuweist
- **THEN** zeigt die UI verfuegbare und bereits zugewiesene Module getrennt oder gleichwertig filterbar an
- **AND** bietet sie pro Modul eine explizite Aktion zum Zuweisen oder Entziehen an
- **AND** ist dieser Bereich von der operativen Instanz-Detailseite getrennt und nur fuer den Studio-Admin erreichbar
- **AND** haben Instanz-Operatoren keinen Zugriff auf diese Verwaltung

### Requirement: Modulzuweisung zeigt integrierten IAM-Seeding-Effekt

Das System SHALL in der Modulverwaltung klar kommunizieren, dass die Zuweisung eines Moduls zu einer Instanz die noetige IAM-Basis in derselben Operation herstellt.

#### Scenario: Zuweisung zeigt fachliche Folge

- **GIVEN** ein Modul ist einer Instanz noch nicht zugewiesen
- **WHEN** der Studio-Admin die Zuweisung bestaetigt
- **THEN** macht die UI sichtbar, dass das Modul fuer die Instanz fachlich freigeschaltet und die zugehoerige IAM-Basis in derselben Operation geseedet wird
- **AND** zeigt sie nach Abschluss eine verstaendliche Ergebnisrueckmeldung

### Requirement: Modulentzug zeigt Hard-Removal und fordert Bestaetigung

Das System SHALL den Entzug eines Moduls von einer Instanz als harte, fachlich wirksame Entfernung mit Vorschau und expliziter Bestaetigung darstellen.

#### Scenario: Entzug warnt vor Rechteentzug

- **GIVEN** ein Modul ist einer Instanz zugewiesen
- **WHEN** der Studio-Admin den Entzug ausloest
- **THEN** zeigt die UI eine Bestaetigung mit Hinweis auf die harte Entfernung modulbezogener Permissions und Rollenbeziehungen
- **AND** SHALL sie betroffene Systemrollen (Name), Permissions-Anzahl und einen Hinweis auf moegliche Auswirkungen auf aktive Nutzersitzungen in einer Vorschau sichtbar machen
- **AND** wird der Entzug ohne explizite Bestaetigung des Studio-Admins nicht ausgefuehrt

### Requirement: Instanz-Cockpit zeigt Befund fuer IAM-Basis aktiver Module

Das System SHALL auf der Instanz-Detailseite einen expliziten Befund fuer die IAM-Basis aktiver Module anzeigen und dem Studio-Admin eine direkte Reparaturaktion anbieten.

#### Scenario: Cockpit zeigt Reparaturpfad fuer IAM-Basis-Drift

- **GIVEN** die Instanz hat aktive Module mit unvollstaendiger IAM-Basis
- **WHEN** der Studio-Admin die Instanz-Detailseite oeffnet
- **THEN** zeigt das Cockpit einen degradierten Befund fuer die IAM-Basis aktiver Module
- **AND** enthaelt der Befund eine verstaendliche Klartextzeile (nicht nur das technische Label `IAM-Basis aktiver Module`)
- **AND** ordnet die Seite diesen Befund als operativen Handlungsbedarf ein
- **AND** bietet sie eine direkte Aktion zum Neu-Seeden von Berechtigungen und Systemrollen an
- **AND** ist diese Aktion nur fuer den Studio-Admin sichtbar und ausfuehrbar

#### Scenario: Cockpit zeigt Empty-State fuer Bestandsinstanz ohne zugewiesene Module

- **GIVEN** eine Bestandsinstanz hat nach Einfuehrung des Modulvertrags noch keine zugewiesenen Module
- **WHEN** der Studio-Admin die Instanz-Detailseite oeffnet
- **THEN** erklaert das Cockpit, dass fuer diese Instanz noch keine Module zugewiesen wurden
- **AND** weist es darauf hin, dass die Zuweisung im zentralen Bereich `Module` erfolgt
- **AND** wertet es den leeren Modulsatz nicht als Fehler, sondern als erwarteten Ausgangszustand

### Requirement: Instanz-Anlage-Flow fuehrt einen gefuehrten Admin-Bootstrap-Abschnitt

Das System SHALL im Instanz-Anlage-Flow einen eigenen Abschnitt fuer den initialen Admin-Bootstrap der neuen Instanz bereitstellen. Der Abschnitt muss sich harmonisch in den Happy Path einfuegen, aber Fehler aus Modulzuordnung, Rollenerzeugung und Gruppierung klar getrennt sichtbar machen.

#### Scenario: Abschnitt zeigt Happy-Path-Bedienung mit genau einem Sammel-Button

- **GIVEN** die Instanz wurde erfolgreich angelegt
- **WHEN** der Studio-Admin den Bootstrap-Abschnitt oeffnet
- **THEN** zeigt die UI eine optionale Modulauswahl
- **AND** zeigt sie genau einen Sammel-Button zum Anlegen der Admin-Struktur
- **AND** erklaert sie knapp, dass ohne Modulauswahl mindestens `Admins` und `Core Admin` angelegt werden

#### Scenario: Abschnitt zeigt Warnhinweis fuer Namenskonflikte

- **GIVEN** der Bootstrap-Abschnitt kann bestehende Rollen mit denselben Namen ueberschreiben
- **WHEN** der Studio-Admin den Abschnitt betrachtet oder die Aktion vorbereitet
- **THEN** weist die UI sichtbar darauf hin, dass gleichnamige bestehende Rollen ueberschrieben werden koennen
- **AND** bleibt die Aktion trotzdem als Happy-Path-Sammelaktion verstaendlich

### Requirement: Initiale Admin-Struktur wird mit editierbaren Rollen aufgebaut

Das System SHALL ueber den Bootstrap-Abschnitt eine initiale Gruppe `Admins` sowie sprechend benannte Initialrollen fuer `Core` und optional ausgewaehlte Module anlegen. Diese Rollen sind Startartefakte und duerfen spaeter im IAM-UI bearbeitet werden.

#### Scenario: Bootstrap ohne Module erzeugt editierbare Core-Struktur

- **GIVEN** der Studio-Admin fuehrt den Bootstrap-Abschnitt ohne Modulauswahl aus
- **WHEN** die Aktion erfolgreich abgeschlossen wird
- **THEN** legt die UI-seitig beschriebene Mutation die Gruppe `Admins` und die Rolle `Core Admin` an
- **AND** sind diese Artefakte spaeter im IAM-UI sichtbar und bearbeitbar

#### Scenario: Bootstrap mit Modulen erzeugt sprechend benannte Modul-Admin-Rollen

- **GIVEN** der Studio-Admin hat im Bootstrap-Abschnitt Module ausgewaehlt
- **WHEN** die Aktion erfolgreich abgeschlossen wird
- **THEN** erzeugt das System zusaetzlich pro ausgewaehltem Modul eine sprechend benannte Modul-Admin-Rolle
- **AND** verknuepft es diese Rollen zusammen mit `Core Admin` mit der Gruppe `Admins`
- **AND** bleiben die erzeugten Rollen spaeter im IAM-UI bearbeitbar
