# Performance Review – Template

Nutze dieses Template für evidenzbasierte Performance-Reviews.

## Entscheidung

- Performance-Risiko: [niedrig | mittel | hoch]
- Begründung (1–2 Sätze):

## Executive Summary (3–5 Punkte)

- Punkt 1
- Punkt 2
- Punkt 3

## Befundübersicht

| ID | Thema | Schwere | Bereich | Evidenz |
|---:|-------|---------|---------|---------|

## Detail-Findings

### P1 – Kurztitel

- Beschreibung: …
- Impact/Risiko (Latenz, Rendering, Bundle, Cache): …
- Evidenz/Quelle: (Benchmarks, Profiler, Codepfad, Query-Pattern)
- Empfehlung/Abhilfe: …
- Ist Messung/Profiling zwingend? [Ja/Nein]

## Checkliste (Status)

- [ ] Review basiert auf messbarer Evidenz oder klarer technischer Herleitung
- [ ] Query-/Cache-Verhalten ist bewertet
- [ ] Große Listen / Rendering-Hotspots sind bewertet
- [ ] Bundle-/Initial-Load-Risiken sind bewertet
- [ ] Hot Paths in serverseitiger Logik sind bewertet
- [ ] Fehlende Messbarkeit ist explizit benannt

## Anhänge

- Eingesetzte Inputs: (Benchmarks, Vite-Config, Traces, PR-Diff)
