# Featured Projects verwalten

Featured Projects sind hervorgehobene Projektinhalte im Studio. Sie werden fachlich als `projects.project` geführt und im SVA-Mainserver als `GenericItem` mit `genericType: "FeaturedProject"` gespeichert.

## Berechtigungen und Einstieg

Das Modul verwendet ausschließlich die Berechtigungen `projects.read`, `projects.create`, `projects.update` und `projects.delete`. Die direkte Plugin-Navigation ist ausgeblendet. Berechtigte Redakteur:innen öffnen Projekte über die gemeinsame Inhaltsverwaltung; dort erscheinen sie genau einmal als Typ „Projekte“.

## Redaktioneller Vertrag

Der Editor gliedert sich in die Bereiche „Basis“, „Inhalt“ und „Einstellungen“:

- „Basis“ enthält Sprache, Titel und Kurzbeschreibung. Sprache ist ein frei editierbarer Pflichtwert.
- „Inhalt“ enthält Rich Text und eine optionale, geordnete Bildergalerie. URL und Alternativtext sind je Bild verpflichtend; Bildunterschrift und Bildnachweis sind optional. Das erste Bild ist Titel- und Vorschaubild.
- „Einstellungen“ enthält Status und genau einen sichtbaren Autor als Organisation oder Person. Veröffentlichungszeitpunkt und technische Metadaten sind nur lesbar.

Der lokale Content-Core ist für Status, Veröffentlichungsmetadaten und Autorenschaft führend. Der Adapter spiegelt den Status für die Mainserver-Kompatibilität nach `payload.status` und setzt `visible` nur bei `published` auf `true`. Ein Löschvorgang markiert das Mainserver-Payload mit `deleted: true` und entfernt das Projekt aus aktiven Studio-Listen.

## Konsistenz und Wiederholung

Create-Aufrufe verwenden eine stabile Operations-ID als `Idempotency-Key` und Mainserver-`externalId`. Eine allgemeine External-Content-Referenz bindet den lokalen Inhalt an die Mainserver-ID. Geht eine Providerantwort verloren, wird der Datensatz zur Reconciliation vorgemerkt und vor einer erneuten Anlage anhand der `externalId` gesucht.

Updates lesen den Mainserver-Datensatz unmittelbar vor dem Schreiben und erhalten nicht sichtbare GenericItem-Felder sowie unbekannte Payload-Schlüssel. Da der Mainserver keine Revision als Schreibvorbedingung anbietet, garantiert dieser Ablauf keine konfliktfreie Zusammenführung paralleler externer Änderungen.
