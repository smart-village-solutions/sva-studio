## ADDED Requirements

### Requirement: Routing bleibt frei von Auth-Runtime-Implementierung

`@sva/routing` MUST Route-Verträge, Pfade, Search-Params und Guard-Schnittstellen bereitstellen, darf aber keine Auth-Runtime-Implementierung oder IAM-Fachimplementierung importieren. Auth- und IAM-nahe Routen müssen über neutrale Contracts oder App-seitiges Wiring angebunden werden.

#### Scenario: Auth-Route wird registriert

- **WHEN** eine Auth-Route im produktiven Routing verfügbar gemacht wird
- **THEN** nutzt `@sva/routing` nur neutrale Route- und Handler-Verträge
- **AND** konkrete Login-, Session- oder OIDC-Implementierung bleibt in `@sva/auth-runtime`

#### Scenario: IAM-Route wird verdrahtet

- **WHEN** eine IAM-Admin-, Governance- oder Instanz-Route eingebunden wird
- **THEN** bleibt die fachliche Handler-Implementierung im jeweiligen Zielpackage oder in einer App-Server-Funktion
- **AND** `@sva/routing` importiert keine Fachpackage-Interna

#### Scenario: Boundary-Disable schützt alte Kopplung

- **WHEN** ein Boundary-Disable eine Routing-zu-Auth- oder Routing-zu-IAM-Kopplung erlaubt
- **THEN** wird diese Ausnahme im Hard-Cut-Inventar erfasst
- **AND** der Disable wird im Rahmen der Transition entfernt oder mit blockierendem Folgeticket versehen
