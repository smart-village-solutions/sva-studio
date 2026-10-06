## ADDED Requirements

### Requirement: Persönliche API-Anmeldung verwendet den bestehenden IAM-Identitätskern

Studio SHALL persönliche OIDC-Anmeldungen für freigegebene MCP-Verwaltungs-HTTP-Routen im jeweiligen Plattform- oder Tenant-Realm akzeptieren und dabei dieselbe maßgebliche Account-, Realm- und Tenant-Identität wie für die Browser-Sitzung auflösen. Der zusätzliche API-Pfad SHALL den ausstellenden MCP-Client und die vorgesehene Studio-Audience getrennt prüfen und SHALL den bestehenden Cookie-Session-Pfad erhalten. Abgelaufene, ungültige oder für den Zielhost fremde Tokens SHALL abgewiesen werden. Liegt ein Bearer-Token vor, SHALL ein zugleich vorhandenes Browser-Cookie dessen Ablehnung nicht übergehen.

#### Scenario: Persönlicher Tenant-Token am passenden Host

- **WHEN** ein gültiger persönlicher Token des Tenant-Realms am zugehörigen Tenant-Host vorliegt
- **THEN** wird seine Identität für die bestehende fachliche IAM-Aktion aufgelöst

#### Scenario: Token eines anderen Realms

- **WHEN** ein Plattform- oder Nachbar-Tenant-Token an einem Tenant-Host verwendet wird
- **THEN** wird der Verwaltungsaufruf ohne Realm- oder Account-Fallback abgewiesen

#### Scenario: Normaler Studio-Login-Token am MCP-API-Pfad

- **WHEN** ein persönlicher Token des normalen Studio-Login-Clients für einen MCP-Verwaltungsaufruf verwendet wird
- **THEN** wird dieser API-Authentisierungspfad ohne passende MCP-Client-Bindung abgewiesen

#### Scenario: Ungültiger Bearer-Token mit gültigem Browser-Cookie

- **WHEN** eine freigegebene Verwaltungsroute einen ungültigen Bearer-Token und zugleich ein gültiges Browser-Cookie erhält
- **THEN** wird der persönliche API-Aufruf abgewiesen, ohne auf die Browser-Identität zu wechseln
