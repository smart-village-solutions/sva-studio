# UI-Shell Theming

## Ziel

Die Layout-Shell von `apps/sva-studio-react` verwendet semantische Design-Tokens als gemeinsame Grundlage für:

- Light- und Dark-Mode
- instanzabhängige Theme-Varianten über `instanceId`
- Tailwind-/shadcn-kompatible UI-Bausteine

## Leitlinien

- Neue UI-Komponenten und neue UI-Flächen basieren auf `shadcn/ui`.
- Bestehende `shadcn/ui`-Primitives und Varianten werden bevorzugt wiederverwendet, statt parallele Basisbausteine einzuführen.
- Shell-nahe Komponenten verwenden bevorzugt semantische Klassen wie `bg-background`, `text-foreground`, `bg-card`, `bg-sidebar`, `border-border` und `text-muted-foreground`.
- Direkte Farbcodes oder projektspezifische Tailwind-Farben wie `slate-*` oder `emerald-*` sollen in neuen Shell-Komponenten nicht mehr verwendet werden.
- Theme-Auswahl erfolgt zentral über `ThemeProvider` und `src/lib/theme.ts`.
- `instanceId` bestimmt optional die Theme-Variante; unbekannte Werte fallen auf `sva-default` zurück.
- Light-/Dark-Mode bleibt ein separater Modus und darf nicht über Theme-Namen kodiert werden.

## KERN-2 Phase 1

- Phase 1 ist eine visuelle Annäherung der Studio-Shell an KERN 2 im Light-Theme, keine technische Migration auf eine zweite UI-Laufzeit.
- Die internen Theme-IDs `sva-default` und `sva-forest` bleiben stabil; geändert werden nur die sichtbaren Anzeigenamen und die zugrunde liegenden semantischen Token.
- `apps/sva-studio-react/src/styles.css` bleibt die führende Quelle für Shell-Token. KERN-nahe Farben, Radien, Schatten und Flächen werden dort in die bestehenden semantischen Variablen übersetzt.
- Das Default-Light-Theme nutzt dabei eine KERN-nahe blaue Action- und Accent-Palette; `sva-forest` bleibt bewusst eine separate grüne Variantenlinie.
- Große Shell-Flächen wie Cards, Dialoge, Flyouts und Tabellen-Wrapper verwenden bewusst restriktivere Radien als Chips, Icon-Buttons oder pill-förmige Status-/Filterelemente.
- Plain-Table-Flächen ohne eigenes `StudioDataTable`-Primitive sollen bevorzugt den Shared-Baustein `StudioTableSurface` verwenden. Der Wrapper orientiert sich am Waste-Management-Plugin mit `overflow-hidden`, `rounded-none`, `border-y` und einer klar getrennten horizontalen Scroll-Ebene.
- Filter- und Toolbar-Flächen auf Listen-/Admin-Seiten sollen bevorzugt `StudioFilterSurface` verwenden, damit Suchfelder, Selects, Primäraktionen und Paginationsleisten dieselbe Shell-Fläche teilen.
- Kennzahlen- und Statuskarten sollen bevorzugt `StudioSummaryCard` verwenden, damit Eyebrow, Titelhierarchie, Radius und Flächenwirkung zwischen Monitoring-, Cockpit- und Admin-Seiten konsistent bleiben.
- `@kern-ux/native` wird in Phase 1 nicht als globaler CSS-Reset oder als konkurrierende Komponentenbibliothek eingebunden.
- Root-Dokument, `AppShell`, `Header` und `Sidebar` konsumieren ausschließlich semantische Tokens. Neue Shell-Flächen sollen keine direkten KERN-Farbcodes oder projektspezifischen Utility-Farben einführen.

### Aktueller Stand 2026-06-02

- Das Default-Light-Theme (`sva-default`) nutzt jetzt eine KERN-nahe blau-graue Foundation mit semantischen Tokens für `background`, `foreground`, `primary`, `ring`, `sidebar`, `muted`, `border` und `waste-panel-*`.
- Die restriktivere Shell-Geometrie ist umgesetzt: `--radius` 6px, `--radius-card` 8px und `--radius-modal` 12px bilden die Basis für Shell-Flächen, Dialoge und Karten.
- Die grüne Linie bleibt über `sva-forest` als separate Instanzvariante erhalten; die öffentlichen Runtime-Theme-IDs wurden bewusst nicht umbenannt.
- `@kern-ux/native` ist aktuell ausschließlich als Font-Quelle eingebunden. Verwendet wird nur `@kern-ux/native/dist/fonts/fira-sans.css`; ein globaler KERN-CSS-Reset oder KERN-Komponenten-CSS wird weiterhin nicht geladen.
- Das Root-Dokument setzt den Theme-Modus vor dem ersten Paint per Bootstrap-Skript. Der `ThemeProvider` synchronisiert `data-theme`, `data-theme-mode`, `color-scheme` und die `dark`-Klasse anschließend per Layout-Effekt, um den initialen Theme-Flicker zu vermeiden.
- Die Shell-Bausteine `__root.tsx`, `AppShell`, `Header` und `Sidebar` sowie die Shared-Flächen `StudioFilterSurface`, `StudioSummaryCard` und `StudioTableSurface` verwenden den semantischen Token-Satz bereits produktiv.
- Die KERN-2-Phase-1-Anpassung ist damit für Foundations, Shell und ausgewählte Admin-/Monitoring-Flächen umgesetzt. Dark-Mode bleibt funktional und regressionssicher, ist aber noch keine vollständige KERN-2-Dunkelvariante.
- Nicht Teil von Phase 1 bleiben vorerst das vollständige Reskinning aller Shared Form-Primitives sowie tiefe fachliche Detailseiten außerhalb des Shell-nahen Bereichs.

## Relevante Dateien

- `apps/sva-studio-react/src/styles.css`
- `apps/sva-studio-react/src/lib/theme.ts`
- `apps/sva-studio-react/src/providers/theme-provider.tsx`
- `apps/sva-studio-react/src/routes/__root.tsx`
- `apps/sva-studio-react/src/components/AppShell.tsx`
- `apps/sva-studio-react/src/components/Header.tsx`
- `apps/sva-studio-react/src/components/Sidebar.tsx`
- `apps/sva-studio-react/src/components/StudioFilterSurface.tsx`
- `apps/sva-studio-react/src/components/StudioSummaryCard.tsx`
- `apps/sva-studio-react/src/components/StudioTableSurface.tsx`
- `apps/sva-studio-react/src/components/ui/sheet.tsx`

## Erweiterungsregeln

- Abweichungen von `shadcn/ui` für Standardmuster wie Button, Dialog, Input, Select oder Tabs sind nur mit dokumentierter Architekturentscheidung zulässig.
- Neue Theme-Varianten nur zentral in `src/lib/theme.ts` und den zugehörigen CSS-Token-Overrides ergänzen.
- Neue Shell-Interaktionen bevorzugt über standardisierte Primitives modellieren, aktuell insbesondere Drawer-/`Sheet`-Muster.
- Größere Route-Flächen sollen bei Anpassungen opportunistisch auf semantische Tokens migriert werden, ohne die Shell erneut zu fragmentieren.
