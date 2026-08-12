## Context

Das Studio verwendet Tailwind-/shadcn-kompatible Buttons, deren zentrale Variante in `@sva/studio-ui-react` liegt. Parallel existiert noch eine lokale App-Implementierung. Beide bilden derzeit die Varianten `default`, `secondary`, `ghost`, `outline` und `destructive` ab. Die visuelle Produktsprache unterscheidet dagegen Primär-, Sekundär- und Tertiäraktionen sowie destruktive Aktionen.

Die Theme-Werte liegen zentral in `apps/sva-studio-react/src/styles.css`. Das Default-Theme verwendet eine blaue, das Forest-Theme eine grüne Aktionsfarbe; Light- und Dark-Mode sind jeweils unabhängig davon. Die aktuelle Verwendung von `bg-secondary/10 text-secondary` macht den Text der Sekundärvariante praktisch unlesbar. Im Forest-Dark-Mode ist der helle Primärton mit weißem Text ebenfalls nicht ausreichend kontrastreich. Transparente Hover-Flächen erschweren darüber hinaus eine belastbare Prüfung auf unterschiedlichen Untergründen.

## Goals / Non-Goals

### Goals

- Eine eindeutige und fachlich verständliche Button-Hierarchie bereitstellen.
- WCAG 2.1 AA und BITV 2.0 in allen Theme-, Modus- und relevanten Zustandskombinationen automatisiert absichern.
- Button-Basis, Variantenlogik, Tooltip-Verhalten und Größen in `@sva/studio-ui-react` zentralisieren.
- Untergrundunabhängige Aktionsfarben über semantische Zustandstokens verwenden.
- Bestehende Aufrufstellen ohne fachliche Verhaltensänderung kontrolliert migrieren.
- Mit bestehenden Testwerkzeugen arbeiten und keine neue UI- oder Accessibility-Abhängigkeit einführen.

### Non-Goals

- Keine vollständige KERN-Komponentenmigration.
- Keine zweite Design-System-Laufzeit und kein globaler CSS-Reset.
- Keine Änderung an Mutation, Navigation, Autorisierung oder fachlicher Fehlerbehandlung.
- Keine allgemeine Überarbeitung aller Studio-Farbtokens außerhalb direkt betroffener Action- und Foreground-Kombinationen.

## Decisions

### Decision: Produktsemantische Variantennamen ersetzen Darstellungsnamen

Die öffentliche Button-API verwendet nach der Migration:

- `primary` für den fachlichen Abschluss oder die wichtigste Aktion eines Bereichs,
- `secondary` für unterstützende, sichtbare Aktionen,
- `tertiary` für nachrangige oder kompakte Aktionen,
- `destructive` für risikobehaftete Aktionen.

Ohne explizite `variant` bleibt `primary` der Standard. `default`, `ghost` und `outline` werden im selben Change an allen internen Aufrufstellen fachlich zugeordnet und anschließend aus dem Variantentyp entfernt. Damit bleibt kein dauerhaftes Alias-System bestehen, das neue Aufrufstellen wieder fragmentieren könnte.

`destructive` beschreibt das Risiko und steht außerhalb der neutralen Hierarchie. Bestätigungs- und Berechtigungsverträge ändern sich dadurch nicht.

### Decision: Varianten erhalten explizite Action-State-Tokens

Die Theme-Foundation erhält semantische Tokens für mindestens folgende Kombinationen:

- `action-primary`, `action-primary-foreground`, `action-primary-hover`, `action-primary-active`
- `action-secondary`, `action-secondary-foreground`, `action-secondary-hover`, `action-secondary-active`
- `action-tertiary-foreground`, `action-tertiary-hover`, `action-tertiary-hover-foreground`, `action-tertiary-active`
- `action-disabled`, `action-disabled-foreground`
- `action-focus`

Die konkreten Werte werden für Default-Light, Default-Dark, Forest-Light und Forest-Dark zentral definiert. Sie bewahren die blaue beziehungsweise grüne Themenidentität, müssen aber vor Übernahme die Kontrastmatrix erfüllen. Forest-Dark verwendet für die helle grüne Primärfläche einen dunklen Vordergrund. Primary-Hover und Primary-Active erhalten explizite Vollfarben statt `/90`-Mischungen. Secondary verwendet eine erkennbare neutrale Fläche mit kontrastreichem Foreground. Tertiary ist im Ruhezustand transparent und erhält für Hover und Active explizite Flächen.

Komponenten dürfen Action-State-Farben nicht lokal durch Alpha-Modifikatoren oder direkte Palettenfarben verändern. Wo andere Komponenten weiterhin die allgemeinen Tokens `primary`, `secondary` oder `accent` konsumieren, werden unbeabsichtigte Farbänderungen vermieden; Action-Tokens bilden einen klar begrenzten Vertrag für interaktive Aktionen.

### Decision: Die Accessibility-Matrix ist normativer Bestandteil des Komponentenvertrags

Für aktiven Buttontext gilt in allen gerenderten Zuständen mindestens 4,5:1 Kontrast gegen die unmittelbare Fläche. Für Fokusindikatoren und nicht-textliche Informationen, die zur Erkennung des Zustands erforderlich sind, gilt mindestens 3:1 gegen angrenzende Farben. Wo die Markenpalette es ohne Verlust der Hierarchie zulässt, wird ein Sicherheitsabstand oberhalb des Mindestwerts gewählt.

Die Matrix umfasst:

| Dimension  | Werte                                            |
| ---------- | ------------------------------------------------ |
| Theme      | Default, Forest                                  |
| Modus      | Light, Dark                                      |
| Variante   | Primary, Secondary, Tertiary, Destructive        |
| Zustand    | Default, Hover, Active, Focus, Disabled, Loading |
| Untergrund | Page, Card, Dialog/Popover                       |

Disabled Controls sind zwar von einzelnen WCAG-Kontrastanforderungen ausgenommen, bleiben aber im Studio erkennbar und lesbar. Deshalb verwenden sie definierte Disabled-Tokens statt pauschaler `opacity-50` auf einer beliebigen Kombination. Loading erhält denselben visuellen Kontrastvertrag wie der aktive Ausgangszustand, verhindert Doppelauslösung und stellt seinen Status semantisch über `aria-busy` bereit.

### Decision: 44 Pixel sind die wirksame Mindestzielgröße

Standard- und Icon-Buttons stellen eine wirksame Interaktionsfläche von mindestens 44 x 44 Pixel bereit. Eine kompakte Größenvariante darf Typografie und sichtbares Padding reduzieren, aber nicht über lokale `h-8 w-8`-Overrides wieder eine kleinere Klick- oder Touchfläche erzeugen. Bestehende Tabellen-, Toolbar- und Inline-Aktionen werden auf solche Overrides geprüft und auf eine kompatible Anordnung migriert.

Reine Icon-Buttons benötigen einen zugänglichen Namen. Ihr Tooltip erscheint sowohl bei Pointer-Hover als auch bei Tastaturfokus und ist über `aria-describedby` zugeordnet, solange er sichtbar ist. Der Tooltip ersetzt den zugänglichen Namen nicht.

### Decision: Ruhige Zustandswechsel ersetzen den Scale-Lift

Der globale Scale-/Shadow-Lift wird entfernt. Hover, Active und Focus werden über Farbe, Fläche, Border beziehungsweise Fokus-Ring erkennbar. Eine kurze Farbtransition darf bestehen bleiben; bei `prefers-reduced-motion: reduce` wird sie deaktiviert. Dadurch bewegen sich benachbarte Controls in dichten Tabellen und Toolbars nicht mehr visuell gegeneinander.

### Decision: `@sva/studio-ui-react` ist alleiniger Owner

`packages/studio-ui-react/src/button.tsx` besitzt Varianten, Größen, Tooltip- und Zustandsverhalten. Die lokale App-Button-Datei wird entfernt. App-interne Dialoge und sonstige Aufrufstellen importieren den Shared-Button beziehungsweise `buttonVariants` aus `@sva/studio-ui-react`. Plugins definieren weiterhin keine eigenen Basisbuttons.

Die Migration wird repositoryweit geprüft. Ein statischer Boundary-Test oder bestehender UI-Boundary-Check wird so erweitert, dass eine erneute parallele Button-Basis in App oder Plugins erkannt wird.

### Decision: Browserbeweis ergänzt Unit- und Token-Tests

Unit-Tests prüfen API, Defaultvariante, Disabled-/Loading-Semantik, Tooltip bei Hover und Fokus sowie `asChild`. Ein gerendertes Test-Harness zeigt alle Varianten und Zustände in allen vier Theme-/Modus-Kombinationen. Die bereits vorhandenen Pakete `axe-core` und `@axe-core/playwright` prüfen die gerenderte Oberfläche; es wird keine neue Dependency eingeführt.

Da Axe nicht jeden simulierten Zustand und nicht alle CSS-Tokenkombinationen allein beweist, liest ein fokussierter Browsertest die berechneten Vordergrund-, Hintergrund-, Border- und Fokusfarben nach Hover, Active und Fokus aus und verifiziert die normativen Kontrastschwellen. Visuelle Screenshots ergänzen die Regressionserkennung, sind aber kein Ersatz für numerische oder semantische Assertions.

## Alternatives considered

### Nur `text-secondary-foreground` einsetzen

Diese Variante würde den akutesten Kontrastfehler beheben, ließe aber untergrundabhängige Alpha-Zustände, Forest-Dark, die doppelte Komponenten-Ownership, kleinere Icon-Ziele und fehlende Zustandsprüfungen bestehen. Sie erfüllt deshalb nicht das Ziel einer dauerhaften Überarbeitung.

### Bestehende Variantennamen behalten

`default`, `ghost` und `outline` sind etablierte shadcn-Darstellungsnamen, bilden aber die im Studio dokumentierte Aktionshierarchie nicht eindeutig ab. Dauerhafte Aliasnamen würden Ownership und Reviewaufwand erhöhen. Die kontrollierte interne Migration ist trotz des größeren Diffs langfristig klarer.

### Externe Komponentenbibliothek vollständig übernehmen

Eine KERN- oder andere Komponentenbibliothek könnte einzelne Accessibility-Entscheidungen mitbringen, würde aber eine zweite UI-Laufzeit, Migrationsrisiko und zusätzliche Ownership erzeugen. Die bestehende shadcn-/Radix-Basis deckt Semantik und Interaktion ab; das Problem liegt primär in Tokens, Zustandsvertrag und Konsolidierung.

## Risks / Trade-offs

- Die Umbenennung betrifft viele Aufrufstellen. Die Migration wird mechanisch begonnen, anschließend aber fachlich geprüft, weil `outline` nicht automatisch immer `secondary` bedeutet.
- Eine Mindestzielgröße von 44 Pixel kann dichte Tabellen und Toolbars verbreitern. Betroffene Layouts werden responsiv angepasst, statt die Zielgröße lokal wieder zu unterschreiten.
- Action-spezifische Tokens vergrößern den Token-Satz. Dafür verhindern sie unerwünschte Kopplung zwischen Buttons, Sidebar, Badges und allgemeinen Accent-Flächen.
- Ein Browser-Harness verursacht zusätzlichen Testaufwand. Er ist erforderlich, weil reine Quelltext- oder jsdom-Tests berechnete CSS-Kontraste nicht belastbar beweisen.
- Exakte Farbwerte können gegenüber dem bisherigen Erscheinungsbild sichtbar abweichen. Die Themenidentität und Hierarchie bleiben erhalten; normative Kontraste haben Vorrang.

## Migration Plan

1. Die vollständige Theme-/Modus-/Zustandsmatrix mit geprüften Action-Tokenwerten festlegen.
2. Action-Tokens zentral in der Studio-Theme-Foundation ergänzen und bestehende allgemeine Tokenverbraucher gegen unbeabsichtigte Änderungen prüfen.
3. Die Shared-Button-API auf `primary`, `secondary`, `tertiary` und `destructive` umstellen; Größen, Fokus, Disabled, Loading, Tooltip und Motion vereinheitlichen.
4. Host- und Plugin-Aufrufstellen fachlich migrieren; lokale Größen- und Farbübersteuerungen auditieren.
5. Die lokale App-Button-Basis entfernen und App-Dialoge auf `@sva/studio-ui-react` umstellen.
6. Unit-, Boundary-, Browser-, Axe-, Kontrast- und visuelle Regressionstests ergänzen.
7. Theme-, UI-Standard- und arc42-Dokumentation aktualisieren.
8. Fokussierte Unit-/Type-/Lint-/Browser-Gates und anschließend den relevanten PR-Gate-Pfad ausführen.

Ein Rollback besteht aus der gemeinsamen Rücknahme von Token-, API- und Aufrufstellenmigration. Legacy-Aliase werden nicht als dauerhafter Rollbackpfad im Produkt belassen.

## Open Questions

- Keine. Die fachliche Hierarchie, zentrale Ownership, 44-Pixel-Zielgröße, Theme-Matrix und normativen Prüfschwellen sind für die Umsetzung festgelegt.
