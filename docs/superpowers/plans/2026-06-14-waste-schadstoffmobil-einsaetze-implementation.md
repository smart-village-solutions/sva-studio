# Generische Tour-Einsätze mit mehreren Abholorten

**Ziel:** Das Waste-Management-Modell erhält generische explizite Tour-Einsätze. Ein Einsatz gehört zu einer normalen Tour, hat ein Datum, einen optionalen gemeinsamen Hinweis und einen oder mehrere Abholorte. Das Schadstoffmobil nutzt dieses Modell ausschließlich über seine normale Abfallfraktion und Tourzuordnung.

**Architektur:** Abfallfraktionen bleiben die einzige Grundlage für Kalenderfilter, Labels und Farben. Touren tragen ihre Fraktionen bereits über `wasteFractionIds`. Neue Einsätze werden in einer eigenen Tabelle gespeichert und über eine Zuordnungstabelle mit Abholorten verbunden. Die bestehende Tabelle `waste_location_tour_pickup_dates` wird nur als Migrationsquelle behandelt; sie ist wegen ihrer Eindeutigkeit auf Tour, Ort und Datum nicht das Zielmodell. Die redaktionelle Pflege erweitert die vorhandene Tour- und Scheduling-Oberfläche generisch. Es entstehen keine Schadstoffmobil-Sonderrolle, Namenskonvention, Sonder-API oder Sondermaske.

**Abgrenzung:** Fachlich kann es mehrere Touren mit der Fraktion Schadstoffmobil und mehrere Einsätze derselben Tour am selben Tag geben. Der Hinweis ist bei allen Einsätzen optional. Ein Einsatz darf mehrere, auch übergeordnete, Abholorte abdecken.

## Dateiübersicht

**Schema, Migration und Shared Types**

- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.schema.ts`
- Create: `apps/sva-studio-react/src/lib/waste-management-tour-assignments.migration.ts`
- Create: `apps/sva-studio-react/src/lib/waste-management-tour-assignments.migration.server.test.ts`
- Modify: `packages/core/src/waste-management/master-data-scheduling.ts`
- Modify: `packages/core/src/index.ts` (falls Exporte ergänzt werden)
- Modify: `docs/development/studio-db-schema-final.sql`
- Modify: `docs/development/studio-db-schema.md`

**Repository und geschützte API**

- Create: `packages/data-repositories/src/waste-management/master-data.tour-assignments.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.contract.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.test.ts`
- Modify: `packages/data-repositories/src/index.ts`
- Create: `packages/auth-runtime/src/waste-management/core/tour-assignments.ts`
- Create: `packages/auth-runtime/src/waste-management/core/tour-assignments.direct.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/schemas.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/types.ts`
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.ts`

**Import, Materialisierung und öffentliche Ausgabe**

- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.import.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.import.server.test.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-mainserver-sync.materialization.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-mainserver-sync.materialization.test.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.test.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-calendar-occurrences.ts` (falls die Zusammenführung dort liegt)

**Studio-UI**

- Modify: `packages/plugin-waste-management/src/waste-management.api.types.operations-overview.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-panel.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-content.tsx`
- Create: `packages/plugin-waste-management/src/waste-management.scheduling-assignment-list.tsx`
- Create: `packages/plugin-waste-management/src/waste-management.scheduling-assignment-dialog.tsx`
- Create: `packages/plugin-waste-management/src/waste-management.scheduling-assignment-form.tsx`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.scheduling.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.scheduling.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.scheduling-content.test.tsx`

## Task 1: Schema und additive Migration

- [x] **Step 1: Einsatz- und Einsatzorttabellen ergänzen**

Lege zwei neue Tabellen an:

```sql
CREATE TABLE waste_tour_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES waste_tours(id) ON DELETE CASCADE,
  pickup_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE waste_tour_assignment_locations (
  assignment_id UUID NOT NULL REFERENCES waste_tour_assignments(id) ON DELETE CASCADE,
  collection_location_id UUID NOT NULL REFERENCES waste_collection_locations(id) ON DELETE CASCADE,
  PRIMARY KEY (assignment_id, collection_location_id)
);
```

Es gibt ausdrücklich keinen Unique-Constraint auf `tour_id` und `pickup_date`. Ergänze sinnvolle Indizes für `tour_id, pickup_date` und `collection_location_id`. Übernimm die Tabellen, Constraints und Indizes in den Schema-Snapshot.

- [x] **Step 2: Bestehende Einzeltermine migrieren**

Erstelle eine idempotente, transaktionale Migration. Jeder Datensatz aus `waste_location_tour_pickup_dates` wird zu einem `waste_tour_assignments`-Datensatz mit exakt einer `waste_tour_assignment_locations`-Zeile. Übernimm Tour, Datum und Hinweis unverändert. Verwende eine nachvollziehbare, persistierte Zuordnung oder einen deterministischen Schutz gegen erneutes Importieren derselben Altzeile.

Die alten Tabellen und Leser werden in diesem Change nicht gelöscht. Die Migration muss einen Dry-Run beziehungsweise einen überprüfbaren Zähler für gelesene, erzeugte und übersprungene Datensätze liefern.

- [x] **Step 3: Tests und Server-Runtime-Gate ausführen**

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/lib/waste-management-tour-assignments.migration.server.test.ts
pnpm check:server-runtime
```

Erwartung: Eine Wiederholung der Migration erzeugt keine zusätzlichen Einsätze; leere Hinweise bleiben erhalten; alle Server-Runtime-Imports sind ESM-konform.

## Task 2: Typen, Repository und geschützte Einsatz-API

- [x] **Step 1: Framework-agnostische Typen und Verträge definieren**

Füge zentrale Typen für `WasteTourAssignmentRecord` und `WasteTourAssignmentLocationRecord` in `packages/core` hinzu. Das Einsatzobjekt liefert seine Orte als `locationIds` oder über einen klar benannten Untertyp. Verwende keine Schadstoffmobil-spezifischen Typen oder Felder.

- [x] **Step 2: Repository-Operationen implementieren**

Das Repository braucht mindestens:

- Einsätze nach Tour und nach Ortsmenge listen,
- Einsatz einschließlich seiner Orte laden,
- Einsatz mit vollständiger Ortsmenge atomar speichern,
- Einsatz löschen.

Beim Aktualisieren ersetzt die übergebene Ortsmenge die bisherige Menge in einer Transaktion. Mindestens ein Ort ist Pflicht; doppelte Orte innerhalb eines Einsatzes werden vor dem Schreiben entfernt oder als Validierungsfehler behandelt. Derselbe Ort in unterschiedlichen Einsätzen bleibt zulässig.

- [x] **Step 3: Bestehende Autorisierung wiederverwenden**

Ergänze Create-, Update- und Delete-Handler unter der vorhandenen Action-ID `waste-management.scheduling.manage`. Die Payload validiert Tour-ID, ISO-Datum, optionalen Hinweis und eine nicht-leere Menge gültiger Orts-IDs. Behalte CSRF-Schutz, Mandantentrennung, Audit-Logging und Fehlerformat der bestehenden Scheduling-Handler bei.

- [x] **Step 4: Repository- und API-Tests ausführen**

```bash
pnpm nx run data-repositories:test:unit --testFiles=src/waste-management/master-data.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/tour-assignments.direct.test.ts
pnpm check:server-runtime
```

Erwartung: Mehrere Einsätze am selben Tag sowie derselbe Ort in unterschiedlichen Einsätzen funktionieren; Einsätze ohne Ort werden mit `400` abgewiesen; unberechtigte Aufrufe mit `403`.

## Task 3: Import und Materialisierung

- [x] **Step 1: Importprofil um stabile Einsatzkennung erweitern**

Das Importprofil für ortsbezogene Termine erhält eine Spalte `assignment_id` (oder einen eindeutig dokumentierten fachlichen Schlüssel). Zeilen mit gleicher Einsatzkennung bilden einen Einsatz; ihre Ortsdaten bilden dessen Ortsmenge. `tour`, `pickup_date` und `note` müssen innerhalb einer Einsatzgruppe konsistent sein. Der Hinweis bleibt optional.

- [x] **Step 2: Preview und Persistierung absichern**

Das Preview markiert Gruppen als ungültig, wenn sie keinen auflösbaren Ort haben oder wenn Tour, Datum oder Hinweis innerhalb einer Gruppe widersprüchlich sind. Es darf keine Teilpersistierung einer ungültigen Gruppe geben. Mehrere Gruppen mit gleichem Datum, Tour und Ort sind zulässig.

- [x] **Step 3: Materialisierung additiv erweitern**

Ergänze den Mainserver-Sync so, dass Einsätze und ihre Orte ohne Verlust transportiert werden. Entferne alte `locationTourPickupDates` erst in einem späteren, separaten Kompatibilitätschange.

- [x] **Step 4: Gezielte Tests ausführen**

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/lib/waste-management-operations.import.server.test.ts --testFiles=src/lib/waste-management-mainserver-sync.materialization.test.ts
```

Erwartung: Zwei Ortszeilen derselben Einsatzkennung erzeugen einen Einsatz mit zwei Orten; zwei Einsatzkennungen am selben Tag bleiben getrennt.

## Task 4: Generische Einsatzpflege im Studio

- [x] **Step 1: Vorhandene Scheduling-Oberfläche generisch erweitern**

Baue eine Einsatzliste und einen Dialog innerhalb der bestehenden Tour-/Scheduling-Pflege. Der Dialog enthält Datum, optionalen Hinweis und eine zugängliche Mehrfachauswahl für Abholorte. Wiederverwende vorhandene Design-System-Komponenten und Ortsauswahlmuster. Es gibt keinen Branch auf Tourname oder Fraktionsname.

- [x] **Step 2: Übergeordnete Abholorte klar kennzeichnen**

Zeige in der Mehrfachauswahl die vollständige Ortsbezeichnung und Hierarchie, etwa `Perleberg (alle Straßen)` gegenüber `Perleberg / Ackerstraße`. Die Auswahl darf konkrete und übergeordnete Orte kombinieren. Der Formularfehler für eine leere Auswahl muss mit dem Feld programmatisch verknüpft sein.

- [x] **Step 3: Übersetzungen und Statusmeldungen ergänzen**

Ergänze nur generische Schlüssel wie `scheduling.assignments.*`; keine sichtbaren Schadstoffmobil-Texte. Decke Lade-, Speicher-, Berechtigungs-, Validierungs- und Löschfehler ab.

- [x] **Step 4: UI-Tests ausführen**

```bash
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.scheduling-content.test.tsx
```

Erwartung: Ein Einsatz mit mehreren Orten lässt sich anlegen, bearbeiten und löschen; der Hinweis darf leer sein; eine leere Ortsmenge blockiert das Speichern.

## Task 5: Öffentliche Kalenderausgabe und Fraktionsfilter

- [x] **Step 1: Hierarchische Ortsmenge bestimmen**

Ermittle für die angefragte Adresse den konkreten Abholort sowie seine vorhandenen Vorfahren. Diese Menge ist die einzige Ortsvoraussetzung für explizite Einsätze; `waste_location_tour_links` wird hierfür nicht gejoint oder als Filter verwendet.

- [x] **Step 2: Einsätze mit Tour-Fraktionen laden**

Lade Einsätze, deren Einsatzorte in der ermittelten Ortsmenge liegen, zusammen mit Tour und den über die vorhandene Tour–Fraktion-Beziehung zugeordneten Fraktionen. Die Ausgabe behält Einsatz-ID, Tour-ID und Fraktions-ID, damit mehrere Einsätze gleicher Tour am selben Datum nicht zusammenfallen.

- [x] **Step 3: Wiederholungstermine mit Einsätzen zusammenführen**

Ein expliziter Einsatz für dieselbe Tour, dasselbe Datum und einen passenden abgefragten Ort ersetzt den sonst identischen generischen Wiederholungstermin. Mehrere explizite Einsätze bleiben eigenständige Einträge. Sein Hinweis hat Vorrang vor einem allgemeinen Tour- oder Verschiebungshinweis.

- [x] **Step 4: Public-Tests ausführen**

Das Nx-Unit-Target der Public-App ist deaktiviert. Nutze daher den package-lokalen Vitest-Runner:

```bash
cd apps/public-waste-calendar-web && pnpm exec vitest run src/lib/public-waste-repository.server.test.ts
```

Erwartung:

- Auswahl der Fraktion Schadstoffmobil zeigt die zugehörigen Einsätze.
- Andere Fraktionen blenden sie aus.
- Ein Einsatz am Ort `Perleberg (alle Straßen)` erscheint für eine konkrete Straße in Perleberg.
- Mehrere Einsätze am selben Tag bleiben getrennt.
- Ein passender Wiederholungstermin wird nicht doppelt ausgegeben.

## Task 6: Dokumentation und Abschlussgates

- [x] **Step 1: Fach- und Schemasnapshot aktualisieren**

Halte die neue Einsatzentität, Mehrfachorte, Ortsvererbung, Importgruppierung und Migrationsstrategie in der Fachspezifikation sowie im Datenbankschema-Snapshot fest. Verweise in den betroffenen arc42-Abschnitten auf die neue öffentliche Datenflussregel, wenn sich deren Schnittstellenbeschreibung ändert.

- [x] **Step 2: Kleinsten relevanten Gesamt-Gate-Pfad messen und ausführen**

Zuerst Scope messen:

```bash
pnpm nx show projects --affected --withTarget=test:unit --base=origin/main
```

Ist der Scope klein, ausführen:

```bash
pnpm nx affected --target=test:unit --base=origin/main
pnpm nx affected --target=test:types --base=origin/main
pnpm check:server-runtime
```

Ist der Scope breit, dokumentiere die Abweichung und führe stattdessen die Tests aus Task 1 bis 5 sowie die betroffenen Type-Targets aus.

## Selbstprüfung

- Keine Schadstoffmobil-spezifische Rolle, API, UI oder Namenserkennung ergänzt.
- Abfallfraktionen steuern weiterhin allein Kalenderfilter und Darstellung.
- Einsätze unterstützen mehrere Orte, übergeordnete Ortsvererbung und mehrere Einsätze pro Tour und Tag.
- Hinweis ist optional und wird pro Einsatz, nicht pro Ort, gespeichert.
- Bestehende Einzeltermine werden verlustfrei und idempotent migriert.
