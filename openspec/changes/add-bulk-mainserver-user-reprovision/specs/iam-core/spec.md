## MODIFIED Requirements
### Requirement: Idempotency für duplikatskritische IAM-Endpunkte

Das System MUST Idempotency für duplikatskritische Mutationen erzwingen, um doppelte Keycloak- und Datenbankoperationen bei Retries zu verhindern.

#### Scenario: Erstanfrage mit Idempotency-Key

- **WENN** ein Client `POST /api/v1/iam/users`, `POST /api/v1/iam/users/bulk-deactivate`, `POST /api/v1/iam/users/bulk-reprovision-mainserver` oder `POST /api/v1/iam/roles` mit `X-Idempotency-Key` aufruft
- **DANN** wird die Operation genau einmal ausgeführt und das Ergebnis serverseitig gespeichert
- **UND** der Key wird im Scope (`actor_account_id`, `endpoint`, `idempotency_key`) ausgewertet

#### Scenario: Retry mit identischem Payload

- **WENN** ein Client denselben Endpunkt mit demselben `X-Idempotency-Key` und identischem Payload erneut aufruft
- **DANN** liefert der Server das gespeicherte Ergebnis zurück
- **UND** es erfolgt keine zweite mutierende Operation gegen Keycloak oder IAM-DB

#### Scenario: Wiederverwendung mit abweichendem Payload

- **WENN** ein Client denselben `X-Idempotency-Key` für denselben Endpunkt mit abweichendem Payload wiederverwendet
- **DANN** antwortet der Server mit `409 Conflict`
- **UND** der Fehlercode ist `IDEMPOTENCY_KEY_REUSE`

### Requirement: Keycloak Admin API Integration

Das System MUST über dedizierte Service-Accounts mit der Keycloak Admin REST API kommunizieren, um Benutzer, Identitätsattribute, technische Realm-Artefakte und die ausdrücklich verbleibenden Sonderrollen im jeweiligen Platform- oder Tenant-Scope vollständig listen, bearbeiten und synchronisieren zu können. Keycloak bleibt System of Record für Identitäten, Login und technische Realm-Zugänge; tenantlokale Fachrollen und deren Permissions werden normativ im Studio-IAM-Modell verwaltet.

#### Scenario: Bulk-Reprovision aktualisiert Mainserver-Attribute pro Zielnutzer

- **WENN** ein berechtigter Tenant-Admin `POST /api/v1/iam/users/bulk-reprovision-mainserver` mit explizit markierten Nutzer-IDs ausführt
- **DANN** verarbeitet das System höchstens 50 eindeutige Zielnutzer
- **UND** aktualisiert pro erfolgreich verarbeitetem Zielnutzer die Mainserver-Credentials in den Keycloak-Attributen
- **UND** liefert pro nicht erfolgreich verarbeitetem Zielnutzer einen stabilen Fehlercode zurück, ohne erfolgreiche Zielnutzer zurückzurollen
