# Change: Technische Entflechtung der SVA-Mainserver-Service-Interna

## Why
`packages/sva-mainserver/src/server/service.ts` bündelt aktuell Konfigurationsauflösung, Credential- und Token-Lifecycle, GraphQL-Transport, Retry-/Timeout-Logik, Telemetrie sowie die domänenspezifische News-/Event-/POI-Abbildung in einem einzelnen Modul. Das erschwert gezielte Änderungen, vergrößert die Regressionsfläche und führt dazu, dass viele fachlich getrennte Verhaltensweisen nur über breite Service-Tests abgesichert sind.

## What Changes
- Einführung einer internen Zielstruktur für `@sva/sva-mainserver/server`, die Infrastruktur- und Fachverantwortlichkeiten trennt
- Extraktion von Credential-, Token-, GraphQL-, Cache- und Observability-Logik in dedizierte interne Module
- Extraktion der News-, Event- und POI-Mapper sowie der ressourcenspezifischen Operationen in getrennte interne Module
- Beibehaltung der öffentlichen Service-Fassade, der Top-Level-Helper, der Fehlercodes und der beobachtbaren Laufzeitsemantik
- Ergänzung fokussierter Unit-Tests für die neuen internen Module bei reduziertem, aber weiterhin vorhandenem Service-Level-Wiring-Test

## Impact
- Affected specs:
  - `sva-mainserver-integration`
- Affected code:
  - `packages/sva-mainserver/src/server/service.ts`
  - `packages/sva-mainserver/src/server/**/*.test.ts`
  - `packages/sva-mainserver/README.md`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
