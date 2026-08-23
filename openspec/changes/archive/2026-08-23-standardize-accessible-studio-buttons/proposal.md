# Change: Zugängliche Studio-Buttons standardisieren

## Why

Die gemeinsame Button-Darstellung des Studios bildet Primär-, Sekundär- und Tertiäraktionen derzeit nicht dauerhaft zugänglich ab. Insbesondere verwendet die Sekundärvariante denselben hellen beziehungsweise dunklen Farbtoken für Text und schwach transparente Fläche und erreicht dadurch in beiden Modi keinen ausreichenden Textkontrast. Im dunklen Forest-Theme kombiniert die Primärvariante außerdem eine helle grüne Fläche mit weißem Text. Zustandsfarben entstehen teilweise über Transparenz und hängen damit vom jeweiligen Seiten-, Card- oder Dialoghintergrund ab.

Zusätzlich existiert die Button-Basis sowohl in `@sva/studio-ui-react` als auch lokal in `apps/sva-studio-react`. Die nahezu identischen Implementierungen können bei Varianten, Tooltips, Fokusverhalten und Größen auseinanderlaufen. Es fehlt eine automatische Theme-, Modus- und Zustandsmatrix, die Kontrast- und Bedienbarkeitsregressionen vor dem Merge verhindert.

## What Changes

- Das Studio führt die klar benannten neutralen Aktionsstufen `primary`, `secondary` und `tertiary` ein; `destructive` bleibt eine separate risikobezogene Variante.
- Alle Aktionsvarianten erhalten zentrale semantische Tokens für Vordergrund, Fläche, Hover, Active, Fokus und Disabled in Default- und Forest-Theme sowie Light- und Dark-Mode.
- Zustandsfarben werden nicht mehr durch untergrundabhängige Alpha-Mischungen erzeugt.
- Text, Fokusindikatoren und relevante grafische Zustände erfüllen mindestens WCAG 2.1 AA und BITV 2.0; die Prüfschwellwerte werden automatisiert abgesichert.
- Standard- und Icon-Buttons erhalten eine mindestens 44 x 44 Pixel große Interaktionsfläche. Kompakte Darstellungen dürfen die sichtbare Dichte reduzieren, nicht aber die wirksame Zielgröße.
- Reine Icon-Buttons benötigen einen zugänglichen Namen und stellen ihren Tooltip mit Maus und Tastaturfokus bereit.
- Lade-, Disabled-, Hover-, Active- und Fokuszustände werden pro Variante einheitlich definiert. Der globale Scale-Lift entfällt zugunsten ruhiger Farbtransitionen unter Beachtung von `prefers-reduced-motion`.
- `@sva/studio-ui-react` wird alleiniger Owner der Button-Basis. Die lokale App-Kopie und langfristige Legacy-Variantenbezeichnungen werden vollständig migriert.
- Eine gerenderte Testmatrix prüft alle Varianten und interaktiven Zustände in beiden Themes und beiden Modi mit den bereits vorhandenen Axe-/Playwright-Werkzeugen.
- Die Theme- und Studio-UI-Dokumentation beschreibt Hierarchie, Einsatzregeln, Token und Accessibility-Vertrag.

## Impact

- Affected specs: `ui-layout-shell`, `monorepo-structure`
- Affected code:
  - `packages/studio-ui-react/src/button.tsx`
  - `packages/studio-ui-react/src/button.test.tsx`
  - `packages/studio-ui-react/src/index.ts`
  - `apps/sva-studio-react/src/components/ui/button.tsx`
  - `apps/sva-studio-react/src/components/ui/alert-dialog.tsx`
  - `apps/sva-studio-react/src/styles.css`
  - Button-Aufrufstellen in Host und Plugins
  - vorhandene Studio-Accessibility- und Playwright-Harnesses
- Affected documentation:
  - `docs/development/ui-shell-theming.md`
  - `docs/development/studio-uebersichts-und-detailseiten-standard.md`
- Affected arc42 sections:
  - `docs/architecture/README.md`, Abschnitt 5 (Bausteinsicht) für die zentrale Ownership von `@sva/studio-ui-react`
  - `docs/architecture/README.md`, Abschnitt 8 (Querschnittliche Konzepte) für Theme- und Accessibility-Regeln
- Breaking impact: Interne Button-Aufrufstellen mit `default`, `ghost` oder `outline` werden auf die fachlichen Varianten migriert. Es bleiben nach Abschluss keine parallelen Legacy-Aliase bestehen.

## Out of Scope

- Vollständiges Reskinning aller Form- und Navigationskomponenten
- Austausch von shadcn/ui oder Einführung einer zweiten Komponentenbibliothek
- Änderung fachlicher Aktionslogik, Berechtigungen oder Save-Lifecycles
- Neugestaltung von Badges, Links oder destruktiven Bestätigungsabläufen außerhalb ihrer Button-Darstellung
