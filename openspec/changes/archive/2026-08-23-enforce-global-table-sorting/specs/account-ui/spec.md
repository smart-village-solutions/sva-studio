## ADDED Requirements

### Requirement: Paginierte Benutzerlisten täuschen keine globale Sortierung vor

Das System MUST Sortieraktionen in paginierten Tenant- und Plattform-Benutzerlisten nur anbieten, wenn die führende Benutzerquelle die vollständige gefilterte Ergebnismenge für das jeweilige Feld korrekt sortieren kann.

#### Scenario: Keycloak unterstützt die dargestellten Sortierfelder nicht global

- **GIVEN** eine Tenant- oder Plattform-Benutzerliste wird seitenweise aus Keycloak und lokalen Projektionen zusammengesetzt
- **AND** die führende Quelle unterstützt keine globale Sortierung für eine dargestellte Spalte
- **WHEN** ein Administrator die paginierte Benutzerliste öffnet
- **THEN** zeigt die Spalte keine Sortieraktion
- **AND** sortiert der Browser nicht ausschließlich die aktuell geladene Benutzerseite

#### Scenario: Unpaginierte Benutzer-Teilansicht besitzt einen Vollbestand

- **GIVEN** eine getrennte Benutzer-Teilansicht enthält nachweislich den vollständigen gefilterten Datenbestand
- **WHEN** sie eine fachlich korrekte clientseitige Sortierung anbietet
- **THEN** darf sie den expliziten Tabellenmodus `client` verwenden
- **AND** wird diese Sortierung nicht allein wegen der deaktivierten paginierten Hauptlisten entfernt
