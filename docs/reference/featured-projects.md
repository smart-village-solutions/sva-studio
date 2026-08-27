# Featured Projects verwalten

Featured Projects sind hervorgehobene Projektinhalte im Studio. Sie werden fachlich als `projects.project` geführt und im SVA-Mainserver als `GenericItem` mit `genericType: "FeaturedProject"` gespeichert.

## Berechtigungen und Einstieg

Das Modul verwendet ausschließlich die Berechtigungen `projects.read`, `projects.create`, `projects.update` und `projects.delete`. Die direkte Plugin-Navigation ist ausgeblendet. Berechtigte Redakteur:innen öffnen Projekte über die gemeinsame Inhaltsverwaltung; dort erscheinen sie genau einmal als Typ „Projekte“.

## Redaktioneller Vertrag

Der Editor gliedert sich in die Bereiche „Basis“, „Inhalt“ und „Einstellungen“:

- „Basis“ enthält Sprache, Titel und Kurzbeschreibung. Sprache ist ein frei editierbarer Pflichtwert.
- „Inhalt“ enthält Rich Text und eine optionale, geordnete Bildergalerie. URL und Alternativtext sind je Bild verpflichtend; Bildunterschrift und Bildnachweis sind optional. Das erste Bild ist Titel- und Vorschaubild.
- „Einstellungen“ enthält Status und genau einen sichtbaren Autor als Organisation oder Person. Veröffentlichungszeitpunkt und technische Metadaten sind nur lesbar.

Der lokale Content-Core ist für Status, Veröffentlichungsmetadaten und Autorenschaft führend. Der Adapter spiegelt den Status für die Mainserver-Kompatibilität nach `payload.status` und setzt `visible` nur bei `published` auf `true`. Ein vorhandenes Mainserver-GenericItem mit `genericType: "FeaturedProject"` wird unabhängig von einem älteren Payload-Feld `deleted` als Projekt behandelt und im Studio angezeigt. Ein Löschvorgang entfernt das GenericItem physisch aus dem Mainserver. Neue oder aktualisierte Projekte setzen selbst keinen `deleted`-Projektzustand; unbekannte bestehende Payload-Schlüssel bleiben bei Aktualisierungen unverändert erhalten.

## Konsistenz und Wiederholung

Create-Aufrufe verwenden eine stabile Operations-ID als `Idempotency-Key` und Mainserver-`externalId`. Eine allgemeine External-Content-Referenz bindet den lokalen Inhalt an die Mainserver-ID. Geht eine Providerantwort verloren, wird der Datensatz zur Reconciliation vorgemerkt und vor einer erneuten Anlage anhand der `externalId` gesucht.

Updates lesen den Mainserver-Datensatz unmittelbar vor dem Schreiben und erhalten nicht sichtbare GenericItem-Felder sowie unbekannte Payload-Schlüssel. Da der Mainserver keine Revision als Schreibvorbedingung anbietet, garantiert dieser Ablauf keine konfliktfreie Zusammenführung paralleler externer Änderungen.

Die Sichtbarkeit von Featured Projects wird über die bestehende Mainserver-Mutation `SvaMainserverChangeNewsVisibility` mit `recordType: GenericItem` gesetzt. Der übertragene `operationName` muss dabei dem Namen im GraphQL-Dokument entsprechen. Ist der Provider-Create bereits erfolgreich, ein nachgelagerter Schritt aber fehlgeschlagen, wird der vorhandene Datensatz ausschließlich über seine `externalId` identifiziert und gebunden; ein zweiter Create ist nicht zulässig.

## Lokale Fehlerdiagnose

Schlägt das Speichern im lokalen Development-Modus fehl, protokolliert der Projekt-Editor die ursprüngliche Exception ohne Formulardaten als `Project save failed` in der Browser-Konsole. Der lokale Vite-Server übernimmt diese Meldung einschließlich Stacktrace in das konfigurierte Runtime-Log. Sichere, typisierte Fehlermeldungen der Studio-API werden im Editor als konkrete Ursache angezeigt; unbekannte Fehler bleiben auch in Produktionsoberflächen generisch.
