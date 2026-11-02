# Briefing: SVA-Studio-Designsystem in Figma vervollständigen

**Stand:** 1. November 2026

**Adressat:** Designsystem-Spezialist:in

**Arbeitsdatei:** [Designsystem SVA Studio](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio)

**Ergebnis:** Ergänzungen der bestehenden Bibliothek, nachvollziehbare Zustände und umsetzbare Anwendungsbeispiele.

## Auftrag

Das überarbeitete Designsystem ist gestalterisch freigegeben und wird bereits
schrittweise auf den Code angewendet. Die Figma-Bibliothek ist noch nicht
veröffentlicht. Der Abgleich mit der Anwendung hat fehlende Zustände, unklare
Interaktionen und einzelne Abweichungen zwischen Figma und Code sichtbar gemacht.

Bitte das bestehende System gezielt vervollständigen. Vorhandene Komponenten,
Variablen und Muster weiterverwenden. Sämtliche fachlichen Funktionen,
Bedienmöglichkeiten und Berechtigungsunterschiede müssen erhalten bleiben.

Große Teile der Pluginoberflächen und gemeinsamen React-Bausteine sind im
lokalen Migrationsworktree angepasst und gezielt getestet. Weitere Hostflächen
und die manuelle Gesamtprüfung sind offen. Dieser Stand ist keine Aussage über
eine produktive Bereitstellung oder fachliche Abnahme.

## Verbindliche Leitplanken

- **Barrierefreiheit hat höchste Priorität.** Ziel ist mindestens WCAG 2.1 AA.
  Eine Freigabe der Figma-Datei ersetzt keine Prüfung der implementierten Oberfläche.
- Gewünscht sind dezente Farben und ruhige Flächen. Hierarchie durch Typografie,
  Abstand und Gruppierung schaffen; kräftige Farben gezielt für Aktionen,
  notwendige Zustandsmerkmale und Fokus einsetzen.
- **Nur das aktive Standard-Theme in Light und Dark bearbeiten.** Die grüne
  Forest-Variante bleibt zurückgestellt; ihre Reaktivierung ist kein Auftrag.
- Fira Sans und die vorhandene Lucide-Iconsprache erhalten.
- Zustände und Rollen zentral definieren. Keine lokalen Farbausnahmen oder
  abweichenden Basisbausteine für einzelne Plugins erzeugen.
- Vorhandene Funktionen auf kleinen Ansichten zugänglich halten. Aktionen,
  Kommentare oder Zuordnungen dürfen nicht aus Platzgründen entfallen.
- Neue Fachregeln, Backendfähigkeiten oder Speicherwirkungen benötigen eine
  gesonderte Produktentscheidung. Entsprechende Entwürfe ausdrücklich markieren.
- Die Ergänzungen zunächst unveröffentlicht in der bestehenden Datei vorbereiten.
  Veröffentlichung und Produktabnahme erfolgen gesondert.

## 1. Foundations: Kontraste und Farbrollen vereinheitlichen

**Priorität: zuerst bearbeiten. Bezug: L11.**

Figma und Code sollen dieselben semantischen Rollen und Zustände verwenden.
Einzelne Disabled-/Secondary-Darstellungen in Figma weichen vom strengeren
bisherigen Codevertrag ab. Bitte diese Unterschiede auflösen, ohne die bestehende
Lesbarkeit im Code abzusenken.

Benötigt wird eine Zuordnung für Text, Hilfetext, Eingabefläche, notwendige
Control-Kontur, dekorative Trennlinie, primäre/sekundäre/destruktive Aktion,
Fokus sowie Erfolg, Warnung und Fehler. Jeweils Light/Dark und die tatsächlich
benötigten Zustände dokumentieren: Standard, Hover, gedrückt/ausgewählt, Fokus,
Disabled, Laden und Validierungsfehler.

Prüfgrundlage:

- Normaler Text mindestens **4,5:1**, großer Text nach WCAG-Definition mindestens
  **3:1** zum Hintergrund. Die WCAG-Ausnahmen für inaktive Controls sind keine
  Aufforderung, die bisherige Studio-Lesbarkeit zu reduzieren.
  [W3C: Textkontrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- Visuelle Merkmale, die zur Erkennung von Controls oder Zuständen benötigt
  werden, grundsätzlich mindestens **3:1** zu angrenzenden Farben. Rein
  dekorative Card-Konturen und Trennlinien benötigen keine pauschale 3:1-Behandlung.
  [W3C: Nichttext-Kontrast](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html)
- Tastaturfokus muss sichtbar bleiben; die Gestaltung muss auch ohne reine
  Farbunterscheidung verständlich sein.
  [W3C: Sichtbarer Fokus](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)

**Lieferung:** Rollen-/Variablenzuordnung mit gemessenen Kontrastpaaren sowie
Komponentenbeispiele für beide Modi. Mit den bestehenden
[Button-/Farbrollen](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=23-29470)
und [Control-Zuständen](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=23-32345)
arbeiten.

## 2. Suchauswahl: explizites Leeren vervollständigen

**Bezug: L14.**

Die optionale Abholortauswahl im Abfallmodul kann bereits geleert werden.
Die geprüften SearchableSelect-Varianten zeigen dafür keine explizite Aktion.
Diese Funktion muss auch bei erfolgloser Suche erreichbar bleiben.

Bitte am vorhandenen
[SearchableSelect](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=147-3558)
ergänzen:

- leerer und befüllter Wert, jeweils geschlossen und geöffnet;
- Suche mit Treffern und ohne Treffer bei weiterhin ausgewähltem Wert;
- sichtbare, eindeutig benannte Aktion zum Leeren optionaler Werte;
- Fokus-, Disabled- und bestehende Fehlerdarstellung;
- geöffnete Auswahl auf schmalen Ansichten und innerhalb eines Dialogs oder
  einer Tabelle, ohne abgeschnittene Such- oder Trefferflächen.

Der ausgewählte Wert bleibt beim bloßen Öffnen, Suchen oder Schließen erhalten.
Nach Auswahl, Leeren oder Escape kehrt der Fokus zum Auslöser zurück. Tab muss
die Löschaktion und anschließend das nächste Formularfeld erreichbar machen.
Für Pflichtfelder keine neue Löschmöglichkeit ohne fachlichen Auftrag einführen.

**Lieferung:** ergänzte Varianten und ein beschrifteter Tastaturablauf mit
Auslöser, Suchfeld, Trefferliste, Löschaktion und Fokusrückgabe.

## 3. Kalender und mobile Einzeltermin-Bearbeitung

**Bezug: L19 und L20.**

Die vorhandene schmale Jahresansicht ist im Code bereits als Monatsliste
umgesetzt. Sie beschreibt jedoch nicht vollständig die Bearbeitung einzelner
Termine mit Kommentaren und mehreren Abholort-Zuordnungen. Diese Bearbeitung
nutzt derzeit auf kleinen Ansichten eine lokal horizontal scrollbar gehaltene
Tabelle; ihre Aktionen bleiben erreichbar.

Bitte eine kompakte Bearbeitungsdarstellung entwickeln, die erhält:

- Datum und Terminbeschreibung;
- keine, eine oder mehrere Abholort-Zuordnungen;
- Hinzufügen, Suchen, Leeren und Entfernen einer Zuordnung;
- Hinweise je Zuordnung und sichtbare Duplikatfehler;
- Termin entfernen einschließlich vorhandener Verlust-/Löschbestätigung;
- deaktivierte Bearbeitung bei fehlender Freigabe oder laufender Operation.

Für die Jahresübersicht zusätzlich unterscheiden: Monat ohne berechnete
Treffer, außerhalb des Gültigkeitszeitraums, unbekannter und nur teilweise
berechenbarer Stand. Welche dieser Zustände der Code zuverlässig liefern kann,
mit der Entwicklung abgleichen. Ein unbekannter Stand darf nicht als sicher
terminfrei dargestellt werden; keine neue Terminberechnung voraussetzen.

Der Ansatz „Status und konkrete Ursache im bestehenden Kalender anzeigen“ ist
mit dem Nutzer abgestimmt. Den Entwicklungsauftrag und seine Akzeptanzkriterien
beschreibt das [Entwicklungsbriefing für L19](./abfallkalender-status-entwicklungsbriefing.md).
Die technische Umsetzung mit gezielten Unit-/Typ- und Browsernachweisen liegt im Migrationsworktree vor; die vollständige manuelle und fachliche Abnahme bleibt offen.

Vorhandene Referenzen:
[Calendar](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=113-700),
[Jahresübersicht breit](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=141-2754),
[Jahresübersicht schmal](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=141-4205).
Vorhandene Verschiebungslinks und die Anzeige des ursprünglichen Datums erhalten.

**Lieferung:** mobile und breite Anwendungsbeispiele mit identischem
Funktionsbestand, ausgeklappten Zuordnungen und den genannten Zuständen.

## 4. Kalender: Schließen erhält die bereits erfolgten Änderungen

**Produktentscheidung getroffen am 1. November 2026. Bezug: L15.**

Ein Klick auf einen Kalendertag ändert weiterhin sofort den übergeordneten
Tourenentwurf. Eine Aktion, die diese Änderungen nicht rückgängig macht, muss
„Schließen“ heißen. Der bisherige „Abbrechen“-Button erhält deshalb diese
Beschriftung. Eine rücksetzende Dialogkopie ist nicht beauftragt.

| Aktion | Festgelegte Wirkung |
| ------ | ------------------- |
| Kalender öffnen | Aktuellen Tourenentwurf anzeigen. |
| Tage auswählen | Den übergeordneten Tourenentwurf sofort ändern; keine dauerhafte Speicherung. |
| Schließen, Escape und andere bereits unterstützte Schließwege | Dialog schließen und bereits erfolgte Änderungen im Tourenentwurf erhalten. |
| Vorhandene Aktion „Auswahl übernehmen“ | Schließt derzeit ebenfalls lediglich den Dialog; kein zusätzlicher Übertragungs- oder Speicherweg. |
| Tour speichern | Bestehenden dauerhaften Speicherweg verwenden. |

Die vorhandene Verlustbestätigung beim Entfernen eines Termins mit wertvollen
Zusatzangaben bleibt erhalten. „Behalten“ oder Escape in dieser Bestätigung
verwirft ausschließlich die noch unbestätigte Entfernung. Andere bereits
erfolgte Änderungen sowie Kommentare und Zuordnungen bleiben erhalten.
Bestätigtes Entfernen wird durch anschließendes Schließen des Kalenderdialogs
nicht rückgängig gemacht. Escape in einer untergeordneten Auswahl oder
Bestätigung wirkt nur auf diese Ebene.

**Lieferung:** Figma-Ablauf, Entscheidung und Codebeschriftung sind aktualisiert.
„Schließen“ erhält den aktuellen Tourenentwurf; der separate Speicherweg und
die echte Abbruchaktion bei unbestätigter Entfernung bleiben erhalten.
Die vorhandenen Tests der Einzelterminauswahl bestehen.

## 5. Aktionsgruppen und Popup-Menüs eindeutig zuordnen

**Bezug: L16; bestätigte Codeabweichung, keine pauschale fehlende Komponente.**

`StudioActionMenu` ist im Code bisher eine Gruppe sichtbarer Aktionsbuttons und
erlaubt auch frei gerenderte Aktionen. Die Figma-Referenz entwirft ein echtes
Popup-Menü. Eine einzelne Waste-Erstellenaktion wird inzwischen als direkter
Button gezeigt.

Bitte die Zuordnung an der vorhandenen
[ActionMenu-Referenz](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=148-3546)
eindeutig dokumentieren: einzelne Aktion, sichtbare Aktionsgruppe und echtes
Überlaufmenü. Für ein Menü Auslösername, Öffnen/Schließen, Tastaturnavigation,
deaktivierte Einträge, destruktive Aktionen und Fokusrückgabe zeigen.

**Lieferung:** eindeutige Musterzuordnung mit einem Beispiel mit mehreren
tatsächlich vorhandenen Aktionen. Kein reiner Icon-Auslöser ohne zugänglichen Namen;
keine bestehenden Aktionen oder freien Inhalte beim Umbau verlieren.

## 6. Medien- und QR-Darstellung abgleichen

**Bezug: L17; zunächst Abgleich, noch kein bestätigter fehlender Figma-Baustein.**

Bitte das vorhandene
[Medienmuster](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=115-4451)
mit den tatsächlichen Medienansichten vergleichen:

- weißer QR-/Papierinhalt innerhalb einer hellen oder dunklen Appfläche;
- transparente Medien und fehlende Vorschau;
- Lade- und Fehlerzustände der vorhandenen Vorschau-/QR-Aktionen.

Weiß im QR-Inhalt erhalten; Inhaltsfarben nicht automatisch an das App-Theme
anpassen. Die umgebende Oberfläche und Zustandsmeldungen verwenden gemeinsame
semantische Rollen. Bestehende passende Varianten wiederverwenden.

**Lieferung:** bestätigte Zuordnung oder gezielte Ergänzung mit Light-/Dark-Beispielen.

## 7. Fax-Easteregg unverändert erhalten

**Entschieden durch den Nutzer am 1. November 2026. Bezug: L18.**

Der Fax-Dialog ist ein funktionsloses Easteregg und soll exakt wie bisher
bleiben. Bestehende Optik, Abmessungen, Animationen, Statusmeldungen und
Schließwege werden unverändert erhalten. Der Dialog ist von der
Designmigration ausgenommen.

Die zuvor vorgeschlagene Neugestaltung einschließlich vergrößerter
Bedienflächen und zugehöriger Figma-Bausteine ist zurückgenommen. L18 ist
damit entschieden und kein offener Gestaltungsauftrag. Es werden keine
Fax-Funktionen ergänzt.

## Bestehende Fehler- und Recovery-Entwürfe gegenprüfen

Diese Entwürfe bestehen bereits. Bitte nur prüfen, ob Gestaltung und Texte den
aktuellen Funktionsbestand korrekt ausdrücken:

| Vorhandener Entwurf                                                                                                           | Zu erhaltender Vertrag                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Konflikt](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=164-12747)                     | Vorhandene Schutz-/Fehlerpfade darstellen. Keine nicht vorhandene Revisionsprüfung oder automatische Zusammenführung versprechen.                                                                                                                                          |
| [Wiederanmeldung](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=164-12901)              | Anmeldung in neuem Tab und explizite Wiederaufnahme nach Identitäts-, Kontext- und Rechteprüfung. Keine automatische Entwurfswiederherstellung nach Browser-Neustart oder Neuladen versprechen.                                                                            |
| [Unbekanntes Speicherergebnis](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=164-13034) | Unklaren Ausgang sichtbar lassen und weitere Inhalts-Saves sperren. Ergebnisprüfung nur anbieten, soweit verfügbar. Ein reiner Medienreferenz-Retry darf keine erfolgreiche Inhaltsänderung wiederholen. Neue Eingaben dürfen nicht fälschlich als gespeichert erscheinen. |
| [Veröffentlichung](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=164-13299)             | Bestehende Modi Entwurf, sofort und terminiert erhalten. Neue Freigaben, revisionsgebundene Vorschauen oder Rücknahmen gesondert entscheiden.                                                                                                                              |

Abweichende Produktideen als gesonderte Vorschläge markieren. Sie gelten nicht
automatisch als Auftrag für die Designmigration.

## Ausarbeitung und Übergabe

1. Bestehende Komponenten und Variablen prüfen; pro Auftrag Ergänzung,
   vorhandenes Gegenstück oder Codeabweichung benennen. Die IDs L11 und L14–L20
   zur Zuordnung verwenden; die technische Lückenliste bleibt die führende Quelle.
2. Priorisierte Foundations und Interaktionsentscheidungen zuerst vorstellen,
   danach Varianten und Fachbeispiele ausarbeiten.
3. Auto Layout für zusammengehörige Inhalte verwenden. Abstände an echten
   Layoutcontainern definieren; lange Texte dürfen keine Labels oder Controls
   überlagern. Der zuletzt gemeldete Formularabstand und die Label-Verschiebung
   waren Codefehler und sind im Worktree korrigiert.
4. Auf 320, 390, 768, 1024, 1280 und 1728 px sowie an relevanten Layoutgrenzen
   prüfen. Lange deutsche und englische Texte, geringe Höhe, Textvergrößerung,
   Tastatur und offene Dialog-/Suchzustände berücksichtigen. Die vorhandene
   kompakte Kalendervariante gesondert von normalen Aktionsflächen betrachten.
5. Je Änderung Figma-Link/Node-ID, Varianten, Variablenbindung, Zustandswechsel,
   Fokusführung, Code-Gegenstück und offene Entscheidung übergeben. Für Beispiele
   ausschließlich synthetische Daten verwenden.

Die Übergabe ist für einen Bereich vollständig, wenn beide Modi, relevante
Zustände, mobile Bedienbarkeit und gemessene Kontraste nachvollziehbar sind,
der Funktionsbestand erhalten ist und Produktentscheidungen explizit benannt
sind. Design-Review, Umsetzung im Code und manuelle
Produkt-/Accessibility-Abnahme bleiben unterscheidbare Schritte.

## Arbeitsgrundlagen

- [Migrationsstand, Funktionsbestand und führende Lückenliste](../../openspec/changes/align-studio-ui-design-system/design.md)
- [Umsetzungs- und Abnahmestand](../../openspec/changes/align-studio-ui-design-system/tasks.md)
- [Standard für Übersichts-, Detailseiten und Formularraster](./studio-uebersichts-und-detailseiten-standard.md)
- [UI-Shell und Theming](./ui-shell-theming.md)
- [Semantische Farbrollen im aktuellen Code](../../apps/sva-studio-react/src/styles.css)
- [Gemeinsame React-Bausteine](../../packages/studio-ui-react/src/index.ts)
