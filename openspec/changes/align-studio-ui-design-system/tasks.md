# Tasks: Iterative Studio-UI-Migration

Der Nutzer hat den ersten Code-Lieferabschnitt mit „Setze das um“ freigegeben.
Baseline, Foundations, Shell und News wurden lokal umgesetzt und geprüft;
die restlichen Plugins sind im freigegebenen Folgeabschnitt bearbeitet.
Technische Ergebnisse stehen im Design, Abschnitte 7 und 9. Manuelle und fachliche Abnahmen sind gesondert ausgewiesen.
Die referenzierte Ausgangslage steht im
[Design](./design.md); Aufgabenhaken sind keine Produktabnahme.

## 0. Planungsunterlagen

- [x] 0.1 Dedizierten Worktree und Planungsbranch am vereinbarten Commit anlegen.
- [x] 0.2 Bestehende UI-/Formular-/Package-Verträge und laufende Changes prüfen;
      Gesamtinventur mit klar getrenntem Detail- und Vorsortierungsstand erstellen.
- [x] 0.3 Figma-Referenzen, Token-Brücke und Funktionsbestand für Shell/News
      dokumentieren; fehlenden unveränderlichen Figma-Snapshot offenlegen.
- [x] 0.4 Iterationen, Ownership, additive Tab-Option, Altpfadentfernung,
      Designlücken, Nachweise und Stoppbedingungen konkretisieren.
- [x] 0.5 Spec-Delta für `ui-layout-shell` erstellen; bestehende Szenarien
      erhalten und die neuen Erhaltungs-/Responsive-Verträge ergänzen.
- [x] 0.6 OpenSpec-Validierung, Dateiplatzierung, Dokumentationsprüfung und
      interne Links erfolgreich prüfen; ausschließlich vier Planungsdateien als
      Änderung bestätigen.

Planungsnachweis vom 1. November 2026: strikte OpenSpec-Validierung,
Repository-Dateiplatzierung, zusätzliche Platzierungsprüfung der vier neuen
Dateien, Dokumentationsprüfung und interne Links bestanden. Die Prüfungen
nutzten das vorhandene `openspec` und die bestehende `tsx`-Installation des
Hauptcheckouts. Architektur-/Dokumentations- und UX-/Test-Review führten zu
Präzisierungen bei Legacy-Sidebarpräferenzen, Fokusaktivierung und einzeln
gefilterten Unit-Testdateien. Produktcode und Produkt-Tests blieben unverändert.
Zum Abschluss des reinen Planungsabschnitts standen Unit-, Browser- und
fachliche Abnahmen aus; der aktuelle Nachweis steht in Design, Abschnitt 7.

## 1. Iteration 0 — Implementierungsbaseline

- [x] 1.1 Konkreten ersten Code-Lieferabschnitt freigeben und Ziel, Nicht-Ziele,
      betroffene Bereiche sowie aktuellen Code-/Figma-Stand festhalten.
- [x] 1.2 Referenzsuche gemäß `AGENTS.md` ausführen; betroffene direkte
      Verbraucher und Überschneidungen mit laufenden Changes prüfen.
- [x] 1.3 Funktionsbestand aus dem Design mit vorhandenen Tests verknüpfen;
      echte Lücken vor dem Umbau durch gezielte Charakterisierung absichern.
- [x] 1.4 Im bestehenden Playwright-Pfad reproduzierbare Vorher-Aufnahmen für
      Shell, Contentliste und News-Create/-Edit ergänzen; Daten, Locale, Theme,
      Viewport und Ladezustand deterministisch halten.
- [x] 1.5 Baseline gezielt grün nachweisen; Vorher-Referenzen sichtbar prüfen.

## 2. Iteration 1 — Tokens und gemeinsame Controls

- [x] 2.1 Semantische Figma-Rollen auf vorhandene Tokens abbilden; abweichende
      Rollen nicht unbemerkt zusammenlegen. Forest-Farbidentität erhalten.
- [x] 2.2 Typografie/Geometrie, Buttons, Eingaben/Auswahl, Labels/Fehler und
      Status/Dialoge familienweise anpassen; nach jedem Block gezielt prüfen.
- [x] 2.3 App-lokale und gemeinsame Controls auf abweichende Wirkung prüfen;
      ersetzte Implementierungen und alle zugehörigen Restimporte entfernen.
- [x] 2.4 Focus/Disabled/Loading/Invalid, numerische Kontraste und vier
      Theme-/Moduskombinationen nachweisen; keine unbesehene Snapshotaktualisierung.
- [x] 2.5 Betroffene Token-/Theming-Dokumentation einschließlich veralteter
      HSL-Angaben im bestehenden Pfad korrigieren; Oberfläche bilanzieren.

## 3. Iteration 2 — Shell

- [x] 3.1 Header, Sidebar, Breadcrumbs, Seitenköpfe und Aktionsleisten migrieren;
      Drawer/Rail/Sidebar gemäß Zielbreiten prüfen. Gültige Legacywerte `0`/`1`
      erhalten; Defaults und Viewportwechsel schreiben keine neue Präferenz.
- [x] 3.2 Inhaltsbreitenabhängige Header, Umbruch und lokale Scrollregionen
      umsetzen; keine globale Umstellung kompakter Tabellen auf Tourenlayout.
- [x] 3.3 Icons gemäß Figma/Lucide zuordnen; Account, Organisation, Sprache,
      Theme, Navigation, Hilfe und sämtliche bestehenden Systemzustände erhalten.
- [x] 3.4 Header-/Sidebar-/AppShell-Tests, Fokus-/Tastaturwege, Grenzen und
      visuelle Soll-Aufnahmen prüfen; betroffene direkte Verbraucher kontrollieren.

## 4. Iteration 3 — Nachrichten-Pilot

- [x] 4.1 News und Events als reale Nutzungsmuster für Tab-Vorladung und
      Panelerhalt vergleichen; geplante additive Schnittstelle bestätigen.
- [x] 4.2 `preloadOnIntent?: boolean = false` im vorhandenen Shared-Tab-Pfad
      ergänzen und unmittelbar Default/Disabled/Hidden/Idempotenz testen; Hover
      aktiviert nicht, bestehende automatische Fokusaktivierung bleibt erhalten.
- [x] 4.3 News auf kontrollierte `StudioDetailTabs` mit `keepMounted` und
      Intent-Vorladung migrieren; lokale Visit-/Warm-Darstellung und überflüssige
      Props/Icons entfernen, fachliche Dirty-Ermittlung erhalten.
- [x] 4.4 Card-Reexport durch direkte Shared-Nutzung ersetzen und löschen;
      FormProvider/Formular-/Portal-/Submit-Komposition prüfen.
- [x] 4.5 Felder, Principal, Kategorien, WYSIWYG/HTML, Medien, Veröffentlichung,
      Push/Zielgebiete, Historie, Fehlermeldungen und Navigation vollständig mit
      dem Funktionsbestand abgleichen.
- [x] 4.6 API-/Payload-/Ressourcenrechte unverändert nachweisen; partieller
      Medienreferenzfehler und Reference-Retry senden keine zweite Inhaltsmutation.
- [x] 4.7 Gezielte Shared-/News-/Host-Tests, Typen, Lint, E2E, automatisierte Accessibility und
      visuelle Vergleiche bestehen; neue und entfernte Pfade dokumentieren.

## 5. Weitere Iterationen — jeweils vor Beginn konkretisieren

- [x] 5.1 Events, POI und Projects am aktuellen Stand inventarisieren,
      migrieren und gezielt technisch prüfen; Produktabnahme bleibt 6.5.
- [x] 5.2 Generic Items, FAQ und Kacheln bearbeiten; bereits zentrale Bausteine
      übernehmen und nur belegte Restabweichungen entfernen.
- [x] 5.3 Surveys und Vouchers einschließlich ihrer fachlichen Sonderzustände
      bearbeiten und in bestehenden Tests prüfen.
- [x] 5.4 Waste-Listen und Tourentabelle bearbeiten; danach Kalender,
      Stammdaten und Importoberflächen in eigenständig prüfbaren Slices migrieren.
- [x] 5.5 Kategorien, SSF und Katalog sowie die übrigen registrierten Plugins
      abgleichen; vorhandene zentrale Bausteine übernehmen und Restabweichungen
      anpassen. Disabled-Headerbeiträge und externe Links erhalten.
- [ ] 5.6 Übrige Host-/Admin-/Konto-/Medienoberflächen gesondert bearbeiten;
      die gemeinsamen Grundlagen und repräsentative Bereiche werden im
      freigegebenen Folgeabschnitt 8 bearbeitet; der vollständige Element- und
      Zustandsabgleich bleibt als eigener Abschluss offen.

## 6. Wiederkehrender Slice-Abschluss

- [x] 6.1 Pro abgeschlossenem Slice Funktionserhalt, Designvergleich,
      direkte Verbraucher, Tests und entfernte Altpfade dokumentieren.
- [x] 6.2 Designlücken samt Übergang und Entscheidung fortschreiben; technische,
      visuelle und fachliche Abnahme unterscheiden.
- [x] 6.3 Aktuelle UI-Standards und betroffene arc42-Abschnitte aktualisieren;
      keine zweite allgemeine Komponentenrichtlinie anlegen.
- [ ] 6.4 Vor jedem Merge die erforderlichen Nachweise am exakten HEAD prüfen;
      Bereitstellungen nur bei gesondertem Auftrag über den kanonischen Prozess.

- [ ] 6.5 Vollständige manuelle Barrierefreiheits- und fachliche Produktabnahme
      durchführen: Screenreader, Forced Colors, Zoom/Textabstände, geringe Höhe
      und lange deutsche/englische Inhalte; L7 und Produktfreigabe offen halten.

## 7. Freigegebener Folgeabschnitt — News-Speicherergebnisse und Wiederaufnahme

- [x] 7.1 Geschützten Statusread und konservative Ergebniszuordnung am vorhandenen
      Mutationsjournal ergänzen; Scope-/Berechtigungsnegativfälle und rein lesendes Verhalten prüfen.
- [x] 7.2 SDK erhält stabile Versuchskorrelation und konservative Ergebnis-
      klassifikation; unbekannte Medienergebnisse behalten Uploadzuordnungen.
- [x] 7.3 News sperrt parallele/neue Saves bei unbekanntem Ausgang und prüft
      explizit den gespeicherten Status; keine zweite Contentmutation bei Recovery.
- [x] 7.4 Geänderte Form-/Medienrevisionen und aktueller Benutzer-/Organisations-
      kontext bleiben bei Prüfung/Wiederaufnahme geschützt.
- [x] 7.5 Kleine Unit-/Typgates, Server-Runtime, fokussierte Browserfälle und
      aktuelle Dokumentation samt Gegenbeispielen abschließen.

## 8. Fortsetzung nach Elementaudit

Der Auftrag „Dann mach da noch weiter“ umfasst weitere UI-Anpassungen und
konkrete Figma-Lücken im bestehenden Change. Einzelne abgeschlossene Pakete
sind keine pauschale Abnahme jedes Studio-Elements.

- [x] 8.1 Vorhandene Host-Suchauswahl mit Tests zentralisieren; optionale Werte
      explizit leeren können und beim Deaktivieren die offene Auswahl schließen.
      Waste-Doppellogik und Such-/Öffnungs-State im Plugin entfernen.
- [x] 8.2 Ein-Aktions-Menü durch direkten zentralen Button ersetzen und den
      lokalen Menüpfad löschen; bestehende Aktion unmittelbar prüfen.
- [x] 8.3 Einzelterminauswahl auf Shared Calendar umstellen; Datum, Auswahl,
      Locale und Disabled erhalten. Jahresübersicht gemäß Figma auf schmalen
      Breiten als Liste derselben Termine mit unveränderten Verschiebungslinks
      darstellen; Ursprungsdaten und eindeutige Beschreibungs-IDs erhalten.
- [x] 8.4 Host-Card und Host-Switch zentralisieren, Radio in vorhandenen News-/
      Instanz-/Schnittstellenverbrauchern einführen, Controls auf 44 px ausrichten.
      Labelstruktur, native Form-/Radiosemantik und Ressourcenrechte prüfen.
- [x] 8.5 Medien-, Konto- und Admin-Restflächen auf semantische Statusrollen
      umstellen; verbleibende Host-Tabler-Motive ersetzen. QR-Inhaltscanvas erhalten.
- [x] 8.6 Gezielte Unit-, Typ-, Lint- und Browsernachweise abschließen;
      aktualisierte Referenzbilder sichtbar prüfen und Grenzen ausweisen.
- [x] 8.7 Fehlende beziehungsweise unklare Figma-Zustände von bereits
      vorhandenen, im Code noch offenen Vorgaben unterscheiden; L14–L20 führen.
- [ ] 8.8 Vollständigen manuellen Element-/Zustandsabgleich einschließlich
      übriger Admin-/Kontodialoge, lokaler Host-Primitives (etwa Alert) und
      Screenreader/Forced Colors abschließen.
      L7, L11 und die Produktabnahme bleiben offen.


## 9. Kalenderentscheidungen L15 und L19

Auftrag vom 1. November 2026: die abgestimmten technischen Kalenderpunkte im
bestehenden Pfad umsetzen und anschließend eine lokale UI-Umgebung starten.
Fax-Easteregg (L18), neue Fachregeln, Backendverträge und Datenbankmigrationen
sind nicht Teil dieses Abschnitts.

- [x] 9.1 L15: „Abbrechen“ im Einzeltermin-Kalender durch „Schließen“ ersetzen;
      unmittelbare Entwurfsänderungen und echte Verlustbestätigung erhalten.
- [x] 9.2 L19: bestehende Berechnung um belegbare Ursachen und Gültigkeitszustände
      ergänzen; gültige Teil-/Ersatztermine und bestehende Array-Verträge erhalten.
- [x] 9.3 Tatsächliche Lade-/Fehlerzustände einschließlich Öffnungsaktion anbinden;
      aktuelle Kalenderdaten vor verspäteten Antworten schützen.
- [x] 9.4 Gitter, mobile Liste und Terminliste konsistent darstellen; deutsche und
      englische Texte sowie fokussierte Unit-/Typ-/Browsernachweise ergänzen.
- [x] 9.5 Lokale UI mit Dev-Auth starten und HTTP-/Browser-Erreichbarkeit prüfen.
      Browserfälle verwenden API-Fixtures; echte Fachdaten sind nicht angebunden.
- [ ] 9.6 Vollständige manuelle Sprach-/Accessibility-Matrix und fachliche Abnahme
      abschließen; die übergeordneten offenen Abnahmepunkte bleiben bestehen.

Der [L19-Umsetzungsnachweis](../../../docs/development/abfallkalender-status-entwicklungsbriefing.md)
führt Umfang, Prüfergebnisse und Grenzen dieses lokalen Zwischenstands auf.
