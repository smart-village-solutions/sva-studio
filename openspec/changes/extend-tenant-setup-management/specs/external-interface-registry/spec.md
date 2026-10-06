## ADDED Requirements

### Requirement: Tenant-Schnittstellen besitzen autorisierte Verwaltungs-HTTP-Verträge

Studio SHALL die bereits unterstützten tenantseitigen Einzelaktionen für Schnittstellen über Verwaltungs-HTTP-Endpunkte bereitstellen, soweit sie für Einrichtung und laufende Verwaltung benötigt werden. Diese Endpunkte SHALL die vorhandenen Interface-Services, Schemas, Berechtigungen, Tenant-Bindung, verschlüsselte Secret-Speicherung und Healthchecks wiederverwenden. Pluginverwaltete Interfaces SHALL in der allgemeinen Tenant-Verwaltung verborgen bleiben.

#### Scenario: Beauftragte Schnittstelle konfigurieren und prüfen

- **WHEN** ein berechtigter Tenant-Administrator eine unterstützte Schnittstelle über die Verwaltungs-API anlegt oder ändert
- **THEN** verwendet Studio dieselbe Validierung und Persistenz wie die vorhandene Studio-Verwaltung
- **AND** der Status kann über einen autorisierten Readback oder Healthcheck geprüft werden

#### Scenario: Pluginverwaltete Schnittstelle direkt adressieren

- **WHEN** ein allgemeiner Tenant-Verwaltungsaufruf ein pluginverwaltetes Interface direkt adressiert
- **THEN** verweigert Studio die Bearbeitung nach dem bestehenden Owner-Vertrag

#### Scenario: Schnittstelle entfernen

- **WHEN** ein berechtigter Administrator eine löschbare Schnittstelle über die Verwaltungs-API entfernt
- **THEN** gelten dieselben Schutzregeln und Auditanforderungen wie im bestehenden Interface-Pfad
- **AND** spätere Readbacks zeigen den aktuellen Zustand
