# Change: Mainserver-Inhalte als fachliche Wahrheit behandeln

## Why

Mainserver-Inhalte entstehen regulär auch außerhalb des Studios über die öffentliche API. Der derzeitige Projekte-Pfad blendet solche `FeaturedProject`-Datensätze aus, solange kein lokaler Content-Core und keine gebundene External-Content-Referenz existieren. Damit wird ein optionaler Studio-Begleitzustand unbeabsichtigt zur Voraussetzung für fachliche Sichtbarkeit.

## What Changes

- Der SVA Mainserver wird für alle Mainserver-basierten Content Items zur alleinigen fachlichen Source of Truth für Existenz, Identität, Felder, Lifecycle, Veröffentlichung, Autor und Ownership.
- Das Studio-IAM autorisiert weiterhin ausschließlich Aktionen auf Inhaltstypen; lokale Content-Cores, References, History und Projektionen sind keine fachlichen Existenzbedingungen.
- Listen und Details zeigen autorisierte Mainserver-Inhalte auch ohne lokale Begleitdatensätze.
- Studio-Mutationen schreiben zuerst zum Mainserver; lokale History-, Reference- und Projektionsfehler dürfen einen bestätigten Provider-Erfolg nicht rückwirkend in einen fachlichen Fehler verwandeln.
- Vollständige Reconciliation übernimmt externe Neuanlagen, Änderungen und Löschungen in austauschbare lokale Listenprojektionen.
- Die Studio-History bleibt transparent auf `coverage = studio_mutations` begrenzt.

## Impact

- Affected specs: `sva-mainserver-integration`, `content-management`
- Affected code: `packages/sva-mainserver`, Mainserver-Projektions- und History-Folgepfade in `apps/sva-studio-react`
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`
- API compatibility: Projekt-IDs entsprechen im Read-Pfad der stabilen Mainserver-ID; bestehende lokal gebundene Datensätze bleiben über ihre Reference adressierbar.
