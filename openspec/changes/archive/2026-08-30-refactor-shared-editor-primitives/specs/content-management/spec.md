## ADDED Requirements

### Requirement: Standardisierte technische Lifecycles für Content-Plugins

Das System SHALL wiederkehrende technische Content-Editor-Lifecycles über
gemeinsame frameworkfreie Clientverträge und hosteigene React-Controller
bereitstellen, ohne fachliche Plugin-Logik in den Host zu verschieben.

#### Scenario: Plugin nutzt gemeinsamen Lifecycle ohne Fachlogikverlust

- **GIVEN** ein standardisiertes Content-Plugin verwendet gemeinsame
  Pagination-, Map-, Media-Picker- oder Reference-Retry-Abläufe
- **WHEN** sein Editor oder seine Liste ausgeführt wird
- **THEN** delegiert es den wiederkehrenden technischen Ablauf an den
  gemeinsamen Vertrag
- **AND** Mapping, Validierung, Permissions, Payload, fachliche Texte und
  Navigation bleiben im Plugin

#### Scenario: Normaler Submit bleibt pluginkontrolliert

- **GIVEN** ein migrierter Editor speichert Content
- **WHEN** ein normaler oder nach Validierungsfehler erneut ausgelöster Submit
  erfolgt
- **THEN** läuft er weiterhin über den bestehenden RHF-/Zod-`handleSubmit`-
  Pfad des Plugins
- **AND** der gemeinsame technische Controller umgeht weder Validierung noch
  bestehende Idempotenz- und Mutationsverträge

### Requirement: Vollständige Consumer-Migration der benannten Clone-Familien

Das System SHALL jede im Change benannte Clone-Familie für alle zugehörigen
produktiven Consumer migrieren und die ersetzten lokalen Implementierungen
entfernen.

#### Scenario: Pagination besitzt genau eine Implementierung

- **GIVEN** Events, Generic Items, POI und Projects verwenden identische
  List-Search-Regeln und News besitzt noch eine ungenutzte identische Kopie
- **WHEN** der Change abgeschlossen wird
- **THEN** nutzen alle vier realen Consumer genau einen gemeinsamen Vertrag
- **AND** ihre fünf lokalen `list-pagination.ts`-Implementierungen sind
  entfernt

#### Scenario: Map-Lifecycle besitzt genau eine technische Implementierung

- **GIVEN** Events, Generic Items und POI verwenden denselben technischen
  Location-Map-Ablauf
- **WHEN** der Change abgeschlossen wird
- **THEN** nutzen alle drei Plugins denselben gemeinsamen Lifecycle
- **AND** ersetzte lokale Hook-, Effects-, Shared- und Cache-Implementierungen
  sind entfernt

#### Scenario: Media-Picker-Konfiguration ist nicht mehr pluginlokal kopiert

- **GIVEN** Events, Generic Items, News und POI verwenden dieselbe technische
  Labelstruktur und Feedback-Abbildung
- **WHEN** der Change abgeschlossen wird
- **THEN** nutzen alle vier Plugins denselben gemeinsamen Vertrag
- **AND** lokale Erzeuger und Resolver derselben Struktur sind entfernt

#### Scenario: Media-Reference-Retry ist für alle Consumer konsolidiert

- **GIVEN** Events, Generic Items, News, POI, Projects und Cockpit Cards
  verwenden denselben technischen Save-/Reference-Retry-Ablauf
- **WHEN** der Change abgeschlossen wird
- **THEN** nutzen alle sechs Plugins denselben gemeinsamen Controller
- **AND** ihre ersetzten lokalen Retry-Zustände, Statusabbildungen und
  Inline-Retry-Aktionen sind entfernt

### Requirement: Technical-Debt-Abbau ist nachweisbar

Das System SHALL den Abschluss des Changes durch Verhaltensnachweise,
Löschbilanz und statische Clone-Analyse belegen.

#### Scenario: Abschluss weist reale Ownership-Reduktion nach

- **GIVEN** alle Migrationsslices sind implementiert
- **WHEN** der Change zur Abnahme vorgelegt wird
- **THEN** dokumentiert die Löschbilanz entfernte Dateien, Exporte, Funktionen,
  Consumer und produktive Zeilen
- **AND** der produktive Zielscope ist netto nicht gewachsen
- **AND** Fallow meldet weder die erfassten Clone-Familien noch gleichwertige
  neue Kopien im Zielscope

#### Scenario: Paralleler Altpfad blockiert den Abschluss

- **GIVEN** mindestens eine ersetzte lokale Implementierung oder ein
  dauerhafter Kompatibilitätswrapper existiert weiterhin
- **WHEN** der Abschluss geprüft wird
- **THEN** bleibt der Change unvollständig
- **AND** die betreffende Aufgabe darf nicht als erledigt markiert werden
