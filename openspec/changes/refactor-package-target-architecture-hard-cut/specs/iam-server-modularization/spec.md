## ADDED Requirements

### Requirement: IAM-Server-Hard-Cut in Zielpackages

Der IAM-Server MUST von einer internen Modulstruktur in getrennte Zielpackages überführt werden. Authentifizierung, zentrale Autorisierung, IAM-Administration, IAM-Governance und Instanz-Control-Plane MUST getrennte Package-Verantwortlichkeiten erhalten.

#### Scenario: Authentifizierungslogik wird migriert

- **WHEN** Login, Logout, OIDC, Cookies, Session oder Auth-Middleware geändert werden
- **THEN** liegt die Implementierung in `@sva/auth-runtime`
- **AND** sie importiert keine IAM-Admin-, Governance- oder Instanz-Implementierungsdetails

#### Scenario: IAM-Admin-Logik wird migriert

- **WHEN** Benutzer, Rollen, Gruppen, Organisationen oder Reconcile-Logik geändert werden
- **THEN** liegt die Implementierung in `@sva/iam-admin`
- **AND** Autorisierungsentscheidungen werden über `@sva/iam-core` konsumiert

#### Scenario: Governance- oder DSR-Logik wird migriert

- **WHEN** DSR, Legal Texts, Audit-nahe IAM-Fälle oder Governance-Flows geändert werden
- **THEN** liegt die Implementierung in `@sva/iam-governance`
- **AND** PII-Verarbeitung ist dort explizit klassifiziert und getestet

#### Scenario: Instanz-Control-Plane wird migriert

- **WHEN** Instanzmodell, Host-Klassifikation, Registry, Provisioning oder Platform-Keycloak-Control-Plane geändert werden
- **THEN** liegt die Implementierung in `@sva/instance-registry`
- **AND** sie wird nicht als Unterfunktion von `@sva/auth-runtime` oder `@sva/iam-admin` umgesetzt

### Requirement: Zentrale Autorisierungsinvariante

Das System MUST zentrale Autorisierungsentscheidungen ausschließlich über `@sva/iam-core` treffen. Fachpackages MUST diesen Vertrag konsumieren und dürfen keine zweite Berechtigungsauflösung gegen eigene Tabellen, Keycloak-Rollen oder kopierte Rollenlogik einführen.

#### Scenario: Fachpackage prüft Berechtigung

- **WHEN** `@sva/iam-admin`, `@sva/iam-governance` oder `@sva/instance-registry` eine geschützte Operation ausführt
- **THEN** ruft es den Autorisierungsvertrag aus `@sva/iam-core` auf
- **AND** fehlender oder unvollständiger Autorisierungskontext führt fail-closed zu einer Ablehnung

#### Scenario: Neue Berechtigungsregel entsteht

- **WHEN** eine neue fachliche Berechtigungsregel benötigt wird
- **THEN** wird der zentrale Autorisierungsvertrag erweitert
- **AND** Fachpackages duplizieren die Entscheidung nicht lokal

### Requirement: IAM-PII-Verarbeitung nach Zielpackage

Das System MUST IAM-bezogene PII-Verarbeitung nach Zielpackage begrenzen. `@sva/iam-admin` und `@sva/iam-governance` MAY Klartext-PII verarbeiten, wenn Autorisierung und Entschlüsselungsvertrag erfüllt sind; andere Zielpackages dürfen PII nur entsprechend ihrer dokumentierten Rolle verarbeiten.

#### Scenario: Benutzerprofil wird verwaltet

- **WHEN** Benutzerprofil-PII für Administration benötigt wird
- **THEN** erfolgt die Klartextverarbeitung in `@sva/iam-admin`
- **AND** Repositories liefern persistente Daten ohne eigenständige fachliche Entschlüsselungsentscheidung

#### Scenario: DSR-Fall benötigt Klartextdaten

- **WHEN** ein Betroffenenrechte-Flow personenbezogene Daten benötigt
- **THEN** erfolgt die Klartextverarbeitung in `@sva/iam-governance`
- **AND** der Zugriff ist über `@sva/iam-core` autorisiert und testbar

#### Scenario: Instanz-Registry verarbeitet Registry-Daten

- **WHEN** `@sva/instance-registry` Instanz- oder Hostdaten verarbeitet
- **THEN** verarbeitet sie keine personenbezogenen Daten im Klartext
- **AND** personenbezogene IAM-Daten bleiben in den autorisierten IAM-Fachpackages
