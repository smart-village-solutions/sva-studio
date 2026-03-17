## ADDED Requirements

### Requirement: Automatisierter Organisations- und Membership-Abnahmenachweis

Das System MUST für die Organisations- und Membership-Funktionalität einen reproduzierbaren Abnahmenachweis in der vereinbarten Testumgebung bereitstellen.

#### Scenario: Organisations-CRUD wird im aktiven Instanzkontext nachgewiesen

- **WHEN** der Paket-2-Abnahmeflow ausgeführt wird
- **THEN** werden Erstellen, Lesen, Aktualisieren und Deaktivieren einer Organisation im aktiven Instanzkontext erfolgreich geprüft
- **AND** Parent-/Child-Beziehungen und Hierarchiefelder werden im selben Flow verifiziert

#### Scenario: Membership-Zuweisung und Default-Kontext werden nachgewiesen

- **WHEN** der Paket-2-Abnahmeflow eine Account-zu-Organisation-Zuweisung ausführt
- **THEN** ist die Membership über API und Datenbank nachweisbar vorhanden
- **AND** der Default-Kontext des Accounts ist korrekt gesetzt oder aktualisiert

#### Scenario: Admin-UI spiegelt Organisations- und Membership-Daten korrekt wider

- **WHEN** der Paket-2-Abnahmeflow die Admin-Oberfläche prüft
- **THEN** sind Benutzerliste, Organisationsstruktur und Membership-Zuweisung sichtbar korrekt
- **AND** der Abnahmebericht dokumentiert den erfolgreichen UI-Nachweis
