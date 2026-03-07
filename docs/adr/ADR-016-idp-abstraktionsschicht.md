# ADR-016: IdP-Abstraktionsschicht über `IdentityProviderPort`

**Status:** Accepted  
**Entscheidungsdatum:** 2026-03-04  
**Entschieden durch:** IAM/Auth + Architektur

## Kontext

Der IAM-Service benötigt administrative Identitätsoperationen (User anlegen, aktualisieren, deaktivieren, Rollen synchronisieren). Initial wird Keycloak als IdP verwendet. Ohne Abstraktion würde die Domänenlogik eng an die Keycloak-API gekoppelt.

## Entscheidung

Wir führen eine explizite Port-Adapter-Struktur ein:

- Port: `IdentityProviderPort` in `@sva/auth`
- Adapter: `KeycloakAdminClient`

Domänennahe IAM-Handler sprechen nur gegen den Port. Keycloak-spezifische REST-Details verbleiben im Adapter.

## Begründung

- Entkopplung der IAM-Domänenlogik von IdP-Implementierungsdetails.
- Verbesserte Testbarkeit über gemockte Port-Implementierungen.
- Kontrollierter Vendor-Lock-in mit späterer Austauschoption.

## Verbindliche Leitplanken

- Keine Keycloak-REST-Calls außerhalb des Adapters.
- Fehlerklassen (`unavailable`, `request_error`) werden port-seitig normiert.
- Degraded-Mode-Regeln gelten adapterübergreifend:
  - Reads: DB-Fallback
  - Writes: `503 Service Unavailable`

## Alternativen

### Alternative A: Direkte Keycloak-Calls in Handlern

- Vorteil: schneller Start.
- Nachteil: starke Kopplung, hoher Refactor-Aufwand, schlechte Testbarkeit.
- Ergebnis: verworfen.

### Alternative B: Port in `@sva/core`

- Vorteil: formale Trennung im Core.
- Nachteil: Port ist server-/infrastrukturgebunden und verletzt Core-Grenzen.
- Ergebnis: verworfen.

## Konsequenzen

### Positiv

- Saubere Schichtentrennung und klarere Verantwortlichkeiten.
- Adapter kann Circuit-Breaker/Retry/Timeout zentral kapseln.

### Negativ

- Zusätzlicher Implementierungsaufwand für Port + Adapter.

## Verwandte ADRs

- `ADR-009-keycloak-als-zentraler-identity-provider.md`
- `ADR-014-postgres-notify-cache-invalidierung.md`
