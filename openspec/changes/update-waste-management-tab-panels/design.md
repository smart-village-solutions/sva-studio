# Design des Abfallmanagement-Umbaus

## 1. Tabpanels und Zustände

Die [Figma-Zeilen pro Tab](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=272-2) zeigen Ruhe-, Filter-, Auswahl- und Werkzeugzustände. Die folgenden Verhaltensregeln konkretisieren die Gestaltung. Insbesondere entfällt das in Figma gezeigte Datumsfeld bei **Tour-Einsätzen**. Tabellen behalten die fachlichen Inhalte, Spalten und Zeilenaktionen aus dem Code. Die aktive Tab-Beschriftung bleibt sichtbar und beschriftet das Tabpanel auch programmatisch.

- **Listen.** Suche, falls vorgesehen, und Filterbutton stehen am Anfang der Bedienleiste. Hauptaktion und tabbezogener Einstieg stehen am Ende. Angewandte Kriterien stehen in einer eigenen Zeile. Auswahlumfang und Aktionen für markierte Zeilen folgen unmittelbar vor der Tabelle. Eine bestehende seitenübergreifende Auswahlaktion ist schon bei leerer Auswahl erreichbar.
- **Filterdialog.** Derselbe mittige, modale Studio-Dialog für alle sechs Listen. Entwurf beim Öffnen aus dem angewandten Zustand füllen. `Zurücksetzen` setzt den Dialogentwurf zurück. `Abbrechen`, Schließen und Escape verwerfen ihn. `Filter anwenden` übernimmt ihn atomar. Ein bereits angewandtes Kriterium lässt sich in der Liste direkt entfernen, ebenso alle Listenfilter gemeinsam. Standardwerte und Sortierzustand werden nachvollziehbar angezeigt. Ein reiner Filter-Reset behält die Sortierung. Eine im Dialog gewählte Adressreihenfolge gehört beim Anwenden zum selben Zustandswechsel. Fokus im Dialog führen und nach dem Schließen an den Auslöser zurückgeben. Auf schmalen Ansichten scrollt der Dialoginhalt und die Aktionen bleiben erreichbar.
- **Ausgabe, Datentools und Einstellungen.** Fachliche Abschnitte mit zugehörigen Aktionen gruppieren und aufklappbar darstellen. Ein auf- oder zugeklappter Abschnitt lässt den laufenden Formular- oder Prozesszustand bestehen. Die Speichergrenzen des Ausgangscodes gelten weiter, insbesondere die getrennten Ausgabeformulare und das gemeinsame Einstellungsformular.

## 2. Filterumfang und fachliche Bedeutung

| Liste | Sichtbare Kriterien | Vertragsdetails |
| --- | --- | --- |
| Abfallarten | Suche, Status | Suche nach Name, Kürzel, Beschreibung und Gefäßgröße. Status `Alle`, `Aktiv`, `Inaktiv`. |
| Touren | Name, Abfallart, Status, Gültigkeitsjahr und freie Grenzen für Gültigkeitsbeginn und -ende | Bestehende Bedeutung der relativen Jahre, offenen Grenzen und expliziten Termine erhalten. Alle gesetzten Kriterien werden gemeinsam angewandt. |
| Abholpunkte | Suche, Aktivitätsstatus, Region, Ort, Straße, Hausnummer, Tour, Tourenjahr, Tourstatus | Region, Ort, Straße, Hausnummer und Tour mit stabilen IDs filtern. Straße und Hausnummer beziehen sich auf die gespeicherte Stammdatenzuordnung. `Alle Straßen` und `Alle Hausnummern` im Filterdialog setzen keine Einschränkung. Tourenjahr und Tourstatus begrenzen wie bisher die angezeigten Tourzuordnungen und die Auswahl konkreter Touren. Sie schneiden die Menge der Abholpunkte ohne konkrete Tourauswahl nicht zusätzlich zu. Der bestehende Aktivitätsfilter der Abholpunkte bleibt unabhängig vom Tourstatus. |
| Stammdaten | Datentyp, Suche, kontextabhängige Elternauswahl | Datentyp bestimmt die Tabelle und bleibt in der Leiste. Elternfilter passend zur Ebene, etwa Region für Orte, Ort für Straßen und Straße für Hausnummern. Den bestehenden Suchumfang einschließlich PLZ und Elternkontext erhalten. |
| Ausweichtermine | Suche, Typ, Tour, Zeitraum | Typen unterscheiden Feiertagsregel, globale sowie tourbezogene Verschiebung. Tour-Kontext folgt dem vorhandenen Prädikat, einschließlich explizit betroffener globaler Verschiebungen. Zeitraum filtert nach dem **ursprünglichen Termin**, inklusive gesetzter Grenzen, mit nullable Anfang oder Ende. |
| Tour-Einsätze | Tour | Die bestehende Tour-ID wird im Dialog auswählbar und bleibt aus Tour-Deep-Links vorausgewählt. Die Lieferung enthält für diese Liste ausschließlich den Tour-Filter. |

Angewandte Kriterien sind typisierter URL-Zustand je Liste. Bestehende Parameter, Links und Datentypen erhalten beim Wechsel, Rücksprung, Neuladen und bei der Normalisierung denselben fachlichen Geltungsbereich. Filter-, Sortier- und Seitengrößenwechsel beginnen auf Seite eins. Elternwechsel setzen ausschließlich unpassend gewordene untergeordnete Kriterien zurück. Gleichnamige Adressen und Touren werden anhand von Kontext unterscheidbar beschriftet. Fehlerhafte Datumsbereiche bleiben im Dialog mit Feldhinweisen korrigierbar.

## 3. Sortierumfang

Die [Sortiermatrix im Spec-Delta](specs/waste-management/spec.md#requirement-waste-management-sortiert-datenspalten-vor-der-pagination) bestimmt die Kriterien je Liste. Desktop-Kopfzellen und die Wahl von Feld und Richtung in schmalen Listendarstellungen bedienen denselben Zustand. Für Zähl- und Sammelspalten wird die Sortierbedeutung am Control verständlich gemacht.

### Serverseitiger Abholpunkt-Listenvertrag

Der vorhandene Vertrags-, Handler- und Repository-Pfad bleibt zuständig. Die Disjunktion aus den zwei Adressreihenfolgen und den sechs Einzelspalten erhält eine feste Zulassungsliste. Die URL akzeptiert bestehende `locationSortMode`-Werte und behält deren Reihenfolge. Der Wechsel des Einzelkriteriums ersetzt die vorherige Adressreihenfolge. Die gewählte Richtung gilt für das aktive fachliche Kriterium, die eindeutige Abholpunkt-ID stabilisiert Gleichstände aufsteigend.

Listen und seitenübergreifende Auswahl verwenden dieselbe fachliche Filterung für Region, Ort, Straße, Hausnummer, Tour, Abholpunktstatus und Suche. Die Sortierung nach Touranzahl verwendet serverseitig denselben fachlichen Umfang wie die angezeigte Tourenspalte, einschließlich des gewählten Jahres und Tourstatus. Sie zählt die dort berücksichtigten Zuordnungen und verwendet `0` für Abholpunkte ohne passende Zuordnung. Die bestehende Jahresprüfung einschließlich expliziter Termine bleibt maßgeblich. Zählwerte werden für den gefilterten Bestand im vorhandenen lesenden Pfad bestimmt. Die Liste darf keine unpaginierten Adressdatensätze oder Einzelabfragen je Zeile benötigen. Neue Parameter werden typisiert validiert. Datums-, ID- und Textwerte werden gebunden, Sortierausdrücke stammen aus der festen Zuordnung. Der Auswahlpfad nutzt Filterwerte und IDs unabhängig von Sortierung und Seitenzuschnitt.

## 4. Aktionen und Nachweise

| Bereich | Bei der Umstellung nachweislich erreichbar |
| --- | --- |
| Abfallarten | Fraktion anlegen, vorhandene Zeilenaktionen und Statuswechsel, markierte löschen samt Auswirkungs- und Bestätigungspfad, bedingter Wiederholungsweg des Abfallarten-Abgleichs. |
| Touren | Neue Tour, Jahresübernahme bei den bisherigen Rechten, alle gefilterten auswählen und abwählen, Auswahl aufheben, Status und Gültigkeit ändern, Touren löschen. Auswahlzahl enthält weiterhin außerhalb des Filters liegende Markierungen. Klickziele für Kalender, Zuordnungen, Verschiebungen und Zeilenaktionen bleiben erhalten. Jahresübernahme führt über Quelljahr, Vorschau einschließlich Konflikten, Bestätigung als Entwurf bis zur Ergebnisliste. |
| Abholpunkte | Neuer Abholpunkt, alle gefilterten auswählen oder abwählen, Tour gesammelt zuweisen, markierte löschen. Fraktionsprüfung mit bisherigem fachlichem Umfang, Entwürfen, Sonderfällen, Fehlermeldungen, Ergebnis und beiden Folgewegen für einzelne oder alle betroffenen Zuordnungen. Die Prüfparameter und das Ergebnis bleiben vom Listenfilter unabhängig. |
| Stammdaten | Anlegen je Ebene, Ersatzaktion für fehlende Elternebene, Bearbeiten und Löschen mit vorhandenen Vorschauen, Bestätigungen und Rechten. |
| Ausweichtermine | Anlegen, markierte löschbare Einträge löschen, `Zur Tour` im vorhandenen Kontext, bestehende Zeilen- und Terminaktionen. |
| Tour-Einsätze | Einsatz anlegen bei den bestehenden Rechten, `Zur Tour` im vorhandenen Kontext, bestehende Zeilenaktionen. |
| Ausgabe | Medienbibliothek, Upload, öffentliche URL, Logo entfernen und Bibliothek erneut laden gemäß vorhandenen Fähigkeiten. PDF-Inhalte und E-Mail-Erinnerungsdienst getrennt speichern. |
| Datentools | Import mit Vorlage, Upload, Vorschau, Fehlerdatei und Ausführung. Export und Ergebnisdownload. Prozessdetails und Historienaktionen. Initialisierung, Migration, Initialdaten, PLZ-Ergänzung, Reset und technische Details gemäß den vorhandenen Berechtigungen. |
| Einstellungen | Bereitstellung bei Fehler erneut starten, eigene Turnusabstände hinzufügen, bearbeiten, löschen und Fallback sichern, Einstellungsformular speichern, Feiertagsüberschreibung bestätigen, Einbettungscode bei gespeicherter Web-URL kopieren. |
| Modulrahmen | Vorhandene Hinweise und Aktionen zum Mainserver-Abgleich und zu Jobdetails, einschließlich der bestehenden Berechtigungs- und Fehlerzustände. |

Die Bestandsliste ist der Mindestnachweis. Der Abgleich mit dem tatsächlichen Zielbranch vor Umsetzung erfasst zusätzlich dessen vorhandene Leer-, Lade-, Fehler-, Berechtigungs- und Rücksprungzustände. Die Changes `align-studio-ui-design-system`, `add-waste-address-master-data-management`, `add-waste-tour-status-bulk-update` und `add-waste-mainserver-sync-status` liefern dabei bestehende Anforderungen, die weiter gelten.

## 5. Risiken und Lieferung

| Invariante | Geplanter Nachweis |
| --- | --- |
| Liste und Auswahl betreffen dieselben gefilterten IDs, auch bei unterschiedlichen Seiten und gleicher Sortierspalte. | Vertrags-, Repository- und Browser-Tests mit mehr Treffern als einer Seite, Gleichständen, optionalen Adresswerten und ausgewählten IDs außerhalb des Filters. |
| Dieselbe Aktion hat weiterhin dieselbe Wirkung und benötigt dieselben Rechte. | Gegenprobe mit Bearbeitungs- und reiner Leserolle, Kontext-Rücksprünge, bestehende Bestätigungsdialoge und Rücklesung der betroffenen Ergebnisse in Testdaten. |
| Ein Dialogentwurf hat bis zum Anwenden keine Auswirkung auf Treffer, Auswahl oder URL. | Komponenten- und Browser-Test für Anwenden, Reset, Abbrechen, Escape, Fokus und die Wiederherstellung per Deep-Link. |
| Die Übersicht bleibt unter realistischen Datenmengen vollständig und bedienbar. | Mehrseitiger Repository-Test für Zähl- und Adresssortierung, gezielte Prüfung des Abfrageaufwands und Sichtprüfung der neun Tabs auf Desktop und schmaler Ansicht. |

Implementierungsschritte können separat geprüft werden. Zur Abnahme und Freigabe zählt der zusammenhängende Build mit dem vollständigen Umfang. Die vorhandene Host-Fassade, die tenantbezogene Ausführung und die bestehenden Schreiboperationen sind die Ausführungsgrenzen. Für Staging und Production gilt der [Studio-Rollout-Prozess](../../../docs/guides/studio-rollout-process.md).
