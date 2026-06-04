## MODIFIED Requirements
### Requirement: Zentraler Admin-Bereich fuer instanzbezogene Modulzuweisung auf Studio-Root-Ebene

Das System SHALL einen zentralen Bereich `Module` auf Studio-Root-Ebene bereitstellen, der ausschliesslich fuer den Studio-Admin zugaenglich ist und ueber den Module Instanzen zugewiesen oder entzogen werden. Dieselbe fachliche Modulverwaltung darf zusaetzlich in einem instanzgebundenen Root-Admin-Tab der Instanz-Detailseite wiederverwendet werden, solange keine zweite Mutationslogik entsteht.

#### Scenario: Studio-Admin weist einer Instanz ein Modul ueber die Sammelseite zu

- **GIVEN** ein Studio-Admin oeffnet den zentralen Bereich `Module` auf Studio-Root-Ebene
- **WHEN** er eine konkrete Instanz auswaehlt und ein Modul zuweist
- **THEN** zeigt die UI verfuegbare und bereits zugewiesene Module getrennt oder gleichwertig filterbar an
- **AND** bietet sie pro Modul eine explizite Aktion zum Zuweisen oder Entziehen an
- **AND** bleibt dieser Bereich als rootweiter Sammelarbeitsplatz erreichbar
- **AND** haben Instanz-Operatoren keinen Zugriff auf diese Verwaltung

#### Scenario: Sammelseite und Detail-Tab verwenden denselben Fach-Workspace

- **GIVEN** die Modulverwaltung ist sowohl auf `/admin/modules` als auch in `/admin/instances/:instanceId` verfuegbar
- **WHEN** ein Root-Admin dieselbe Modulmutation in einem der beiden Einstiege ausloest
- **THEN** verwenden beide Oberflaechen dieselben Root-only-Mutationen und dieselbe fachliche Zustandsdarstellung
- **AND** fuehrt die Detailseite keine abweichende zweite Aktivierungslogik ein

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
- **AND** weist es darauf hin, dass die Zuweisung im Tab `Module` oder alternativ im zentralen Bereich `Module` erfolgt
- **AND** wertet es den leeren Modulsatz nicht als Fehler, sondern als erwarteten Ausgangszustand

### Requirement: Instanz-Detailseite zeigt Modultransparenz fuer alle global bekannten Module

Das System SHALL auf der Instanz-Detailseite alle global bekannten Module in einem eigenen Root-Admin-Tab `Module` anzeigen. Der Status wird pro Modul ausschliesslich aus der Root-Modulzuordnung der Instanz abgeleitet; die Seite fuehrt keine zweite Aktivierungslogik ein. Die Beschreibung eines Moduls stammt aus pluginseitig gepflegter Metadatenauflosung.

#### Scenario: Instanz zeigt aktive und deaktivierte Module im Modul-Tab

- **GIVEN** eine Instanzdetailseite kennt die global bekannte Modulliste und den aktuell zugewiesenen Modulsatz der Instanz
- **WHEN** der Studio-Admin den Tab `Module` oeffnet
- **THEN** zeigt die UI alle global bekannten Module in einer Tabelle oder gleichwertigen Listenansicht an
- **AND** markiert sie Module aus `assignedModules` als aktiv
- **AND** markiert sie global bekannte, aber nicht zugewiesene Module als deaktiviert
- **AND** zeigt sie pro Modul eine pluginseitig gepflegte Beschreibung an

#### Scenario: Fehlende Modulbeschreibung nutzt Fallback ohne die Tabelle zu verbergen

- **GIVEN** ein global bekanntes Modul liefert keine aufloesbare Beschreibung
- **WHEN** der Studio-Admin den Tab `Module` oeffnet
- **THEN** bleibt das Modul in der Uebersicht sichtbar
- **AND** rendert die UI fuer dieses Modul einen definierten Fallbacktext statt einer leeren Beschreibung
- **AND** bleibt die Modultransparenz der restlichen Eintraege unveraendert lesbar

## ADDED Requirements
### Requirement: Instanz-Detailseite bietet einen Root-Admin-Modul-Workspace als eigenen Tab

Das System SHALL auf der Root-Admin-Instanz-Detailseite unter `/admin/instances/:instanceId` einen eigenen Tab `Module` bereitstellen, der die instanzgebundene Modulverwaltung fuer genau diese Instanz enthaelt. Die Sammelseite `/admin/modules` bleibt daneben als rootweiter Ueberblick bestehen.

#### Scenario: Root-Admin verwaltet Module direkt im Instanz-Detail

- **GIVEN** ein Root-Admin oeffnet `/admin/instances/:instanceId`
- **WHEN** er den Tab `Module` waehlt
- **THEN** zeigt die Detailseite fuer genau diese Instanz die Bereiche `Zugewiesene Module` und `Verfuegbare Module`
- **AND** bietet sie dort dieselben fachlichen Aktionen wie die Sammelseite an
- **AND** benoetigt der Root-Admin keine zusaetzliche Instanzauswahl

#### Scenario: Modulzuweisung und IAM-Baseline laufen ohne zusaetzlichen Confirm-Schritt

- **GIVEN** ein Root-Admin befindet sich im Modul-Tab einer Instanz
- **WHEN** er ein Modul zuweist oder `IAM-Basis neu aufbauen` ausloest
- **THEN** fuehrt die UI die bestehende Root-only-Mutation direkt aus
- **AND** zeigt danach eine verstaendliche Ergebnisrueckmeldung

#### Scenario: Entzug und Admin-Struktur-Initialisierung verlangen eine explizite Bestaetigung

- **GIVEN** ein Root-Admin befindet sich im Modul-Tab einer Instanz
- **WHEN** er ein Modul entziehen oder die Admin-Struktur initialisieren will
- **THEN** verlangt die UI vor der Mutation eine explizite Bestaetigung in einem Dialog
- **AND** bleibt der Dialoginhalt fachlich eindeutig auf diese Instanz bezogen
- **AND** wird die Mutation ohne bestaetigenden Abschluss nicht ausgefuehrt
