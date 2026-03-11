## ADDED Requirements

### Requirement: Verwaltungs-UI für Gruppen und vermittelte Rechte

Das System SHALL in der Admin-UI Oberflächen für Gruppen, Gruppenzuweisungen und deren vermittelte Rechte bereitstellen.

#### Scenario: Gruppe wird in der Admin-UI verwaltet

- **WHEN** ein Administrator die Gruppenverwaltung öffnet
- **THEN** kann er Gruppen anlegen, bearbeiten, deaktivieren und Accounts zuweisen
- **AND** die UI zeigt an, welche Rollen oder Berechtigungen über die Gruppe vermittelt werden
- **AND** Änderungen sind ohne hardcodierte Texte und mit zugänglicher Statuskommunikation bedienbar

### Requirement: Sichtbare Lifecycle-Workflows in der Verwaltungs-UI

Das System SHALL Onboarding-, Offboarding- und Delegationszustände in der Verwaltungs-UI sichtbar und steuerbar machen.

#### Scenario: Onboarding-Status eines Accounts ist offen

- **WHEN** ein Administrator einen Account mit offenem Onboarding betrachtet
- **THEN** zeigt die UI den aktuellen Lifecycle-Status, ausstehende Schritte und zulässige Folgeaktionen an
- **AND** sicherheitsrelevante Aktionen wie Offboarding oder Delegationsentzug erfordern eine explizite Bestätigung

### Requirement: Rollen- und Organisationszuweisungen mit Konflikthinweisen

Das System SHALL bei Rollen-, Gruppen- und Organisationszuweisungen fachliche Konflikte sichtbar machen.

#### Scenario: Zuweisung kollidiert mit bestehender Restriktion

- **WHEN** eine geplante Zuweisung wegen Scope-, Hierarchie- oder Lifecycle-Regeln nicht wirksam wäre oder einen Konflikt erzeugt
- **THEN** kommuniziert die UI diesen Zustand verständlich vor dem Speichern
- **AND** der Administrator erhält keinen irreführenden Erfolgseindruck
