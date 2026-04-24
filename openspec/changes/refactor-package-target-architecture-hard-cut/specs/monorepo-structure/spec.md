## ADDED Requirements

### Requirement: Verbindliche Package-Zielarchitektur

Das System MUST die in `docs/architecture/package-zielarchitektur.md` beschriebenen Zielpackages als verbindliche Workspace-Grenzen umsetzen. Neue fachliche Logik MUST einem Zielpackage zugeordnet werden und darf nicht weiter in historische Sammelpackages wachsen, wenn ein passender Zielbaustein existiert.

#### Scenario: Neues IAM-Feature wird begonnen

- **WHEN** ein neues Feature Benutzerverwaltung, Rollen, Gruppen, Organisationen, Governance, DSR oder Instanzen betrifft
- **THEN** ordnet der Change die Arbeit einem Zielpackage wie `@sva/iam-admin`, `@sva/iam-governance` oder `@sva/instance-registry` zu
- **AND** die Implementierung landet nicht pauschal in `@sva/auth`

#### Scenario: Neues Datenfeature wird begonnen

- **WHEN** ein neues Feature Datenzugriff erweitert
- **THEN** wird zwischen client-sicherem Datenvertrag und serverseitigem Repository unterschieden
- **AND** Browser- oder Universal-Code importiert keine serverseitigen Repository- oder DB-Hilfen

### Requirement: Hard-Cut-Migration ohne dauerhafte Sammelimporte

Das System MUST alte Sammelimporte aus `@sva/auth`, `@sva/data` und `@sva/sdk` für migrierte Verantwortlichkeiten entfernen. Temporäre Re-Exports MAY nur innerhalb der aktiven Migrationsphase existieren und MUST mit Ablaufbedingung dokumentiert werden.

#### Scenario: Consumer nutzt migrierte Funktionalität

- **WHEN** eine Funktionalität in ein Zielpackage verschoben wurde
- **THEN** importieren alle produktiven Consumer den Zielpackage-Pfad
- **AND** der alte Sammelimport ist entfernt oder durch ein blockierendes Migrationsticket mit Ablaufdatum markiert

#### Scenario: Neue API wird veröffentlicht

- **WHEN** eine neue öffentliche API für Plugin-, Server-Runtime-, IAM-, Instanz- oder Datenlogik entsteht
- **THEN** wird sie direkt im passenden Zielpackage exportiert
- **AND** sie wird nicht zusätzlich als dauerhafte Kompatibilitäts-API über ein altes Sammelpackage veröffentlicht

### Requirement: Zielpackage-Tags und Boundary-Enforcement

Das System MUST jedes Zielpackage mit eindeutigen Nx-Tags, expliziten Package-Dependencies und standardisierten Targets versehen. ESLint-/Nx-Boundary-Regeln MUST unerlaubte Importkanten zwischen App, Plugins, Routing, Server-Runtime, Daten, IAM und Instanz-Control-Plane verhindern.

#### Scenario: Zielpackage wird angelegt

- **WHEN** ein Zielpackage wie `@sva/iam-admin` oder `@sva/instance-registry` angelegt wird
- **THEN** besitzt es `project.json`, `package.json`, TypeScript-Konfiguration, Build-, Lint-, Unit-, Type- und erforderliche Runtime-Checks
- **AND** trägt es Scope-Tags, die in `depConstraints` verwendet werden

#### Scenario: Unerlaubter Import wird eingeführt

- **WHEN** ein Package eine verbotene Importkante einführt, etwa Plugin zu internem Auth-Code oder Browser-Code zu serverseitigem Repository
- **THEN** schlägt die Boundary-Prüfung fehl
- **AND** die Fehlermeldung verweist auf den zulässigen öffentlichen Vertrag

### Requirement: PII- und Credential-Grenzen im Monorepo

Das System MUST Packages, die personenbezogene Daten im Klartext oder Credentials verarbeiten, explizit klassifizieren und ihre Importkanten entsprechend begrenzen.

#### Scenario: Package verarbeitet Klartext-PII

- **WHEN** ein Package Klartext-PII entschlüsselt oder verarbeitet
- **THEN** trägt es einen expliziten PII-Tag
- **AND** seine Tests decken Autorisierungs- und Datenflussgrenzen ab
- **AND** nicht autorisierte Packages können die Entschlüsselungsfähigkeit nicht importieren

#### Scenario: Integration benötigt Credentials

- **WHEN** ein Integrationspackage Credentials benötigt
- **THEN** konsumiert es einen expliziten Credential-Vertrag
- **AND** es importiert keine Session-, Middleware- oder Auth-Runtime-Interna
