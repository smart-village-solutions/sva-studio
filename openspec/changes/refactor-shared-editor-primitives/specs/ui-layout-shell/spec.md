## ADDED Requirements

### Requirement: Gemeinsame technische Content-Editor-Primitives

Das Studio SHALL in `studio-ui-react` gemeinsame React-Primitives und
Controller für nachweislich wiederkehrende technische Content-Editor-Abläufe
bereitstellen, damit mehrere Content-Editoren dieselben hosteigenen UI-, Map-,
Media-Picker- und Reference-Retry-Verträge nutzen.

#### Scenario: Mehrere Editoren nutzen denselben technischen Controller

- **GIVEN** mindestens zwei Content-Editoren besitzen denselben technischen
  Zustands- und Fehlerablauf
- **WHEN** dieser Ablauf konsolidiert wird
- **THEN** verwenden die Editoren denselben gemeinsamen Controller aus
  `studio-ui-react`
- **AND** pluginlokale Payloads, Texte, Navigation und Fachregeln bleiben über
  kleine explizite Eingaben beim jeweiligen Plugin

#### Scenario: Location-Map-Lifecycle wird gemeinsam betrieben

- **GIVEN** Events, Generic Items und POI verwenden denselben Map-, Marker-,
  Viewport- und Cleanup-Ablauf
- **WHEN** ihre Location-Editoren materialisiert werden
- **THEN** nutzen sie denselben strukturell typisierten React-Lifecycle
- **AND** der gemeinsame Vertrag führt keine zweite Map-Dependency oder
  Providerlogik ein

#### Scenario: Reference-Retry wiederholt keine Content-Mutation

- **GIVEN** ein Content-Item wurde gespeichert und nur seine
  Medienreferenz-Synchronisation ist fehlgeschlagen
- **WHEN** der Benutzer den Reference-Retry ausführt
- **THEN** wird ausschließlich die Referenzoperation wiederholt
- **AND** die bereits erfolgreiche Content-Mutation wird nicht erneut gesendet

### Requirement: Frameworkfreie gemeinsame Plugin-Clientverträge

Das Studio SHALL frameworkfreie Normalisierungs- und Host-Clientverträge, die
von mehreren Content-Plugins identisch benötigt werden, in `plugin-sdk`
besitzen.

#### Scenario: Listenparameter werden zentral normalisiert

- **GIVEN** Events, Generic Items, POI und Projects verwenden dieselben
  Seitengrößen-, Default- und Offsetregeln
- **WHEN** ein Plugin seine List-Search-Parameter normalisiert
- **THEN** verwendet es den gemeinsamen Vertrag aus `plugin-sdk`
- **AND** es existiert keine parallele pluginlokale Implementierung derselben
  Regeln

#### Scenario: Geocoding-Konfiguration wird zentral dedupliziert

- **GIVEN** mehrere Plugins lesen dieselbe hostseitige Map-/Geocoding-
  Konfiguration
- **WHEN** gleichzeitige Reads stattfinden
- **THEN** dedupliziert der gemeinsame Client den laufenden Read
- **AND** ein fehlgeschlagener Read bleibt nicht dauerhaft gecacht

### Requirement: Ersetzte Editor-Implementierungen werden entfernt

Das Studio SHALL bei der Einführung gemeinsamer Editor-Verträge die ersetzten
lokalen Implementierungen im selben Migrationsblock entfernen und eine
prüfbare Löschbilanz führen.

#### Scenario: Migration löscht den lokalen Altpfad

- **GIVEN** ein Plugin wurde auf einen gemeinsamen Editor-Vertrag umgestellt
- **WHEN** der Migrationsblock abgeschlossen wird
- **THEN** sind ersetzte lokale Dateien, Funktionen, Exporte, Zustände und
  Inline-Abläufe gelöscht
- **AND** es verbleibt kein dauerhafter Weiterleitungswrapper oder paralleler
  Altpfad

#### Scenario: Gemeinsamer Code reduziert den produktiven Zielscope

- **GIVEN** der Change fügt gemeinsamen Produktivcode hinzu
- **WHEN** seine Gesamtbilanz über `plugin-sdk`, `studio-ui-react` und alle
  migrierten Plugins erstellt wird
- **THEN** übersteigen hinzugefügte produktive TypeScript-/TSX-Zeilen die
  entfernten produktiven Zeilen nicht
- **AND** Tests und Dokumentation werden getrennt von dieser Bilanz
  ausgewiesen

#### Scenario: Spekulative Abstraktion wird abgewiesen

- **GIVEN** ein vorgeschlagener API-Parameter oder Abstraktionszweig besitzt
  weniger als zwei reale produktive Consumer
- **WHEN** der gemeinsame Vertrag reviewt wird
- **THEN** wird dieser Teil nicht in den gemeinsamen Vertrag aufgenommen
- **AND** die konkrete Fachlogik bleibt lokal lesbar
