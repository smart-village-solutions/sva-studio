# Waste Tour Termin-Ort-Zuordnung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Tour-Bearbeitung so umbauen, dass individuelle Termine direkt in der Tour pro Termin mit einem oder mehreren vorhandenen Abholorten und genau einem Freitext-Hinweis je Termin-Ort-Kombination gepflegt werden koennen.

**Architecture:** Die bestehende Persistenz `waste_location_tour_pickup_dates` bleibt die fachliche Quelle fuer terminbezogene Ortszuordnungen. Die Tour speichert weiterhin ihre `customDates`; die Zuordnungen `tourId + pickupDate + locationId + note` werden im Tour-Dialog mitgeladen, im selben Formular bearbeitet und beim Speichern gegen den Backend-Bestand abgeglichen. Der Plan ist bewusst **nicht testdriven**, weil das explizit so vorgegeben wurde; stattdessen wird nach jedem Aenderungsblock gezielt verifiziert.

**Tech Stack:** TypeScript Strict Mode, React, pnpm/Nx Monorepo, Vitest, Waste-Management Plugin, bestehende Scheduling- und Master-Data-APIs

---

## File Map

**Tour-Form-State und Datenmapping**
- Modify: `packages/plugin-waste-management/src/waste-management.tours.types.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.shared.ts`
- Modify: `packages/plugin-waste-management/src/use-waste-tours-state.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.actions.ts`

**Tour-Overview und Kontextdaten**
- Modify: `packages/plugin-waste-management/src/use-waste-tours-overview.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-overview.parts.ts`
- Reuse: `packages/plugin-waste-management/src/waste-management.tours.locations.ts`

**Tour-UI**
- Modify: `packages/plugin-waste-management/src/waste-management.tours-custom-dates.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-tour-fields.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-form-content.tsx`
- Optional Create: `packages/plugin-waste-management/src/waste-management.tours-custom-date-assignments.tsx`
- Optional Create: `packages/plugin-waste-management/src/waste-management.tours-custom-date-assignment-row.tsx`

**Save-/Sync-Logik**
- Modify: `packages/plugin-waste-management/src/waste-management.tours.tour-mutations.ts`
- Reuse: `packages/plugin-waste-management/src/waste-management.api.operations.ts`
- Reuse: `packages/core/src/waste-management/master-data-scheduling.ts`

**Übersetzungen**
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.tours.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.tours.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.shared.scheduling.ts` (nur falls die Tours-Factory dort die Keys definiert)

**Tests**
- Modify: `packages/plugin-waste-management/tests/waste-management.tours-custom-dates.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.tours-form-content.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.tours.shared.test.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.loaders.test.tsx`
- Optional Modify: `packages/plugin-waste-management/tests/waste-management.tours-content.test.tsx`
- Optional Modify: `packages/plugin-waste-management/tests/waste-management.scheduling-content.test.tsx` (nur wenn die bisherige Schadstoffmobil-Spezialflaeche aus der Scheduling-Sicht entfernt oder reduziert wird)

## Leitentscheidungen

- Es gibt **keine freie Suche und keine Filterung** innerhalb der neuen Termin-Ort-Zuordnung.
- Der Abholort ist immer eine Auswahl aus den bereits vorhandenen `collectionLocations`.
- Es gilt genau **ein Eintrag pro `tourId + pickupDate + locationId`**.
- Mehrere Hinweise fuer denselben Ort am selben Termin werden **nicht** als mehrere Datensaetze modelliert; sie werden in einem Freitext-Hinweis zusammengefasst.
- Die Bearbeitung liegt **direkt in der Tour**, primär im Bereich `Individuelle Termine`.
- Die technische Loesung bleibt so allgemein, dass sie spaeter auch fuer Sondertermine anderer Tourarten wiederverwendet werden kann.

## Task 1: Tour-Form-State fuer Termin-Ort-Zuordnungen erweitern

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.tours.types.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.shared.ts`
- Modify: `packages/plugin-waste-management/src/use-waste-tours-state.ts`

- [ ] `TourFormState` um eine flache Liste fuer terminbezogene Ortszuordnungen erweitern, zum Beispiel:

```ts
export type TourDateLocationAssignmentFormState = {
  readonly id: string;
  readonly pickupDate: string;
  readonly locationId: string;
  readonly note: string;
};
```

- [ ] `TourFormState` um `dateLocationAssignments: readonly TourDateLocationAssignmentFormState[]` erweitern.
- [ ] `createDefaultTourForm()` mit leerer `dateLocationAssignments`-Liste initialisieren.
- [ ] `mapTourToForm()` so vorbereiten, dass vorhandene Tourdaten weiter gemappt werden und die neuen Zuordnungen spaeter additiv injiziert werden koennen.
- [ ] Helper in `waste-management.tours.shared.ts` anlegen fuer:
  - Normalisierung von `note`
  - Vergleichsschluessel `pickupDate + locationId`
  - Entfernen verwaister Zuordnungen, wenn ein individueller Termin geloescht wird
  - Sortierung zuerst nach Datum, dann nach Ortslabel

- [ ] Verifikation fuer diesen Block ausfuehren:

```bash
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours.shared.test.ts
```

## Task 2: Tour-Overview um Abholorte und pickup dates im Tour-Kontext laden

**Files:**
- Modify: `packages/plugin-waste-management/src/use-waste-tours-overview.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-overview.parts.ts`
- Reuse: `packages/plugin-waste-management/src/waste-management.tours.locations.ts`

- [ ] Sicherstellen, dass der Tour-Bereich beim Laden sowohl die `collectionLocations` als auch `locationTourPickupDates` zur Verfuegung hat.
- [ ] Bestehende Loader-Teile pruefen und nur dort erweitern, wo der Tour-Dialog diese Daten noch nicht verlässlich bekommt.
- [ ] Eine kleine Mapping-Funktion anlegen, die fuer eine konkrete Tour alle `locationTourPickupDates` dieser Tour in `TourDateLocationAssignmentFormState` ueberfuehrt.
- [ ] Beim Oeffnen des Bearbeiten-Dialogs `state.tourForm` nicht nur mit `mapTourToForm(tour)`, sondern mit den geladenen Zuordnungen der Tour befuellen.
- [ ] Beim Oeffnen des Create-Dialogs einen leeren Zuordnungszustand setzen.

- [ ] Verifikation fuer diesen Block ausfuehren:

```bash
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.loaders.test.tsx
```

## Task 3: UI fuer Termin-Ort-Zuordnungen direkt in `Individuelle Termine` einbauen

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.tours-custom-dates.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-tour-fields.tsx`
- Optional Create: `packages/plugin-waste-management/src/waste-management.tours-custom-date-assignments.tsx`
- Optional Create: `packages/plugin-waste-management/src/waste-management.tours-custom-date-assignment-row.tsx`

- [ ] Die bisherige Tabelle in `WasteToursCustomDatesField` fachlich erweitern:
  - pro Termin weiterhin Datum und optionaler Termin-Kommentar
  - darunter oder daneben ein eigener Bereich `Abholorte fuer diesen Termin`
  - Button `Abholort zuweisen`
  - je Zuordnung: Ortsauswahl, Freitext-Hinweis, Entfernen-Aktion

- [ ] Die Komponente nicht mit Scheduling-spezifischer Sicht vermischen; sie bleibt Teil des Tour-Dialogs.
- [ ] `WasteToursTourFields` so erweitern, dass `WasteToursCustomDatesField` neben `customDates` auch folgende Props erhaelt:
  - `locations`
  - `dateLocationAssignments`
  - `onAssignmentsChange`

- [ ] In der UI die Eindeutigkeit `pickupDate + locationId` direkt absichern:
  - derselbe Abholort darf fuer denselben Termin nur einmal angelegt werden
  - stattdessen soll der vorhandene Eintrag bearbeitet werden

- [ ] Bestehende Datums-Delete-Logik erweitern:
  - wenn ein individueller Termin entfernt wird, werden alle zugehoerigen Termin-Ort-Zuordnungen aus dem Formularzustand mit entfernt

- [ ] Die Ortsauswahl auf vorhandene `collectionLocations` begrenzen und die Anzeige ueber `formatCollectionLocationLabel(...)` aus `waste-management.tours.locations.ts` aufbauen.

- [ ] Die UI so formulieren, dass sie nicht nur fuer `Schadstoffmobil`, sondern generisch fuer Sondertermine nutzbar bleibt.

- [ ] Verifikation fuer diesen Block ausfuehren:

```bash
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours-custom-dates.test.tsx --testFiles=tests/waste-management.tours-form-content.test.tsx
```

## Task 4: Save-Logik auf Tour plus Termin-Ort-Abgleich umstellen

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.tours.tour-mutations.ts`
- Reuse: `packages/plugin-waste-management/src/waste-management.api.operations.ts`

- [ ] `onSubmitTour` in zwei fachliche Schritte aufteilen:
  1. Tour selbst anlegen oder aktualisieren
  2. Termin-Ort-Zuordnungen fuer diese Tour mit `locationTourPickupDates` abgleichen

- [ ] Fuer Create-Faelle die vom Formular erzeugte Tour-ID weiterverwenden, damit die Zuordnungen direkt nach dem Tour-Create gegen dieselbe ID geschrieben werden koennen.
- [ ] Eine kleine Reconcile-Logik anlegen:
  - `existingAssignments` = alle geladenen `locationTourPickupDates` der Tour
  - `nextAssignments` = normalisierte Form-Zuordnungen
  - `toCreate` = in `next`, aber nicht in `existing`
  - `toUpdate` = in beiden vorhanden, aber `note` geaendert
  - `toDelete` = in `existing`, aber nicht mehr in `next`

- [ ] Dafuer die vorhandenen API-Operationen wiederverwenden:
  - `createWasteManagementLocationTourPickupDate`
  - `updateWasteManagementLocationTourPickupDate`
  - `deleteWasteManagementLocationTourPickupDate`

- [ ] Beim Update **nicht** die Scheduling-Oberflaeche voraussetzen; die Tour selbst muss vollstaendig speicherbar sein.
- [ ] Vor dem Persistieren sicherstellen:
  - leere `locationId`-Eintraege nicht schreiben
  - leere `note` trimmen; falls der Hinweis fachlich Pflicht sein soll, an der UI validieren
  - Zuordnungen ohne gueltigen `pickupDate` nicht schreiben

- [ ] Beim erfolgreichen Speichern `loadOverview(true)` beibehalten, damit Tour und Zuordnungen neu geladen werden.

- [ ] Verifikation fuer diesen Block ausfuehren:

```bash
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.api.test.ts
```

## Task 5: Texte, Hinweise und Validierungsfeedback nachziehen

**Files:**
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.tours.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.tours.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.shared.scheduling.ts`

- [ ] Neue Tours-Texte anlegen fuer:
  - Abschnittstitel der Termin-Ort-Zuordnung
  - Button zum Hinzufuegen eines Abholorts
  - Feldlabel fuer Abholort
  - Feldlabel fuer Hinweis
  - Leerzustand, wenn fuer einen Termin noch kein Ort zugeordnet ist
  - Meldung bei doppelter Termin-Ort-Kombination

- [ ] Vorhandene Texte so anpassen, dass der bisherige Sprung auf einen anderen Bereich fachlich nicht mehr suggeriert wird.
- [ ] Falls Scheduling-Texte fuer die fruehere Schadstoffmobil-Spezialflaeche jetzt irrefuehrend sind, diese entschlacken oder spaeter in einem Cleanup entfernen.

- [ ] Verifikation fuer diesen Block ausfuehren:

```bash
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/plugin.translations.shared.test.ts
```

## Task 6: Tour-Tests auf den neuen Fluss umstellen

**Files:**
- Modify: `packages/plugin-waste-management/tests/waste-management.tours-custom-dates.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.tours-form-content.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.tours.shared.test.ts`
- Optional Modify: `packages/plugin-waste-management/tests/waste-management.tours-content.test.tsx`
- Optional Modify: `packages/plugin-waste-management/tests/waste-management.scheduling-content.test.tsx`

- [ ] `waste-management.tours-custom-dates.test.tsx` um folgende Faelle erweitern:
  - Termin zeigt zugeordnete Abholorte an
  - neuer Ort kann fuer einen Termin hinzugefuegt werden
  - derselbe Ort kann fuer denselben Termin nicht doppelt hinzugefuegt werden
  - Loeschen eines Termins entfernt auch dessen Zuordnungen

- [ ] `waste-management.tours.shared.test.ts` um Normalisierungs- und Reconcile-Helfer erweitern.
- [ ] `waste-management.tours-form-content.test.tsx` auf die neuen Props und die Darstellung im Tour-Dialog erweitern.
- [ ] Falls Scheduling-Tests bisher die Schadstoffmobil-Spezialflaeche als Pflicht ansehen, diese Erwartung an den neuen Tour-zentrierten Fluss anpassen.

- [ ] Relevante Verifikation fuer diesen Block ausfuehren:

```bash
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours-custom-dates.test.tsx --testFiles=tests/waste-management.tours-form-content.test.tsx --testFiles=tests/waste-management.tours.shared.test.ts
```

## Task 7: Manuelle End-to-End-Pruefung im Studio

**Files:**
- Keine dauerhaften Code-Dateien; nur lokale Verifikation

- [ ] Dev-Server starten:

```bash
pnpm nx run sva-studio-react:serve
```

- [ ] Im Studio zu `.../plugins/waste-management?tab=tours...` wechseln.
- [ ] Neue Tour mit Art `Individuell` anlegen.
- [ ] Zwei individuelle Termine anlegen.
- [ ] Fuer den ersten Termin mehrere vorhandene Abholorte zuweisen und je Zuordnung einen Freitext-Hinweis eintragen.
- [ ] Fuer denselben Termin pruefen, dass derselbe Abholort nicht doppelt angelegt werden kann.
- [ ] Fuer den zweiten Termin einen anderen Satz Abholorte hinterlegen.
- [ ] Tour speichern, erneut oeffnen und pruefen:
  - Termine bleiben erhalten
  - Orte je Termin bleiben erhalten
  - Hinweise je Termin-Ort-Kombination bleiben erhalten
  - geloeschte Termine haben keine verwaisten Zuordnungen mehr

- [ ] Wenn die aeltere Scheduling-Schadstoffmobil-Flaeche noch sichtbar ist, pruefen, ob sie weiter konsistent bleibt oder in einem Folge-PR entfernt werden sollte.

## Offene Abgrenzung fuer die Umsetzung

- Kein neues DB-Schema noetig, solange `waste_location_tour_pickup_dates` weiterverwendet wird.
- Kein neuer Such- oder Filtermechanismus in der Termin-Ort-Zuordnung.
- Keine Mehrfachdatensaetze fuer dieselbe Termin-Ort-Kombination.
- Kein separater Schadstoffmobil-Sonderdialog mehr als primaerer Pflegeweg.

## Empfohlene Reihenfolge

- [ ] Erst State und Loader
- [ ] dann UI im Tour-Dialog
- [ ] dann Save-Reconcile
- [ ] dann Texte
- [ ] dann Tests
- [ ] dann manuelle Browser-Pruefung

