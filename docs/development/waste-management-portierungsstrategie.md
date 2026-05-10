# Waste-Management-Portierungsstrategie

## Zweck

Dieses Dokument beschreibt die verbindliche Portierungsstrategie für das Studio-Plugin `waste-management` gegenüber dem älteren `Newcms`-Abfallkalender-MVP.

Es ergänzt die OpenSpec-Artefakte des Changes `add-waste-management-plugin`, insbesondere:

- [Portierungsinventur](../../openspec/changes/add-waste-management-plugin/porting-inventory.md)
- [Design des Changes](../../openspec/changes/add-waste-management-plugin/design.md)

## Grundsatz

`Newcms` ist für Waste-Management im Studio **nur** Fach- und UX-Referenz, keine Runtime-Abhängigkeit.

Erlaubt ist:

- Übernahme oder Anlehnung von Informationsarchitektur, Tab-Zuschnitt und Dialogfluss
- Übernahme fachlicher Begriffe, Feldgruppen und Bedienmuster
- Nutzung der bisherigen `waste_*`-Tabellenfamilie als Migrationsbasis
- Ableitung von Importprofilen, Kalenderlogik und fachlichen CRUD-Fällen aus dem MVP

Nicht erlaubt ist:

- produktive Übernahme von `Newcms`-Hooks, API-Clients oder Stores
- Supabase-Functions oder Supabase-Client-Aufrufe aus dem Plugin oder der App-Shell
- direkte Rechteannahmen aus `Newcms`; im Studio gelten ausschließlich `waste-management.*`
- implizite Kopplung an `Newcms`-Routing, Dialogzustände oder lokale DTOs

## Zielgrenzen im Studio

Die produktive Studio-Struktur für Waste-Management ist bewusst neu geschnitten:

- `packages/plugin-waste-management`: fachliche UI, Dialoge, Bulk-Flows, lokale View-Model-Logik
- `packages/auth-runtime`: hostgeführte HTTP-Fassade `/api/v1/waste-management/*`
- `packages/server-runtime`: serverseitige Datenquellenauflösung, Secret-Nutzung, Connection-Checks
- `packages/data-repositories`: zentrale Governance-Persistenz und hostseitige Waste-Repositories
- `packages/instance-registry`: instanzbezogene Waste-Modulkonfiguration
- `packages/data`: keine neue primäre Waste-Orchestrierungs- oder SQL-Ownership

## Konkrete Prüfregeln bei weiteren Portierungen

Bei jeder weiteren UX- oder Fachübernahme aus `Newcms` ist zu prüfen:

1. Ist das Artefakt präsentational oder fachlogisch referenzierbar, ohne Runtime-Kopplung?
2. Bleiben Datenzugriffe vollständig hinter `/api/v1/waste-management/*`?
3. Bleiben Rechte ausschließlich auf `waste-management.*` gemappt?
4. Werden keine `Newcms`-Importpfade, Supabase-Functions oder lokalen DTO-Annahmen produktiv übernommen?
5. Ist der resultierende Pfad durch Studio-Tests und nicht nur durch den alten MVP abgesichert?

## Aktueller Stand

Für den bisher umgesetzten Scope gilt:

- die Portierungsinventur ist geführt
- verbotene `Newcms`-Runtime-Kopplungen wurden für den umgesetzten Scope geprüft
- die Studio-Tests decken Host-Fassade, Plugin-UI, Rechtepfade und einen E2E-Flow des Waste-Plugins eigenständig ab

Weitere größere Übernahmen aus `Newcms` müssen dieselbe Prüfung erneut durchlaufen.
