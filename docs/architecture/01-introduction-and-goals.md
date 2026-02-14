# 01 Einfuehrung und Ziele

## Zweck

SVA Studio ist eine TanStack-Start-basierte Webanwendung im Nx-Monorepo, die
als modulares Studio fuer Content- und Systemfunktionen aufgebaut wird.
Der aktuelle Stand fokussiert auf:

- Typsicheres Routing mit Core- und Plugin-Routen
- OIDC-Login mit Session-Verwaltung (Redis)
- Strukturiertes Server-Logging mit OTEL-Pipeline
- Monorepo-Governance fuer Build/Test/Qualitaet

Referenzen:

- `apps/sva-studio-react/src/router.tsx`
- `packages/routing/src/index.ts`
- `packages/auth/src/routes.server.ts`
- `packages/sdk/src/logger/index.server.ts`

## Mindestinhalte

Mindestinhalte fuer diesen Abschnitt:

- Systemkontext in 3-5 Saetzen
- Primaere Stakeholder und deren wichtigste Beduerfnisse
- Top-3 Architekturziele mit Prioritaet

## Aktueller Stand

### Stakeholder (technisch)

- Produkt-/Architektur-Team: stabile Zielarchitektur und nachvollziehbare Entscheidungen
- Entwickler:innen: hohe Typsicherheit, klare Modulgrenzen, reproduzierbare Workflows
- Betrieb/SRE: beobachtbares und betreibbares System inkl. Logging/Monitoring

### Top-3 Architekturziele (priorisiert)

1. Typsichere, erweiterbare Modul- und Routing-Architektur (Core + Plugins)
2. Sichere Authentifizierung und Session-Management fuer Web-Workflows
3. Einheitliche, PII-sichere Observability ueber OTEL -> Collector -> Loki

### Systemgrenze (Kurzfassung)

In diesem Repo liegen Frontend, Routing-Layer, Auth-BFF-Funktionen,
SDK/Observability sowie lokale Betriebsartefakte.
Externe Systeme (IdP/Keycloak, ggf. weitere Backends) werden integriert, aber
nicht in diesem Repository betrieben.
