## ADDED Requirements

### Requirement: System-Administratoren pflegen installationsweite SSF-Standards

Das System SHALL dem Root-`system_admin` eine SSF-Standardoberfläche anbieten,
in der er Standardsprache, verfügbare Sprachen, die drei lokalisierten
Erklärungstexte und die Gesprächsspeicherung für die SSF-Installation pflegt.
Der Zugriff MUST eine explizite Root-Berechtigung erfordern.

#### Scenario: Systemstandard wird geändert

- **GIVEN** ein Tenant hat den betroffenen Wert nicht überschrieben
- **WHEN** der `system_admin` den Systemstandard gültig ändert
- **THEN** verwendet die wirksame Tenant-Konfiguration unmittelbar den neuen Systemstandard
- **AND** werden vorhandene Tenant-Overrides nicht verändert

#### Scenario: Root-Nutzer besitzt keine SSF-Systemberechtigung

- **WHEN** ein Root-Nutzer ohne erforderliche SSF-Berechtigung Navigation oder API aufruft
- **THEN** bleiben Oberfläche und Datenzugriff gesperrt

### Requirement: Tenant-Administratoren bearbeiten SSF-Overrides im Plugin-Scope

Das System SHALL eine tenantlokale SSF-Konfigurationsoberfläche ausschließlich
als Beitrag des installierten SSF-Plugins bereitstellen. Lesen MUST
`ssf.configuration.tenant.read`, Schreiben MUST
`ssf.configuration.tenant.manage` erfordern. Der Server MUST den Tenant aus dem
verifizierten Ausführungskontext binden.

#### Scenario: Berechtigter Tenant-Administrator öffnet die Konfiguration

- **GIVEN** das SSF-Plugin ist für den Tenant aktiv
- **AND** der Nutzer besitzt `ssf.configuration.tenant.read`
- **WHEN** er die SSF-Konfigurationsseite öffnet
- **THEN** sieht er die geerbten Systemstandards und seine Tenant-Overrides
- **AND** sieht er keine Branding-, Tenantnamen- oder Zeitzonenfelder

#### Scenario: Nutzer ohne Schreibrecht öffnet die Konfiguration

- **GIVEN** der Nutzer besitzt Leserecht, aber nicht `ssf.configuration.tenant.manage`
- **WHEN** er die SSF-Konfigurationsseite öffnet
- **THEN** ist die Konfiguration lesbar
- **AND** sind alle Änderungen und Speichern-Aktionen gesperrt

### Requirement: Beide Editoren verwalten nur Sprachen, Texte und Gesprächsspeicherung

Das System SHALL auf Root- und Tenant-Ebene Standardsprache, Sprachen, die drei
lokalisierten SSF-Erklärungstexte und den Modus `ask` oder `disabled`
bearbeiten. Der Server MUST alle Eingaben validieren und HTML mit der
bestehenden SSF-Sanitization bereinigen.

#### Scenario: Gültige mehrsprachige Tenant-Konfiguration wird gespeichert

- **GIVEN** der Nutzer besitzt `ssf.configuration.tenant.manage`
- **WHEN** er gültige Overrides speichert
- **THEN** werden alle Änderungen atomar im gebundenen Tenant gespeichert
- **AND** liest die Oberfläche den bestätigten Stand erneut

#### Scenario: Ungültige Eingabe wird abgelehnt

- **WHEN** ein Text die Vertragsgrenze überschreitet oder die Standardsprache nicht aktiv ist
- **THEN** wird der gesamte Speichervorgang ohne Teiländerung abgelehnt
- **AND** zeigt die Oberfläche eine verständliche Fehlermeldung, ohne den Entwurf zu verlieren

#### Scenario: Tenant setzt einen Wert auf den Systemstandard zurück

- **GIVEN** ein Tenant hat einen Wert überschrieben
- **WHEN** der `tenant_admin` „Systemstandard verwenden“ auswählt und speichert
- **THEN** wird der betreffende Tenant-Override entfernt
- **AND** folgt der wirksame Wert wieder aktuellen und zukünftigen Systemstandards

### Requirement: Branding bleibt außerhalb der UI- und Schreibverträge

Das System MUST Branding, Logo und Icon aus beiden Administrationsoberflächen
und ihren Schreibverträgen ausschließen. Bestehende Datenbankfelder oder
Runtime-Fallbacks dürfen dadurch weder entfernt noch verändert werden.

#### Scenario: Unterstützte SSF-Konfiguration wird geändert

- **WHEN** ein System- oder Tenant-Administrator unterstützte Werte speichert
- **THEN** bleiben sämtliche Branding-Werte unverändert
