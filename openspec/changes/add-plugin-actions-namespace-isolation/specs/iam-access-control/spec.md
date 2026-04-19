## ADDED Requirements

### Requirement: Einheitliches Zielformat für autorisierbare Action-IDs
Das IAM-System MUST autorisierbare Action-IDs langfristig in einem einheitlichen fully-qualified Format `<namespace>.<actionName>` behandeln, unabhängig davon, ob die Action aus dem Core oder aus einem Plugin stammt.

#### Scenario: Core-Action verwendet das gemeinsame Zielformat
- **WHEN** ein Client `POST /iam/authorize` für eine interne Action wie `content.read` aufruft
- **THEN** wird die Action als gültige fully-qualified Action-ID akzeptiert
- **AND** sie folgt demselben Formatvertrag wie eine Plugin-Action

#### Scenario: Plugin-Action verwendet das gemeinsame Zielformat
- **WHEN** ein Client `POST /iam/authorize` für eine Plugin-Action wie `news.create` aufruft
- **THEN** wird die Action als gültige fully-qualified Action-ID akzeptiert
- **AND** sie folgt demselben Formatvertrag wie eine interne Core-Action

### Requirement: Namespace-sichere Plugin-Action-Autorisierung
Das IAM-System MUST Plugin-Aktionen in vollständig qualifizierter Form autorisieren und Action-IDs ohne Namespace-Kollaps oder implizites Prefix-Mapping auswerten.

#### Scenario: Authorize nutzt vollständig qualifizierte Action-ID
- **WHEN** ein Client `POST /iam/authorize` für `news.create` aufruft
- **THEN** wird genau `news.create` gegen die effektiven Berechtigungen ausgewertet
- **AND** es findet keine implizite Umdeutung auf `create`, `content.create` oder einen anderen Namespace statt

#### Scenario: Fremder Namespace bleibt verboten
- **WHEN** ein Plugin ohne passende Berechtigung eine fremde Action-ID wie `events.publish` ausführen will
- **THEN** liefert die Autorisierung eine Deny-Entscheidung
- **AND** die Diagnose bleibt auf die vollständig qualifizierte Action-ID referenzierbar

### Requirement: Legacy-Kurzformen bleiben eine explizite Übergangsphase
Das IAM-System MUST unqualifizierte Legacy-Action-Strings wie `read`, `write` oder `create` nur als zeitlich begrenzte Übergangsphase behandeln und darf daraus keine implizite Namespace-Zuordnung ableiten.

#### Scenario: Legacy-Kurzform erhält keinen impliziten Namespace
- **WHEN** eine unqualifizierte Legacy-Action wie `read` verarbeitet wird
- **THEN** wird sie nicht implizit zu `content.read`, `news.read` oder einem anderen fully-qualified Namen umgedeutet
- **AND** eine zukünftige Verschärfung des Request-Schemas kann diese Legacy-Kurzform vollständig verbieten
