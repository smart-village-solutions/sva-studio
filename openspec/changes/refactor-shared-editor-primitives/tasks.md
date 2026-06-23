## 1. Scope und Referenzen festziehen

- [ ] 1.1 Bestehende Section-, Repeater- und Formularmuster in `plugin-poi`, `plugin-news` und `studio-ui-react` systematisch inventarisieren
- [ ] 1.2 Pro Extraktionskandidat festhalten, ob er nach `studio-ui-react` wandert oder bewusst pluginlokal bleibt
- [ ] 1.3 Betroffene arc42-Abschnitte `05`, `08`, `09`, `10` und `11` für die spätere Doku-Aktualisierung vormerken

## 2. Gemeinsame UI-Primitives in `studio-ui-react` einführen

- [ ] 2.1 Gemeinsame Detail-Section-Card in `packages/studio-ui-react` implementieren
- [ ] 2.2 Kleine RHF-kompatible Repeater-/List-Section-Primitives für strukturierte Mehrfacheinträge entwerfen und implementieren
- [ ] 2.3 Falls fachlich stabil, gemeinsame Formularhilfen für wiederkehrende Titel-/Beschreibung-/Fehlerflächen ergänzen
- [ ] 2.4 Neue `studio-ui-react`-Primitives direkt mit Unit-Tests absichern

## 3. Referenzeditoren auf die neuen Primitives umstellen

- [ ] 3.1 `plugin-poi` von lokalen Section-/Repeater-Bausteinen auf `studio-ui-react` umstellen
- [ ] 3.2 Einen zweiten Referenzeditor, bevorzugt `plugin-news`, ebenfalls auf die neuen Primitives umstellen
- [ ] 3.3 Verbleibende pluginlokale Helfer auf echte Fachlogik reduzieren
- [ ] 3.4 Angepasste Plugin-Tests grün ziehen

## 4. Qualitäts- und Abschlussnachweise

- [ ] 4.1 Relevante `studio-ui-react`-, `plugin-poi`- und `plugin-news`-Unit-Tests ausführen
- [ ] 4.2 Bei öffentlichen Typpfaden `pnpm nx affected --target=test:types --base=origin/main` ausführen
- [ ] 4.3 Relevante Doku unter `docs/` und betroffene arc42-Abschnitte aktualisieren
- [ ] 4.4 `openspec validate refactor-shared-editor-primitives --strict` erfolgreich ausführen
