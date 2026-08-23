## ADDED Requirements

### Requirement: Die Sidebar gruppiert die Inhaltsnavigation nach lesbarem Datentyp

Die Layout-Shell MUST den Bereich `Inhalte` als zugängliche Navigationsgruppe mit einem Einstieg für alle Inhalte und berechtigungsabhängigen Einstiegen für registrierte Inhaltstypen darstellen.

#### Scenario: Benutzer öffnet die Inhaltsgruppe

- **WENN** ein Benutzer mindestens einen Inhaltstyp lesen darf
- **DANN** zeigt die Sidebar `Inhalte` als aufklappbare Gruppe
- **UND** steht `Alle` als erster Unterpunkt zur Verfügung
- **UND** folgen ausschließlich registrierte Inhaltstypen, deren Read-Action und Modulzuweisung im aktuellen Kontext erfüllt sind
- **UND** verwenden alle Unterpunkte die kanonische gemeinsame Inhaltsroute `/admin/content`

#### Scenario: Benutzer öffnet einen typbezogenen Unterpunkt

- **WENN** ein Benutzer einen Inhaltstyp-Unterpunkt wie Nachrichten, Veranstaltungen oder POI auswählt
- **DANN** setzt die Navigation den registrierten `contentType` als `type`-Search-Parameter der gemeinsamen Inhaltsroute
- **UND** bleibt genau dieser Unterpunkt aktiv
- **UND** bleibt die Inhaltsgruppe geöffnet

#### Scenario: Alle Inhalte sind aktiv

- **WENN** die Route `/admin/content` keinen gültigen expliziten Typfilter enthält
- **DANN** ist ausschließlich der Unterpunkt `Alle` aktiv
- **UND** ist kein typbezogener Unterpunkt fälschlich aktiv

#### Scenario: Typbezogener Editor hält den Navigationskontext

- **WENN** ein Benutzer eine registrierte Erstellungs- oder Detailroute eines Inhaltstyps öffnet
- **DANN** bleibt die Inhaltsgruppe aktiv und geöffnet
- **UND** ist der zugehörige Inhaltstyp-Unterpunkt aktiv

#### Scenario: Inhaltsgruppe bleibt responsiv und zugänglich

- **WENN** die Sidebar erweitert, eingeklappt oder als mobiler Drawer dargestellt wird
- **DANN** bleiben alle sichtbaren Inhalts-Unterpunkte per Tastatur und Screenreader erreichbar
- **UND** sind Öffnungs- und Auswahlzustand semantisch erkennbar
- **UND** verursacht die Gruppe kein horizontales Layout-Breaking
