## Context

Das Studio kombiniert TanStack Router/Start, Zod, Nx und eine pluginfähige React-Host-Anwendung. Für mehrere wiederkehrende Querschnittsprobleme fehlen aber noch verbindliche Foundations:

- formularzentrierte Host- und Plugin-Workflows
- reproduzierbare HTTP-nahe Frontend-Tests
- generative Tests für kritische Kernlogik

Die Einführung neuer npm-Pakete ist in diesem Repository bewusst architekturwirksam und muss daher als normativer Standard beschrieben werden, nicht nur als Implementierungsdetail.

## Goals / Non-Goals

- Goals:
  - Ein einheitlicher Standard für Form-State, `zod`-Resolver und Fehlerrendering
  - Ein HTTP-Level-Mocking-Standard für Frontend-Tests
  - Ein gezielter Property-based-Testing-Standard für kritische Kernlogik
- Non-Goals:
  - Kein vollständiger Umstieg aller bestehenden Komponenten in einem Schritt
  - Keine Einführung zusätzlicher UI- oder DnD-Bibliotheken in diesem Change
  - Kein Ersatz bestehender E2E-Läufe durch Mock-basierte Tests

## Decisions

- Decision: `react-hook-form` mit `@hookform/resolvers` wird der Formularstandard für Host- und Plugin-Views mit `zod`-Validierung.
  - Rationale: Das Repository nutzt bereits `zod` intensiv. Die Kombination minimiert Boilerplate, hält Validierungslogik typnah und verbessert Konsistenz über Account-, Admin- und Content-Formulare.

- Decision: `msw` wird der Standard für HTTP-nahe Frontend-Tests unterhalb echter E2E-Läufe.
  - Rationale: Netzwerkverhalten soll auf Protokollebene und nicht über clientinterne Stubs geprüft werden. Das passt zu Host/Plugin-Integrationen und reduziert Mock-Kopplung an Implementierungsdetails.

- Decision: `fast-check` wird gezielt für kritische framework-agnostische Logik eingeführt, nicht pauschal für jede Komponente.
  - Rationale: Der höchste Mehrwert liegt in Parsern, Guards, Normalisierern, Query-Key-/Routing-Invarianten und ähnlicher Kernlogik. Für rein visuelle UI-Komponenten wäre der Nutzen meist gering.

## Alternatives Considered

- Alternative: Formularlogik mit lokaler React-State-Verwaltung oder ad-hoc Hooks.
  - Rejected: Das erhöht Inkonsistenzen bei Fehlerabbildung, Submit-Status, Field Arrays und Resolver-basierter Validierung.

- Alternative: Fetch/Client-Mocks ohne `msw`.
  - Rejected: Diese koppeln Tests stärker an Implementierungsdetails statt an beobachtbares HTTP-Verhalten.

- Alternative: Nur beispielbasierte Tests ohne `fast-check`.
  - Rejected: Für Hotspots mit vielen Eingabekombinationen bleiben Randfälle leichter unentdeckt.

## Risks / Trade-offs

- Mehr Tooling erhöht kurzfristig die Einstiegskomplexität.
  - Mitigation: gemeinsame Patterns, Doku und Wrapper-Utilities bereitstellen.

- `msw` kann falsch eingesetzt echte Integrationslücken verdecken.
  - Mitigation: Abgrenzung zu Live-E2E und infra-abhängigen Tests explizit dokumentieren.

- `fast-check` kann bei ungezieltem Einsatz Testlaufzeiten erhöhen.
  - Mitigation: nur für kritische Kernlogik und definierte Hotspots einsetzen.

## Migration Plan

1. Foundations als Dependencies und Workspace-Standards einführen.
2. Formular-Hotspots in Account/Admin/Content schrittweise umstellen.
3. HTTP-nahe Frontend-Tests auf `msw` konsolidieren.
4. Kritische Kernmodule selektiv mit `fast-check` absichern.

## Open Questions

- Welche bestehenden Formularflüsse werden in Phase 1 verpflichtend migriert?
- Welche Kernmodule werden initial als `fast-check`-Hotspots geführt?
