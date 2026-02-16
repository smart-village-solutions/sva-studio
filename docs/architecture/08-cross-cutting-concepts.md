# 08 Querschnittliche Konzepte

## Zweck

Dieser Abschnitt sammelt übergreifende Konzepte, die mehrere Bausteine
gleichzeitig beeinflussen.

## Mindestinhalte

- Security- und Privacy-Konzepte
- Logging/Observability-Konzept
- Fehlerbehandlung, Resilienz, i18n und Accessibility-Leitlinien

## Aktueller Stand

### Security und Privacy

- Sicherheits- und Datenschutzanforderungen sind als verbindliche Entwicklungsregeln dokumentiert
- Der Branch enthält aktuell keine produktive Auth-/Session-Implementierung im Code
- Architektur- und Security-Reviews sind über Agenten-Templates als Governance verankert

### Logging und Observability

- Es existieren Architekturleitlinien in `docs/architecture/logging-architecture.md`
- Eine produktive OTEL-Pipeline ist in diesem Branch nicht als laufende Implementierung enthalten
- Observability wird daher als Zielbild dokumentiert, nicht als vollständiger IST-Flow

### Fehlerbehandlung und Resilienz

- `@sva/data` gibt bei HTTP-Fehlern klare Fehler zurück (`throw new Error(...)`)
- Der DataClient nutzt einen TTL-basierten In-Memory-Cache zur Lastreduktion
- CI-Prüfungen sichern Build-/Test-Basis regelmäßig ab

### i18n und Accessibility

- i18n- und A11y-Anforderungen sind in `DEVELOPMENT_RULES.md` und Review-Templates festgelegt
- Vollständige technische Durchsetzung ist projektweit noch nicht abgeschlossen

Referenzen:

- `DEVELOPMENT_RULES.md`
- `docs/architecture/logging-architecture.md`
- `packages/data/src/index.ts`
- `.github/agents/templates/architecture-review.md`
