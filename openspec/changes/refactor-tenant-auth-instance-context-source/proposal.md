# Change: Tenant-Instanzkontext im Login aus Host und Realm ableiten

## Why

Der aktuelle Tenant-Login-Pfad verwendet zwei Wahrheitsquellen fuer denselben Mandantenkontext: einerseits Host/Registry/Realm-Aufloesung und andererseits einen benutzerbezogenen OIDC-Claim `instanceId`. In tenant-spezifischen Realms fuehrt diese Doppelmodellierung zu operativen Fehlkonfigurationen und stillen Login-Abbruechen, obwohl der Benutzer bereits im richtigen Realm authentifiziert wurde.

Die fachliche Zielregel fuer SVA Studio lautet fuer tenant-spezifische Realms: Jeder Benutzer, der sich in genau diesem Realm erfolgreich authentifiziert, gehoert technisch zu diesem Tenant-Kontext. `instanceId` bleibt fuer Logging, Audit, Session, JIT-Provisioning und Datenzugriffe wichtig, soll aber aus dem bereits verifizierten Host-/Realm-Scope stammen und nicht als zweites per-User-Login-Gate modelliert werden.

## What Changes

- Aendert den IAM-/Auth-Vertrag so, dass tenant-spezifische Sessions ihren `instanceId`-Kontext primaer aus Host, Registry und dem aufgeloesten Realm-Scope beziehen.
- Entfernt die normative Anforderung, dass tenant-spezifische Logins nur bei vorhandenem benutzerbezogenem OIDC-Claim `instanceId` erfolgreich sein duerfen.
- Aendert den Import-/Sync-Vertrag fuer tenant-spezifische Realms von "nur Benutzer mit passendem `instanceId`-Attribut" zu "alle Benutzer des aktiven Tenant-Realm".
- Stuetzt `instanceId` in Keycloak von einem harten Login-Gate zu einem optionalen Interop-/Diagnoseartefakt ab.
- Erfordert klare fail-closed-, aber nutzerverstaendliche Fehlermeldungen fuer echte Scope-Konflikte oder Registry-/Realm-Fehler statt stiller Rueckkehr auf eine anonyme Startseite.
- Dokumentiert die Architekturentscheidung und aktualisiert betroffene arc42-Abschnitte.

## Impact

- Affected specs:
  - `iam-core`
  - `instance-provisioning`
- Affected code:
  - `packages/auth/src/config.ts`
  - `packages/auth/src/auth-server/callback.ts`
  - `packages/auth/src/auth-server/shared.ts`
  - `packages/auth/src/middleware-hosts.ts`
  - `packages/auth/src/jit-provisioning.server.ts`
  - `packages/auth/src/iam-account-management/*`
  - `packages/auth/src/iam-instance-registry/*`
  - `packages/core/src/iam/claims.ts`
- Affected docs:
  - `docs/guides/keycloak-tenant-realm-bootstrap.md`
  - `docs/guides/instance-keycloak-provisioning.md`
  - relevante arc42-Abschnitte unter `docs/architecture/README.md`, insbesondere `03`, `05`, `08` und bei Bedarf `10`
