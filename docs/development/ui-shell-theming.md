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
- Tailwind-Varianten mit `dark:` werden in `src/styles.css` explizit an die vom `ThemeProvider` gesetzte `.dark`-Klasse gebunden. Sie dürfen nicht vom Betriebssystem-Media-Query abweichen.
- `instanceId` bestimmt optional die Theme-Variante; unbekannte Werte fallen auf `sva-default` zurück.
- Light-/Dark-Mode bleibt ein separater Modus und darf nicht über Theme-Namen kodiert werden.
- Ohne gespeicherte Studio-Auswahl fällt der Light-/Dark-Mode auf den Studio-Default `light` zurück, nicht auf Browser- oder Betriebssystem-Präferenzen.

## Action-Tokens und Button-Kontrast

Buttons beziehen ihre Farben ausschließlich aus den semantischen `action-*`-Tokens in `src/styles.css`. Der Vertrag wird für `sva-default` und `sva-forest` jeweils in Light und Dark gepflegt. Er trennt die Aktionsfarben bewusst von allgemeinen `primary`-, `secondary`- und `accent`-Flächen, damit Änderungen an Buttons nicht unbeabsichtigt Sidebar, Badges oder andere Shell-Flächen verändern.

| Variante    | Ruhestand                                          | Zustände                                              |
| ----------- | -------------------------------------------------- | ----------------------------------------------------- |
| Primary     | gefüllte blaue beziehungsweise grüne Aktionsfläche | eigene Foreground-, Hover- und Active-Tokens          |
| Secondary   | neutrale Fläche mit sichtbarer Kontur              | eigene Foreground-, Border-, Hover- und Active-Tokens |
| Tertiary    | transparenter Hintergrund mit kontrastreichem Text | explizite Hover- und Active-Flächen samt Foreground   |
| Destructive | zurückhaltende rote Fläche und Kontur              | eigene Foreground-, Border-, Hover- und Active-Tokens |
| Disabled    | definierte neutrale Fläche, Kontur und Schrift     | keine pauschale Opacity-Mischung                      |

Der aktive Text erreicht in Default, Hover und Active mindestens 4,5:1 gegen seine unmittelbare Fläche. Sekundärkontur und Fokusindikator erreichen mindestens 3:1 gegen Page-, Card- und Popover-Flächen. Forest-Dark verwendet deshalb einen dunklen Vordergrund auf dem hellen grünen Primary. Transparente Alpha-Mischungen sind für Action-Zustände nicht zulässig, weil ihr Ergebnis sonst vom unbekannten Untergrund abhängt.

Foundation-Tests prüfen die vollständige Tokenmatrix numerisch. Der Playwright-Test `e2e/button-accessibility.spec.ts` ergänzt Axe, berechnete Browserfarben, Zielgrößen und visuelle Referenzen für alle vier Theme-/Modus-Kombinationen.

## Figma-Designsystem: lokaler Implementierungsstand November 2026

Die neue Foundation übernimmt die semantischen Light-/Dark-Rollen aus dem
überarbeiteten Designsystem. RGB-Kanäle und öffentliche Theme-IDs bleiben
stabil. `surface-inset`, `border-subtle` und explizite Statusfarben ergänzen
gezielt die vorhandenen Tokens. Forest behält seine grüne Aktionspalette.

Die Gestaltung ist freigegeben und wird bereits vor Bibliotheksveröffentlichung verwendet. Forest wird erst später wieder aktiv gestaltet; bestehende Theme-IDs bleiben erhalten.

Die dokumentierten Figma-Werte für Secondary-Konturen und deaktivierte Texte
unterschreiten teilweise die bestehenden Studio-Kontrastprüfungen. Deshalb
nutzt der Code dort stärkere semantische Rollen; die Abweichung ist im
[UI-Migrationsdesign](../../openspec/changes/align-studio-ui-design-system/design.md)
als Designlücke dokumentiert. Deaktivierte Texte sind normativ teilweise
von Kontrastanforderungen ausgenommen; die strengere bestehende Studio-Prüfung
bleibt im aktuellen technischen Stand erhalten. Für den endgültigen
Figma-/Code-Abgleich gilt die Nutzerentscheidung: Barrierefreiheit zuerst,
dekorative Flächen und Linien dezent. Eine dekorative Buttonkontur benötigt
nicht pauschal 3:1, wenn Text/Signal das Control ausreichend kennzeichnet;
ein erforderlicher Fokusindikator bleibt kontrastreich. Siehe
[W3C: Nicht-Text-Kontrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
und [W3C: Mindestkontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
Die bisherigen strengeren Codechecks werden nicht stillschweigend abgeschwächt;
die abgestimmten endgültigen Rollen werden vor der visuellen Abnahme übernommen.

Die Shell verwendet ohne gespeicherte Präferenz unter 1024 px einen Drawer,
ab 1024 px eine 80-px-Rail und ab 1280 px eine 288-px-Sidebar. Gültige bestehende
Collapse-Werte `0`/`1` bleiben Präferenzen; automatische Viewportwechsel schreiben
keine Auswahl. Die Arbeitsorganisation erscheint zusätzlich in der Kopfzeile,
auf schmalen Ansichten in einer eigenen Zeile. Kontokontext und Mitgliedschaften
bleiben im Kontomenü erreichbar; mehrfach gerenderte Auswahlfelder besitzen
getrennte IDs. Eigene Sidebar-Motive nutzen Lucide, dynamische Plugin-Icons
bleiben dem zuständigen Beitrag zugeordnet.

`StudioPageHeader` richtet seine Aktionen anhand der Inhaltsbreite aus.
Gemeinsame Detail-Tabs besitzen lokale horizontale Scrollregionen und eine
sichtbare mobile Bereichsauswahl. News verwendet den bestehenden Shared-Pfad
mit `keepMounted` und optionaler Intent-Vorladung. Card- und Tab-Panel-Flächen
verwenden Radius 8 und 16/24 px Innenabstand. Die einzige gespeicherte
Formularquelle, Mediencontroller und Mutationsverträge bleiben erhalten.

`e2e/news-plugin.spec.ts` ergänzt synthetische Referenzen für Contentübersicht,
News-Create und News-Edit in beiden Themes/Modi sowie responsive Grenzen.
Screenshots, funktionale Tests, Browser-Barrierefreiheit und fachliche Abnahme
sind getrennte Nachweise. Dieser Stand beschreibt lokale Implementierung,
keine Bereitstellung oder pauschale WCAG-Abnahme aller Plugins.

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

### Historischer Ausgangsstand 2026-06-02

- Das Default-Light-Theme (`sva-default`) nutzt jetzt eine KERN-nahe blau-graue Foundation mit semantischen Tokens für `background`, `foreground`, `primary`, `ring`, `sidebar`, `muted`, `border` und `waste-panel-*`.
- Die restriktivere Shell-Geometrie ist umgesetzt: `--radius` 6px, `--radius-card` 8px und `--radius-modal` 12px bilden die Basis für Shell-Flächen, Dialoge und Karten.
- Die grüne Linie bleibt über `sva-forest` als separate Instanzvariante erhalten; die öffentlichen Runtime-Theme-IDs wurden bewusst nicht umbenannt.
- `@kern-ux/native` ist aktuell ausschließlich als Font-Quelle eingebunden. Verwendet wird nur `@kern-ux/native/dist/fonts/fira-sans.css`; ein globaler KERN-CSS-Reset oder KERN-Komponenten-CSS wird weiterhin nicht geladen.
- Das Root-Dokument setzt den Theme-Modus vor dem ersten Paint per Bootstrap-Skript aus der gespeicherten Studio-Auswahl oder dem festen Studio-Default `light`. Der `ThemeProvider` synchronisiert `data-theme`, `data-theme-mode`, `color-scheme` und die `dark`-Klasse anschließend per Layout-Effekt, um den initialen Theme-Flicker zu vermeiden.
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
- `@sva/studio-ui-react` ist alleiniger Owner der Button-Basis. Ein Boundary-Gate verhindert einen neuen lokalen App-Button sowie lokale Plugin-Basisbuttons.
- Neue Theme-Varianten nur zentral in `src/lib/theme.ts` und den zugehörigen CSS-Token-Overrides ergänzen.
- Neue Shell-Interaktionen bevorzugt über standardisierte Primitives modellieren, aktuell insbesondere Drawer-/`Sheet`-Muster.
- Größere Route-Flächen sollen bei Anpassungen opportunistisch auf semantische Tokens migriert werden, ohne die Shell erneut zu fragmentieren.
