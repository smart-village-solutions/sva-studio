## Context

`@sva/data` ist historisch gewachsen und trägt noch immer Importpfade, Re-Exports und Betriebsartefakte, die in Teilen dieselbe fachliche Richtung wie `@sva/data-repositories` adressieren. Die Zielarchitektur dokumentiert bereits, dass neue serverseitige Persistenzlogik nicht mehr in `@sva/data` landen soll.

## Goals / Non-Goals

- Goals:
  - Den Architekturvertrag für `@sva/data` und `@sva/data-repositories` normativ angleichen.
  - Einen klaren Kompatibilitätspfad für bestehende Consumer von `@sva/data` und `@sva/data/server` festhalten.
  - Guardrails für neue fachliche Ownership in `@sva/data` vorbereiten.
- Non-Goals:
  - Keine sofortige Entfernung aller Altimporte.
  - Keine neue Package-Aufteilung jenseits der bereits beschlossenen Zielarchitektur.
  - Keine Änderung an den fachlichen Verantwortungen anderer Daten-, IAM- oder Runtime-Packages.

## Decisions

- Decision: `@sva/data-repositories` bleibt die einzige führende Repository-Schicht für neue serverseitige Persistenzfunktionalität.
- Decision: `@sva/data` bleibt als historisches DB-Operations- und Kompatibilitätspaket bestehen.
- Decision: Breite Spiegelimplementierungen in `packages/data/src/**` werden architektonisch als Abweichung behandelt und in Shims oder direkte Consumer-Migrationen überführt.
- Alternatives considered:
  - `@sva/data` vollständig entfernen: derzeit zu riskant für bestehende Consumer und Betriebsabläufe.
  - Beide Pakete parallel weiterführen: verworfen wegen unklarer Ownership und dauerhafter Doppelpflege.

## Risks / Trade-offs

- Bestehende Consumer können vorübergehend weiter Altpfade nutzen, was die Migrationsdauer verlängert.
- Zusätzliche Guardrails können Brownfield-Sonderfälle sichtbar machen, bevor alle Consumer migriert sind.

## Migration Plan

1. Architektur- und Monorepo-Specs auf einen einheitlichen Vertrag für `@sva/data` festziehen.
2. Arc42-Dokumente mit derselben Sprache nachziehen.
3. Folgearbeit für Shims, Consumer-Migrationen und Guardrails an Implementierungs-Changes koppeln.

## Open Questions

- Welche Guardrail-Checks werden letztlich in `tooling/testing` zentralisiert und welche bleiben package-lokal?
