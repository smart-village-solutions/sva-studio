## ADDED Requirements

### Requirement: Architektur dokumentiert tenant-lokale Auth-Flows
Die Architekturdokumentation SHALL tenant-lokale Login-, Callback-, Logout- und Reauth-Flows sowie den Wechsel vom globalen Realm-Modell auf instanzspezifische Realm-Auflösung beschreiben.

#### Scenario: Architekturänderung wird nach Implementierung nachvollzogen
- **WHEN** ein Entwickler oder Operator die Arc42- und ADR-Dokumentation liest
- **THEN** sind Request-Flows, Betriebsannahmen, Cache-Segmentierung und Sicherheitsgrenzen für realm-spezifisches Auth-Routing beschrieben
