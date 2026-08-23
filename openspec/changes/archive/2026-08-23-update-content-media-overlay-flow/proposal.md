# Change: Gemeinsamer Bildblock und Mainserver-kompatible Medienverwendung

## Why

Bildfähige Content-Editoren verwenden trotz eines bereits vorhandenen hostseitigen Medien-Overlay-Flows unterschiedliche Blöcke für Bildliste, manuelle URL, Vorschau, Metadatenpflege und Reihenfolge. Gleichzeitig besitzt die Studio-Medienbibliothek ein eigenständiges `MediaAsset`-Modell, während die externe Mainserver-GraphQL-API Bilder je nach Inhaltstyp weiterhin über unterschiedliche URL-basierte Felder persistiert. Ohne einen gemeinsamen Verwendungs- und Adaptervertrag entstehen inkonsistente Bedienung, doppelte Logik und das Risiko, globale Asset-Metadaten mit contentbezogenen Angaben zu vermischen.

## What Changes

- baut auf dem bestehenden Host-Medien-Overlay mit `library`, `upload` und `review` auf, statt einen konkurrierenden Flow einzuführen
- führt einen kanonischen, wiederverwendbaren Bildblock nach dem POI-Bedienmuster ein
- trennt globale `MediaAsset`-Metadaten von contentbezogenen Metadaten-Snapshots und Overrides
- übernimmt Asset-Metadaten bei der Verknüpfung als editierbare Startwerte in den Content
- aktualisiert bestehende Content-Snapshots niemals automatisch nach späteren Asset-Änderungen
- ergänzt eine explizite, feldweise und differenzbasierte Aktion `Metadaten aus Mediathek aktualisieren`
- persistiert bei Bibliotheksauswahl und Upload parallel eine Studio-`MediaReference` und einen Mainserver-kompatiblen URL-/Metadaten-Snapshot
- speichert den Mainserver-Content zuerst und ersetzt danach die zugehörigen Studio-Medienreferenzen idempotent
- macht einen Teilfehler der Referenzsynchronisation sichtbar und wiederholbar, ohne einen nicht möglichen Cross-System-Rollback vorzutäuschen
- bietet einheitlich die Einstiege `Aus Mediathek auswählen`, `Bild hochladen` und `Bild-URL manuell eingeben`
- hält manuelle URLs als bewusste Mainserver-kompatible Verwendung ohne `MediaAsset` und ohne `MediaReference` funktionsfähig
- bindet die unterschiedlichen Plugin-Formularmodelle über kleine, typsichere Adapter an ein neutrales UI-Verwendungsmodell an
- migriert News, Events, POI, Generic Items, Projects und Cockpit Cards auf den gemeinsamen Kernblock
- belässt die Medienverwaltung als kanonischen Vollseiten-Einstieg und `MediaAsset` als eigenständiges Bibliotheksobjekt

## Impact

- Affected specs: `media-management`, `content-management`
- Affected code: geteilte Media-UI in `packages/studio-ui-react`, Host-Media- und Referenz-Clients in `packages/plugin-sdk`, Host-Integration in `apps/sva-studio-react`, Content-Editoren in `packages/plugin-news`, `packages/plugin-events`, `packages/plugin-poi`, `packages/plugin-generic-items`, `packages/plugin-projects`, `packages/plugin-cockpit-cards`
- Existing contracts reused: `iam.media_references`, `listHostMediaReferencesByTarget`, `replaceHostMediaReferences`, bestehender `StudioMediaPickerOverlay`
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`
- Affected guide: `docs/guides/plugin-development.md`
- Database impact: keine neue Tabelle und keine Migration geplant; falls für einen dauerhaft persistierten Synchronisationsstatus doch ein Schemaeingriff erforderlich wird, muss dieser vor Implementierung separat spezifiziert und mit den kanonischen DB-Schema-Dokumenten fortgeschrieben werden
