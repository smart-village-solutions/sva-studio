## ADDED Requirements

### Requirement: Organisationslisten werden vor der Pagination global sortiert

Das System MUST Organisationslisten innerhalb des autorisierten Instanzumfangs zuerst filtern, danach deterministisch sortieren und erst anschließend paginieren. Es MUST standardmäßig `displayName asc` verwenden und die serverseitig unterstützten Felder `displayName`, `parentDisplayName`, `childCount`, `membershipCount` und `isActive` auf den vollständigen Trefferbestand anwenden.

#### Scenario: Administrator sortiert eine gefilterte Organisationsliste

- **GIVEN** eine Organisationsliste enthält mehr Treffer als auf eine Seite passen
- **AND** ein Such-, Typ- oder Statusfilter ist aktiv
- **WHEN** der Administrator ein unterstütztes Sortierfeld und eine Sortierrichtung auswählt
- **THEN** wendet das Backend Filterung und Sortierung auf die vollständige autorisierte Treffermenge an
- **AND** berechnet es erst danach die angeforderte Seite
- **AND** stellt es fehlende Elternwerte unabhängig von der Richtung ans Ende
- **AND** stabilisiert es gleiche Sortierwerte mit `ID asc`

#### Scenario: Organisationsliste verwendet einen sichtbaren alphabetischen Default

- **GIVEN** die Organisationsliste wird ohne gültigen expliziten Sortierwert geöffnet
- **WHEN** das System die erste Seite lädt
- **THEN** sortiert das Backend nach `displayName asc`
- **AND** zeigt die Tabelle den Anzeigenamen als aktive Sortierung
- **AND** ordnet sie nicht still nach Hierarchietiefe

#### Scenario: Flache alphabetische Liste täuscht keine Baumstruktur vor

- **WHEN** Organisationen global alphabetisch über mehrere Seiten sortiert werden
- **THEN** rückt die Namensspalte Einträge nicht anhand ihrer Hierarchietiefe ein
- **AND** bleiben übergeordnete Organisation und Hierarchieinformationen in den vorgesehenen Feldern erkennbar

#### Scenario: Übersetzter Organisationstyp ist nicht scheinbar alphabetisch sortierbar

- **WHEN** die Organisationsliste lokalisierte Typbezeichnungen anzeigt
- **THEN** bietet die Typ-Spalte keine Sortieraktion an
- **AND** sortiert das Backend sie nicht nach technischen Enum-Werten

#### Scenario: Ungültige Organisationssortierung wird abgewiesen

- **GIVEN** ein direkter Organisationslisten-Request enthält ein unbekanntes Sortierfeld oder eine unbekannte Richtung
- **WHEN** der Runtime-Handler den Request validiert
- **THEN** antwortet er mit `400 invalid_request`
- **AND** führt das Read-Model kein ungeprüftes SQL-Fragment aus
