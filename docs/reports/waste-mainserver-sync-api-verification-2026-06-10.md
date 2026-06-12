# Waste-Mainserver-Sync API-Verifikation 2026-06-10

## Status

Die Implementierung des Waste-Mainserver-Sync-Jobs ist in diesem Lauf technisch verdrahtet und über Unit-Tests abgesichert worden.

Die hier dokumentierten Findings basieren aktuell auf:

- dem GraphQL-Schema-Snapshot im Repository
- den neuen Unit-Tests für `packages/sva-mainserver`
- der Diff-/Orchestrierungslogik in `apps/sva-studio-react`

Eine manuelle oder gegen echte Safe-Systeme ausgeführte Live-Verifikation gegen `de-musterhausen` wurde in diesem Lauf noch nicht abgeschlossen.

## Zielsysteme

- Studio: `https://de-musterhausen.studio.localhost:3000`
- Mainserver: `https://de-musterhausen.server.smart-village.app`

## Geprüfte Operationen

- `wasteTours`
- `wasteLocationTypes(tourId)`
- `createWastePickUpTimes`
- `destroyWastePickUpTime`

## Aktueller technischer Stand

### `wasteTours`

- Erwartete Felder laut Snapshot und Adapter: `id`, `title`, `wasteType`
- Der neue Adapter mappt diese Felder in eine stabile Tour-Sicht für den Sync

### `wasteLocationTypes(tourId)`

- Erwartete Felder laut Snapshot und Adapter:
  - `id`
  - `wasteType`
  - `address.street`
  - `address.zip`
  - `address.city`
  - `pickUpTimes.id`
  - `pickUpTimes.pickupDate`
  - `pickUpTimes.note`
  - `pickUpTimes.wasteLocationTypeId`

### `createWastePickUpTimes`

- Der Adapter sendet Batch-Inputs als `WastePickUpTimeSimplifiedInput[]`
- Der aktuelle Batch enthält:
  - `pickupDate`
  - `wasteType`
  - `street`
  - optional `zip`
  - optional `city`
  - optional `note`
  - aktuell keine Rhythmusfelder aus dem Read-Snapshot

### `destroyWastePickUpTime`

- Primärpfad: Löschung per `ids`
- Fallback-Pfad: Löschung per `pickupDate + wasteLocationType`
- Der Fallback verwendet aktuell:
  - `wasteType`
  - `address.street`
  - optional `address.zip`
  - optional `address.city`
  - keine Rhythmusfelder aus dem Read-Snapshot

## Finalisierte Matching-Entscheidung im Code

- Schlüssel: `pickupDate + wasteType + street + zip + city`
- Vergleich: normalisiert über `trim()` und `toLocaleLowerCase('de-DE')`
- Delete-Pfad: zuerst `ids`, nur ohne Upstream-ID Fallback auf `pickupDate + wasteLocationType`
- `district`, `rhythmRrule`, `rhythmStartDate`, `rhythmExcludes` sind aktuell nicht Teil des Match-Schlüssels

## Offene Punkte vor Live-Freigabe

- Studio-zu-Mainserver-Mapping gegen echte `de-musterhausen`-Daten prüfen
- Validieren, ob die aktuelle Studio-Ableitung für `street`, `zip` und `city` fachlich vollständig ist
- Bestätigen, dass der Fallback `destroyWastePickUpTime(pickupDate, wasteLocationType)` gegen das echte System ausreicht
- Prüfen, ob zusätzliche Address- oder District-Felder für stabile Diffs benötigt werden

## Nächster manueller Verifikationsschritt

1. Studio lokal starten
2. Mainserver-Zugang für `de-musterhausen` verwenden
3. `wasteTours` und `wasteLocationTypes(tourId)` gegen echte Antworten vergleichen
4. Create-/Delete-Verhalten in einer sicheren Testkonstellation mit nachvollziehbaren Beispieldatensätzen prüfen
