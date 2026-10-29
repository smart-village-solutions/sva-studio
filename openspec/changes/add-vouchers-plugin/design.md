# Entwurf und Nachweisgrenzen

## Ausgangslage

Die Analyse des lokalen Mainserver-SaaS-Stands `b01aead122485848cd03ea774c12eb9fc3efdd28` zeigt: `ResourceService.update_resource` löscht im normalen POI-Update abhängige Beziehungen. `PointOfInterest.vouchers`, `GenericItem.quota` und `Quota.redemptions` bilden dabei eine Löschkette. Das alte CMS sendet Voucher-Inhalte mit und erhält `payload.id`; die Datenbank-IDs und Einlösungen werden dadurch nicht erhalten.

`createGenericItem` bietet auf oberster Ebene keinen vollständigen Gutschein-Schreibvertrag für POI-Bezug, Rabatt und Kontingent. Der verschachtelte `GenericItemInput` unterstützt diese Gutschein-Felder, aber keine Datenbank-ID zur sicheren Aktualisierung. `changeVisibility` aktualisiert dagegen direkt den vorhandenen Datensatz. Der Batch-Import ist asynchron und seine POI-Sync-Konfiguration enthält keine Gutscheine; er wird nicht zum alternativen Editorpfad umfunktioniert.

Diese Befunde sind Quellcodeanalyse und werden vor Freigabe der Implementierung gegen den tatsächlich verwendeten Mainserver-Vertrag in isolierten Testdaten nachgewiesen. Es wird keine schreibende Produktionsprüfung vorausgesetzt.

## Entscheidung und Alternativen

Gewählt ist eine eigenständige redaktionelle Gutscheinoberfläche über der vorhandenen POI-Speicherung. Der Nutzer akzeptiert den Reset der Einlösungen; die konkrete Wirkung wird trotzdem vor jedem betroffenen Speichern erklärt und bestätigt.

Ein rein lesendes Plugin erfüllt die benötigte Erstellung und Bearbeitung nicht. Eine neue Top-Level-API oder relationale Mehrfachzuordnung im Mainserver ist derzeit ausgeschlossen. Duplikate pro Ort, lokale Zusatzkontingente und Verknüpfungen im Payload würden App und Mainserver keine wirksame gemeinsame Zuordnung liefern und werden nicht angelegt.

Das neue Fachplugin ist nötig, weil bestehende generische und POI-Editoren den eigenständigen Gutscheinablauf einschließlich Reset-Bestätigung nicht korrekt ausdrücken. Unmittelbare Verbraucher sind Redakteure und Firmeninhaber; bestehende UI-, Host- und Mainserver-Pfade werden erweitert, statt weitere Infrastruktur zu schaffen.

## Oberfläche und Fachmodell

- Plugin-ID `vouchers`, Inhaltstyp `vouchers.voucher`, eigene `vouchers.read`, `vouchers.create`, `vouchers.update` und `vouchers.publish`-Actions mit expliziter Zuordnung zu vorhandenen Access-/Principal-Verträgen. Keine neue IAM-Policy-Engine.
- Übersicht und Integration in die hostgeführte Inhaltsliste: Titel, zugeordneter Ort, Sichtbarkeit, Gültigkeit und Restkontingent; Suche sowie Filter für Ort, Kategorie und Sichtbarkeit.
- Create als Onepager in der Reihenfolge Grunddaten, Einlöseort, Vorteil, Kontingent, Gültigkeit, Sichtbarkeit und Speichern. Edit verwendet dieselben fachlichen Felder und bestehende Editor-Bindings. Pflichtangaben, Hinweise und Fehler sind in de/en übersetzt und nach WCAG 2.1 AA bedienbar.
- Vorteil als explizite Auswahl: Prozentrabatt, fixer Rabattbetrag oder Originalpreis/reduzierter Preis. Ein gewählter Modus erzeugt keine widersprüchlichen Rabattwerte. Bestehende mehrdeutige Rabatte werden angezeigt und vor Änderung explizit aufgelöst, nicht beim Laden bereinigt.
- Titel, genau ein zulässiger Ort und ein positives Gesamtmaximum sind erforderlich. Optionales Personenmaximum ist positiv; Rhythmus ist einmalig, täglich, wöchentlich, monatlich, quartalsweise oder jährlich. Geldbeträge sind nicht negativ, Prozentrabatt liegt über 0 und höchstens 100; reduzierter Preis überschreitet den Originalpreis nicht. Dezimalkomma wird korrekt verarbeitet.
- Gültigkeitsgrenzen sind optional; bei beiden Grenzen liegt Ende nicht vor Beginn. Fehlende Grenzen bedeuten fachlich unbeschränkt. Die App-Kompatibilität offener Grenzen ist gesondert nachzuweisen; Studio verspricht keine neue App-Semantik.
- Sichtbarkeit und abgeleitete Zustände wie abgelaufen/ausgeschöpft bleiben getrennt. Keine erfundene Terminierungs- oder Archivierungsfunktion.
- Ortsbezug im fachlichen Modell als Liste, an der aktuellen Adaptergrenze exakt ein Eintrag. Mehr als ein Eintrag wird client- und serverseitig abgelehnt. Kontingent bleibt am Gutschein; spätere Mehrfachzuordnungen sollen es gemeinsam nutzen. Keine zusätzliche Konfiguration für zukünftige APIs.
- Ortswechsel bestehender Gutscheine ist ausgeschlossen: Er würde zwei getrennte POI-Updates erfordern. Der Ort-Editor zeigt nur verlinkte Gutscheine. Neue Orte entstehen über dessen vorhandenen Erstellungsweg.

## Onepager für gelegentlich arbeitende Anwender

### Aufbau und Orientierung

Eine durchgehende Formularseite mit einem Formular-/Submit-Owner, ohne Wizard oder innere Editor-Tabs. Oben stehen Titel „Gutschein erstellen“, der Rückweg zur Übersicht und eine kurze Erklärung: „Beschreiben Sie den Vorteil, wählen Sie den Einlöseort und legen Sie fest, wie oft der Gutschein genutzt werden kann.“ Alle hier genannten Beispieltexte sind Inhaltsvorgaben für spätere de/en-Übersetzungsschlüssel, keine hardcodierten UI-Texte.

Die sechs fachlichen Abschnitte bleiben offen. Nur optionale längere Beschreibung und Bilddetails dürfen vorhandene aufklappbare Zusatzbereiche nutzen. Eine kompakte Sprungnavigation verwendet bestehende Onepager-/native Fragmentmuster; sie ersetzt nicht die lineare Lesereihenfolge. Keine neue Section-Registry oder Formular-Engine.

Die Seite bleibt mobil einspaltig. Zusammengehörige Preis-, Mengen- und Datumsfelder dürfen auf breiten Ansichten nebeneinander stehen; DOM- und Fokusreihenfolge bleiben identisch. Pflichtfelder sind erkennbar, optionale Angaben ausdrücklich bezeichnet. Technische IDs, Payload und Mainserver-Begriffe erscheinen nicht im redaktionellen Formular.

| Reihenfolge | Sichtbare Eingaben | Hilfen und Verhalten |
| --- | --- | --- |
| 1. Grunddaten | Überschrift, optionale Einleitung, optionale ausführliche Beschreibung, Kategorie und Bilder | Beispiel für die Überschrift: „20 % auf den Eintritt“. Die Einleitung beschreibt die wichtigsten Bedingungen, die Beschreibung weitere Details. Vorhandene Rich-Text-/Medienbausteine verwenden; Bilder sind kein Pflichtschritt. |
| 2. Einlöseort | Suchbare Auswahl genau eines berechtigten Ortes | Früh klären, wo der Gutschein gilt. Auswahl zeigt Name und unterscheidbare Adresse; danach dieselben Angaben als kompakte Zusammenfassung. Vorhandene Gutscheine dieses Ortes und der Reset-Hinweis werden unmittelbar sichtbar. |
| 3. Vorteil | Rabattart und ausschließlich die dazu passenden Werte | Verständliche Auswahl „Rabatt in Prozent“, „Fester Rabattbetrag“ oder „Reduzierter Preis“. Die Bedeutung der eingegebenen Werte wird als kurzer Satz angezeigt. |
| 4. Kontingent | Rhythmus, maximale Anzahl insgesamt, optionales Maximum pro Person | Feldhilfe erklärt, dass beide Grenzen für den gewählten Zeitraum gelten. Eine aus den Eingaben abgeleitete Erklärung ersetzt Fachbegriffe wie Quota. |
| 5. Gültigkeit | Optionales „Einlösbar ab“ und „Einlösbar bis“ | Ohne Beginn gilt keine Untergrenze, ohne Ende keine Obergrenze. Erläuterung: Der Zeitraum bestimmt die Einlösbarkeit, nicht das automatische Anzeigen oder Ausblenden. |
| 6. Sichtbarkeit und Speichern | Sichtbarkeit bei Neuanlage, kompakte Zusammenfassung, primäre Speicheraktion und Abbrechen | Vor dem Absenden sind Vorteil, Ort, Mengen, Zeitraum und öffentliche Wirkung gemeinsam prüfbar. Der Reset wird bei betroffenem Bestand zusätzlich ausdrücklich bestätigt. |

### Ort auswählen und bestehende Gutscheine verstehen

- Bei genau einem zulässigen Ort darf dieser vorausgewählt sein, bleibt aber samt Adresse sichtbar. Bei mehreren Orten gibt es keine unbemerkte Vorauswahl. Während des Ladens oder bei nicht geklärtem Bestand kann nicht gespeichert werden; Eingaben in anderen Abschnitten bleiben erhalten.
- Bei Auswahl eines Ortes erscheint ein kurzer Hinweis mit Anzahl und Titeln der vorhandenen Gutscheine: „Beim Speichern werden auch die bisherigen Einlösungen dieser Gutscheine zurückgesetzt.“ Die Liste umfasst unsichtbare Gutscheine, soweit der Benutzer auf den gesamten Bestand berechtigt ist. Fehlende Berechtigungen werden als Sperrgrund erklärt; fremde Inhalte werden nicht offengelegt.
- Ein anderer Ort kann während der Neuanlage gewählt werden, ohne Texte, Bilder oder Vorteil zu verlieren. Bestandshinweis und spätere Bestätigung werden für den neuen Ort neu geladen; die alte Bestätigung ist ungültig.
- Kein zulässiger Ort: verständlicher Leerzustand. Wer Orte anlegen darf, erhält einen Link zum bestehenden Ort-Erstellungsweg; ansonsten einen Hinweis auf die notwendige Freigabe durch die Redaktion. Verlassen eines begonnenen Formulars nutzt den vorhandenen Verlassensschutz. Es wird keine automatische Übernahme ungespeicherter Eingaben zwischen Editoren versprochen.
- Bei Bearbeitung steht der Ort als unveränderliche Zuordnung mit Link zur Detailansicht. Die Begrenzung ist erläutert, statt eine scheinbar funktionierende Ortsauswahl anzubieten.

### Vorteil ohne widersprüchliche Werte

Die Rabattart wird mit einer vorhandenen zugänglichen Auswahlkomponente gewählt. Es gibt keinen stillschweigenden Standardrabatt. Beispiele unmittelbar an den Feldern:

- **Rabatt in Prozent:** ein Prozentfeld; „Zum Beispiel 20 % Rabatt auf den Eintritt.“
- **Fester Rabattbetrag:** ein Betragsfeld; „Zum Beispiel 5,00 € Rabatt auf einen Einkauf.“
- **Reduzierter Preis:** Originalpreis und neuer Preis; „Statt 15,00 € nur 10,00 €.“

Währungseinheit und Prozentzeichen stehen als Feldzusatz statt als Teil der einzutippenden Zahl. Die Darstellung setzt keine neue Währungsverwaltung voraus; verwendete Währung muss zum bestehenden App-/Mandantenvertrag passen. Bei Moduswechsel dürfen lokal bereits eingegebene Werte für einen Rückwechsel erhalten bleiben; gesendet werden ausschließlich die zum gewählten Modus gehörenden Werte. Verborgene Werte dürfen nicht als zweiter Rabatt mitgespeichert werden.

Bei bestehenden Gutscheinen mit mehreren befüllten Rabattvarianten werden diese zunächst lesbar angezeigt. Vor einem Inhalts-Save muss der Anwender ausdrücklich eine Variante auswählen; die Zusammenfassung nennt die dadurch entfallenden Varianten. Bloßes Öffnen, Abbrechen oder eine separate Sichtbarkeitsänderung bereinigt keine Werte.

### Kontingent in Alltagssprache

Rhythmus steht vor den beiden Mengen. Erläuterung: „Wie viele Einlösungen sind insgesamt und pro Person im gewählten Zeitraum möglich?“ Bei Neuanlage ist „Einmalig“ sichtbar vorausgewählt; ein Gesamtmaximum wird nicht erfunden. Die Erklärung folgt den eingegebenen Werten, beispielsweise:

- Einmalig, insgesamt 100, pro Person 1: „Insgesamt 100 Einlösungen über die gesamte Laufzeit, höchstens eine pro Person.“
- Monatlich, insgesamt 100, pro Person 1: „In jedem Kalendermonat insgesamt 100 Einlösungen, höchstens eine pro Person in diesem Monat.“
- Leeres Personenmaximum: „Keine zusätzliche Begrenzung pro Person. Das Gesamtkontingent gilt weiterhin.“

Bei täglichen, wöchentlichen, monatlichen, vierteljährlichen und jährlichen Rhythmen werden Kalenderzeiträume gemäß nachgewiesener Mainserver-Zeitzone und Periodengrenzen erklärt; keine rollierenden 24 Stunden oder 30 Tage behaupten. Die Laufzeit begrenzt die Nutzbarkeit zusätzlich. Ein Personenmaximum oberhalb des Gesamtmaximums wird als wirkungslose zusätzliche Grenze erläutert, ohne eine neue Backend-Regel zu erfinden. Aus den Eingaben entsteht nur eine Erklärung, keine Simulation von Einlösungen.

### Gültigkeit und Sichtbarkeit getrennt entscheiden

Der Abschnitt Gültigkeit heißt „Wann kann der Gutschein eingelöst werden?“. Optionale Datumsgrenzen verwenden vorhandene Datumseingaben. Die Zusammenfassung zeigt bei fehlenden Grenzen „Ohne zeitliche Begrenzung“, „Ab … ohne Enddatum“ oder „Bis …“. Das sind fachliche Angaben; ihre App-Kompatibilität bleibt Gegenstand der Laufzeitabnahme.

Die abschließende Sichtbarkeit heißt „Soll der Gutschein in der App angezeigt werden?“. Bei Neuanlage ist „Zunächst ausgeblendet speichern“ vorausgewählt, alternativ „In der App anzeigen“ bei vorhandener Publish-Berechtigung. Ausgeblendet ist die bestehende `visible: false`-Semantik, kein neuer Entwurfs- oder Freigabedienst. Die Hilfe erklärt: „Ein zukünftiger Einlösebeginn blendet den Gutschein nicht automatisch aus.“ Sichtbarkeit allein verspricht keine Einlösbarkeit; auch Ortszugang, Zeitraum und Kontingent sind relevant.

Bei vorhandenen Gutscheinen ist Sichtbarkeit eine getrennte Aktion am gespeicherten Stand. Während ungespeicherter Inhaltsänderungen wird sie nicht nebenbei ausgeführt: Anwender speichern diese zuerst oder verwerfen sie ausdrücklich. So wird eine Sichtbarkeitsaktion nicht als Speichern der offenen Formularwerte missverstanden.

### Zusammenfassung und explizite Bestätigung

Am Formularende folgt eine kompakte, aus den Eingaben abgeleitete Zusammenfassung: Titel, Einlöseort mit Adresse, Vorteil, Kontingentregel, Gültigkeit und gewünschte Sichtbarkeit. Native Links führen zur Korrektur in den jeweiligen Abschnitt. Die Zusammenfassung ist keine Nachbildung der App und erhält keinen eigenen Vorschaudienst.

Bei Neuanlage heißen die Aktionen je nach Wahl „Gutschein ausgeblendet erstellen“ oder „Gutschein erstellen und anzeigen“; bei Bearbeitung „Änderungen speichern“. Beide gegebenenfalls vorhandenen Submit-Auslöser im Kopf und am Ende führen durch denselben Validierungs- und Bestätigungsablauf. Unveränderte vorhandene Inhalte lösen keinen erneuten destruktiven Save aus.

Erst nach erfolgreicher Validierung und frischer Prüfung des betroffenen Bestands öffnet sich bei vorhandenen Gutscheinen der bestehende Bestätigungsdialog:

- **Titel:** „Einlösungen am Ort zurücksetzen und speichern?“
- **Inhalt:** Ort, Anzahl und Titel aller betroffenen vorhandenen Gutscheine; ausdrücklicher Satz „Alle bisherigen Einlösungen dieser Gutscheine werden gelöscht. Bereits verwendete Gutscheine können erneut eingelöst werden. Dies lässt sich im Studio nicht rückgängig machen.“ Auch ein ausgeblendet gespeicherter neuer Gutschein kann diese Wirkung für vorhandene Gutscheine auslösen.
- **Aktionen:** „Zurück zum Formular“ und „Einlösungen zurücksetzen und speichern“. Die sichere Rückkehr ist der initiale Fokus; Escape und Schließen kehren ohne Mutation zum unveränderten Formular zurück. Ein generisches „OK“ reicht nicht. Keine zusätzliche Pflicht-Checkbox neben der bereits eindeutig beschrifteten Bestätigung.

Bei einem Ort ohne vorhandene Gutscheine gibt es keine Einlösungen bestehender Gutscheine zu bestätigen; normale Speicheraktion mit serverseitiger erneuter Bestandsprüfung genügt. Ist inzwischen ein Gutschein hinzugekommen, wird der Schreibrequest abgewiesen und eine aktuelle Reset-Bestätigung verlangt. Es wird kein Dialog allein wegen der technischen Verwendung der POI-Mutation gezeigt.

### Fehler, Fortschritt und Abschluss

- Feldfehler stehen am Eingabefeld und in der vorhandenen verlinkten Fehlerzusammenfassung; optionale betroffene Bereiche öffnen sich vor dem Fehlerfokus. Keine Mutation vor gültigen Pflichtangaben.
- Nicht verfügbarer Ort, fehlende Rechte oder unvollständig erhaltbarer Bestand: konkreter Hinweis am Ort beziehungsweise dauerhaft beim Speicherbereich; Eingaben bleiben erhalten. Keine generische Erfolgsmeldung und keine automatische Ersatzzuordnung.
- Erkennbarer Inhaltskonflikt: „Der Ort oder seine Gutscheine wurden inzwischen geändert.“ Vorhandene Eingaben nicht automatisch durch neu geladene Daten ersetzen. Erneutes Laden und die damit verbundene Übernahme/Verwerfung offener Eingaben werden ausdrücklich gewählt; kein automatischer Merge.
- Während Submit sind Formulareingaben und parallele Speicher-/Sichtbarkeitsaktionen gesperrt. Der bestätigte Vorgang wird zugänglich als laufend angekündigt; kein zweiter Request durch Doppelklick oder Enter.
- Erfolg führt erst nach gesicherter ID-Zuordnung zum gespeicherten Gutschein. Wenn Einlösungen zurückgesetzt wurden, nennt die Rückmeldung diesen erfolgten Effekt. Ein Link öffnet den zugeordneten Ort.
- Bei unbestätigtem Ausgang erklärt die Oberfläche „Das Speicherergebnis ist noch unklar“ und bietet den vorhandenen sicheren Ergebnisabgleich an. Bei bestätigtem Save und fehlgeschlagener Navigation/Projektion bleibt der Erfolg unterscheidbar; kein erneutes „Erstellen“ als Reparatur.

## Redaktionelle UX-Abnahme

Mit vorhandenen Browser-/Komponententests und einer kurzen beobachteten Aufgabe prüfen: Ein gelegentlich arbeitender Redakteur erstellt einen monatlichen Gutschein für einen Ort mit zwei vorhandenen Gutscheinen, korrigiert den Rabatt und speichert ihn zunächst ausgeblendet. Vor der Bestätigung muss er ohne mündliche Hilfe benennen können, wo der Gutschein gilt, welche Mengenregel gilt, ob er öffentlich sichtbar wird und dass die Einlösungen beider vorhandenen Gutscheine zurückgesetzt werden. Eine zweite Aufgabe deckt einen Firmeninhaber mit genau einem berechtigten Ort ab. Eine nicht durchgeführte Beobachtung darf nicht als bestandene Usability-Prüfung ausgewiesen werden.

## Nutzung: registrierte Einlösungen sichtbar machen

### Datenbasis und Bedeutung

Der vorhandene `QuotaType` liefert `maxQuantity`, `availableQuantity`, `frequency`, `maxPerPerson` und optional `availableQuantityForMember(memberId)`. Im geprüften `Quota`-Modell ist `available_quantity` das Gesamtmaximum minus der Anzahl der Redemptions im aktuellen Rhythmus. Daraus folgt für die Anzeige:

- Registrierte Einlösungen = `maxQuantity - availableQuantity`.
- Restkontingent = unverändertes `availableQuantity` vom Mainserver.
- Auslastung = registrierte Einlösungen / Gesamtmaximum, sofern das Maximum positiv ist.

`redeem!(member_id, quantity)` erzeugt je Einheit einen Redemption-Datensatz. Eine Mengen-Einlösung von drei zählt daher als drei Einlösungen; weder Anzahl der Bedienvorgänge noch eindeutige Personen werden daraus abgeleitet. Das Attribut `quantity` darf nicht zusätzlich aufsummiert werden. `availableQuantityForMember` ist eine persönliche Verfügbarkeit und wird nicht zur allgemeinen Nutzungsstatistik umgedeutet oder durch Abfragen beliebiger Member-IDs zur Personenanalyse verwendet.

Die Darstellung heißt „Vom Mainserver registrierte Einlösungen“. Sie belegt gespeicherte Einlösungen, nicht die tatsächliche Leistungsabgabe vor Ort; noch nicht synchronisierte Offline-Einlösungen fehlen. Der Gutschein-GraphQL-Vertrag bietet keine Liste mit einzelnen Redemption-Zeitpunkten, keinen Unique-Member-Zähler und keine historische Periodenreihe. Studio erzeugt daraus keine Tageskurve, Umsatzberechnung, Personenliste, Zeitreihe oder lokale Statistikdatenbank.

### Darstellung in der Übersicht

Die Spalte „Nutzung“ zeigt je Gutschein beispielsweise **„37 von 100 eingelöst“**, darunter **„63 verfügbar · aktueller Kalendermonat“** und einen schmalen Auslastungsbalken. Zahlen bleiben ohne Balken verständlich und sind für Screenreader zugänglich. Sortierung/Filter werden nicht zusätzlich als serverseitig verfügbar behauptet, wenn der bestehende Listenvertrag sie nicht bietet.

Bei wiederkehrenden Gutscheinen ist der Zeitraum pro Zeile erkennbar; unterschiedliche Rhythmen werden nicht in einer undatierten Gesamtkennzahl addiert. Eine Ausblendung oder ein Ablauf setzt die angezeigte Nutzung nicht auf null. Redaktioneller Status, zeitliche Gültigkeit und Kontingentnutzung bleiben getrennte Angaben.

### Nutzungsbereich in der Detailansicht

Der gespeicherte Gutschein erhält vor den längeren Inhaltsdetails einen kompakten Bereich „Nutzung“. Er gehört zur Detailansicht, nicht als scheinbar schon bestehende Statistik in das Create-Formular. Er enthält:

1. **Registrierte Einlösungen:** hervorgehobene absolute Zahl, zum Beispiel 37.
2. **Noch verfügbar:** 63; das Gesamtmaximum 100 steht direkt dabei.
3. **Auslastung:** 37 % mit beschriftetem Fortschrittsbalken. Keine zusätzliche Diagrammbibliothek; vorhandene Studio-/Design-System-Primitiven verwenden.
4. **Bezugszeitraum:** bei `once` „Gesamte Laufzeit des aktuellen Kontingents“, sonst „Heute“, „Aktuelle Kalenderwoche“, „Aktueller Kalendermonat“, „Aktuelles Kalenderquartal“ oder „Aktuelles Kalenderjahr“ gemäß Mainserver-Rhythmus. Konkrete Datumsgrenzen werden nur ergänzt, wenn Server-Zeitzone und Periodengrenzen nachgewiesen sind; keine aus der Browser-Zeitzone geratenen Datumsbereiche.
5. **Einlöseregel:** beispielsweise „Höchstens eine Einlösung pro Person und Kalendermonat“. Das ist die konfigurierte Regel, keine Zahl tatsächlich erreichter Personen.
6. **Datenstand und Aktualisieren:** „Zuletzt erfolgreich abgerufen: …“ mit zugänglicher Aktualisierungsaktion. Der Zeitpunkt bezeichnet den Abruf, nicht die letzte Einlösung.

Ein kurzer dauerhafter Hinweis erläutert: „Gezählt werden die aktuell im Mainserver gespeicherten Einlösungen. Noch nicht übertragene Offline-Einlösungen sind nicht enthalten. Beim bestätigten Speichern von Gutschein- oder Ortsinhalten wird der Zähler zurückgesetzt.“ Der Hinweis wird nicht zur dominierenden Warnfläche; die tatsächlichen Nutzungszahlen bleiben im Vordergrund. Einen konkreten „letzten Reset“-Zeitpunkt zeigen wir nur bei eindeutig vorhandener Evidenz aus dem bestehenden Auditvertrag; `updatedAt` ist dafür kein Beleg.

Im Edit-Formular bleiben Nutzungswerte als Daten des gespeicherten Standes erkennbar. Eine Änderung des Maximums oder Rhythmus im Formular berechnet keine scheinbar reale neue Nutzung aus alten Restwerten. Die Zusammenfassung darf die zukünftige Konfiguration erklären, zeigt aber keine fiktiven Nutzungszahlen. Nach dem Save werden die realen Werte erneut geladen, auch für betroffene Geschwistergutscheine.

### Frische Daten und Grenzfälle

- Nutzung wird beim Öffnen und über „Aktualisieren“ frisch über den vorhandenen autorisierten Mainserver-Lesepfad abgerufen. Persistierte Content-Projektionen allein sind kein aktueller Nutzungsnachweis. Kein neuer Pollingdienst; keine Behauptung einer Echtzeitanzeige. Nach bestätigtem Inhalts-/POI-Save wird die betroffene Nutzung invalidiert und neu gelesen.
- Ein im aktuellen Backend vorhandener Voucher-Cache-Bypass ist im konkreten Abfragedokument und Zielserver nachzuweisen; ein Cache-Buster wird nicht erfunden. Kann Frische nicht nachgewiesen werden, muss die Anzeige diese Einschränkung benennen.
- Fehlendes Kontingent, `null`, unbekannter Rhythmus oder fehlgeschlagener Abruf bedeutet „Nutzung nicht verfügbar“ beziehungsweise „Zeitraum unbekannt“, niemals automatisch null Einlösungen. Fehlende Daten unterdrücken nur die nicht ableitbaren Werte.
- Bei 0 registrierten Einlösungen und gültigem Maximum wird ausdrücklich „Noch keine Einlösungen in diesem Zeitraum registriert“ angezeigt. Bei 0 Restkontingent heißt es „Kontingent ausgeschöpft“; Details bleiben lesbar.
- Negative Restmenge ist im aktuellen Backend möglich. Bei Maximum 100 und Rest −2 werden 102 registrierte Einlösungen, 102 % Auslastung und „Um 2 Einlösungen überschritten“ gezeigt. Der Balken endet bei 100 %, die tatsächlichen Zahlen werden nicht auf 100 korrigiert. Die negative Restmenge bleibt als Serverwert im Detail erkennbar.
- Bei fehlendem/nicht positivem Maximum wird kein Prozentwert berechnet. Bei Restmenge oberhalb des Maximums, nicht ganzzahligen Mengen oder sonst nicht plausibel ableitbaren Einlösungen erscheint „Nutzungsdaten widersprüchlich“ mit sicher darstellbaren Serverwerten; keine negative Anzahl registrierter Einlösungen und keine stille Korrektur.
- Beim erneuten Abruf bleiben zuvor erfolgreiche Zahlen mit ihrem alten Abrufzeitpunkt sichtbar. Ein Fehler kennzeichnet diese als nicht aktualisiert und bietet Wiederholung des reinen Reads. Der Fehler sperrt nicht pauschal die gesamte Detailansicht; Inhalts-Saves benötigen weiterhin ihren eigenen frischen Bestandsnachweis.
- Kalenderwechsel und bestätigter Inhaltsreset können eine kleinere Einlösungszahl ergeben. Studio interpretiert das nicht als gelöschte Transaktionen über eine selbst geführte Zeitreihe. Nach bestätigtem Reset zeigt es nur den neuen Serverstand und behauptet keine erhaltene Gesamthistorie.

### Akzeptanz der Nutzungsdarstellung

Gezielte Adapter-/UI-Tests decken 37 von 100, 0 von 100, 100 von 100, 102 von 100, Mengen-Einlösung von drei, fehlende Werte, unbekannten Rhythmus, widersprüchliche Werte, Abruffehler, Kalenderwechsel und Reset ab. Ein isolierter Mainserver-Test belegt, dass eine Mengen-Einlösung um drei den abgeleiteten Zähler um drei erhöht. Getrennt werden der aktuelle Zeitraum, Datenstand und die sichtbare Aktualisierung vor/nach einem bestätigten Save geprüft. Alle Tests verwenden die vorhandenen Vitest-/Browserpfade und bestehende UI-Komponenten.

## Speicherung über den bestehenden Adapter

1. Host prüft Session, aktiviertes Plugin, Mandant, effektive Credentials und die konkrete Action. Das Lesen für den Schreibvorgang verwendet einen frischen Mainserver-Detailabruf, keine Listenprojektion als Schreibgrundlage.
2. Adapter lädt den vollständigen für einen verlustfreien Roundtrip erforderlichen POI-Bestand und sämtliche Gutschein-Inhalte, einschließlich unsichtbarer Gutscheine. Strukturierte Daten, Payloads und weitere durch das POI-Update betroffene Beziehungen werden anhand einer Feldinventur erfasst. Kann ein vorhandener Inhalt nicht gelesen oder zurückgeschrieben werden, wird der Vorgang vor der Mutation mit konkretem Grund abgelehnt.
3. Der Server ersetzt genau den bearbeiteten Gutschein im aktuellen Bestand oder fügt einen neuen hinzu. Andere Gutscheine und POI-Inhalte bleiben inhaltlich erhalten. Nur zulässige Fachfelder werden übernommen; keine freie GraphQL-/Payload-Eingabe aus dem Browser.
4. Neue Gutscheine erhalten serverseitig eine `payload.id`-UUID bereits bei der Vorbereitung des Save-Versuchs, vor dem destruktiven Mainserver-Request. Die UUID wird dem Browser vorab zurückgegeben und dort mit Ort und aktivem Mandanten-/Organisationskontext für den Ergebnisabgleich über einen Reload hinweg im bestehenden Operationsvertrag oder, falls dieser nicht passt, minimal im Session-Storage des aktuellen Tabs gehalten. Keine Formularinhalte, Credentials oder neue Recovery-Datenbank speichern. Die Zuordnung wird serverseitig an Akteur, Kontext und Versuch gebunden und bei Verwendung geprüft; UUID-Kenntnis allein erteilt keine Berechtigung. Bestätigung und Mutation nutzen denselben Schlüssel; auch ein Ort ohne bestehende Gutscheine durchläuft diese Vorbereitung, aber keinen unnötigen Reset-Dialog. Vorhandene Kennungen und unbekannte Payload-Schlüssel bleiben erhalten. Fehlende Kennungen bestehender Gutscheine werden beim bestätigten Aggregat-Save ergänzt; vorhandene Datenbank-ID plus POI dient bis dahin zur Auswahl. Doppelte Kennungen im betroffenen Bestand führen zu einem expliziten Konflikt statt einer geratenen Zuordnung.
5. Vor dem Schreiben bestätigt der Anwender den benannten Ort und alle dort vorhandenen Gutscheine. Beispieltext: „Beim Speichern werden die bisherigen Einlösungen der Gutscheine an diesem Ort zurückgesetzt. Bereits verwendete Gutscheine können erneut eingelöst werden.“ Abbruch sendet keine Mutation.
6. Die Bestätigung ist an Akteur, Ort, Operation und den relevanten Inhaltsstand gebunden und serverseitig gegen Manipulation zu prüfen; vorhandene Bestätigungsprimitive verwenden, andernfalls ein kleines lokales Token im bestehenden Hostpfad. Nach erneuter Prüfung wird genau ein POI-Schreibrequest gesendet. Laufende Submits sind gegen Doppelklick gesperrt.
7. Ergebnis wird erneut geladen; neu vergebene Datenbank-IDs werden über die erhaltenen UUIDs zugeordnet. Betroffene Gutschein- und POI-Projektionen, Detailcaches und Referenzen werden über bestehende Hostmechanismen aktualisiert. Historie/Audit ordnen den bestätigten Vorgang samt Aggregatwirkung zu, behaupten aber keine Wiederherstellbarkeit gelöschter Redemptions.

Die Feldinventur ist eine notwendige Implementierungsaufgabe, keine Annahme, dass der heutige POI-Adapter bereits verlustfrei ist. Sie umfasst insbesondere Adressen, Kontakte, Betreiber, Öffnungszeiten, Preise, Medien, Kategorien, Zertifikate, Barrierefreiheit, Ort/Location, Payload und sonstige löschabhängige Beziehungen wie Lunches/Announcements, sofern am konkreten Bestand vorhanden. Read-only-IDs werden nicht blind als Inputs gesendet.

### Konkrete Schreibgrenzen bei gefilterten Beziehungen

Eine gefilterte oder leere Detailantwort beweist keinen vollständigen Bestand. Die folgenden bereits belegten Fälle müssen vor Aktivierung der Schreibfunktion im bestehenden Adapter geklärt werden; es entsteht keine allgemeine Eligibility-Engine oder neue Konfigurationsmatrix:

| Vorhandener Fall | Verbindliche Behandlung im bestehenden Schreibpfad |
| --- | --- |
| POI- oder Gutschein-Kategorien: Detailfelder liefern nur aktive Kategorien | Inaktive Zuordnungen über einen nachweislich vollständigen vorhandenen öffentlichen Read zusätzlich ermitteln und inhaltlich erhalten. Kann Vollständigkeit für die konkrete Beziehung nicht belegt werden, Inhalts-Save blockieren; fehlende Detailwerte nicht als Löschauftrag interpretieren. |
| Ankündigungen an einem POI ohne wirksame `business_account`-Ausnahme | Der normale POI-Write kann sie löschen, bietet aber keinen Input zum Wiederherstellen. Existenz über einen vollständigen autorisierten Read prüfen. Bei vorhandenen Ankündigungen oder ungeklärter Vollständigkeit Inhalts-Saves am POI und seinen Gutscheinen blockieren; Lesen und separate Sichtbarkeit bleiben möglich. Auch vergangene und undatierte Ankündigungen zählen. |
| Ankündigungen mit nachgewiesen wirksamer `business_account`-Ausnahme | Die vorhandene Lösch-Ausnahme darf genutzt werden, wenn sie für den tatsächlichen effektiven Datenanbieter des Updates belegt ist. Andere Roundtrip-Prüfungen bleiben erforderlich. |

Als bestehende Lesekandidaten kommen `genericItems(genericType: "Announcement")` mit POI-Bezug sowie `categories(includeInactive: true)` mit den vorhandenen Mitgliedschaften infrage. Dies ist noch kein Vollständigkeitsnachweis: Rollenfilter, globale Filter, Pagination und inverse Zuordnungen sind konkret zu prüfen. Liefert der öffentliche Vertrag diese Sicherheit nicht, bleibt der jeweilige Inhalts-Save gesperrt; kein Datenbankzugriff und keine Mainserver-Änderung als versteckter Ausweg. Die Oberfläche nennt die konkrete Grenze, beispielsweise „Dieser Ort enthält Ankündigungen, die beim Speichern verloren gehen würden.“ Ein unbekannter Bestand wird als nicht ausreichend prüfbar erklärt, nicht als erwiesenermaßen vorhandene Ankündigung.

Akzeptanzfälle sind ein Ort mit ausschließlich vergangener/undatierter Ankündigung trotz leerem Detailfeld und ein POI beziehungsweise Gutschein mit inaktiver Kategorie. Ein ausgeblendeter Gutschein wird nicht mit einem inaktiven Kategorieeintrag verwechselt. Die gezielten Tests müssen Erhaltung oder Ablehnung vor dem Schreibrequest belegen; der akzeptierte Einlösungsreset ist keine Freigabe zum Verlust dieser Daten.

## Alle Studio-Verbraucher derselben Grenze

Gewöhnliche POI-Inhaltsänderungen können denselben Reset auslösen. Der bestehende POI-Speicherpfad muss deshalb denselben frischen Gutschein-Roundtrip, dieselbe Bestätigung und dieselbe Ergebnisaktualisierung nutzen; kein paralleler Aggregat-Writer. Das schützt den Bestand auch bei deaktiviertem Gutschein-Plugin: Ist eine sichere Erhaltung/Bestätigung im jeweiligen Kontext nicht möglich, wird der betroffene POI-Write blockiert.

POI-Löschen mit Gutscheinen wird im ersten Umfang blockiert; keine stillschweigende Gutschein-/Historienlöschung. Generische Editoren, Status- und Bulk-Actions dürfen `Voucher` nicht über einen unbestätigten allgemeinen Schreibpfad verändern. Für reine Sichtbarkeit wird `changeVisibility(recordType: "GenericItem")` verwendet und das Ergebnis geprüft; kein erneuter Inhalts-Save.

## Autorisierung und Ausführungsgrenzen

Die Plugin-Berechtigung ersetzt keine Berechtigung am betroffenen POI und dessen Gutscheinbestand. Host und Mainserver-Adapter prüfen den bestehenden Principal-/Ownership-Vertrag auch für die Aggregatwirkung. Ein Firmeninhaber darf keine fremden Orte wählen; fehlen ausreichende Rechte auf den vollständigen betroffenen Bestand, erfolgt kein Schreibrequest. Wiederangelegte Gutscheine dürfen nicht stillschweigend einem anderen Datenanbieter zugeordnet werden. Abweichende bestehende Ownership, nicht vollständig sichtbare Geschwister und unklare Zuordnung werden vorab abgelehnt.

Es entstehen keine direkten Browserzugriffe auf Mainserver-Credentials und keine direkten Datenbankzugriffe. Diagnose nutzt den vorhandenen Server-Logger; keine Member-IDs, Tokens, personenbezogenen Einlösehistorien oder freien Inhalte in Logs. Reset-Bestätigung dokumentiert die Wirkung, nicht einzelne Einlösende.

## Konflikte, Fehler und akzeptierte Grenzen

- Zwischen Formularöffnung/Bestätigung und Schreiben erkennbare Inhaltsänderungen am POI oder seinen Gutscheinen führen zu einem Konflikt und erfordern erneutes Laden/Bestätigen. Inhaltsvergleich trennt redaktionelle Änderungen von durch Einlösung berührten Zeitstempeln/Restmengen.
- Der Mainserver bietet im geprüften Pfad kein atomisches Compare-and-Swap. Ein frischer Read mit Inhaltsvergleich verhindert daher nicht jede Änderung zwischen letzter Prüfung und Mutation. Es wird keine vollständige Konkurrenzsicherheit versprochen und kein neuer Lock-Service gebaut. Gleichzeitige Bearbeitung über altes CMS/Importer bleibt eine benannte Betriebsgrenze.
- Der akzeptierte Reset umfasst auch Einlösungen, die bis zur Ausführung des destruktiven Updates eingehen. Offline-Einlösungen oder Deeplinks auf alte Datenbank-IDs können danach ins Leere laufen. Diese Backend-/App-Grenzen werden in den Anwenderhinweisen und Akzeptanznachweisen festgehalten.
- Bei eindeutig abgelehnter Mutation bleiben Formulardaten erhalten. Bei Timeout/Verbindungsabbruch ist das Ergebnis unbestätigt: kein automatischer Retry. Der Ergebnisabgleich verwendet die vorab bekannte UUID im gebundenen Ort-/Benutzerkontext, nicht allein Überschrift oder Inhalt. Ein Serverprozessabbruch nach erfolgreichem Mainserver-Write verliert damit nicht die Suchkennung. Zwei inhaltsgleiche Gutscheine bleiben unterscheidbar. Fehlt die Kennung etwa nach Verlust des Tab-Speichers, bleibt der Ausgang ausdrücklich ungeklärt; kein automatisches erneutes Erstellen. Eine einzelne leere Antwort bei eventuell noch laufendem Request beweist keinen endgültigen Fehlschlag. Der Schlüssel verbessert die Wiederauffindbarkeit, garantiert aber ohne Backend-Vertrag keine atomische Genau-einmal-Ausführung.
- Bestätigte Mutation mit fehlgeschlagenem Readback/Refresh wird als gespeichert, aber noch nicht vollständig abgeglichen behandelt. Keine erneute Erstellung als Recovery. Fehlt die eindeutige Zuordnung, wird keine falsche Detailroute geöffnet.
- Kein Sicherungsversprechen: Studio kann gelöschte Einlösungen nicht wiederherstellen. Der spätere Mainserver-Fix ist separat in GitHub #445 / Jira SVA-1778 erfasst.

## Invarianten und geplante Nachweise

| Invariante | Grenze und Fehlerfall | Geplanter Nachweis |
| --- | --- | --- |
| V1: Nur bestätigter Reset | Browser → Host → POI-Mutation; manipulierte/veraltete Bestätigung | Route-/Integrationstest mit zwei Geschwistergutscheinen, Abbruch, fehlender und veralteter Bestätigung; kein Request bei Ablehnung |
| V2: Inhaltserhalt außerhalb der gewählten Änderung | POI-Aggregat → destruktiver Mainserver-Write; ausgelassene oder gefilterte Beziehungen | Feldinventur, Roundtrip-Fixtures und isolierter Mainserver-Test einschließlich inaktiver Kategorien und vergangener/undatierter Ankündigungen; Erhaltung oder Ablehnung vor Write |
| V3: Rechte umfassen die Aggregatwirkung | Principal/Organisation → POI und alle Gutscheine; fremder Anbieter | Negative Mandanten-/Ownership-Tests und Firmeninhaber-E2E; keine Mutation bei unvollständiger Berechtigung |
| V4: Ehrlicher Ausgang und stabile Zuordnung | Vorbereitung → Mutation → Readback/Projektion; neue IDs, verlorener Response, Reload, Prozessabbruch | Zwei inhaltsgleiche Gutscheine, vorab bekannte UUID, erfolgreicher Write vor verlorenem Response, Tab-Reload und Prozessabbruch prüfen; kein blinder Retry |
| V5: Alle Studio-Writer beachten denselben Vertrag | Gutschein-, POI-, GenericItem- und Bulk-Pfade | Verbraucherinventur und Regressionstests einschließlich deaktiviertem Plugin; Visibility ohne Reset |

Die Quellcodeanalyse ist noch kein bestandener Nachweis. Vor Merge müssen die relevanten Tests und die kontrollierte Akzeptanz für den exakten HEAD vorliegen; offene Vertragslücken werden nicht durch grüne allgemeine CI ersetzt. Verbleibende externe Konkurrenz- und Offline-Grenzen sind ausdrücklich zu dokumentieren.

## Lieferabschnitte und Dokumentation

1. Vorhandene API, Feldinventur, Autorisierung und bestätigten Aggregat-Roundtrip in den bestehenden Adapter integrieren; kleinste passende Unit-/Type-Gates sofort ausführen. Noch keine ungesicherten UI-Schreibaktionen aktivieren.
2. Gutschein-Plugin und die betroffenen POI-/Host-Verbraucher auf denselben Pfad anbinden; Sichtbarkeit separat halten. Zusammenhängend abnehmen, bevor produktive Aktivierung erfolgt.

Kein verpflichtender PR-Stack. Bei Umsetzung arc42 03/05/06/08/10/11 und bestehende Anwenderhilfe aktualisieren. Das Verfahren bleibt nach einem Backend-Fix nicht automatisch sicherer: Der neue Vertrag ist separat zu prüfen, bevor Warnung oder Adapterlogik entfernt werden.
