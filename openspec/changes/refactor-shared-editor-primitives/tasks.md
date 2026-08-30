## 1. Baseline reconciliieren und Abbau messbar machen

- [x] 1.1 Den bereits gelieferten Stand von `StudioDetailCard`,
      `StudioPagination`, `StudioDetailTabs`, Formular-Bridge, Save-Feedback,
      Media-Picker und `saveContentWithHostMediaReferences` dokumentieren und aus
      der Umsetzungsplanung entfernen
- [x] 1.2 Die vier Ziel-Clone-Familien mit Dateien, Funktionen, Consumern,
      produktiven Zeilen und aktuellen Fallow-Fingerprints in
      `docs/development/studio-form-migrationsinventur.md` erfassen
- [x] 1.3 Für jeden Slice eine Löschbilanz mit produktiven Additionen,
      Löschungen, entfernten Dateien/Exporten und verbliebenen Consumern anlegen;
      Tests und Dokumentation separat ausweisen
- [x] 1.4 Die Package-Ownership festhalten: frameworkfreie Clientverträge nach
      `plugin-sdk`, React-Orchestrierung nach `studio-ui-react`, Fachlogik in den
      Plugins; die einzige neue Richtung ist
      `@sva/studio-ui-react` → `@sva/plugin-sdk/content-media`
- [x] 1.5 Relevante arc42-Abschnitte `05`, `08`, `09`, `10` und `11` für die
      spätere Aktualisierung vormerken

## 2. Frameworkfreie Pagination- und Geocoding-Duplikate entfernen

- [x] 2.1 Characterization-Tests für erlaubte Seitengrößen, Defaultwert,
      positive Seiten und maximalen Offset aus den fünf vorhandenen
      `list-pagination`-Tests konsolidieren
- [x] 2.2 Genau einen List-Search-Normalisierer in `plugin-sdk` implementieren,
      Events, Generic Items, POI und Projects darauf umstellen und die ungenutzte
      identische News-Kopie entfernen
- [x] 2.3 Alle fünf pluginlokalen `list-pagination.ts`-Implementierungen und
      redundanten Tests/Exporte im selben Block löschen
- [x] 2.4 Config-Deduplizierung und erneuten Read nach Fehler für den
      Map-/Geocoding-Client in `plugin-sdk` charakterisieren und zentralisieren
- [x] 2.5 Events, Generic Items und POI direkt auf den zentralen Clientvertrag
      umstellen und die drei pluginlokalen Cache-/Weiterleitungsimplementierungen
      löschen
- [x] 2.6 `pnpm nx run plugin-sdk:test:unit` und die fokussierten Listen-/Client-
      Tests der vier realen Consumer grün ausführen
- [x] 2.7 Löschbilanz und Fallow-Diff für Slice 2 prüfen; bei positiver
      produktiver Netto-LOC-Bilanz STOP und Vertrag verkleinern

## 3. Location-Map-Lifecycle für drei reale Consumer konsolidieren

- [x] 3.1 Events- und Generic-Items-Tests für Initialisierung, Default-
      Viewport, Marker, Click, Drag, Fehler und Cleanup als Characterization-
      Baseline festziehen
- [x] 3.2 Einen minimalen strukturellen Map-Runtime-Vertrag und gemeinsamen
      React-Hook in `studio-ui-react` implementieren, ohne neue Map-Dependency und
      ohne Providerlogik
- [x] 3.3 Events und Generic Items auf den gemeinsamen Hook umstellen und ihre
      ersetzten Hook-/Effects-/Shared-Dateien löschen
- [x] 3.4 POI auf denselben bestätigten Vertrag umstellen und seine ersetzten
      Hook-/Effects-/Shared-Dateien löschen
- [x] 3.5 Runtime-Loader nur bei nachgewiesener Gleichheit konsolidieren;
      andernfalls die fachlich begründeten Loader ausdrücklich als verbleibenden
      Unterschied dokumentieren
- [x] 3.6 `studio-ui-react`-Map-Tests sowie die fokussierten Events-, Generic-
      Items- und POI-Map-Tests grün ausführen
- [x] 3.7 Löschbilanz und Fallow-Diff für Slice 3 prüfen; keine parallelen
      Map-Lifecycle-Wrapper dürfen verbleiben

## 4. Media-Picker-Konfiguration aus vier Editoren entfernen

- [x] 4.1 Bestehende Labelstruktur, technischen Fehlercode und Phasenfeedback
      aus Events und Generic Items als Referenz charakterisieren
- [x] 4.2 Gemeinsame Label- und Feedback-Helfer in `studio-ui-react` gegen den
      vorhandenen `StudioMediaPickerOverlay`-Vertrag implementieren
- [x] 4.3 Events und Generic Items migrieren und lokale
      `create*MediaPickerLabels`-/`resolve*MediaPickerFeedback`-Funktionen löschen
- [x] 4.4 News und POI migrieren und ihre entsprechenden lokalen Funktionen
      löschen; abweichende fachliche Texte bleiben über kleine explizite Inputs
      lokal steuerbar
- [x] 4.5 Gemeinsame UI-Tests und fokussierte Tests aller vier Plugins grün
      ausführen
- [x] 4.6 Löschbilanz und Fallow-Diff für Slice 4 prüfen; eine neue generische
      Optionsmatrix ohne reale Consumer ist nicht zulässig

## 5. Media-Save- und Reference-Retry-Orchestrierung vollständig migrieren

- [x] 5.1 Zustandsübergänge für normalen Save, vollständigen Erfolg,
      partiellen Referenzfehler, erfolgreichen/fehlgeschlagenen Reference-Retry und
      Create-Navigation in Events und Generic Items charakterisieren
- [x] 5.2 Einen schmalen öffentlichen Subpath
      `@sva/plugin-sdk/content-media` für die bereits vorhandenen kanonischen
      Content-Media-Save-, Phasen- und Reference-Sync-Verträge bereitstellen, ohne
      React- oder UI-Abhängigkeit im SDK
- [x] 5.3 Die Nx-Boundary gezielt für die einseitige Abhängigkeit
      `scope:studio-ui-react` → `scope:plugin-sdk` erweitern und einen kleinen
      Media-Save-/Reference-Retry-Controller in `studio-ui-react` implementieren;
      `@sva/plugin-sdk` wird dabei mit `workspace:*` als Dependency deklariert und
      ein gezielter Import-Guard verbietet dem UI-Package den SDK-Root sowie andere
      SDK-Subpaths;
      der Controller verwendet die öffentlichen SDK-Vertragstypen, erhält
      Persistenzoperationen aber als Callbacks und besitzt weder Host-I/O noch
      Payload, Mutation, Texte oder Navigation
- [x] 5.4 Events und Generic Items vollständig migrieren; lokale
      `retryReferenceSync`-Zustände, wiederholte `referenceStatus`-Abbildung und
      Inline-Retry-Aktionen entfernen
- [x] 5.5 POI und News migrieren; POI-Deviation-Verhalten und News-Navigation
      nach bereits angelegtem Inhalt unverändert über explizite Callbacks erhalten
- [x] 5.6 Projects und Cockpit Cards migrieren und die entsprechenden lokalen
      Retry-/Statusblöcke entfernen
- [x] 5.7 Negative Regressionstests ergänzen: Reference-Retry wiederholt keine
      Content-Mutation, fehlgeschlagener Retry bleibt sichtbar, normaler erneuter
      Submit läuft weiterhin durch RHF/Zod und bestehende Idempotenzverträge
- [x] 5.8 Gemeinsame Controller-Tests und fokussierte Tests aller sechs Plugins
      grün ausführen
- [x] 5.9 Löschbilanz und Fallow-Diff für Slice 5 prüfen; kein benannter
      Consumer und kein dauerhafter Kompatibilitätswrapper darf verbleiben

## 6. Gesamtbilanz, Architektur und Abschlussnachweise

- [x] 6.1 Mit `git diff --numstat` die produktive Gesamtbilanz für
      `plugin-sdk`, `studio-ui-react` und die sechs Plugins ausweisen; hinzugefügte
      produktive Zeilen dürfen entfernte produktive Zeilen nicht übersteigen
- [x] 6.2 Fallow Production-Duplication erneut ausführen und nachweisen, dass
      die erfassten Clone-Familien sowie gleichwertige neue Kopien im Zielscope
      verschwunden sind
- [x] 6.3 Mit `rg` nach den gelöschten lokalen Helpernamen, Dateien,
      `retryReferenceSync`-Inline-Blöcken und verbliebenen Parallelpfaden suchen;
      jeder Treffer muss fachlich begründet oder entfernt sein
- [x] 6.4 Relevante Dokumentation und arc42 `05`, `08`, `09`, `10` und `11`
      auf den tatsächlichen gemeinsamen Vertrag, die einseitige
      `studio-ui-react`-zu-`plugin-sdk`-Abhängigkeit und die Löschbilanz
      aktualisieren; insbesondere die aktiven Package-Boundaries unter
      `docs/reference/monorepo.md` fortschreiben
- [x] 6.5 `pnpm nx run-many -t test:unit -p plugin-sdk,studio-ui-react,plugin-events,plugin-generic-items,plugin-news,plugin-poi,plugin-projects,plugin-cockpit-cards`
      erfolgreich ausführen
- [x] 6.6 `pnpm nx run-many -t test:types -p plugin-sdk,studio-ui-react,plugin-events,plugin-generic-items,plugin-news,plugin-poi,plugin-projects,plugin-cockpit-cards`
      und die betroffenen Lint-Targets erfolgreich ausführen
- [x] 6.7 `pnpm check:plugin-ui-boundary`,
      `pnpm check:plugin-architecture-boundary`, `pnpm check:boundaries:fallow`
      und `pnpm check:file-placement` erfolgreich ausführen
- [x] 6.8 `pnpm exec openspec validate refactor-shared-editor-primitives --strict`
      und `git diff --check` erfolgreich ausführen
- [x] 6.9 Den Change nur abschließen, wenn alle ersetzten lokalen
      Implementierungen gelöscht, alle benannten Consumer migriert und die
      produktive Netto-LOC-Bilanz höchstens null ist
