## 1. Theme- und Variantenvertrag

- [x] 1.1 Für Default-Light, Default-Dark, Forest-Light und Forest-Dark die Action-Tokens für Primary, Secondary, Tertiary, Destructive, Focus und Disabled festlegen und alle normativen Kontrastschwellen vor der Komponentenänderung prüfen.
- [x] 1.2 Die zentralen Action-State-Tokens in `apps/sva-studio-react/src/styles.css` ergänzen und untergrundabhängige Alpha-Mischungen aus den Buttonzuständen entfernen.
- [x] 1.3 Die betroffenen allgemeinen `primary`-, `secondary`-, `accent`- und Foreground-Verbraucher auf unbeabsichtigte Theme-Auswirkungen prüfen; insbesondere Forest-Dark darf keinen hellen Primärhintergrund mit weißem Text behalten.
- [x] 1.4 Nach dem Token-Block fokussierte Foundation- und Kontrasttests ausführen und bei einem roten Stand nicht mit der Komponentenmigration fortfahren.

## 2. Kanonische Shared-Button-Komponente

- [x] 2.1 `@sva/studio-ui-react` auf die Varianten `primary`, `secondary`, `tertiary` und `destructive` umstellen; die ausgelassene Variante bleibt Primary.
- [x] 2.2 Hover, Active, Focus, Disabled und Loading mit den zentralen Action-Tokens abbilden; Loading semantisch mit `aria-busy` kennzeichnen und Doppelauslösung verhindern.
- [x] 2.3 Standard-, kompakte und Icon-Darstellungen mit einer wirksamen Mindestzielgröße von 44 x 44 Pixeln umsetzen.
- [x] 2.4 Tooltip-Verhalten für reine Icon-Buttons bei Pointer-Hover und Tastaturfokus sowie den zugänglichen Namen absichern.
- [x] 2.5 Den Scale-/Shadow-Lift entfernen und nur eine reduzierte, `prefers-reduced-motion` respektierende Zustandsanimation beibehalten.
- [x] 2.6 Nach dem Shared-Component-Block fokussierte Unit- und Type-Tests ausführen und bei einem roten Stand nicht mit der Aufrufstellenmigration fortfahren.

## 3. Repositoryweite Migration und Ownership

- [x] 3.1 Alle expliziten Verwendungen von `default`, `ghost` und `outline` fachlich auf Primary, Secondary oder Tertiary abbilden; keine rein mechanische Zuordnung für mehrdeutige Aktionskontexte übernehmen.
- [x] 3.2 Implizite Primary-Verwendungen, Destructive-Aktionen und `asChild`-Links auf unveränderte Semantik und zugängliche Namen prüfen.
- [x] 3.3 Lokale Farb-, Höhen- und Breiten-Overrides wie `h-8 w-8` auditieren und so migrieren, dass Kontrast- und 44-Pixel-Zielgrößenvertrag erhalten bleiben.
- [x] 3.4 Die lokale App-Button-Implementierung entfernen und App-Dialoge sowie übrige lokale Verbraucher auf `@sva/studio-ui-react` umstellen.
- [x] 3.5 Den bestehenden UI-Boundary-Check oder einen fokussierten statischen Test so erweitern, dass neue parallele Button-Basisimplementierungen in Host und Plugins abgewiesen werden.
- [x] 3.6 Nach der Migration die betroffenen Package-/App-Unit- und Type-Gates ausführen und bei einem roten Stand keine weitere Implementierung beginnen.

## 4. Dauerhafte Accessibility-Regressionstests

- [x] 4.1 Unit-Tests für Varianten-API, Default-Primary, Disabled, Loading, `asChild`, Tooltip-Hover, Tooltip-Fokus und Fokuszuordnung ergänzen.
- [x] 4.2 Ein gerendertes Button-Test-Harness für alle Varianten und relevanten Zustände auf Page-, Card- und Dialog/Popover-Untergründen bereitstellen, ohne eine produktive Design-System-Seite einzuführen.
- [x] 4.3 Playwright-/Axe-Prüfungen für Default-Light, Default-Dark, Forest-Light und Forest-Dark ergänzen.
- [x] 4.4 Berechnete Text-, UI- und Fokuskontraste nach Default, Hover, Active und Focus browserbasiert gegen mindestens 4,5:1 beziehungsweise 3:1 prüfen.
- [x] 4.5 Tastaturreihenfolge, sichtbaren Fokus, Tooltip-Fokus, Disabled- und Loading-Verhalten sowie 44 x 44 Pixel große Bounding-Boxes automatisiert prüfen.
- [x] 4.6 Stabile visuelle Screenshots für die vier Theme-/Modus-Kombinationen ergänzen; Screenshots nicht als Ersatz für numerische und semantische Assertions verwenden.

## 5. Dokumentation und Abschlussgates

- [x] 5.1 `docs/development/ui-shell-theming.md` um Action-Tokens, Theme-Matrix und Kontrastvertrag ergänzen.
- [x] 5.2 `docs/development/studio-uebersichts-und-detailseiten-standard.md` um Einsatzregeln für Primary, Secondary, Tertiary, Destructive, Icon-Buttons und Zustände ergänzen.
- [x] 5.3 Die zentrale Button-Ownership und Accessibility-/Theme-Regeln in den betroffenen arc42-Abschnitten 5 und 8 dokumentieren.
- [x] 5.4 Fokussierte Unit-, Type-, Lint-, Boundary-, Playwright-, Axe- und OpenSpec-Gates ausführen.
- [x] 5.5 Den affected Scope gegen `origin/main` messen und anschließend den kleinsten relevanten finalen PR-Gate-Pfad gemäß `DEVELOPMENT_RULES.md` ausführen; ausgelassene breite Gates transparent dokumentieren.
- [x] 5.6 Vor Abschluss alle Tasks, Dokumente, Variantenverwendungen und lokalen Overrides gegen den finalen Diff prüfen und erst nach vollständiger Umsetzung abhaken.
