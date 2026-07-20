# ADR-047: Keycloak-Service-Accounts für die lokale MCP-Control-Plane

## Status

Akzeptiert

## Kontext

Codex und andere lokale CLI-Clients sollen die vorhandene Instanz-Control-Plane über MCP lesen, diagnostizieren und kontrolliert bedienen können. Browser-Sessions, CSRF und Fresh-Reauth sind dafür nicht geeignet. Ein direkter Zugriff des lokalen Prozesses auf Datenbank, Keycloak-Admin-API oder interne Services würde dagegen die Studio-Autorisierungs-, Audit- und Fehlergrenze umgehen.

Die MCP-Fläche reicht von risikoarmen Reads bis zu Archivierung, Modulentzug und Secret-Rotation. Die erste Ausbaustufe verwendet bewusst ein mächtiges Credential je Umgebung. Deshalb dürfen weder Action-Prüfung noch Bestätigung allein durch Tool-Anweisungen erzwungen werden; beide Sicherheitsgrenzen liegen in Studio.

## Entscheidung

1. Der lokale stdio-MCP-Server ist ausschließlich ein Client der Studio-HTTP-API. Studio bleibt fachliche Schreib-, Autorisierungs- und Auditgrenze.
2. Keycloak stellt kurzlebige Access Tokens über den vertraulichen Service-Account-Client `sva-studio-mcp` aus. Die drei Root-Realms sind `studio-dev`, `studio-staging` und `sva-studio`; ihre Clients und Secrets bleiben getrennt.
3. Studio validiert Signatur, Issuer, Audience, Ablauf, Plattformrolle `instance_registry_admin` und Action-Scope fail-closed über JWKS. Vollständig qualifizierte Actions wie `instance.create`, `instance.confirmation.prepare`, `instance.provision.execute` und `instance.status.archive` sind der normative Maschinenvertrag.
4. Reads benötigen nur Read-Actions. Kontrollierte Mutationen benötigen eine eigene Action und Idempotenz. Kritische Mutationen benötigen zusätzlich eine kurzlebige, einmalig verwendbare und an Action, Instanz sowie aktuellen Zustand gebundene Confirmation-Challenge mit exakter Phrase.
5. Client-Secrets werden ausschließlich lokal über OS-Keychain oder nicht versionierte Umgebungsvariablen verteilt. Studio benötigt für die JWT-Prüfung kein MCP-Client-Secret. Tokens und Secrets erscheinen weder in Antworten, Logs, Auditdetails noch Telemetrie.
6. Ein serverseitiger Environment-Kill-Switch ermöglicht die sofortige Deaktivierung des Maschinenpfads, ohne den Browser-/Session-Pfad zu verändern.

## Konsequenzen

### Positiv

- Studio behält eine einheitliche Fehler-, Audit- und Datenintegritätsgrenze.
- Berechtigungen und Bestätigungen sind serverseitig und pro Aktion erzwingbar.
- Die drei Umgebungen sind kryptografisch und betrieblich voneinander getrennt.
- Widerruf und Rollback sind ohne Änderung der interaktiven Studio-Anmeldung möglich.

### Negativ

- Keycloak-Client-, Rollen- und Audience-Konfiguration muss in drei Realms synchron gehalten und geprüft werden.
- JWKS-Cache, Key-Rotation und Keycloak-Ausfälle erweitern die Authentisierungs-Testmatrix.
- Kritische Aktionen benötigen persistente oder gleichwertig atomare Challenge-Zustände.

## Verworfen

### Browser-Session für den lokalen MCP-Prozess

Verworfen, weil CSRF, Cookies und Fresh-Reauth keinen robusten Maschinenidentitätsvertrag ergeben.

### Direkter Datenbank- oder Keycloak-Admin-Zugriff

Verworfen, weil dadurch Studio-Autorisierung, Audit, Idempotenz und der strukturierte Fehlervertrag umgangen würden.

### Getrennte Credentials je Action oder Risikostufe

Für die erste Ausbaustufe verworfen, um den lokalen Betrieb überschaubar zu halten. Der einzelne Service Account trägt alle Action-Rollen. Der dadurch erhöhte Schadensradius wird durch kurze Token-Laufzeit, getrennte Secrets je Umgebung, routenspezifische Action-Prüfung, Kill-Switch und serverseitige Einmal-Challenges begrenzt.

## Betrieb und Verifikation

Der Rollout erfolgt in der Reihenfolge `studio-dev`, `studio-staging`, `sva-studio`. Jede Stufe verlangt Read-only-Smoke, kontrollierte Mutation an einer Testinstanz, eine Challenge-geschützte Mutation sowie Audit- und OTEL-Evidenz. Die Rotation verwendet ein kurzes Overlap-Fenster und widerruft das alte Secret erst nach erfolgreichem Smoke mit dem neuen Credential.

Rollback bedeutet: Kill-Switch deaktivieren, betroffene Clients oder Credentials widerrufen und lokale MCP-Konfiguration entfernen. Der vorherige Studio-Image-Digest bleibt der App-Rollback-Pfad; additive Challenge-Daten bleiben während eines Incidents ungenutzt bestehen.

## Referenzen

- [ADR-009: Keycloak als zentraler Identity Provider](./ADR-009-keycloak-als-zentraler-identity-provider.md)
- [ADR-018: Auth-Routing-Error-Contract und Korrelation](./ADR-018-auth-routing-error-contract-und-korrelation.md)
- [ADR-030: Registry-basierte Instanzfreigabe und Provisioning](./ADR-030-registry-basierte-instance-freigabe-und-provisioning.md)
- [ADR-046: Plattform- vs. Tenant-Rollenmodell](./ADR-046-plattform-vs-tenant-rollenmodell-und-legacy-standardrollen.md)
- `openspec/changes/add-studio-instance-create-mcp/`
