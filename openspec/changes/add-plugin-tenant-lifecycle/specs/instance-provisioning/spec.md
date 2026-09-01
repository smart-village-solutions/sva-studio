## ADDED Requirements

### Requirement: Plugin-Fachprovisionierung und Instanz-Core-Setup bleiben getrennt und korrelierbar

Das System SHALL Core-/IAM-Setup einer Instanz und tenantbezogene Plugin-Fachprovisionierung als getrennte Prozessverträge führen. Die Instanzdetailansicht MUST beide Zustände korrelieren, ohne Pluginfehler als Realm- oder Core-Fehler umzudeuten.

#### Scenario: Core-Setup ist bereit und Plugin-Provisionierung blockiert

- **GIVEN** Instanz, Realm, Login-Client und Tenant-Admin sind erfolgreich eingerichtet
- **AND** die Fachprovisionierung eines aktiven Plugins ist blockiert
- **WHEN** der Root-Admin die Instanzdetailansicht öffnet
- **THEN** zeigt das System Core-/IAM-Setup als bereit und das Plugin getrennt als blockiert
- **AND** bietet es eine zum Plugin-Lifecycle gehörende Reparaturaktion an

#### Scenario: Pflicht-Plugin beeinflusst die Gesamtbereitschaft

- **GIVEN** ein `required`-Plugin ist für die Instanz aktiv, aber fachlich nicht bereit
- **WHEN** die aggregierte Instanzbereitschaft bewertet wird
- **THEN** bleibt die Gesamtbereitschaft blockiert
- **AND** bleibt erkennbar, dass der blockierende Teilvertrag vom Plugin und nicht vom Core stammt
