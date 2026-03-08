# Zugriffssteuerungs-Spezifikation (Child-A-Scope)

## ADDED Requirements

### Requirement: Authentifizierter Identity-Kontext als Vorbedingung

Das System MUSS nach erfolgreicher OIDC-Authentifizierung einen verlässlichen Identity-Kontext bereitstellen, der in nachgelagerten Child-Changes für RBAC/ABAC verwendet werden kann.

#### Scenario: Identity-Kontext nach Login verfügbar

- **WHEN** ein Benutzer sich erfolgreich über Keycloak anmeldet
- **THEN** stehen mindestens `sub` (Identity-ID) und `instanceId` im Server-Kontext bereit
- **AND** dieser Kontext kann von nachgelagerten Autorisierungspfaden konsumiert werden

### Requirement: Keine fachliche Autorisierungsentscheidung in Child A

Das System MUSS in Child A keine fachlichen RBAC-/ABAC-Entscheidungen implementieren; diese werden in Child C/D spezifiziert.

#### Scenario: Autorisierung außerhalb Child-A-Scope

- **WHEN** ein Fachmodul eine fachliche Berechtigungsentscheidung benötigt
- **THEN** ist Child A nicht die entscheidende Instanz
- **AND** die verbindliche Entscheidung erfolgt erst über die in Child C/D definierten Authorize-Pfade

## MODIFIED Requirements

(Keine)

## REMOVED Requirements

(Keine)
