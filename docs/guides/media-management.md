# Medienmanagement

Dieser Guide beschreibt den aktuellen MVP-Umgang mit Medien im Studio für Redakteure und Instanzverantwortliche.

## Zielgruppe

- Redakteure, die Bilder hochladen und in News, Events oder POI verwenden
- Administratoren, die Mediennutzung, Sichtbarkeit und Löschblockierungen nachvollziehen müssen

## Einstieg

Der kanonische Einstieg liegt unter `/admin/media`.

Dort stehen im MVP zur Verfügung:

- Medienbibliothek mit Suche und Sichtbarkeitsfilter
- direkter Single-File-Upload für neue Bilder aus der Bibliothek
- Metadatenpflege für Titel, Alternativtext, Beschreibung, Copyright und Lizenz
- Nutzungsanzeige (`Usage-Impact`) für aktive Referenzen
- kontrollierte Auslieferung für öffentliche und geschützte Medien

## Upload

Der MVP verarbeitet zunächst Bilder.

Ablauf:

1. Datei in `/admin/media` auswählen.
2. Studio initialisiert den Upload serverseitig und reserviert Asset-ID plus Upload-Session.
3. Der Browser lädt die Datei direkt an die signierte Storage-URL.
4. Studio schließt den Upload über den Host-Vertrag serverseitig ab.
5. Nach Erfolg öffnet Studio direkt die Mediendetailansicht.

Beim Abschluss werden synchron ausgeführt:

- Inhaltsvalidierung des Uploads
- Metadaten-Extraktion
- Generierung häufiger Standardvarianten
- Statuspflege für Upload und Verarbeitung

Fehlschläge bleiben fail-closed. Redigierte Fehlerdetails werden am Asset gespeichert; technische Storage-Details werden nicht in Fachmodulen offengelegt.

Fehlverhalten im Frontend:

- Schlägt die Initialisierung fehl, bleibt der Nutzer in der Bibliothek und erhält eine fachlich redigierte Fehlermeldung.
- Schlägt der direkte Storage-Upload fehl, wird kein Abschluss-Call ausgeführt; die Bibliothek bleibt offen und zeigt den Uploadfehler an.
- Schlägt nur der Abschluss fehl, existiert bereits ein reserviertes Asset im Pending-Zustand und kann technisch nachverfolgt werden.

## Medienrollen

Fachmodule referenzieren Medien nicht über rohe URLs, sondern über hostseitige Medienreferenzen mit Rollen.

Aktuelle Rollen im MVP:

- `teaser_image`
- `header_image`
- `gallery_item`
- `hero_image`
- `thumbnail`
- `download`

Die Rollen werden im jeweiligen Plugin über den hostseitigen Media-Picker ausgewählt.

## Nutzungstransparenz

Jedes Asset zeigt an, wo es aktuell verwendet wird.

Die Nutzungsansicht beantwortet insbesondere:

- welches Fachmodul das Asset referenziert
- welche Ziel-ID betroffen ist
- welche Medienrolle verwendet wird
- ob eine Löschung aktuell blockiert ist

## Löschung und Änderungen

Löschungen bleiben fail-closed.

Ein Asset kann im MVP nicht gelöscht werden, wenn:

- aktive Referenzen existieren
- der Upload oder die Verarbeitung nicht in einem löschbaren Zustand sind
- weitere Schutzregeln künftig eingreifen

Metadaten- und Sichtbarkeitsänderungen laufen ebenfalls über den hostseitigen Medienvertrag und werden auditierbar verarbeitet.

## Grenzen des MVP

- Fokus auf Bild-Assets
- häufige Varianten werden synchron erzeugt
- kein dedizierter Async-Worker für Medienverarbeitung
- Legacy-URL-Felder in News, Events und POI bleiben im Übergang lesbar, neue hostseitige Referenzen sind jedoch der Zielpfad

## Referenzen

- [Plugin-Entwicklung](./plugin-development.md)
- [Architekturentscheidungen](../architecture/09-architecture-decisions.md)
- [Risiken und technische Schulden](../architecture/11-risks-and-technical-debt.md)
