# Change: Nachrichteninhalt optional machen

## Why

Nachrichten können fachlich auch ohne redaktionellen Langtext vorliegen. Die serverseitige Route verlangt derzeit trotzdem mindestens einen Inhaltsblock mit sichtbarem Body-Text und verhindert damit das Speichern solcher Nachrichten.

## What Changes

- Nachrichten dürfen ohne `contentBlocks`, mit `null`, mit einer leeren Liste oder mit Inhaltsblöcken ohne sichtbaren Body-Text gespeichert werden.
- Vorhandene Struktur-, Medien-URL- und Längenvalidierungen für tatsächlich übermittelte Inhaltsblöcke bleiben bestehen.
- Die bereits optionale Source-URL bleibt unverändert und ist nicht Teil der Änderung.

## Impact

- Affected specs: `content-management`
- Affected code: `packages/sva-mainserver/src/server/news-route.ts` und zugehörige Tests
- Affected arc42 sections: keine; die Änderung lockert ausschließlich eine bestehende Eingabevalidierung
