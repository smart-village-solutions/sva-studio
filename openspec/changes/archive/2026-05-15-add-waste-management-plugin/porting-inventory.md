# Portierungsinventur `Newcms` → `waste-management`

## Zweck

Diese Inventur erfüllt Task `2.1` des Changes `add-waste-management-plugin`.

Sie dokumentiert vor weiterer Portierung aus `Newcms`:

- welche relevanten Artefakte als Quelle oder Referenz betrachtet werden
- ob sie präsentational, fachlogisch oder infrastrukturell sind
- in welches Studio-Package die Verantwortung fällt
- welche `Newcms`-Abhängigkeiten entfernt oder ausdrücklich nicht übernommen werden dürfen

Die Datei ist bewusst keine Schönwetterliste. Sie trennt:

- bereits genutzte Referenzen
- noch nicht umgesetzte, aber fachlich geplante Referenzen
- ausdrücklich verbotene produktive Übernahmen

## Legende

- `präsentational`: UI-Struktur, Layout, Dialogfluss, Feldanordnung, Benennung, reine View-Model-Nähe
- `fachlogisch`: Fachregeln, Formularsemantik, Filterlogik, Termin- und Zuordnungslogik, Importlogik
- `infrastrukturell`: API-Clients, Hooks, Stores, Edge-Functions, Persistenz, Auth, Runtime-Annahmen

## Bereits genutzte Referenzen

| `Newcms`-Artefakt | Klasse | Aktueller Studio-Zielschnitt | Status | Portierungsregel |
| --- | --- | --- | --- | --- |
| `src/components/WasteCalendarView.tsx` | präsentational + fachlogisch | `packages/plugin-waste-management/src/waste-management.page.tsx`, `src/search-params.ts` | bereits als UI- und IA-Referenz genutzt | Tab-Struktur, Flächenzuschnitt und Verwaltungsbereiche sind zulässig; `Newcms`-Datenanbindung ist nicht zulässig |
| `src/components/WasteFractionDialog.tsx` | präsentational + fachlogisch | `packages/plugin-waste-management/src/waste-management.page.tsx` | bereits für ersten Stammdaten-Dialog genutzt | Dialogfluss und Feldgruppen zulässig; Hook-/Client-Anbindung nicht übernehmen |
| `src/components/TourDialog.tsx` | präsentational + fachlogisch | später `packages/plugin-waste-management` | noch nicht umgesetzt | nur Feld- und Dialoglogik als Referenz; keine `Newcms`-Formzustände oder DTO-Annahmen direkt übernehmen |
| `src/components/GlobalDateShiftDialog.tsx` | präsentational + fachlogisch | später `packages/plugin-waste-management` | noch nicht umgesetzt | Scheduling-Dialog darf fachlich referenziert werden; Runtime bleibt hostgeführt |
| `src/components/CollectionLocationDialog.tsx` | präsentational + fachlogisch | später `packages/plugin-waste-management` | noch nicht umgesetzt | nur UI- und Bedienmuster, keine implizite Datenlade- oder Persistenzlogik |
| `src/components/TourLocationsDialog.tsx` | präsentational + fachlogisch | später `packages/plugin-waste-management` | noch nicht umgesetzt | Zuordnungsdialog fachlich relevant; Daten- und Rechtepfad werden im Studio neu geschnitten |
| `src/components/BulkLocationDialog.tsx` | präsentational + fachlogisch | später `packages/plugin-waste-management` | noch nicht umgesetzt | Bulk-UX darf referenziert werden; keine produktive `Newcms`-Mutation übernehmen |
| `src/i18n/locales/de/wasteCalendar.ts` | präsentational + fachlogisch | `packages/plugin-waste-management/src/plugin.tsx` | bereits teilweise als Benennungsreferenz genutzt | Fachbegriffe und Textstruktur zulässig; Keys werden im Studio neu organisiert |
| `src/i18n/locales/en/wasteCalendar.ts` | präsentational + fachlogisch | `packages/plugin-waste-management/src/plugin.tsx` | bereits teilweise als Benennungsreferenz genutzt | wie oben |
| `src/docs/ABFALLKALENDER_ANFORDERUNGEN.md` | fachlogisch | `openspec`, `packages/core`, spätere UI- und Host-Slices | bereits als Fachreferenz genutzt | dient als Soll-Bild, nicht als Laufzeitvertrag |
| `src/supabase/migrations/create_waste_calendar_tables_complete.sql` | fachlogisch + infrastrukturell | `packages/core`, `packages/data-repositories`, spätere Migrationsjobs | bereits als Migrationsbasis genutzt | Tabellenfamilie zulässig als Migrationsbasis; keine Supabase-Function-Kopplung |
| `src/supabase/migrations/waste_calendar_schema.sql` | fachlogisch + infrastrukturell | wie oben | Referenz / Altstand | nur als historische Schemaquelle |

## Noch geplante Referenzen

| `Newcms`-Artefakt | Klasse | Geplanter Studio-Zielschnitt | Begründung |
| --- | --- | --- | --- |
| `src/services/wasteCalendarApi.tsx` | infrastrukturell | keine produktive Übernahme; nur Referenz für Endpoint-Vollständigkeit | hilft beim Funktionsabgleich, ist aber als Client verboten |
| `src/hooks/useWasteCalendar.tsx` | infrastrukturell + fachlogisch | keine produktive Übernahme; nur Referenz für Bedienflüsse | Hook mischt Zustand, Mutation und API und darf nicht ins Studio wandern |
| `src/tests/e2e/03-waste-calendar.spec.ts` | präsentational + fachlogisch | spätere `apps/sva-studio-react`-E2E-Tests | Journeys und Prioritäten dürfen abgeleitet werden, Testcode selbst nicht |
| `src/supabase/functions/server/wasteCalendar.tsx` und Untermodule | infrastrukturell + fachlogisch | `packages/auth-runtime`, `packages/server-runtime`, `packages/data-repositories` | Endpoint-Schnitt und Fachoperationen werden hostgeführt neu geschnitten |
| `src/supabase/functions/server/wasteCalendar_bulkOperations.tsx` und Untermodul | fachlogisch + infrastrukturell | spätere Bulk-Slices in Plugin und Host | Bulk-Abläufe fachlich relevant, technische Umsetzung nicht portierbar |
| `src/supabase/functions/server/wasteCalendar_locationTourLinks.tsx` und Untermodul | fachlogisch + infrastrukturell | spätere Zuordnungs- und Touren-Slices | Zuordnungssemantik bleibt relevant |
| `src/supabase/functions/server/wasteCalendar_tourDateShifts.tsx` und `globalDateShifts.tsx` | fachlogisch + infrastrukturell | spätere Scheduling-Mutationen | relevante Fachlogik, aber neuer Host-Vertrag |

## Verbotene produktive Übernahmen

Diese Artefaktgruppen sind für den Studio-Change ausdrücklich nur Analyse- oder Referenzmaterial:

| `Newcms`-Artefaktgruppe | Klasse | Verbot im Studio |
| --- | --- | --- |
| `src/services/wasteCalendarApi.tsx` | infrastrukturell | kein produktiver Import in Plugin oder Host |
| `src/hooks/useWasteCalendar.tsx` | infrastrukturell | keine Übernahme von Hook-, Store- oder Lifecyle-Logik |
| `src/supabase/functions/server/wasteCalendar*.tsx` | infrastrukturell | keine Edge-Functions als produktive Host-Strategie |
| direkte Supabase-Annahmen in UI- oder Service-Dateien | infrastrukturell | Plugin spricht nur `/api/v1/waste-management/*` |
| `Newcms`-Berechtigungs- und Sichtbarkeitsannahmen | infrastrukturell | Rechte müssen auf `waste-management.*` und Host-Guards gemappt werden |
| globale Singleton- oder Nicht-Instanz-Annahmen | fachlogisch + infrastrukturell | im Studio unzulässig wegen Instanzisolation |

## Zuordnung zum aktuellen Studio-Stand

### Bereits sauber neu geschnitten

- UI-Grundfläche, Tab-Struktur und Search-Params liegen in `packages/plugin-waste-management`
- Host-API liegt in `packages/auth-runtime` und `packages/routing`
- Datenquellenauflösung liegt in `packages/server-runtime`
- `waste_*`-Repos liegen in `packages/data-repositories`
- fachliche Kernverträge liegen in `packages/core`

### Bereits ersetzte `Newcms`-Abhängigkeiten

- `Newcms`-API-Client durch `packages/plugin-waste-management/src/waste-management.api.ts`
- `Newcms`-Hook-/Store-Anbindung durch lokale Plugin-State- und Host-Client-Nutzung
- `Newcms`-Supabase-Functions durch Host-Fassade in `packages/auth-runtime`
- direkte Laufzeitannahmen über eine globale Datenhaltung durch instanzbezogene Datenquellenauflösung

### Noch explizit nachzuziehen

- Portierte oder angelehnte Dialoge für Touren, Scheduling, Abholorte und Bulk-Flows müssen vor Umsetzung jeweils wieder gegen diese Inventur geprüft werden
- Für jeden weiteren größeren UI-Block aus `Newcms` ist dieselbe Klassifizierung fortzuschreiben
- Jede spätere größere Übernahme aus `Newcms` muss diese Restprüfung erneut durchlaufen

## Restprüfung für Task `2.3`

### Geprüfter Scope

Die Restprüfung wurde gegen den aktuell umgesetzten Waste-Stack im Studio durchgeführt:

- `packages/plugin-waste-management`
- `packages/auth-runtime/src/waste-management`
- `packages/routing`
- `packages/server-runtime/src/waste`
- `packages/data-repositories/src/waste-management`
- `packages/core`
- `apps/sva-studio-react`

### Geprüfte Ausschlusskriterien

Es wurde explizit nach folgenden verbotenen Kopplungen gesucht:

- direkten `Newcms`-Importen oder Pfadresten
- Referenzen auf `wasteCalendarApi`, `useWasteCalendar` oder `Newcms`-Supabase-Functions
- direkter Browser- oder Plugin-Anbindung an `@supabase/supabase-js`
- produktiven Laufzeitpfaden außerhalb der Studio-Fassade `/api/v1/waste-management/*`
- impliziten Rechtepfaden außerhalb von `waste-management.*`

### Ergebnis

Für den aktuell umgesetzten Scope wurden keine produktiven `Newcms`-Runtime-Kopplungen gefunden.

Stattdessen ist der aktuelle Stand konsistent auf Studio-Verträge gemappt:

- Plugin-Datenzugriff läuft über `packages/plugin-waste-management/src/waste-management.api.ts`
- produktive Requests gehen gegen `/api/v1/waste-management/*`
- Host-Handler liegen in `packages/auth-runtime/src/waste-management`
- Routing und Guards liegen im Studio-Routing
- Datenquellenauflösung liegt in `packages/server-runtime`
- fachliche und technische Verträge liegen in `packages/core`

### Einordnung der verbleibenden `supabase`-Treffer

Die verbleibenden Treffer auf `supabase` im Workspace betreffen nur:

- den zulässigen Datenquellenprovider `supabase`
- Konfigurations- und Testwerte wie Projekt-URLs
- Dokumentation des externen technischen Zielsystems

Sie stellen keine verbotene direkte Plugin- oder `Newcms`-Runtime-Kopplung dar.

### Entscheidung

Task `2.3` gilt für den aktuell implementierten Scope als erfüllt:

- es verbleiben keine produktiven `Newcms`-Hooks
- es verbleiben keine produktiven `Newcms`-API-Clients
- es verbleiben keine produktiven `Newcms`-Stores
- es verbleiben keine produktiven `Newcms`-Rechteannahmen

Diese Aussage gilt für den aktuell umgesetzten Scope und muss bei jeder weiteren größeren UI- oder Fachübernahme aus `Newcms` erneut validiert werden.

## Entscheidung für Task-Interpretation

Task `2.1` gilt mit dieser Datei als erfüllt, weil die verlangte Artefaktliste mit Klassifizierung jetzt vorliegt.

Task `2.3` gilt für den aktuell umgesetzten Scope als erfüllt, weil die dokumentierte Restprüfung keine produktiven `Newcms`-Runtime-Kopplungen gefunden hat. Für spätere zusätzliche Portierungen muss diese Prüfung fortgeschrieben werden.
