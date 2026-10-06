# ADR-067: Persönlicher Plattform- und Tenant-Zugang im Studio-MCP

**Status:** Proposed
**Entscheidungsdatum:** 2026-10-06
**Entschieden durch:** SVA Studio Team
**GitHub Issue:** —
**GitHub PR:** —

## Kontext

Der bestehende lokale MCP besitzt servicegebundene Instanztools. Für persönliche IAM-API-Aufrufe muss ein Betreiber getrennte Plattform- und Tenant-Identitäten verwenden können, ohne diese Identitäten mit dem Service-Account oder untereinander zu vermischen. Das API-Gateway akzeptiert im ersten Abschnitt ausschließlich `GET` und `POST /api/v1/iam/users`.

## Entscheidung

Der vorhandene `@sva/studio-mcp` erhält opt-in persönliche Kontext-Tools. Jeder konfigurierte Kontext bindet eine Studio-Origin, einen Realm-Issuer und eine Client-ID. Anmeldung erfolgt per Authorization Code mit PKCE über den festen Loopback-Callback `127.0.0.1:8765`; parallele Anmeldung desselben Kontexts und ein nicht verfügbarer Callback-Port schlagen geschlossen fehl. Tokens werden ausschließlich im Prozessspeicher gehalten. Persönliche API-Aufrufe verwenden nur den ausdrücklich gewählten Kontext und die freigegebenen User-Collection-Methoden. Servicegebundene Instanztools behalten ihren Vertrag.

## Begründung

- Plattform- und Tenant-Accounts bleiben durch explizite Kontextwahl getrennt.
- PKCE vermeidet ein Browser-Client-Secret; State, Nonce und Verifier sind je Loginversuch gebunden.
- Die feste Redirect-URI entspricht dem Provisioning-Vertrag des persönlichen Clients und vermeidet nicht provisionierte dynamische Ports.
- Eine enge Routen-Allowlist, Redirect-Ablehnung und fehlender Service-Credential-Fallback begrenzen Fehlkonfigurationen.
- Persönliche Clients werden nicht aktiviert, bevor API-/MCP-Nachweise und Live-Abnahme erfolgen.

## Konsequenzen

- Die lokale MCP-Installation benötigt eine nicht geheime Kontextliste und exklusiven Zugriff auf Loopback-Port 8765.
- Tokens verschwinden bei Prozessende; der Benutzer muss sich danach erneut anmelden.
- Logout und Shutdown widerrufen Refresh-Tokens best-effort. Ein Widerrufsfehler verhindert nicht das lokale Löschen.
- Weitere API-Routen, Realm-Provisionierung und Browser-Parität bleiben eigene Liefer- und Abnahmenachweise.

## Verwandte Entscheidungen

- [ADR-047: Keycloak-Service-Accounts für die lokale MCP-Control-Plane](./ADR-047-keycloak-service-accounts-fuer-lokale-mcp-control-plane.md)
- [ADR-018: Auth-Routing-Error-Contract und Korrelation](./ADR-018-auth-routing-error-contract-und-korrelation.md)
