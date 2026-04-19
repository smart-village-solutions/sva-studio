## ADDED Requirements

### Requirement: Fully-Qualified Plugin-Action-Bindings im Routing und UI
Das Routing-System MUST Plugin-Routen und zugehörige UI-Bindings so integrieren, dass deklarierte Plugin-Aktionen über ihre vollständig qualifizierten Action-IDs referenziert werden können.

#### Scenario: Host-App löst Plugin-Aktionsmetadaten zentral auf
- **WHEN** die Host-App Plugins registriert
- **THEN** baut sie neben Route- und Navigation-Registries auch eine zentrale Plugin-Action-Registry auf
- **AND** UI-Bindings können Titel, Owner und Guard-Metadaten über die fully-qualified Action-ID auflösen

#### Scenario: Plugin-UI nutzt deklarierte Action-ID statt impliziter String-Konvention
- **WHEN** eine Plugin-Oberfläche eine Aktion wie `news.create` rendert
- **THEN** liest sie den Titel- und Guard-Bezug aus der deklarierten Plugin-Action-Definition
- **AND** es existiert keine separate, ungebundene UI-Konvention für dieselbe Aktion
