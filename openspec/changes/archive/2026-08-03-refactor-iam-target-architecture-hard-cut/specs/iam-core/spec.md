## ADDED Requirements

### Requirement: Zentrale Autorisierungsinvariante
Das System MUST zentrale Autorisierungsentscheidungen ausschließlich über `@sva/iam-core` treffen. `@sva/iam-core` MUST die Authorize-Verträge, Reason Codes, Permission-/Resource-Typen und die reine synchrone `evaluateAuthorizeDecision`-Engine besitzen. Fachpackages MUST diesen Vertrag konsumieren und dürfen keine zweite Berechtigungsauflösung gegen eigene Tabellen, Keycloak-Rollen oder kopierte Rollenlogik einführen.

#### Scenario: Fachpackage prüft Berechtigung
- **WHEN** `@sva/iam-admin`, `@sva/iam-governance` oder `@sva/instance-registry` eine geschützte Operation ausführt
- **THEN** konsumiert es Authorize-nahe Verträge aus `@sva/iam-core`
- **AND** fehlender oder unvollständiger Autorisierungskontext führt fail-closed zu einer Ablehnung

#### Scenario: Authorize-Engine bleibt rein
- **WHEN** `evaluateAuthorizeDecision` ausgeführt wird
- **THEN** benötigt die Funktion keine DB-, Redis-, Keycloak-, React- oder Runtime-Abhängigkeiten
- **AND** die Funktion liefert bei gleichem Request und gleicher Permission-Liste dieselbe Entscheidung
