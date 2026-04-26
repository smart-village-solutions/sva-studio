## MODIFIED Requirements
### Requirement: Token Validation & User Identity
Das System MUST von Keycloak ausgestellte JWT-Tokens validieren und nur die fuer Session- und Autorisierungspfad erforderlichen Identity-Claims extrahieren.

#### Scenario: User context extraction on tenant hosts

- **WHEN** ein Token fuer einen Request auf einer Tenant-Subdomain gueltig ist
- **THEN** extrahiert das System mindestens die Claims `sub` und Rollen-/Berechtigungsinformationen
- **AND** leitet den Tenant-Kontext `instanceId` aus dem bereits aufgeloesten Host-/Registry-/Realm-Scope ab
- **AND** ein fehlender benutzerbezogener Claim `instanceId` blockiert die Session-Hydration fuer tenant-spezifische Realms nicht
- **AND** ein vorhandener, aber abweichender Claim `instanceId` wird als `tenant_scope_conflict` fail-closed abgelehnt
- **AND** `email` oder `name` sind keine Pflichtclaims fuer Session-Hydration oder Autorisierung
- **AND** zusaetzliche Profildaten werden nur in dedizierten Profil-/Sync-Flows geladen
- **AND** das System injiziert daraus einen minimalen `UserContext` fuer nachgelagerte Handler

#### Scenario: User context extraction on platform scope

- **WHEN** ein Token fuer einen Request auf dem Root-Host gueltig ist
- **THEN** extrahiert das System mindestens `sub` und Rollen-/Berechtigungsinformationen
- **AND** bleibt `instanceId` fuer den Plattform-Scope leer
- **AND** das System verwendet keine Pseudo-Instanz, um den Plattform-Scope als Tenant darzustellen

### Requirement: Keycloak Admin API Integration
Das System MUST über einen dedizierten Service-Account mit der Keycloak Admin REST API kommunizieren, um Benutzer-Accounts und Rollen-Zuweisungen synchron zu halten. Die Kommunikation erfolgt über eine `IdentityProviderPort`-Abstraktionsschicht.

#### Scenario: Service-Account-Authentifizierung

- **WENN** der IAM-Service startet
- **DANN** authentifiziert er sich bei Keycloak mit dem Service-Account `sva-studio-iam-service`
- **UND** der Service-Account hat nur die Rollen `manage-users`, `view-users`, `view-realm` und `manage-realm` (Principle of Least Privilege für Benutzer- und Realm-Role-Verwaltung)
- **UND** das Client-Secret wird über einen Secrets-Manager injiziert (nicht als `.env`-Datei)
- **UND** das Secret wird alle 90 Tage rotiert (BSI-Grundschutz ORP.4) mit Dual-Secret-Rotation (Overlap-Fenster)

#### Scenario: User-Erstellung (Keycloak-First mit Compensation)

- **WENN** ein Administrator einen User über den IAM-Service erstellt
- **DANN** wird der User zuerst in Keycloak via `POST /admin/realms/{realm}/users` erstellt
- **UND** anschließend in `iam.accounts` mit dem von Keycloak vergebenen `keycloak_subject` gespeichert
- **UND** fehlende `iam.instance_memberships` werden für den aktiven Instanzkontext angelegt
- **UND** Rollen werden erst nach erfolgreicher Persistenz mit Keycloak synchronisiert
- **UND** der `instance_id`-Scope wird korrekt gesetzt
- **WENN** der Keycloak-Call fehlschlägt
- **DANN** wird kein Eintrag in `iam.accounts` erstellt
- **WENN** der DB-Write fehlschlägt (nach erfolgreichem Keycloak-Call)
- **DANN** wird der Keycloak-User via `DELETE` entfernt (Compensation)
- **UND** ein `keycloak.sync_failed`-Audit-Event wird geloggt

#### Scenario: Benutzer aus Keycloak nach IAM importieren

- **WENN** ein Administrator einen Keycloak-Sync für eine Instanz ausführt
- **DANN** werden alle Benutzer des aktiven Tenant-Realm importiert oder aktualisiert
- **UND** Basisdaten wie Benutzername, E-Mail, Vorname, Nachname, Anzeigename und Aktivstatus werden in `iam.accounts` gespiegelt
- **UND** fehlende `iam.instance_memberships` werden im aktiven Instanzkontext angelegt
- **UND** bestehende IAM-Benutzer werden nicht dupliziert
- **UND** ein fehlendes benutzerbezogenes Attribut `instanceId` verhindert den Import nicht

## ADDED Requirements
### Requirement: Tenant-spezifische Session-Hydration verwendet den Auth-Scope
Das System MUST fuer tenant-spezifische Requests den Instanzkontext aus dem bereits verifizierten Auth-Scope ableiten und denselben Wert in Session-, Audit- und IAM-Pfaden konsistent weiterfuehren.

#### Scenario: Callback schreibt tenant-spezifische instanceId aus dem Auth-Scope in die Session

- **WHEN** ein Benutzer sich auf einer Tenant-Subdomain erfolgreich ueber den zugeordneten Tenant-Realm authentifiziert
- **THEN** schreibt das System die zu diesem Login-Flow aufgeloeste `instanceId` aus Host, Registry und Realm in die Session
- **AND** dieselbe `instanceId` wird fuer Logging, Audit, JIT-Provisioning und nachgelagerte IAM-Aufloesung verwendet
- **AND** das System fuehrt dafuer keinen zweiten benutzerbezogenen Login-Gate-Abgleich gegen einen optionalen OIDC-Claim `instanceId` aus

#### Scenario: Tenant-spezifische Session bleibt fail-closed bei echtem Scope-Fehler

- **WHEN** Host, Registry oder Realm fuer einen tenant-spezifischen Request nicht eindeutig oder nicht aktiv aufgeloest werden koennen
- **THEN** wird keine Session aufgebaut oder fortgesetzt
- **AND** das System antwortet fail-closed mit einer klar klassifizierten Fehlermeldung
- **AND** der Nutzer landet nicht stillschweigend in einem anonymen oder tenant-losen Zustand

#### Scenario: Tenant-spezifischer Claim-Konflikt wird abgelehnt

- **WHEN** ein Benutzer sich auf einer Tenant-Subdomain erfolgreich im zugeordneten Realm authentifiziert
- **AND** das Token enthaelt einen `instanceId`-Claim fuer eine andere Instanz
- **THEN** erstellt das System keine Session
- **AND** klassifiziert den Fehler als `tenant_scope_conflict`
- **AND** fuehrt keinen Fallback auf Plattform- oder claim-basierten Tenant-Scope aus
