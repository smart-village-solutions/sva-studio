## 1. Baseline und Characterization festziehen

- [x] 1.1 Den Events-Flow in
      `docs/development/studio-form-migrationsinventur.md` ergänzen und als
      interne Section-Zerlegung bei unverändertem `useForm`-Owner,
      Resolverstatus, `validateEventForm`, Submit und HTTP-Vertrag einordnen
- [x] 1.2 Dokumentieren, dass für diesen UI-Strukturrefactor weder neue
      HTTP-nahe Tests noch kritische framework-agnostische Kernlogik entstehen
      und deshalb keine MSW- oder fast-check-Migration Teil des Scopes ist
- [x] 1.3 Auf aktuellem `origin/main` Dateizeilen, produktiven Zielscope und
      Fallow-Werte für `EventsDetailContentTab` sowie seine kritischen
      Inline-Callbacks maschinenlesbar erfassen
- [x] 1.4 Bestehende Content-Tab-Tests den acht Editorbereichen und ihren
      Feld-Array-Operationen zuordnen; nur echte Lücken für leere Defaults,
      Hinzufügen, Entfernen, Reihenfolge und bedingte Felder ergänzen
- [x] 1.5 Den fokussierten Test
      `pnpm nx run plugin-events:test:unit --testFiles=tests/events.detail-content-tab.test.tsx`
      grün ausführen; bei rotem Stand keine Extraktion beginnen

## 2. Kleine und zustandsarme Sections ersetzen

- [x] 2.1 Beschreibung und Medien in ein pluginlokales fachliches
      Section-Modul verschieben; RHF-Watch, Medienabbildung und bestehende
      Capability-Props dort besitzen
- [x] 2.2 Kontakte und Links in ein pluginlokales fachliches Section-Modul
      verschieben; ihre Field-Arrays, Defaults und Callbacks dort besitzen
- [x] 2.3 Preise in ein pluginlokales Section-Modul verschieben; Field-Array,
      Default und numerische Eingabeabbildung dort besitzen
- [x] 2.4 Nach jedem Block den ersetzten Inline-Code vollständig löschen und
      den fokussierten Content-Tab-Test grün ausführen
- [x] 2.5 Produktive Netto-LOC und Fallow-Werte prüfen; bei positiver Bilanz
      STOP und Datei-/Prop-/Wrapper-Overhead reduzieren

## 3. Termine und Ortsdaten fachlich zerlegen

- [x] 3.1 Terminbereich einschließlich Datumseingaben, Zeitfeldern,
      Beschreibungsmodus und Field-Array-Operationen in ein eigenes
      pluginlokales Modul verschieben
- [x] 3.2 Den bestehenden Map-/Geocoding-Config-Effekt in einen kleinen
      pluginlokalen Capability-Hook verschieben, ohne SDK-Client oder
      Location-Map-Lifecycle zu duplizieren
- [x] 3.3 Adress- und Veranstalterbereich gemeinsam fachlich gruppieren und
      ihre RHF-Watches, Field-Array-Operationen, Geo-Fehlerpfade und Defaults
      dort besitzen
- [x] 3.4 Die ersetzten Inline-Callbacks und den alten Config-Effekt im selben
      Block vollständig löschen; keine Wrapper oder alternative Renderpfade
      behalten
- [x] 3.5 Fokussierte Content-Tab- und Map-Tests grün ausführen
- [x] 3.6 Produktive Netto-LOC und Fallow-Werte prüfen; kein neuer kritischer
      Section-Hotspot ist zulässig

## 4. Root-Komponente und Vertragsgrenzen abschließen

- [ ] 4.1 `EventsDetailContentTab` auf äußere Props, einmalige gemeinsame
      Capability-Ableitungen und die explizite Section-Komposition reduzieren
- [ ] 4.2 Mit `rg` nach den alten Inline-Blöcken, duplizierten Field-Array-
      Ownern, Config-Effekten und parallelen Content-Tab-Pfaden suchen und alle
      unbegründeten Treffer entfernen
- [ ] 4.3 Sicherstellen, dass keine neuen öffentlichen Exporte, Dependencies,
      Suppressionen, Grenzwerte oder Shared-Primitives hinzugekommen sind
- [ ] 4.4 `EventsDetailContentTab` auf höchstens 20 zyklomatische, 15 kognitive
      und 250 Funktionszeilen reduzieren; keine neue Section darf kritisch sein
- [ ] 4.5 Die produktive Gesamtbilanz gegen `origin/main` ausweisen; Additionen
      dürfen Löschungen nicht übersteigen

## 5. Dokumentation und Gates

- [ ] 5.1 `docs/development/studio-form-migrationsinventur.md` um den
      plugininternen Events-Schnitt, die führenden Owner und die Löschbilanz
      ergänzen
- [ ] 5.2 arc42 `10-quality-requirements` und
      `11-risks-and-technical-debt` auf den tatsächlichen Abschlussnachweis
      aktualisieren
- [ ] 5.3 `pnpm nx run plugin-events:test:unit` und
      `pnpm nx run plugin-events:test:types` erfolgreich ausführen
- [ ] 5.4 Den verfügbaren betroffenen Lint-Target sowie
      `pnpm check:plugin-ui-boundary`,
      `pnpm check:plugin-architecture-boundary` und
      `pnpm check:file-placement` erfolgreich ausführen
- [ ] 5.5 Fallow Health für `@sva/plugin-events` und den New-only-Audit gegen
      `origin/main` ausführen; keine neue kritische Komplexität, Duplikation,
      Dead-Code- oder Boundary-Schuld akzeptieren
- [ ] 5.6 `pnpm exec openspec validate refactor-events-detail-content-tab --strict`
      und `git diff --check` erfolgreich ausführen
- [ ] 5.7 Den Change nur abschließen, wenn alter Inline-Code vollständig
      entfernt, produktive Netto-LOC höchstens null und alle Success Criteria
      nachweislich erfüllt sind
