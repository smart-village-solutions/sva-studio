## 1. Navigationsmodell

- [x] 1.1 Kleine typsichere Helfer für Content-Unterpunkte, Search-Parameter und aktive Zustände ergänzen.
- [x] 1.2 `Inhalte` als berechtigungsabhängige Sidebar-Gruppe mit `Alle` und lesbaren registrierten Inhaltstypen umsetzen.
- [x] 1.3 Desktop-, Collapse- und Mobile-Verhalten sowie aktive Create-/Detailpfade mit Unit-Tests absichern.

## 2. Tabellenfilter

- [x] 2.1 Schnellfilter für `Alle`, Nachrichten und Veranstaltungen in der gemeinsamen Content-Tabelle ergänzen.
- [x] 2.2 Das Typ-Dropdown auf die übrigen lesbaren Typen begrenzen und seinen neutralen beziehungsweise ausgewählten Zustand zugänglich abbilden.
- [x] 2.3 Erhalt von Status, Sortierung und Seitengröße sowie den Reset auf Seite 1 mit fokussierten Route-/Komponententests absichern.

## 3. Texte und Dokumentation

- [x] 3.1 Deutsche und englische i18n-Ressourcen für Gruppennavigation und Schnellfilter ergänzen oder wiederverwenden.
- [x] 3.2 Die betroffenen arc42-Abschnitte `05-building-block-view`, `06-runtime-view` und `08-cross-cutting-concepts` auf den neuen Navigations- und Filtervertrag aktualisieren.
- [x] 3.3 Bei PR-Erstellung einen Changelog-Eintrag unter der tatsächlichen PR-Nummer für die sichtbare Änderung ergänzen.

## 4. Validierung

- [x] 4.1 Nach jedem Änderungsblock die fokussierten Sidebar- und Content-Listen-Unit-Tests ausführen.
- [x] 4.2 Den betroffenen Type-Test-Pfad und ESLint ausführen.
- [x] 4.3 Den affected Unit-Scope gegen `origin/main` messen und den kleinsten relevanten finalen Gate-Pfad ausführen.
- [x] 4.4 `pnpm check:file-placement`, OpenSpec Strict Validation und Diff-Checks ausführen.
