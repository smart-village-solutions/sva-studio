# Change: Serverseitige Fresh-Reauth fuer kritische Instanz-Mutationen

## Why
Der aktuelle Fresh-Reauth-Schutz fuer kritische Instanz- und Keycloak-Mutationen ist faktisch umgehbar, weil ein klientseitig gesetzter Header als Nachweis akzeptiert wird. Damit ist die bestehende Sicherheitsanforderung aus dem Provisioning-Vertrag nicht wirksam durchgesetzt.

## What Changes
- Ersetzt klientseitige Reauth-Bestaetigungen fuer kritische Instanz-Mutationen durch einen serverseitig gebundenen Fresh-Reauth-Nachweis im Session-Kontext.
- Begrenzt den Pflicht-Nachweis auf besonders sensitive Root-Host-Control-Plane-Mutationen im Instance-Registry- und Keycloak-Provisioning-Pfad.
- Stellt klar, dass Header, Query-Parameter oder andere Request-Felder niemals als alleiniger Fresh-Reauth-Nachweis gelten.
- Definiert ein explizites Nicht-Produktiv-Verhalten fuer lokale Entwicklungsprofile, damit Sicherheitslogik und Delivery-Tempo nicht gegeneinander arbeiten.

## Impact
- Affected specs: `instance-provisioning`, `iam-core`
- Affected code: `packages/auth-runtime/src/middleware.ts`, `packages/auth-runtime/src/redis-session.ts`, `packages/auth-runtime/src/iam-instance-registry/**`, `packages/instance-registry/src/http-guards.ts`
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`
