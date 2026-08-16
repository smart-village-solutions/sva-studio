# Change: News-Kompatibilitäts-Snapshot entflechten

## Why

Die Synchronisation historischer News-Felder bündelt gleichförmige Feldübernahmen und fachliche Sonderfälle in einer hochkomplexen Funktion. Eine explizit typisierte Zerlegung soll den laufenden Legacy-Datenvertrag prüfbar erhalten und das Risiko unbeabsichtigter Überschreibungen reduzieren.

## What Changes

- Gleichförmige String- und Boolean-Übernahmen werden über interne, typisierte Feldgruppen synchronisiert.
- Publication-, Push-, Address- und ContentBlocks-Sonderfälle bleiben getrennt und behalten ihre bestehende Priorität.
- Eine vollständige Characterization-Matrix belegt Touched-, Laufzeittyp-, Konflikt-, Referenz- und Create/Edit-Semantik.

## Impact

- Affected specs: `content-management`
- Affected code: `packages/plugin-news/src/news.detail-form.ts`, zugehörige Tests
- Affected arc42 sections: `08-cross-cutting-concepts`
