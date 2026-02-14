# Architekturuebersicht (arc42)

Diese Uebersicht ist der verpflichtende Einstiegspunkt fuer Architektur- und Systemdokumentation.
Alle Architekturinformationen werden arc42-konform in den Abschnitten 1-12 gepflegt.

## Arc42-Struktur

| Abschnitt | Datei | Mindestinhalte | Pflege-Trigger |
| --- | --- | --- | --- |
| 1. Einfuehrung und Ziele | `./01-introduction-and-goals.md` | Systemzweck, Stakeholder, Top-3 Architekturziele | Aenderung von Produktzielen, Scope oder Zielgruppen |
| 2. Randbedingungen | `./02-constraints.md` | Technische, organisatorische, regulatorische Constraints | Neue Vorgaben (Security, Compliance, Plattform, Budget) |
| 3. Kontext und Scope | `./03-context-and-scope.md` | Systemkontext, externe Schnittstellen, fachliche Grenzen | Neue Integrationen, geaenderte Verantwortungsgrenzen |
| 4. Loesungsstrategie | `./04-solution-strategy.md` | Leitprinzipien, Architekturtreiber, strategische Entscheidungen | Neue Leitentscheidungen oder geaenderte Zielarchitektur |
| 5. Bausteinsicht | `./05-building-block-view.md` | Module/Packages, Verantwortlichkeiten, Abhaengigkeiten | Neue Module, geaenderte Modulgrenzen |
| 6. Laufzeitsicht | `./06-runtime-view.md` | Wichtige Szenarien/Sequenzen, Request-Flows | Geaenderte Flows, neue kritische Laufzeitszenarien |
| 7. Verteilungssicht | `./07-deployment-view.md` | Deployment-Topologie, Umgebungen, Betriebsgrenzen | Neue Laufzeitumgebungen, Infra- oder Deployment-Aenderungen |
| 8. Querschnittliche Konzepte | `./08-cross-cutting-concepts.md` | Security, Logging, Fehlerbehandlung, i18n, A11y | Aenderung cross-cutting Policies oder Patterns |
| 9. Architekturentscheidungen | `./09-architecture-decisions.md` | Relevante ADR-Liste, Status und Verweise | Neue/aktualisierte ADRs |
| 10. Qualitaetsanforderungen | `./10-quality-requirements.md` | Qualitaetsziele, Szenarien, Metriken | Neue Qualitaetsziele oder geaenderte Priorisierung |
| 11. Risiken und technische Schulden | `./11-risks-and-technical-debt.md` | Architektur-Risiken, Schulden, Gegenmassnahmen | Neue Risiken, geaenderte Risikobewertung |
| 12. Glossar | `./12-glossary.md` | Einheitliche Begriffe, Abkuerzungen, Definitionen | Neue zentrale Begriffe oder uneinheitliche Terminologie |

## Pflege-Regeln

- Architektur- oder Systemaenderungen in PRs muessen die betroffenen arc42-Abschnitte aktualisieren oder eine begruendete Abweichung dokumentieren.
- OpenSpec-Changes mit Architekturwirkung muessen betroffene arc42-Abschnitte in `proposal.md` und `tasks.md` referenzieren.
- Architekturentscheidungen werden als ADR unter `./decisions/` dokumentiert und in Abschnitt 9 verlinkt.
- Referenzen sollen konsistent und klickbar sein (Dateipfade statt Freitext).

## Bestehende Architekturdokumente

- Routing: `./routing-architecture.md`
- Logging und Observability: `./logging-architecture.md`
- ADRs: `./decisions/ADR-001-frontend-framework-selection.md`, `./decisions/ADR-002-plugin-architecture-pattern.md`, `./decisions/ADR-003-design-token-architecture.md`
