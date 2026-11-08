# Change: Kommunalen Anwendungsarbeitsplatz als Plugin bereitstellen

## Why

Kommunale Web-Anwendungen sollen über einen gemeinsamen Einstieg im SVA Studio erreichbar sein. Eine konfigurierbare, mehrsprachige Kachelübersicht macht das Studio zum virtuellen Arbeitsplatz, ohne die Zugriffsverwaltung der Zielanwendungen zu übernehmen.

## What Changes

- Eigenständiges Repository für `@sva/plugin-application-workspace` mit eigenem Build, Tests und versionierbarem Paket; Studio konsumiert das Paket über den vorhandenen `linked-package`-/`installed-distribution`-Pfad.
- Optionales Plugin `application-workspace` mit einem 3×3-Grid-Icon und dem übersetzten zugänglichen Namen „Anwendungen“ in der Kopfzeile bereitstellen.
- Bei wirksamer Aktivierung für eine Instanz den Einstieg und die Übersicht allen dort angemeldeten Benutzern zugänglich machen, unabhängig von redaktionellen Rollen.
- Eine responsive Übersicht unter `/plugins/application-workspace` ohne Seitenleiste bereitstellen; die Kopfzeile bleibt verfügbar.
- SVA Studio unveränderlich als erste Kachel anzeigen. Weitere Kacheln mit Icon, Ziel-URL, Name, Beschreibung und CtA-Text sowie Reihenfolge instanzbezogen verwalten.
- Icons aus der im Studio verwendeten Tabler-Bibliothek wählen. Die Icon-Auswahl als gemeinsame Design-System-Komponente in `@sva/studio-ui-react` und im bestehenden Figma-Designsystem „SVA Studio“ mit übereinstimmenden Zuständen dokumentieren.
- Name, Beschreibung und CtA-Text in allen unterstützten Studio-Sprachen pflegbar machen, mit Deutsch als verbindlicher Inhaltssprache und Fallback.
- In der Modulübersicht einen berechtigungsgeprüften Einstieg „Plugin-Einstellungen“ ergänzen. Der erste Verbraucher ist dieses Plugin; andere Plugins werden nicht vorsorglich migriert.
- Einstellungen über die bestehende IAM-Struktur mit `application-workspace.settings.read` und `application-workspace.settings.update` schützen und Änderungen über den bestehenden Auditpfad nachweisen.

## Scope und Nicht-Ziele

Ziel der freigegebenen Umsetzung ist der vollständige instanzbezogene Anwendungsarbeitsplatz einschließlich des Einstiegs für seine Plugin-Einstellungen und der gemeinsamen Tabler-Icon-Auswahl. Maximal betroffen sind das externe Plugin-Package, `@sva/studio-ui-react`, Plugin-SDK/Descriptor/Snapshot, vorhandenes Host-Routing und Server-Wiring, App-Shell, Modulübersicht, Plugin-Persistenz über bestehende Studio-DB-Infrastruktur, Module-IAM sowie zugehörige Tests, Dokumentation und die entsprechende Komponente im bestehenden Figma-Designsystem „SVA Studio“.

Nicht enthalten sind SSO-Einrichtung, Keycloak-Client- oder Realm-Änderungen, Benutzerprovisionierung, Rollenübertragung an Zielsysteme, externe API-Integrationen, automatische Anwendungserkennung, Verfügbarkeitsprüfungen, Einbettung per iframe, frei hochladbare Icons, persönliche Kachellisten und rollenabhängige einzelne Kacheln. Keycloak, OpenProject, Biletado, Buildplace und OpenDesk sind Beispiele und werden nicht automatisch angelegt. Der bestehende Cockpit-Link wird nicht nebenbei migriert.

## Impact

- Affected specs: neue Capability `application-workspace`; additive Erweiterungen von `plugin-platform`, `ui-layout-shell` und `account-ui`.
- Affected code: externes Repository `studio-plugin-application-workspace` statt `packages/plugin-application-workspace`; gemeinsame Icon-Auswahl in `packages/studio-ui-react`; vorhandene Pfade unter `packages/plugin-sdk`, `packages/routing`, Studio-Plugin-Katalog und serverseitiger Einbindung; `apps/sva-studio-react/src/components/{Header,AppShell}.tsx`, `apps/sva-studio-react/src/routes/admin/modules/`; bestehende IAM-, Persistenz-, Übersetzungs- und Dokumentationspfade.
- Affected arc42 sections bei Umsetzung: `docs/architecture/01-introduction-and-goals.md`, `03-context-and-scope.md`, `05-building-block-view.md`, `06-runtime-view.md` und `08-cross-cutting-concepts.md`; Abschnitt 04 wird auf Auswirkungen geprüft. Es entsteht kein neues IAM-Pattern.
- Datenbankschema: dauerhafte pluginbezogene Speicherung ist erforderlich. Vor einer Migration sind `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` erneut zu prüfen und bei Änderung gemeinsam fortzuschreiben. Die Host-Migration bleibt im kanonischen Studio-DB-Pfad.
- Parallele Changes: `enable-mainserver-search-plugin` berührt dieselbe Kopfzeile; `align-studio-ui-design-system` verändert Shell und responsive Navigation. Deren Funktionen und Navigationspräferenzen bleiben erhalten. `add-central-app-translations` betrifft App-Inhalte; die hier gepflegten Kacheltexte gehören zur Studio-Oberfläche und erzeugen keinen zweiten globalen Übersetzungsdienst.

## Freigabe und Abnahme

Die ursprüngliche Implementierung ist freigegeben. Am 8. November 2026 wurde zusätzlich die Auslagerung in ein eigenständiges Repository beauftragt. Aktivierung bei Kommunen und Rollout bleiben separat. Kritische Invarianten und Nachweise stehen im [Design](./design.md), die Lieferung im [Aufgabenplan](./tasks.md).
