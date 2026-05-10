## 1. Specification

- [x] 1.1 Neue Capability `waste-management` mit Scope, UI-Vertrag und Ressourcenmodell spezifizieren
- [x] 1.2 Freie Plugin-Route `/plugins/waste-management` samt Search-Param-Erwartungen spezifizieren
- [x] 1.3 Host-Fassade `/api/v1/waste-management/*` und deren Boundary gegen Plugin und Datenzugriff spezifizieren
- [x] 1.4 Instanzbezogene Weiterentwicklung des `waste_*`-Schemas und Migrationsrichtung spezifizieren
- [x] 1.5 Feingranulares Modul-IAM für Lesen, Pflege, Import, Seed, Reset und Einstellungen spezifizieren
- [x] 1.6 Audit- und Historienerwartungen für Mutationen, CSV-Import, Seed und Reset spezifizieren
- [x] 1.7 Relevante Arc42-Auswirkungen für Plugin-, Runtime-, Sicherheits- und Risiko-Sicht dokumentieren
- [x] 1.8 Betrieb als führendes oder sekundäres Waste-System und daraus folgende Integrationsoffenheit spezifizieren
- [x] 1.9 Erweiterte Terminlogik für Einzelverschiebungen und Folgeeffekte spezifizieren
- [x] 1.10 Detaillierte Portierungsregeln für zulässige `Newcms`-Übernahmen und verbotene Architekturkopplungen spezifizieren
- [x] 1.11 Datenquellen-, Primärmodus- und asynchrone Tool-Entscheidungen spezifizieren
- [x] 1.12 `openspec validate add-waste-management-plugin --strict` ausführen

## 2. Slice A: Contracts und Portierungsinventar

- [x] 2.1 Vor dem Portieren aus `Newcms` eine Artefaktliste für die geplante UI-Übernahme erstellen und je Artefakt festhalten, ob es präsentational, fachlogisch oder infrastrukturell ist
- [x] 2.2 In `packages/core` gemeinsame Contracts für Waste-Settings, Datenquellenstatus, generische Job-Status und instanzbezogene Verwaltungsmodelle ergänzen
- [x] 2.3 Für alle aus `Newcms` angelehnten Artefakte dokumentieren und prüfen, dass keine produktiven `Newcms`-Hooks, API-Clients, Stores oder Rechteannahmen verbleiben

## 2a. Slice A2: Vorgelagerte generische Job-Fähigkeit konsumieren

- [x] 2a.1 Den vorgelagerten Change `update-plugin-platform-for-generic-jobs-imports` als Voraussetzung für generische Jobtypen, Status und zentrale Job-Persistenz berücksichtigen
- [x] 2a.2 Waste-spezifische Jobtypen für Migration, Import, Seed und Reset auf den dort definierten Plattformvertrag mappen
- [x] 2a.3 In `packages/plugin-waste-management` und angrenzenden Host-Packages nur noch die waste-spezifische Nutzung der generischen Job-Fähigkeit ergänzen, ohne eine zweite Registrierungs- oder Persistenzlogik einzuführen

## 2b. Slice A3: Vorgelagerte generische Import-Fähigkeit konsumieren

- [x] 2b.1 Den vorgelagerten Change `update-plugin-platform-for-generic-jobs-imports` als Voraussetzung für generische Importprofile und Host-Importverträge berücksichtigen
- [x] 2b.2 Die Waste-Importprofile `geografie-abholorte`, `touren` und `ausweichtermine` auf dem dort definierten Plugin-Vertrag modellieren
- [x] 2b.3 Waste-spezifische Mapping-, Validierungs- und Vorlagenlogik definieren, ohne eine parallele Importplattform im Plugin aufzubauen
- [x] 2b.4 Eine vorhandene allgemeine Host-Importoberfläche anbinden oder andernfalls einen fachnahen Waste-Flow nur als dünne Bedienhülle auf den generischen Host-Vertrag setzen
- [x] 2b.5 Wiederverwendbare Mapping-Vorlagen nur im Rahmen des zentralen Plattformvertrags nutzen, nicht als Waste-Sonderpersistenz neu schneiden
- [x] 2b.6 Keine zusätzlichen `plugin-sdk`-Grundverträge für Importprofile in diesem Fachchange definieren; nur noch deren Waste-Nutzung ergänzen

## 3. Slice B: Zentrale Governance- und Instanzkonfiguration

- [x] 3.1 In `packages/instance-registry` die instanzbezogene technische Waste-Modulkonfiguration als Teil der Studio-Governance modellieren
- [x] 3.2 In `packages/data-repositories` die primäre Persistenz für Waste-Datenquellen-Konfiguration, Connection-Checks und Governance-Queries im zentralen Studio-Postgres implementieren
- [x] 3.3 In `packages/data` nur bei Bedarf eine dünne Orchestrierungs- oder Kompositionsschicht ergänzen, ohne dort neue primäre Waste-SQL-Heimat aufzubauen

## 4. Slice C: Runtime, Datenquellenauflösung und Waste-Repositories

- [x] 4.1 In `packages/server-runtime` die serverseitige Auflösung der aktiven Waste-Datenquelle, Secret-Nutzung, Connection-Tests und technische Fehlerverträge kapseln
- [x] 4.2 In `packages/data-repositories` die hostseitigen Repositories für die `waste_*`-Tabellenfamilie der instanzbezogenen Waste-Fachdatenbank implementieren
- [x] 4.3 Die Waste-spezifische Einbindung in die generische Studio-Job-Fähigkeit für Initialisierung, Update-Migrationen, Import, Seed und Reset vorbereiten

## 5. Slice D: Host-Fassade, Routing, IAM und Audit

- [x] 5.1 In `packages/auth-runtime` die HTTP-Handler für `/api/v1/waste-management/*` mit Validierung, Rechteprüfung, Fehlervertrag und Endpunkten für die generische Job-Fähigkeit implementieren
- [x] 5.2 In `packages/routing` die freie Plugin-Route, Search-Param-Validierung, Guards und Sichtbarkeitsregeln für Waste-Management integrieren
- [x] 5.3 In `packages/routing` und `packages/auth-runtime` die Host-Routen für `/api/v1/waste-management/*` einschließlich asynchroner Tool- und Migrationspfade in die bestehende Runtime- und Route-Registrierung aufnehmen
- [x] 5.4 In `packages/iam-admin` die neuen `waste-management.*` Rechte in Rollen- und Permission-Verwaltung integrieren, soweit diese zentral vom Studio gepflegt werden
- [x] 5.5 In `packages/iam-governance` die zentrale Audit-Integration und gegebenenfalls einfache Audit-basierte Verlaufsansichten für Waste-Mutationen anbinden
- [x] 5.6 Audit-Events, Modul-IAM und Berechtigungsauflösung für `waste-management.*` im Zusammenspiel von `packages/plugin-sdk`, `packages/iam-admin` und `packages/iam-governance` verdrahten

## 6. Slice E: Fachplugin und Admin-UI

- [x] 6.1 `packages/plugin-waste-management` anlegen und die fachliche Hauptoberfläche unter `/plugins/waste-management` mit typisierten Search-Params materialisieren
- [x] 6.2 In `packages/plugin-waste-management` die Waste-Admin-UI für Tabs, Tabellen, Dialoge, Bulk-Flows sowie Lade-, Leer-, Fehler-, Job- und Berechtigungszustände umsetzen
- [x] 6.2.1 Read-only Übersichten für `master-data`, `tours` und `scheduling` über die Host-Fassade im Plugin anbinden
- [x] 6.2.2 Erste tabellarische Stammdatenansicht mit fachlichen Filtern, Statusdarstellung und Leer-/Fehlerzuständen für `waste_fractions` ausbauen
- [x] 6.2.3 Ersten Mutationspfad für Stammdaten inklusive Dialog, Host-API-Client, Rechteprüfung und Refresh-Strategie implementieren
- [x] 6.2.4 Erste Tourenansicht mit fachlichen Kennzahlen, Filterung und read-only Detailinformationen ausbauen
- [x] 6.2.5 Ersten Mutationspfad für Touren inklusive Dialog, Host-API-Client, Rechteprüfung und Refresh-Strategie implementieren
- [x] 6.2.6 Erste Scheduling-Ansicht für globale und tourbezogene Ausweichtermine mit Kontextfiltern und Statusdarstellung ausbauen
- [x] 6.2.7 Ersten Mutationspfad für Ausweichtermine inklusive Dialog, Host-API-Client, Rechteprüfung und Refresh-Strategie implementieren
- [x] 6.2.8 Bulk- und Massenbearbeitungsflüsse für fachlich geeignete Bereiche ergänzen, sobald die ersten Einzelmutationen stabil sind
- [x] 6.3 In `packages/plugin-waste-management` die Host-API-Clients für CRUD, Settings, asynchrone Import-, Seed-, Reset- und Migrationsoperationen anbinden
- [x] 6.4 Bereits vorhandene allgemeine Host-UI-Bausteine für Import, Jobstatus, Hochrisiko-Confirm und technische Statusanzeigen anbinden; nur fehlende Waste-spezifische Bedienlogik im Plugin selbst halten
- [x] 6.5 In `packages/plugin-waste-management` Jahreskalender, Touren-, Ausweichtermin-, Abholort-, Fraktions- und Zuordnungsdialoge bewusst als fachliche Plugin-Komponenten halten und nur gegen die allgemeinen UI-Bausteine andocken
- [x] 6.6 In `apps/sva-studio-react` die statische Plugin-Registrierung und die Einbettung der instanzbezogenen Waste-Einstellungen in die Studio-Shell ergänzen

## 7. Slice F: Tests, Dokumentation und Architektur

- [x] 7.1 Unit- und Type-Tests in `packages/plugin-waste-management`, `packages/routing`, `packages/auth-runtime`, `packages/server-runtime`, `packages/data-repositories` und `packages/instance-registry` entlang der jeweiligen Slice-Verantwortung ergänzen
- [x] 7.2 Integrations- und E2E-Tests in `apps/sva-studio-react` für Plugin-Navigation, Rechte, Settings, Rekonfiguration, CRUD, Import, Seed, Reset, Migrationen und Instanzisolation ergänzen
- [x] 7.3 Relevante Arc42- und Entwicklerdokumentation für Persistenzgrenzen, Instanzkonfiguration, Runtime-Boundaries, asynchrone Data-Tools und Primärmodus aktualisieren
- [x] 7.4 In der Architektur- und Entwicklerdokumentation die Portierungsstrategie gegen `Newcms` inklusive zulässiger UX-Anlehnung und verbotener Architekturkopplungen festhalten
