# Change: Erweiterbare Skeleton-Layout-Shell für SVA Studio

## Why

Die aktuelle UI-Struktur in `apps/sva-studio-react` ist funktional, aber für den geplanten Ausbau von Navigation und Arbeitsbereichen noch zu wenig als erweiterbare Shell strukturiert. Für die nächsten Ausbaustufen benötigen wir eine klare, wiederverwendbare Grundarchitektur mit den drei zentralen Bereichen:

- Sidebar
- Kopfzeile
- Contentbereich

Zusätzlich sollen Ladezustände bereits auf Shell-Ebene als Skeleton UI verfügbar sein, um wahrgenommene Performance, Konsistenz und Nutzerführung zu verbessern.

## What Changes

- Einführung einer erweiterbaren Layout-Shell mit klarer Aufteilung in Sidebar, Kopfzeile und Contentbereich
- Einführung einer Skeleton-Variante für diese drei Bereiche
- Fokus auf responsives Verhalten (mobil, tablet, desktop)
- Fokus auf Barrierefreiheit (Landmarks, Skip-Link, semantische Struktur, Tastaturbedienbarkeit)
- Ergänzung/Anpassung von Unit-Tests für die neuen Layout-Bausteine
- Dokumentation der Architekturentscheidung als ADR
- Aktualisierung relevanter arc42-Abschnitte
- PR-Dokumentation der Umsetzung unter `docs/pr/`

## Impact

- **Affected specs:** `ui-layout-shell` (neu)
- **Affected code:**
  - `apps/sva-studio-react/src/components/**` (Layout-/Skeleton-Komponenten)
  - `apps/sva-studio-react/src/routes/__root.tsx` (Shell-Integration)
  - `apps/sva-studio-react/src/styles.css` (falls für Layout-Basis nötig)
- **Affected arc42 sections:**
  - 05 Bausteinsicht
  - 06 Laufzeitsicht
  - 08 Querschnittliche Konzepte
  - 09 Architekturentscheidungen
  - 10 Qualitätsanforderungen
