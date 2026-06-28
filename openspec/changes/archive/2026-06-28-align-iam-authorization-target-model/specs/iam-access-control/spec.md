## ADDED Requirements

### Requirement: Effektive Permissions normalisieren den weitesten Scope

Das System SHALL effektive Permissions für identische fachliche Permission-Keys auf den weitesten wirksamen Access-Scope normalisieren.

Ein fachlicher Permission-Key besteht mindestens aus Action, Resource, optionalem Resource-Identifier, optionalem Content-Type und dem aktiven Instanzkontext. Die Scope-Reihenfolge SHALL `own < organization < all` sein. Rollen- und Gruppen-Provenienz SHALL weiterhin erklärbar bleiben, darf aber nicht zu mehreren widersprüchlichen effektiven Grants für denselben fachlichen Key führen.

#### Scenario: Gruppenrolle erweitert eigene Berechtigung auf Organisationsscope

- **GIVEN** ein Benutzer erhält `content.update` über eine direkte Rolle mit Scope `own`
- **AND** derselbe Benutzer erhält `content.update` über eine Gruppenrolle mit Scope `organization`
- **WHEN** das System die effektiven Permissions serialisiert
- **THEN** enthält das Read Model für diesen fachlichen Permission-Key Scope `organization`
- **AND** die Provenienz enthält direkte Rolle und Gruppenrolle

#### Scenario: All-Scope gewinnt gegenüber eingeschränkten Scopes

- **GIVEN** ein Benutzer erhält dieselbe Action-Resource-Kombination mit den Scopes `own`, `organization` und `all`
- **WHEN** das System die effektiven Permissions berechnet
- **THEN** ist der wirksame Scope `all`
- **AND** Autorisierungsentscheidungen bleiben Allow-only

### Requirement: System-Admin ist kein genereller Tenant-Runtime-Bypass

Das System SHALL normale Tenant-Admin-Autorisierung über explizite Permissions entscheiden und SHALL `system_admin` nicht als generellen Rollen-Bypass für fachliche Runtime-Mutationen verwenden.

Zulässige Ausnahmen SHALL auf Plattform-, Bootstrap-, Migration- oder Reconcile-Pfade begrenzt sein, SHALL nicht als normale Tenant-Admin-Funktion exponiert werden und SHALL auditierbar bleiben.

#### Scenario: System-Admin ohne fachliche Permission ruft Tenant-Mutation auf

- **GIVEN** ein Actor besitzt die Rolle `system_admin`
- **AND** der Actor besitzt keine passende Permission für eine normale Tenant-Mutation
- **WHEN** der Actor diese Tenant-Mutation ausführt
- **THEN** weist das System die Mutation mit einem Autorisierungsfehler ab
- **AND** die Entscheidung ist als fehlende Permission erklärbar

#### Scenario: Begrenzter Reconcile-Pfad wird ausgeführt

- **GIVEN** ein dokumentierter Reconcile- oder Bootstrap-Prozess benötigt erhöhte Systemrechte
- **WHEN** der Prozess ausgeführt wird
- **THEN** ist der Pfad technisch vom normalen Tenant-Admin-API-Vertrag getrennt
- **AND** der Vorgang wird mit Actor, Scope, Grundklasse und Ergebnis auditiert
