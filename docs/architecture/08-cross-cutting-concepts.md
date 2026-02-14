# 08 Querschnittliche Konzepte

## Zweck

Dieser Abschnitt sammelt uebergreifende Konzepte, die mehrere Bausteine
gleichzeitig beeinflussen.

## Mindestinhalte

- Security- und Privacy-Konzepte
- Logging/Observability-Konzept
- Fehlerbehandlung, Resilienz, i18n und Accessibility-Leitlinien

## Aktueller Stand

### Security und Privacy

- Sicherheits- und Datenschutzanforderungen sind als verbindliche Entwicklungsregeln dokumentiert
- Der Branch enthaelt aktuell keine produktive Auth-/Session-Implementierung im Code
- Architektur- und Security-Reviews sind ueber Agenten-Templates als Governance verankert

### Logging und Observability

- Es existieren Architekturleitlinien in `docs/architecture/logging-architecture.md`
- Eine produktive OTEL-Pipeline ist in diesem Branch nicht als laufende Implementierung enthalten
- Observability wird daher als Zielbild dokumentiert, nicht als vollstaendiger IST-Flow

### Fehlerbehandlung und Resilienz

- `@sva/data` gibt bei HTTP-Fehlern klare Fehler zurueck (`throw new Error(...)`)
- Der DataClient nutzt einen TTL-basierten In-Memory-Cache zur Lastreduktion
- CI-Pruefungen sichern Build-/Test-Basis regelmaessig ab

### i18n und Accessibility

- i18n- und A11y-Anforderungen sind in `DEVELOPMENT_RULES.md` und Review-Templates festgelegt
- Vollstaendige technische Durchsetzung ist projektweit noch nicht abgeschlossen

Referenzen:

- `DEVELOPMENT_RULES.md`
- `docs/architecture/logging-architecture.md`
- `packages/data/src/index.ts`
- `.github/agents/templates/architecture-review.md`
