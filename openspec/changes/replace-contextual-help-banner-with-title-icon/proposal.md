# Change: Kontextbezogenen Hilfehinweis durch Titel-Icon ersetzen

## Why

Das flächige Hilfehinweisfeld beansprucht auf jeder dokumentierten Seite dauerhaft viel Aufmerksamkeit und verdrängt den eigentlichen Seiteninhalt. Ein kompakter Auslöser direkt an der Seitenüberschrift erhält den schnellen Zugang zur Hilfe, ohne die Fachseite visuell zu dominieren.

## What Changes

- Das bisherige Hilfehinweisfeld oberhalb des Seiteninhalts entfällt.
- Dokumentierbare Seiten zeigen unmittelbar rechts neben ihrer primären H1 einen runden Fragezeichen-Icon-Button.
- Der Icon-Button öffnet weiterhin unmittelbar das bestehende Hilfe-Overlay.
- Lade-, Fehler-, Markdown-, Fokus- und Sicherheitsverhalten des Overlays bleiben unverändert.
- Gemeinsame und individuelle Seitenüberschriften erhalten einen einheitlichen Titel-Zusatz, damit der Auslöser auf allen dokumentierbaren Seiten verfügbar bleibt.

## Impact

- Betroffene Specs: `ui-layout-shell`
- Betroffener Code: `apps/sva-studio-react/src/components/ContextualHelp.tsx`, `apps/sva-studio-react/src/components/AppShell.tsx`, gemeinsame Seitentitel unter `packages/studio-ui-react/` sowie individuelle Seitenüberschriften
- Betroffene arc42-Abschnitte: keine strukturelle Architekturänderung; das bestehende Laufzeitverhalten in `docs/architecture/06-runtime-view.md` bleibt gültig
