# Waste Schadstoffmobil Einsaetze Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das bestehende Waste-Management-Modell so erweitern, dass eine einzelne Tour `Schadstoffmobil` explizite Einsaetze pro Datum und Abholort mit Freitext-Hinweis speichern, importieren, im Studio pflegen und im Public Waste Web anzeigen kann.

**Architecture:** Die bestehende Tabelle `waste_location_tour_pickup_dates` bleibt der zentrale Datentraeger fuer ortsbezogene Termine und wird additiv um `note` erweitert. Alle Schichten folgen diesem Feld: Schema, Core-Typen, Repository, Import, Materialisierung, Public Waste Web und Studio-UI. Der Plan ist bewusst **nicht testdriven**, weil der Nutzer das explizit ausgeschlossen hat; stattdessen wird nach jedem abgeschlossenen Aenderungsblock gezielt verifiziert.

**Tech Stack:** TypeScript strict mode, pnpm/Nx Monorepo, Vitest, TanStack/React UI, Postgres-Schema-Builder, Public Waste Calendar Web

---

## File Map

**Schema und Shared Types**
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.schema.ts`
- Modify: `packages/core/src/waste-management/master-data-scheduling.ts`
- Modify: `packages/core/src/index.ts` (nur falls Exportkette angepasst werden muss)
- Modify: `packages/data-repositories/src/index.ts` (falls Exportkette betroffen)

**Repository und Runtime**
- Modify: `packages/data-repositories/src/waste-management/master-data.location-tour-pickup-dates.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.test.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.contract.ts` (nur falls Signaturen nachgezogen werden muessen)
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.ts` (nur wenn API-Shape explizit transformiert wird)

**Import und Materialisierung**
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.import.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.import.server.test.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-mainserver-sync.materialization.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-mainserver-sync.server.test.ts`

**Public Waste Web**
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.test.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-calendar-occurrences.ts` (nur falls Note-Prioritaet angepasst werden muss)
- Modify: `apps/public-waste-calendar-web/src/components/public-waste-event-dialog.tsx` (nur falls Darstellung des Einsatz-Hinweises angepasst werden muss)

**Studio-UI**
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.operations-overview.ts`
- Create or Modify: `packages/plugin-waste-management/src/waste-management.scheduling-schadstoffmobil-*.tsx` (neue kleine Einheiten fuer Einsatzliste und Dialog)
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-panel.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-content.tsx`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.scheduling.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.scheduling.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.scheduling-panel.test.tsx`
- Modify or Create: `packages/plugin-waste-management/tests/waste-management.scheduling-content.test.tsx`

**Dokumentation**
- Modify: `docs/development/studio-db-schema-final.sql`
- Modify: `docs/development/studio-db-schema.md` (falls Snapshot-Erlaeuterung angepasst werden muss)

## Task 1: Schema, Snapshot und Core-Typen erweitern

**Files:**
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.schema.ts`
- Modify: `packages/core/src/waste-management/master-data-scheduling.ts`
- Modify: `docs/development/studio-db-schema-final.sql`
- Modify: `docs/development/studio-db-schema.md`

- [ ] **Step 1: `note` im Runtime-Schema und im Snapshot ergaenzen**

Fuege das Feld additiv in die Tabelle `waste_location_tour_pickup_dates` ein.

```ts
`CREATE TABLE IF NOT EXISTS ${schema}.waste_location_tour_pickup_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES ${schema}.waste_collection_locations(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL REFERENCES ${schema}.waste_tours(id) ON DELETE CASCADE,
  pickup_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT waste_location_tour_pickup_dates_location_tour_date_unique UNIQUE (location_id, tour_id, pickup_date)
);`,
`ALTER TABLE ${schema}.waste_location_tour_pickup_dates ADD COLUMN IF NOT EXISTS note TEXT;`,
```

Uebernehme dieselbe Spalte in `docs/development/studio-db-schema-final.sql`.

- [ ] **Step 2: Core-Typ fuer pickup dates um `note` erweitern**

```ts
export type WasteLocationTourPickupDateRecord = {
  readonly id: string;
  readonly locationId: string;
  readonly tourId: string;
  readonly pickupDate: string;
  readonly note?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};
```

In `docs/development/studio-db-schema.md` kurz dokumentieren, dass ortsbezogene Tourtermine jetzt optional einen Freitext-Hinweis fuer Schadstoffmobil-Einsaetze tragen.

- [ ] **Step 3: Relevante Typ-Checks fuer diesen Block ausfuehren**

Run:

```bash
pnpm check:server-runtime
pnpm nx run plugin-waste-management:test:types
```

Expected:
- `check:server-runtime` gruen
- `plugin-waste-management:test:types` gruen oder nur bereits bekannte, nicht von diesem Block verursachte Fehler

- [ ] **Step 4: Block committen**

```bash
git add apps/sva-studio-react/src/lib/waste-management-operations.schema.ts \
  packages/core/src/waste-management/master-data-scheduling.ts \
  docs/development/studio-db-schema-final.sql \
  docs/development/studio-db-schema.md
git commit -m "feat: add note to waste pickup dates"
```

## Task 2: Repository, Contracts und Scheduling-Overview nachziehen

**Files:**
- Modify: `packages/data-repositories/src/waste-management/master-data.location-tour-pickup-dates.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.test.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.contract.ts` (falls erforderlich)
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.ts` (nur wenn Mapping explizit ist)
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.operations-overview.ts`

- [ ] **Step 1: Repository-Selects und Upsert um `note` erweitern**

```ts
type WasteLocationTourPickupDateRow = {
  readonly id: string;
  readonly location_id: string;
  readonly tour_id: string;
  readonly pickup_date: string;
  readonly note: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

const mapWasteLocationTourPickupDateRow = (
  row: WasteLocationTourPickupDateRow
): WasteLocationTourPickupDateRecord => ({
  id: row.id,
  locationId: row.location_id,
  tourId: row.tour_id,
  pickupDate: row.pickup_date,
  ...(row.note?.trim() ? { note: row.note } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
```

Das Upsert muss `note` mitschreiben und bei Konflikten aktualisieren:

```ts
INSERT INTO waste_location_tour_pickup_dates (
  id,
  location_id,
  tour_id,
  pickup_date,
  note
)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4::date, $5::text)
ON CONFLICT (location_id, tour_id, pickup_date) DO UPDATE
SET note = EXCLUDED.note,
    updated_at = NOW();
```

- [ ] **Step 2: Repository-Test auf neues Feld erweitern**

Ergaenze die bestehende Pickup-Date-Repository-Story in `packages/data-repositories/src/waste-management/master-data.test.ts` so, dass `note` gelesen und geschrieben wird.

```ts
await expect(
  createWasteMasterDataRepository(list.executor).listWasteLocationTourPickupDates({
    tourId: 'tour-1',
  })
).resolves.toEqual([
  {
    id: 'pickup-1',
    locationId: 'location-1',
    tourId: 'tour-1',
    pickupDate: '2026-01-10',
    note: 'Dienstag 14:00-16:30 Uhr, Parkplatz am Rathaus',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T11:00:00.000Z',
  },
]);
```

- [ ] **Step 3: Scheduling-Overview-Typen auf Additivitaet pruefen**

Stelle sicher, dass `WasteManagementSchedulingOverview` im Plugin und die Runtime-Loader das Feld ohne Sondermapping transportieren koennen. Wenn kein zusaetzlicher Code noetig ist, dokumentiere das im Commit durch den angepassten Typ in `packages/plugin-waste-management/src/waste-management.api.types.operations-overview.ts`.

- [ ] **Step 4: Kleinsten relevanten Unit-Run fuer diesen Block ausfuehren**

Run:

```bash
pnpm nx run data-repositories:test:unit --testFiles=src/waste-management/master-data.test.ts
```

Fallback, falls das Nx-Target keine Dateifilter sauber annimmt:

```bash
cd packages/data-repositories && pnpm exec vitest run src/waste-management/master-data.test.ts
```

Expected:
- Pickup-Date-Repository-Test gruen

- [ ] **Step 5: Block committen**

```bash
git add packages/data-repositories/src/waste-management/master-data.location-tour-pickup-dates.ts \
  packages/data-repositories/src/waste-management/master-data.test.ts \
  packages/data-repositories/src/waste-management/master-data.contract.ts \
  packages/plugin-waste-management/src/waste-management.api.types.operations-overview.ts \
  packages/auth-runtime/src/waste-management/server-loaders.ts
git commit -m "feat: carry pickup date notes through repository"
```

## Task 3: Import und Materialisierung fuer `note` erweitern

**Files:**
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.import.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.import.server.test.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-mainserver-sync.materialization.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-mainserver-sync.server.test.ts`

- [ ] **Step 1: Importprofil `ortsbezogene-tourtermine` um `note` erweitern**

Fuehre in der CSV-/Persistenzlogik ein optionales Feld `note` ein und trimme es fail-closed.

```ts
const normalizeOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};
```

Beim Persistieren:

```ts
await repository.upsertWasteLocationTourPickupDate({
  id: row.locationTourPickupDateId,
  locationId: row.locationId,
  tourId: row.tourId,
  pickupDate: row.pickupDate,
  note: normalizeOptionalText(row.note),
});
```

- [ ] **Step 2: Import- und Servertests mit `note` ergaenzen**

Passe die ortsbezogenen Importtests so an, dass eine Beispielzeile `note` enthaelt und der persistierte Datensatz sie weitertraegt.

```ts
expect(repository.upsertWasteLocationTourPickupDate).toHaveBeenCalledWith(
  expect.objectContaining({
    pickupDate: '2026-05-19',
    note: 'Dienstag 14:00-16:30 Uhr, Parkplatz am Rathaus',
  })
);
```

- [ ] **Step 3: Mainserver-/Materialisierungspfad additiv halten**

In `apps/sva-studio-react/src/lib/waste-management-mainserver-sync.materialization.ts` und zugehoerigen Tests sicherstellen, dass `note` bei `locationTourPickupDates` erhalten bleibt. Keine neue Ableitungslogik; nur additiver Durchtransport.

- [ ] **Step 4: Relevante Tests dieses Blocks ausfuehren**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/lib/waste-management-operations.import.server.test.ts --testFiles=src/lib/waste-management-operations.server.test.ts --testFiles=src/lib/waste-management-mainserver-sync.server.test.ts
```

Expected:
- Import- und Materialisierungstests fuer pickup dates gruen

- [ ] **Step 5: Block committen**

```bash
git add apps/sva-studio-react/src/lib/waste-management-operations.import.ts \
  apps/sva-studio-react/src/lib/waste-management-operations.import.server.test.ts \
  apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts \
  apps/sva-studio-react/src/lib/waste-management-mainserver-sync.materialization.ts \
  apps/sva-studio-react/src/lib/waste-management-mainserver-sync.server.test.ts
git commit -m "feat: import pickup date notes"
```

## Task 4: Public Waste Web auf Einsatz-Hinweis ausrichten

**Files:**
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.test.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-calendar-occurrences.ts` (falls Note-Priorisierung noetig ist)
- Modify: `apps/public-waste-calendar-web/src/components/public-waste-event-dialog.tsx` (nur falls Darstellung geklaert werden muss)

- [ ] **Step 1: Query fuer importierte pickup dates um `p.note` erweitern**

```ts
type ImportedPickupDateRow = {
  readonly location_id: string;
  readonly pickup_date: string;
  readonly tour_id: string;
  readonly tour_name: string;
  readonly tour_description: string | null;
  readonly fraction_id: string | null;
  readonly fraction_label: string | null;
  readonly fraction_pdf_short_label: string | null;
  readonly fraction_color: string | null;
  readonly note: string | null;
};
```

Im SQL:

```sql
SELECT
  p.location_id::text AS location_id,
  p.pickup_date::text AS pickup_date,
  ...
  f.color AS fraction_color,
  p.note AS note
FROM ...
```

- [ ] **Step 2: Projektion so anpassen, dass explizite pickup-date-notes angezeigt werden**

Wenn bisher nur Shift-Beschreibungen oder Occurrence-Notes verwendet werden, setze die Prioritaet fuer explizite pickup-date-notes passend zum Spec-Ziel.

Empfohlene Prioritaet:

```ts
const note =
  importedPickupDate.note?.trim() ??
  tourShift?.description ??
  globalShift?.description ??
  occurrence.note ??
  null;
```

Falls bestehendes Verhalten bewusst Shift-Beschreibungen bevorzugt, pruefe dies gegen die Spec und entscheide explizit. Fuer Schadstoffmobil-Einsaetze soll der explizite Hinweis sichtbar sein.

- [ ] **Step 3: Public-Tests fuer Datum+Ort+Hinweis ergaenzen**

Erweitere `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.test.ts` um einen Fall mit importiertem pickup date und `note`.

```ts
expect(entries).toContainEqual(
  expect.objectContaining({
    date: '2026-05-19',
    note: 'Dienstag 14:00-16:30 Uhr, Parkplatz am Rathaus',
  })
);
```

- [ ] **Step 4: Kleinsten relevanten Testlauf ausfuehren**

Run:

```bash
pnpm nx run public-waste-calendar-web:test:unit --testFiles=src/lib/public-waste-repository.server.test.ts --testFiles=src/lib/public-waste-calendar-occurrences.test.ts --testFiles=src/components/public-waste-event-dialog.test.tsx
```

Expected:
- Public Waste Web zeigt explizite pickup-date-notes korrekt an

- [ ] **Step 5: Block committen**

```bash
git add apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts \
  apps/public-waste-calendar-web/src/lib/public-waste-repository.server.test.ts \
  apps/public-waste-calendar-web/src/lib/public-waste-calendar-occurrences.ts \
  apps/public-waste-calendar-web/src/components/public-waste-event-dialog.tsx
git commit -m "feat: expose schadstoffmobil pickup notes publicly"
```

## Task 5: Studio-UI fuer Schadstoffmobil-Einsatzliste bauen

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-panel.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-content.tsx`
- Create: `packages/plugin-waste-management/src/waste-management.scheduling-schadstoffmobil-list.tsx`
- Create: `packages/plugin-waste-management/src/waste-management.scheduling-schadstoffmobil-dialog.tsx`
- Create: `packages/plugin-waste-management/src/waste-management.scheduling-schadstoffmobil-form.tsx`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.scheduling.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.scheduling.ts`
- Modify or Create: `packages/plugin-waste-management/tests/waste-management.scheduling-content.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.scheduling-panel.test.tsx`

- [ ] **Step 1: UI-Schnitt sauber schneiden**

Baue keine Grosskomponente direkt in `waste-management.scheduling-content.tsx`. Zerlege in:

```tsx
// waste-management.scheduling-schadstoffmobil-list.tsx
export const WasteSchadstoffmobilAssignmentsList = ({ entries, tours, locations, onCreate, onEdit, onDelete }) => { ... };

// waste-management.scheduling-schadstoffmobil-dialog.tsx
export const WasteSchadstoffmobilAssignmentDialog = ({ open, mode, form, locations, onChange, onSubmit, onClose }) => { ... };
```

Die Listenzeile braucht nur:
- Datum
- Abholort-Label
- Hinweis
- Aktionen

- [ ] **Step 2: Nur fuer die Tour `Schadstoffmobil` eine einsatzbezogene Pflege anbieten**

Die fachliche Regel muss im UI-Fluss verankert werden, nicht global fuer alle pickup dates. Nutze eine explizite Erkennung ueber den Tournamen oder eine spaetere dedizierte Markierung, falls schon vorhanden.

Minimaler Einstieg:

```ts
const isSchadstoffmobilTour = (tourName: string): boolean =>
  tourName.trim().localeCompare('Schadstoffmobil', 'de', { sensitivity: 'base' }) === 0;
```

Wenn das Projekt bereits einen robusteren Marker kennt, verwende diesen stattdessen.

- [ ] **Step 3: Dialogvalidierung fuer Pflicht-Hinweis bauen**

Der Hinweis ist fuer Schadstoffmobil-Einsaetze im Studio Pflicht.

```ts
const trimmedNote = form.note.trim();
if (trimmedNote.length === 0) {
  setError('note', 'wasteManagement.scheduling.schadstoffmobil.validation.noteRequired');
  return;
}
```

Der Dialog schreibt auf `WasteLocationTourPickupDateRecord.note`.

- [ ] **Step 4: Uebersetzungen in DE/EN ergaenzen**

Ergaenze nur die konkret benoetigten Keys, z. B.:

```ts
schadstoffmobil: {
  title: 'Schadstoffmobil-Einsaetze',
  create: 'Einsatz anlegen',
  fields: {
    pickupDate: 'Datum',
    location: 'Abholort',
    note: 'Hinweis',
  },
  validation: {
    noteRequired: 'Der Hinweis ist fuer Schadstoffmobil-Einsaetze erforderlich.',
  },
}
```

- [ ] **Step 5: UI-Tests fuer Anlegen/Bearbeiten/Loeschen nachziehen**

Mindestens ein Testfall muss pruefen:
- Liste rendert Datum, Ort und Hinweis
- Dialog blockt leeren Hinweis
- Speichern traegt `note` durch

Beispielassertion:

```ts
expect(screen.getByText('Dienstag 14:00-16:30 Uhr, Parkplatz am Rathaus')).toBeTruthy();
expect(screen.getByText('Der Hinweis ist fuer Schadstoffmobil-Einsaetze erforderlich.')).toBeTruthy();
```

- [ ] **Step 6: Kleinsten relevanten UI-Testlauf ausfuehren**

Run:

```bash
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.scheduling-content.test.tsx --testFiles=tests/waste-management.scheduling-panel.test.tsx
```

Expected:
- Schadstoffmobil-Einsatzliste und Dialog-Flow gruen

- [ ] **Step 7: Block committen**

```bash
git add packages/plugin-waste-management/src/waste-management.scheduling-panel.tsx \
  packages/plugin-waste-management/src/waste-management.scheduling-content.tsx \
  packages/plugin-waste-management/src/waste-management.scheduling-schadstoffmobil-list.tsx \
  packages/plugin-waste-management/src/waste-management.scheduling-schadstoffmobil-dialog.tsx \
  packages/plugin-waste-management/src/waste-management.scheduling-schadstoffmobil-form.tsx \
  packages/plugin-waste-management/src/plugin.translations.de.scheduling.ts \
  packages/plugin-waste-management/src/plugin.translations.en.scheduling.ts \
  packages/plugin-waste-management/tests/waste-management.scheduling-content.test.tsx \
  packages/plugin-waste-management/tests/waste-management.scheduling-panel.test.tsx
git commit -m "feat: manage schadstoffmobil assignments in studio"
```

## Task 6: Abschlussverifikation und PR-Gate

**Files:**
- No new code by default
- Review: alle in den Tasks 1-5 genannten Dateien

- [ ] **Step 1: Diff auf ungewollte Seiteneffekte pruefen**

Run:

```bash
git diff --stat
git diff -- apps/sva-studio-react/src/lib/waste-management-operations.schema.ts \
  packages/core/src/waste-management/master-data-scheduling.ts \
  packages/data-repositories/src/waste-management/master-data.location-tour-pickup-dates.ts \
  apps/sva-studio-react/src/lib/waste-management-operations.import.ts \
  apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts \
  packages/plugin-waste-management/src/waste-management.scheduling-content.tsx
```

Expected:
- Nur die geplanten Schadstoffmobil-/pickup-date-note-Aenderungen sind sichtbar

- [ ] **Step 2: Kleinsten echten Gate-Pfad fuer den Gesamtumfang ausfuehren**

Run:

```bash
pnpm nx affected --target=test:unit --base=origin/main
pnpm nx affected --target=test:types --base=origin/main
pnpm check:server-runtime
```

Expected:
- Affected Unit und Types gruen
- Server-Runtime-Guard gruen

- [ ] **Step 3: Wenn die Affected-Gates zu breit oder instabil sind, die Abweichung transparent dokumentieren**

Dokumentiere im Arbeitsprotokoll oder in der Abschlussnotiz:
- welcher Nx-Target gelaufen ist
- welcher Lauf wegen bestehender Fremdfehler nicht voll verwertbar war
- welche direkt betroffenen Tests gruen sind

- [ ] **Step 4: Final commit fuer Restarbeiten**

```bash
git add -A
git commit -m "feat: support schadstoffmobil assignment notes"
```

## Self-Review

- Spec coverage:
  - Datenmodell `note` auf pickup dates: Task 1-2
  - Importpfad `ortsbezogene-tourtermine`: Task 3
  - Public-Ausgabe Datum+Ort+Hinweis: Task 4
  - Studio-Pflege fuer Schadstoffmobil-Einsaetze: Task 5
  - Snapshot/Dokumentation/Gates: Task 1 und Task 6
- Placeholder scan:
  - Keine `TODO`-/`TBD`-Marker im Plan
  - Jede Aenderungsgruppe nennt konkrete Dateien und konkrete Commands
- Type consistency:
  - Ueberall derselbe Feldname `note`
  - `WasteLocationTourPickupDateRecord` ist die zentrale Typquelle fuer alle nachgelagerten Schichten
