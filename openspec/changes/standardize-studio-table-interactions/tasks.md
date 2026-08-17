## 1. Gemeinsame Tabelleninteraktionen

- [x] 1.1 `StudioTableActionButton`, `StudioTableValueAction` und `StudioStatusBadge` in `@sva/studio-ui-react` implementieren und exportieren.
- [x] 1.2 Link-/Button-Semantik, semantische Farben, Hover/Fokus, destruktive Tonalität, tabellarische Zahlen und 44-Pixel-Zielgröße mit fokussierten Unit-Tests absichern.
- [x] 1.3 Tabellen-Tooltips außerhalb abschneidender Overflow-Container rendern, Viewport-Kollisionen berücksichtigen und Hover sowie Tastaturfokus testen.
- [x] 1.4 Für nicht selbsterklärende Aktionen eine sichtbare mobile Beschriftung unterstützen und die responsive Darstellung im `StudioDataTable`-Kartenlayout testen.
- [x] 1.5 Änderbare Status-Badges mit sichtbarer Bearbeitungsaffordance sowie Dialog-Loading-, Erfolgs- und Fehlerverhalten absichern.
- [x] 1.6 Nach dem Shared-UI-Block den fokussierten Unit- und Type-Test des Projekts ausführen und bei rotem Stand nicht mit den Tabellenmigrationen fortfahren.

## 2. Waste-Tourenliste migrieren

- [x] 2.1 Tourname, Fraktionen, Verschiebungen und Abholortanzahl auf das gemeinsame Informationsmuster umstellen; bestehende Navigation und Create-/Edit-Verzweigungen beibehalten.
- [x] 2.2 Tourstatus als beschriftetes Status-Badge mit zugänglichem Dialog-Trigger, Bestätigung, Disabled-/Loading-Zustand und unveränderter Mutation umsetzen.
- [x] 2.3 Die redundante Bearbeiten-Aktion nach Verlinkung des Tournamens entfernen und Kalender-, Duplizieren- und Löschen-Aktion auf den gemeinsamen Icon-Aktionsbutton umstellen.
- [x] 2.4 Alle Tabellen-Body-Zellen bei einheitlichem vertikalem Padding oben ausrichten und Controls nur innerhalb ihrer eigenen Trefferfläche zentrieren.
- [x] 2.5 Nach jedem abgeschlossenen Migrationsblock die unmittelbar betroffenen Touren- und Accessibility-Tests ausführen und bei rotem Stand nicht fortfahren.

## 3. Zentrale Inhaltstabelle migrieren

- [x] 3.1 Den Inhaltstitel abhängig von bestehender Leseberechtigung als primäre anklickbare Information zum vorhandenen `editPath` oder als reinen Text rendern.
- [x] 3.2 Die redundante Öffnen-/Bearbeiten-Icon-Aktion entfernen und Löschen auf die gemeinsame destruktive Icon-Aktion mit unveränderter Berechtigungs- und Bestätigungslogik umstellen.
- [x] 3.3 `ContentStatusDialog` auf das gemeinsame Status-Badge umstellen und Principal-, Berechtigungs-, Loading-, Erfolgs- und Fehlerverhalten beibehalten beziehungsweise absichern.
- [x] 3.4 Desktop-Tabelle und mobile Kartenansicht einschließlich sichtbarer mobiler Aktionsbeschriftung mit fokussierten Content-List-Tests absichern.
- [x] 3.5 Nach dem Content-Block die unmittelbar betroffenen Content-Unit- und Type-Tests ausführen und bei rotem Stand nicht fortfahren.

## 4. Ausrichtung, Tests und Dokumentation

- [x] 4.1 Bekannte `align-middle`-Overrides in `StudioDataTable`-Verbrauchern entfernen und die Top-Ausrichtung gegen erneute lokale Abweichungen absichern.
- [x] 4.2 Regressionstests für die visuelle Semantik von Text, Link/Button, Status-Badge, Overlay, Tooltips und durchgängiger Top-Ausrichtung ergänzen.
- [x] 4.3 Deutsche und englische Übersetzungen für neue zugängliche Namen, Statuswerte, mobile Aktionsbeschriftungen und Dialogtexte ergänzen beziehungsweise wiederverwenden.
- [x] 4.4 `docs/development/studio-uebersichts-und-detailseiten-standard.md` um die drei Tabellenmuster, mobile Darstellung und die Ausrichtungsregel ergänzen.
- [x] 4.5 Fokussierte Unit-, Type- und Lint-Gates für `studio-ui-react`, `plugin-waste-management` und `sva-studio-react` sowie `git diff --check` ausführen.
- [x] 4.6 Den affected Unit-Scope gegen `origin/main` messen und nur den gemäß `DEVELOPMENT_RULES.md` relevanten abschließenden Gate-Pfad ausführen.
