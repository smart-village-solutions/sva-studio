# POI-Medienupload mit direkter Bildzuordnung

## Ziel

Der Button `Medium hochladen` im POI-Editor soll denselben fachlichen Upload-Ablauf wie die Mediathek nutzen und nach erfolgreichem Upload direkt mit der Zuordnung des neuen Bildes zum POI enden. Nutzer sollen nach dem Upload nicht erneut in der Mediathek suchen oder auswählen müssen.

## Kontext

Der aktuelle lokale POI-Umbau verlagert Bilder von separaten Host-Media-Referenzen in die POI-Formulardaten `content.mediaContents`. `Aus Mediathek auswählen` fügt ein bestehendes Asset bereits als `mediaContents`-Eintrag hinzu. `Medium hochladen` lädt aktuell über `uploadHostMediaFile`, soll aber in UX, Statusführung und Fehlerverhalten näher an den Mediathek-Upload rücken.

`plugin-poi` bleibt ein Plugin-/Workspace-Package und soll nicht direkt von App-Hooks aus `apps/sva-studio-react` abhängen. Der Upload bleibt daher über das Plugin-SDK angebunden.

## Gewählter Ansatz

`plugin-poi` behält den Host-/Plugin-SDK-Upload über `uploadHostMediaFile`. Der POI-Editor modelliert lokal denselben Ablauf wie die Mediathek:

1. Datei auswählen.
2. Upload-Session initialisieren.
3. Datei über die signierte URL hochladen.
4. Upload finalisieren.
5. Medienliste aktualisieren.
6. Das hochgeladene Asset direkt als `content.mediaContents` anhängen.

Die Alternative, `useSingleFileMediaUpload` aus der App direkt im Plugin zu verwenden, wird nicht umgesetzt, weil sie `plugin-poi` an App-Interna koppeln würde.

## UI-Verhalten

Im Medienbereich bleiben drei Aktionen sichtbar:

- `Aus Mediathek auswählen`: öffnet die bestehende Auswahl und fügt ein vorhandenes Asset hinzu.
- `Medium hochladen`: öffnet den Dateidialog und startet danach den Upload.
- Manuelle Medienanlage: bleibt als Fallback für externe URLs erhalten.

Während des Uploads zeigt der Upload-Button einen laufenden Zustand und verhindert parallele Uploads über denselben Button. Bei Erfolg wird das neue Bild unmittelbar in der Medienliste des POI angezeigt. Bei Fehlern bleibt die bestehende Formularliste unverändert und der Medienbereich zeigt eine lokale Fehlermeldung.

## Datenfluss

`PoiDetailPage` stellt dem Medien-Tab eine Upload-Funktion bereit. Diese Funktion nutzt `uploadHostMediaFile` mit `mediaType: 'image'`, `visibility: 'public'` und dem aktuellen `instanceId`, aktualisiert danach die Medienassets und gibt das neu angelegte Asset zurück.

`PoiDetailMediaTab` wandelt das zurückgegebene Asset in einen `mediaContents`-Eintrag um:

- `sourceUrl.url`: bevorzugt `previewUrl` des Assets.
- `sourceUrl.description`: Dateiname oder Asset-ID.
- `captionText`: Titel aus Metadaten, sonst Dateiname oder Asset-ID.
- `copyright`: Copyright aus Metadaten, falls vorhanden.
- `contentType`: aus dem MIME-Type abgeleitet, für Bilder `image`.

Beim Speichern wird die Zuordnung über den bestehenden POI-Payload persistiert; es gibt keinen separaten `replaceHostMediaReferences`-Schritt.

## Fehlerbehandlung

Fehler beim Initialisieren, Hochladen, Finalisieren oder Refresh der Medienliste führen zu einem sichtbaren Upload-Fehler im Medienbereich. Der Fehler hängt keinen halbfertigen `mediaContents`-Eintrag an. Ein fehlendes Asset nach erfolgreichem Upload und Refresh wird ebenfalls als Upload-Fehler behandelt, weil der POI sonst keinen stabilen Bilddatensatz zuordnen kann.

## Tests

Die Umsetzung wird mindestens diese Tests abdecken:

- `Medium hochladen` ruft den Host-Upload mit Datei, `instanceId`, `mediaType: 'image'` und `visibility: 'public'` auf.
- Nach erfolgreichem Upload und Asset-Refresh wird das neue Bild als `mediaContents` angehängt.
- Der anschließende Save sendet den neuen `mediaContents`-Eintrag im Create-/Update-Payload.
- Bei Upload-Fehlern wird kein neuer `mediaContents`-Eintrag angehängt und eine Fehlermeldung angezeigt.

## Nicht-Ziele

- Kein direkter Import von App-Hooks aus `apps/sva-studio-react` in `plugin-poi`.
- Keine Änderung am allgemeinen Mediathek-Upload.
- Keine neue Host-Media-Referenz-Persistenz für POI-Bilder.
- Keine Navigation zur Medien-Detailseite nach Upload im POI-Kontext.
