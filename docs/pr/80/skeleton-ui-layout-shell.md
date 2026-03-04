# Skeleton UI – Layout Shell (Sidebar, Kopfzeile, Content)

## Ziel

Einführung einer erweiterbaren UI-Shell mit konsistenten Skeleton-Zuständen für die drei Kernbereiche:

- Sidebar
- Kopfzeile
- Contentbereich

## Scope

- Neue Shell-Komposition in der Root-Route
- Neue Sidebar-Komponente
- Header um Loading-Skeleton erweitert
- Content-Skeleton in AppShell
- A11y-Baseline (Skip-Link, Landmarks)
- Responsive Basisstruktur

## Methodische Artefakte

- OpenSpec Change: `openspec/changes/add-skeleton-layout-shell/`
- ADR: `docs/architecture/decisions/ADR-009-layout-shell-skeleton-architecture.md`
- Arc42-Updates: Abschnitt 05, 06, 08, 09, 10

## Technische Änderungen (Kern)

- `apps/sva-studio-react/src/components/AppShell.tsx`
- `apps/sva-studio-react/src/components/Sidebar.tsx`
- `apps/sva-studio-react/src/components/Header.tsx`
- `apps/sva-studio-react/src/routes/__root.tsx`
- `apps/sva-studio-react/src/components/AppShell.test.tsx`
- `apps/sva-studio-react/src/components/Header.test.tsx`
- `apps/sva-studio-react/src/components/Sidebar.test.tsx`

## Verifikation

- Unit-Tests in `apps/sva-studio-react` für Header, Sidebar und AppShell
- Zusätzliche manuelle Prüfung vorgesehen:
  - Tastatur-Tab-Reihenfolge inkl. Skip-Link
  - Mobile/Tablet/Desktop Layout-Verhalten

## Offene Punkte

- i18n-Harmonisierung bestehender und neuer UI-Texte gemäß `DEVELOPMENT_RULES.md`
- Entscheidung, wie globale Pending-Zustände perspektivisch an Router-Pending gekoppelt werden
