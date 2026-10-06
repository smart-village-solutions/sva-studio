## ADDED Requirements

### Requirement: Verwaltungs-API erzwingt dieselben fachlichen Rechte für persönliche Tokens

Studio SHALL bei persönlicher API-Anmeldung für jede freigegebene Verwaltungsaktion dieselben serverseitigen Actions, Tenant-Grenzen, Zielschutzregeln und Audit-Verträge anwenden wie bei einer autorisierten Browser-Anmeldung. Der API-Pfad SHALL erforderliche Nachweise für sensitive Mutationen erhalten und SHALL die Browser-Prüfungen für Session, CSRF und Fresh Reauth nicht schwächen. Eine Cookie-Anfrage SHALL weiterhin den Browser-Schutzprüfungen unterliegen; ein Bearer-Token SHALL kein Ersatz für einen verlangten Fresh-Reauth-Nachweis sein.

Studio SHALL für den persönlichen MCP-API-Pfad nur gültige, an den vorgesehenen MCP-Client und Realm gebundene Tokens annehmen. Die Entscheidung, welchen persönlichen Accounts Keycloak solche Tokens ausstellt, SHALL nicht durch eine zweite Studio-Provider-Liste oder Studio-MCP-Rolle ersetzt werden. Nach der Token-Prüfung SHALL Studio unverändert die fachliche Action autorisieren.

#### Scenario: Fehlendes Recht bei API-Anmeldung

- **WHEN** ein persönlicher Provider-Account eine Verwaltungsaktion ohne wirksame Berechtigung anfordert
- **THEN** verweigert Studio diese Aktion wie bei der Browser-Anmeldung
- **AND** es entsteht kein fachlicher Teilerfolg

#### Scenario: Sensitive Mutation ohne erforderlichen Nachweis

- **WHEN** eine persönliche API-Anmeldung eine sensitive Mutation ohne den dafür erforderlichen gültigen Nachweis anfordert
- **THEN** verweigert Studio die Mutation
- **AND** der bestehende Schutz der Browser-Session bleibt erhalten

#### Scenario: Kunden-Admin verwendet normalen Studio-Token

- **WHEN** ein Kunden-Admin mit `system_admin` einen normalen Studio-Login-Token für einen MCP-API-Aufruf verwendet
- **THEN** weist Studio den MCP-API-Pfad wegen fehlender Bindung an den MCP-Client ab, bevor die fachliche Action ausgeführt wird
- **AND** seine normalen Studio-Adminrechte im Browser bleiben erhalten
