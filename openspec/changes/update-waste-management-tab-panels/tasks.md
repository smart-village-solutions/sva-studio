## 1. Ausgangsstand und Umsetzung vorbereiten

- [x] 1.1 Gegen den aktuellen Zielbranch die Aktionsliste aus `design.md` für alle neun Tabs bestätigen. Vorhandene Aktionen, Sichtbarkeitsbedingungen, Bestätigungen, Rücksprungziele und Leer-, Lade- und Fehlerzustände einschließlich gleichzeitig aktiver Waste-Changes erfassen. Die bereits gezielt geprüften 41 Bestandstests als Orientierung verwenden und die zutreffenden Tests auf dem Implementierungsstand erneut heranziehen.
- [x] 1.2 Vorhandene Studio-Tabs, Tabellenleiste, Dialoge, Auswahlleiste, Filteranzeigen und Disclosure-Komponenten zuordnen. Den bestehenden Listen-, Berechtigungs- und Dialogpfad identifizieren und als Ausgangspunkt verwenden.

## 2. Einheitliche Bedienung und vollständige Filter

- [x] 2.1 Alle sechs Listen-Tabs auf die abgestimmte Bedienleiste mit Suche und Filter, angewandten Kriterien, Auswahlumfang sowie Haupt- und Werkzeugaktionen umstellen. Unter allen neun Tabs direkt mit dem Arbeitsinhalt beginnen und den zugänglichen Namen des Tabpanels vom aktiven Tab ableiten.
- [x] 2.2 Für alle sechs Listen denselben mittigen, modalen Filterdialog mit angewandtem Zustand und getrenntem Entwurf einbinden. Anwenden, Zurücksetzen, Abbrechen, Escape, Fokusführung und mobile Bedienung umsetzen. Filterchips entfernen einzeln oder gemeinsam die angewandten Kriterien.
- [x] 2.3 Die Filtermatrix vollständig umsetzen. Abfallarten um sichtbare Suche einschließlich Kürzel ergänzen. Touren- und Stammdatenfilter in den gemeinsamen Ablauf überführen. Ausweichtermine um die sichtbare Suche, Typ, Tour und Zeitraum zum ursprünglichen Termin ergänzen. Der Filterdialog für Tour-Einsätze enthält die Tour und wahrt vorhandene Tour-Deep-Links.
- [x] 2.4 Abholpunktfilter für Region, Ort, Straße und Hausnummer im vorhandenen lesenden Vertrag und in der UI umsetzen. Suche, Aktivitätsstatus und konkreten Tourfilter erhalten. Den bestehenden Umfang von Tourenjahr und Tourstatus für Tourzuordnungen erhalten. Dieselbe Filterlogik in Ergebnisliste, Gesamtzahl und seitenübergreifender Auswahl verwenden.
- [x] 2.5 Bestehende URL-Parameter und Deep-Links weiter unterstützen und neue Parameter je Liste typsicher normalisieren. Seite eins bei wirksamen Änderungen von Filter, Sortierung und Seitengröße anfordern. Auswahl über Seiten und Filtergrenzen an Datensatz-IDs binden.

## 3. Sortierung vollständig liefern

- [x] 3.1 Die zwei Adressreihenfolgen und sechs Einzelspaltensortierungen der Abholpunkte im vorhandenen Vertrags-, Handler- und Repository-Pfad anbieten. Nach allen Filtern sortieren und erst dann paginieren. Datumsgrenzen und Tourstatus für die Zuordnungszählung gemäß Anzeige auswerten. Validierte Sortierschlüssel, stabile Gleichstände und fehlende Werte absichern.
- [x] 3.2 Die übrigen fünf Listen vollständig gemäß Sortiermatrix anbinden. Sortierschlüssel und -richtung für Desktop und schmale Ansichten am gemeinsamen Zustand betreiben. Datenwerte so vergleichen, wie sie fachlich angezeigt werden. Bei Zähl- und Sammelspalten die Sortierbedeutung am Control ausweisen.
- [x] 3.3 Typprüfung und gezielte Vertrags- und Repository-Tests mit mehr Treffern als einer Seite, numerischen Hausnummern, Gleichständen, fehlenden Werten, Touranzahl mit Jahres- und Statuskriterien sowie ungültigen Parametern ausführen. Listen- und Auswahlfilter auf identische ID-Mengen prüfen. Abfrageaufwand mit repräsentativem Bestand kontrollieren.

## 4. Vorhandene Aktionen in allen Zuständen abbilden

- [x] 4.1 Anlege-, Auswahl- und Kontextaktionen aller Listen aus der Bestandsliste anordnen und mit bestehenden Handlern und Berechtigungen anbinden. Ausgewählte Einträge außerhalb des aktuellen Filters, Grenzen der Sammelaktionen sowie Rücksprung `Zur Tour` nachweisen. Die vorhandenen Zeilenaktionen und Bestätigungen in die Durchsicht einbeziehen.
- [x] 4.2 Jahresübernahme bis zur Vorschau, Konfliktprüfung, bestätigten Entwurfsanlage und Ergebnisliste nachweisen. Fraktionsprüfung mit bestehendem Geltungsbereich, Fehlerzuständen und den beiden Folgeaktionen abbilden und gegenüber Listenfilterung und Auswahl abgrenzen.
- [x] 4.3 Ausgabe, Datentools und Einstellungen vollständig in fachliche Abschnitte überführen. Alle Bestandsaktionen einschließlich separater Ausgabe-Speicheraktionen, Importvorschau, Exportdownload, Berechtigungen in Prozesshistorie und erweiterten Werkzeugen, Einstellungsdialogen und Einbettungscode anhand der Liste prüfen. Formularentwürfe und laufende Prozesse beim Auf- und Zuklappen erhalten. Aktionen und Status des Modulrahmens im Kontext nachweisen.

## 5. Abnahme des vollständigen Stands

- [x] 5.1 Gezielt die bestehenden und neuen Unit-, Vertrags-, Repository- und Browserfälle für Filterentwurf, URL und Rücksprung, Berechtigungen, Publizieren/Ändern/Löschen über Seiten, Jahresübernahme und Fraktionsprüfung ausführen. Die Browser-Fälle mit Testdaten und mindestens einer Bearbeitungs- und einer Leserolle prüfen. Für den erweiterten Server-Lesepfad das einschlägige Runtime-Gate ausführen, soweit betroffene Pfade es erfordern.
- [x] 5.2 Alle neun Tabs auf Desktop und schmaler Ansicht gemeinsam mit der Figma-Referenz und der Bestandsliste durchgehen. Geschlossene und geöffnete Filter, Auswahlzustände, leere Treffermengen, Tastaturfokus, Escape und lesbare Sortierzustände prüfen. Vorhandene betroffene Bildreferenzen zusammenhängend prüfen und aktualisieren.
- [x] 5.3 Aktuelle Produktdokumentation sowie arc42 [06 Laufzeitsicht](../../../docs/architecture/06-runtime-view.md) und [08 Querschnittliche Konzepte](../../../docs/architecture/08-cross-cutting-concepts.md) entsprechend dem tatsächlich umgesetzten Wirkungsumfang aktualisieren. Dateiablage und OpenSpec strikt validieren.
- [ ] 5.4 Fachliche Abnahme in Staging für einen gemeinsamen Build mit allen neun Tabs sowie der kompletten Filter- und Sortiermatrix dokumentieren. Die Prüfung verknüpft den überprüften Build mit den Tests aus 5.1 und der Gegenprobe aller Aktionszustände aus 5.2. Freigabe und Promotion erfolgen nach dem zentralen Studio-Rollout-Prozess.

Die lokale Prüfung der Abholpunktsortierung umfasste 20.000 synthetische Abholpunkte und 24.000 Tourzuordnungen. PostgreSQL 17 lieferte die 100 Zeilen der zweiten Seite bei Adresssortierung in rund 38 ms und bei Sortierung nach Touranzahl in rund 68 ms. Die Zeiten stammen aus einem lokalen Abfrageplan mit synthetischen Daten.

Die lokale Browserprüfung verwendet Testdaten, eine Leserolle und einen Bearbeitungskontext. Alle 14 Chromium-Fälle bestanden über den Lauf der Waste-Suite und gezielte Wiederholungen. Für alle neun Tabs und die sechs Filterdialoge liegen Aufnahmen bei 1280 und 390 Pixeln vor. Die fachliche Abnahme in Staging ist offen.
