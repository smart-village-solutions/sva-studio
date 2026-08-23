# Change: Lokale Content-Bilder erst beim Speichern persistieren

## Why

Der gemeinsame Medien-Overlay-Flow lädt eine lokal ausgewählte Bilddatei derzeit sofort als eigenständiges `MediaAsset` hoch. Wird die Content-Bearbeitung danach abgebrochen, die Auswahl entfernt oder die Seite ohne Speichern verlassen, bleibt deshalb ein ungenutztes Medium in der Mediathek zurück. [GitHub-Issue #969](https://github.com/smart-village-solutions/sva-studio/issues/969) verlangt stattdessen einen echten Content-Entwurf: Vor dem Speichern darf nur eine lokale Vorschau existieren; Upload, Asset-Persistenz und Content-Verknüpfung gehören in einen gemeinsamen, wiederholbaren Speicherlebenszyklus.

## What Changes

- führt für lokale Dateien im Content-Editor einen transienten, nicht serialisierbaren Draft-Zustand mit lokaler Vorschau ein
- belässt den eigenständigen Upload unter `/admin/media` sowie die Auswahl bereits vorhandener Bibliotheksassets unverändert
- startet Upload und serverseitige Validierung lokaler Content-Bilder erst nach ausgelöster und erfolgreicher clientseitiger Content-Validierung
- führt tenant- und actor-gebundene provisorische Medienassets ein, die bis zum erfolgreichen Content-/Referenzabschluss nicht in Mediathek, Suche oder regulärer Auswahl erscheinen
- koordiniert provisorische Assets, gewünschte Referenzen und Mainserver-Speicherung über eine idempotente Content-Media-Save-Operation
- aktiviert neu hochgeladene Assets erst zusammen mit dem erfolgreichen Replace der Studio-`MediaReference`s
- verwirft provisorische Assets bei eindeutig fehlgeschlagener Content-Speicherung ohne die Benutzerberechtigung `media.delete`
- hält unklare oder nach Mainserver-Erfolg noch nicht abgeschlossene Zustände für Retry und Reconciliation fest, statt Assets voreilig zu löschen
- ergänzt einen lease-basierten Cleanup-/Recovery-Pfad für abgebrochene oder veraltete Operationen
- vereinheitlicht den Ablauf für News, Events, POI, Generic Items, Projects und Cockpit Cards über gemeinsame UI- und SDK-Verträge
- macht Upload-, Content-, Referenz-, Cleanup- und unklare Teilzustände barrierefrei unterscheidbar

## Impact

- Affected specs: `content-management`, `media-management`
- Affected code:
  - `packages/studio-ui-react` für lokalen Datei-Draft, Vorschau-Lebenszyklus und gemeinsamen Overlay-Modus
  - `packages/plugin-sdk` für Save-Operation-, Upload-, Commit-, Abandon- und Retry-Orchestrierung
  - `packages/auth-runtime` für provisorische Assets, Autorisierung, Aktivierung, Cleanup und Audit
  - `packages/data-repositories` und `packages/data` für persistente Save-Operationen, Statusübergänge und Migration
  - `packages/sva-mainserver` für die Korrelation erfolgreicher Content-Mutationen mit der Save-Operation
  - `packages/plugin-news`, `packages/plugin-events`, `packages/plugin-poi`, `packages/plugin-generic-items`, `packages/plugin-projects` und `packages/plugin-cockpit-cards` für die typsichere Anbindung an den gemeinsamen Ablauf
  - `apps/sva-studio-react` für Host-Routen und Runtime-Recovery
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`
- Affected guide: `docs/guides/plugin-development.md`
- Database impact: additive Migration für provisorischen Asset-Zustand sowie Content-Media-Save-Operationen; `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` müssen mitgeführt werden
- Related active changes:
  - supersedes für Content-Uploads den Abbruchvertrag aus `update-content-media-overlay-flow`, nach dem ein bereits hochgeladenes Asset beim Abbruch in der Mediathek verbleibt
  - lässt `add-single-file-media-upload` für den expliziten Bibliotheksupload unverändert
  - bleibt mit `add-media-async-processing` kompatibel; provisorisch/aktiv und technisch in Verarbeitung/ready sind getrennte Zustandsachsen
