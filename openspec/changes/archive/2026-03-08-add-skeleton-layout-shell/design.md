## Context

Die App `sva-studio-react` benötigt eine robuste und erweiterbare Grundstruktur für kommende Features. Aktuell sind Header und Content vorhanden, eine echte Shell mit Sidebar und konsistenten Skeleton-Zuständen über die Kernbereiche fehlt.

Die Umsetzung muss mit dem bestehenden Stack (TanStack Router/Start, Tailwind, Nx) kompatibel bleiben und die Projektregeln zu A11y, Design-System und Wartbarkeit einhalten.

## Goals / Non-Goals

- Goals:
  - Erweiterbare Shell-Struktur für Sidebar, Header und Content
  - Konsistente Skeleton-UI für alle drei Bereiche
  - Responsives Verhalten ohne zusätzliche UI-Komplexität
  - Barrierefreie Grundstruktur (WCAG-orientiert)
- Non-Goals:
  - Vollständiges Navigations- oder Menüsystem
  - Einführung zusätzlicher Feature-Seiten
  - Umfassendes Redesign aller bestehenden Komponenten

## Decisions

- Decision: Einführung einer dedizierten Shell-Komposition im Root-Layout
  - Sidebar, Header und Content werden als klar getrennte Bereiche modelliert.
- Decision: Skeleton wird als eigene, wiederverwendbare Komponentenfamilie umgesetzt
  - Vorteil: spätere Erweiterung pro Bereich ohne Umbau des Gesamtlayouts.
- Decision: Responsivität wird über einfache Breakpoint-Regeln umgesetzt
  - Mobile-first, Sidebar auf kleinen Viewports als horizontaler/kompakter Bereich.
- Decision: A11y-Baseline im Layout
  - Semantische Landmarks (`header`, `aside`, `main`, `nav`), Skip-Link, sinnvolle `aria`-Attribute.

## Risks / Trade-offs

- Risiko: Zusätzliche Komponenten erhöhen initiale Strukturkomplexität
  - Mitigation: Kleine, klar fokussierte Komponenten und schlanke Props.
- Risiko: Skeleton kann bei fehlender Ladeorchestrierung inkonsistent erscheinen
  - Mitigation: Skeleton-Rendering über klaren Loading-Schalter auf Shell-Ebene.
- Risiko: Responsives Verhalten könnte bei späteren Feature-Erweiterungen brechen
  - Mitigation: Einheitliche Container- und Breakpoint-Konventionen dokumentieren.

## Migration Plan

1. OpenSpec- und ADR-Artefakte anlegen
2. Root-Layout auf Shell-Komposition umstellen
3. Skeleton-Bausteine integrieren
4. Tests und Qualitätschecks ausführen
5. Arc42- und PR-Doku aktualisieren

## Open Questions

- Soll die Sidebar mittelfristig route-basiert oder plugin-basiert erweitert werden?
- Soll ein globaler `layoutLoading`-State über Router-Pending gesteuert werden?
