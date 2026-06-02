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
- `@kern-ux/native` wird in Phase 1 nicht als globaler CSS-Reset oder als konkurrierende Komponentenbibliothek eingebunden.
- Root-Dokument, `AppShell`, `Header` und `Sidebar` konsumieren ausschließlich semantische Tokens. Neue Shell-Flächen sollen keine direkten KERN-Farbcodes oder projektspezifischen Utility-Farben einführen.

## Relevante Dateien

- `apps/sva-studio-react/src/styles.css`
- `apps/sva-studio-react/src/lib/theme.ts`
- `apps/sva-studio-react/src/providers/theme-provider.tsx`
- `apps/sva-studio-react/src/components/Header.tsx`
- `apps/sva-studio-react/src/components/Sidebar.tsx`
- `apps/sva-studio-react/src/components/ui/sheet.tsx`

## Erweiterungsregeln

- Abweichungen von `shadcn/ui` für Standardmuster wie Button, Dialog, Input, Select oder Tabs sind nur mit dokumentierter Architekturentscheidung zulässig.
- Neue Theme-Varianten nur zentral in `src/lib/theme.ts` und den zugehörigen CSS-Token-Overrides ergänzen.
- Neue Shell-Interaktionen bevorzugt über standardisierte Primitives modellieren, aktuell insbesondere Drawer-/`Sheet`-Muster.
- Größere Route-Flächen sollen bei Anpassungen opportunistisch auf semantische Tokens migriert werden, ohne die Shell erneut zu fragmentieren.
