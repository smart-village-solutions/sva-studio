# Change: Vereinheitlichter Medien-Overlay-Flow für Content-Editoren

## Why

Der Medien-Upload in Content-Editoren verwendet heute einen vereinfachten Inline-Flow, der sich deutlich von der Medienverwaltung unterscheidet. Dadurch entstehen inkonsistente Erwartungen bei Upload, Metadatenpflege und Abschluss des Workflows.

## What Changes

- führt einen kanonischen Host-Medien-Overlay-Flow für Content-Editoren ein
- verwendet denselben Upload-Intake wie die Medienverwaltung
- ergänzt einen verpflichtenden Review-Schritt für Metadaten vor der Content-Zuordnung
- stellt die Content-Zuordnung erst nach explizitem Abschluss `Medium übernehmen` her
- belässt die Medienverwaltung als kanonischen Vollseiten-Einstieg mit bestehender Navigation zur Mediendetailseite

## Impact

- Affected specs: `media-management`, `content-management`
- Affected code: Host-Media-UI in `apps/sva-studio-react`, geteilte UI-Bausteine in `packages/studio-ui-react`, Host-Media-Clients in `packages/plugin-sdk`, Content-Editoren in `packages/plugin-news`, `packages/plugin-events`, `packages/plugin-poi`, `packages/plugin-generic-items`
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`
