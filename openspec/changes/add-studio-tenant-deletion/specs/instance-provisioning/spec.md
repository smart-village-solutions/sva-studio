## ADDED Requirements

### Requirement: Archivierte Instanzen können ausschließlich Studio-lokal gelöscht werden

Das System SHALL einen explizit bestätigten Root-Admin-Löschpfad mit CSRF-Schutz und frischer Anmeldung bereitstellen. Er SHALL ausschließlich unverändert archivierte Instanzen ohne aktive Aufbewahrungssperren, ausstehende Jobs oder laufendes Provisioning atomar aus der lokalen Studio-Datenbank entfernen. Eine Löschung SHALL weder Mainserver noch Keycloak noch Objektspeicher oder externe Plugin-Datenbanken verändern. Die bestehende automatische Aktivierungs-Reconciliation SHALL für diesen Aufruf deaktiviert bleiben.

#### Scenario: Test-Tenant wird lokal endgültig gelöscht

- **WHEN** ein berechtigter Root-Admin die archivierte Instanz mit Tenant-ID und aktuellem Änderungsstand ausdrücklich bestätigt
- **THEN** werden ihre lokalen Daten, Hostnamen, Verknüpfungen und Zugangsdaten atomar entfernt
- **AND** bleiben andere Tenants, globale Kataloge und sämtliche externen Ressourcen unverändert
- **AND** bleibt ein Plattform-Audit-Eintrag als Löschbeleg erhalten

#### Scenario: Löschung ist blockiert oder schlägt fehl

- **WHEN** die Instanz aktiv oder verändert ist, aktive Aufbewahrungssperren beziehungsweise ausstehende Arbeit bestehen oder eine Datenbankoperation fehlschlägt
- **THEN** bleibt die Instanz erhalten und es wird ein aussagekräftiger Fehler zurückgegeben
- **AND** entstehen keine partiellen lokalen Löschungen oder externen Mutationen
