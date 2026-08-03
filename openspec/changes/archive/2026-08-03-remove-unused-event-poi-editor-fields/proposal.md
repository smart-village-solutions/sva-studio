# Change: Unnötige Event- und POI-Editorfelder ausblenden

## Why

Die Event- und POI-Editoren zeigen technische oder nicht benötigte Felder, die den redaktionellen Arbeitsablauf unnötig belasten. Die zugrunde liegenden Mainserver-Daten müssen aus Kompatibilitätsgründen dennoch erhalten bleiben.

## What Changes

- Event-Verknüpfung zum POI, Event-Barrierefreiheit, Event-Schlagwörter und Event-Tags werden aus dem Editor entfernt.
- POI-Schlagwörter, Tags, Barrierefreiheit, Zertifikate und freie Payload-Bearbeitung werden aus dem Editor entfernt.
- Bestehende Werte bleiben im internen Formularmodell und werden bei Updates unverändert an den Mainserver zurückgegeben.
- Das Laden der nicht mehr benötigten POI-Auswahlliste beim Öffnen eines Events entfällt.
- Sichtbare deutsche Produkttexte folgen der Terminologie aus GitHub-Issue #861: Nachrichten, Veranstaltungen, generische Inhalte, Überschrift und Einleitung.

## Impact

- Affected specs: `content-management`
- Affected code: `packages/plugin-news`, `packages/plugin-events`, `packages/plugin-generic-items`, `packages/plugin-poi`, `apps/sva-studio-react`
- Affected arc42 sections: keine; Architektur und Systemgrenzen bleiben unverändert
