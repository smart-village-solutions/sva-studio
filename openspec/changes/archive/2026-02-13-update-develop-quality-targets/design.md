## Context

`develop` enthält aktuell gemischte Qualitäts-Targets: einige Projekte laufen mit echten Checks, andere mit Platzhalter-Kommandos. Diese Inkonsistenz erzeugt Review-Risiko, weil "grüne" Pipeline-Ergebnisse nicht überall die gleiche Aussagekraft haben.

## Goals / Non-Goals

- Goals:
  - Einheitliche, ausführbare `lint`- und `test:unit`-Targets für die relevanten Projekte.
  - Konkrete Aktivierung von Unit-Tests im `@sva/monitoring-client`.
  - Dokumentierte und überprüfbare Exemption-Transparenz für Reviewer.
- Non-Goals:
  - Kein komplettes Redesign der Testpyramide.
  - Keine neue CI-Infrastruktur.

## Decisions

- Decision: Platzhalter-Targets werden in betroffenen Projekten durch echte Tool-Aufrufe ersetzt.
  - Rationale: Nur ausführbare Checks liefern belastbare CI-Signale.
- Decision: `@sva/monitoring-client` wird als testpflichtiges Package behandelt.
  - Rationale: Observability-Code wirkt systemweit und darf nicht als ungetesteter Blind Spot verbleiben.
- Decision: Exemptions bleiben möglich, müssen aber zentral dokumentiert und reviewbar sein.
  - Rationale: Pragmatismus ohne Intransparenz.

## Risks / Trade-offs

- Risiko: Kurzfristig mehr CI-Laufzeit durch aktivierte Checks.
  - Mitigation: Nx `affected`-Workflows und Caching konsequent nutzen.
- Risiko: Initiale Flakes in bislang inaktiven Tests.
  - Mitigation: Stabilisierung direkt im selben Change, kein Verschieben in Folge-PRs.

## Migration Plan

1. Targets projektweise von Platzhalter auf echte Kommandos umstellen.
2. Monitoring-Client-Tests aktivieren und stabilisieren.
3. Doku an den tatsächlichen Zielzustand anpassen.
4. End-to-end via Standard-Qualitätsbefehle verifizieren.

## Open Questions

- Keine fachlichen offenen Fragen; Scope ist auf bestehende Toolchain und Konventionen begrenzt.
