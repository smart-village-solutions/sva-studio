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

- [ ] 2.1 Vor dem Portieren aus `Newcms` eine Artefaktliste für die geplante UI-Übernahme erstellen und je Artefakt festhalten, ob es präsentational, fachlogisch oder infrastrukturell ist
- [ ] 2.2 In `packages/core` gemeinsame Contracts für Waste-Settings, Datenquellenstatus, generische Job-Status und instanzbezogene Verwaltungsmodelle ergänzen
- [ ] 2.3 Für alle aus `Newcms` angelehnten Artefakte dokumentieren und prüfen, dass keine produktiven `Newcms`-Hooks, API-Clients, Stores oder Rechteannahmen verbleiben

## 2a. Slice A2: Generische Job-Fähigkeit

- [ ] 2a.1 Eine allgemeine Studio-Job-Fähigkeit für langlaufende Plugin-Operationen als tragfähige Plattformbasis definieren, die für Waste und weitere reale Plugins direkt wiederverwendbar ist
- [ ] 2a.2 Die minimale Persistenz-, Status- und Lifecycle-Schnittstelle dieser generischen Job-Fähigkeit festlegen und in die betroffenen Plattform-Packages einhängen
- [ ] 2a.3 Im `packages/plugin-sdk` einen expliziten Plugin-Vertrag für die Registrierung fachlicher Jobtypen vorsehen

## 2b. Slice A3: Generische Import-Fähigkeit

- [ ] 2b.1 Eine allgemeine Studio-Import-Fähigkeit für CSV, Excel sowie schema-nahe JSON- und XML-Quellen als tragfähige Plattformbasis definieren, die für Waste und weitere reale Plugins direkt wiederverwendbar ist
- [ ] 2b.2 Pluginseitige Importprofile mit kanonischer Vorlage, Mapping-Regeln und Validierungsvertrag als allgemeines Plattformmuster festlegen
- [ ] 2b.3 Die erste automatische Mapping-Strecke mit manueller Korrekturfunktion so schneiden, dass später eine externe KI-basierte Vorschlagslogik als austauschbare Integrationsstelle angeschlossen werden kann
- [ ] 2b.4 Den allgemeinen Import-Dialog als mehrstufigen Wizard mit Quellwahl, Profilwahl, Mapping, Validierungsvorschau, Job-Start und Ergebnisansicht festlegen
- [ ] 2b.5 Einfache gespeicherte Mapping-Vorlagen pro Instanz und Importprofil als wiederverwendbares Plattformmuster vorsehen, ohne bereits komplexe Versionierungslogik einzuführen
- [ ] 2b.6 Im `packages/plugin-sdk` einen expliziten Plugin-Vertrag für die Registrierung fachlicher Importprofile vorsehen

## 3. Slice B: Zentrale Governance- und Instanzkonfiguration

- [ ] 3.1 In `packages/instance-registry` die instanzbezogene technische Waste-Modulkonfiguration als Teil der Studio-Governance modellieren
- [ ] 3.2 In `packages/data-repositories` die primäre Persistenz für Waste-Datenquellen-Konfiguration, Connection-Checks und Governance-Queries im zentralen Studio-Postgres implementieren
- [ ] 3.3 In `packages/data` nur bei Bedarf eine dünne Orchestrierungs- oder Kompositionsschicht ergänzen, ohne dort neue primäre Waste-SQL-Heimat aufzubauen

## 4. Slice C: Runtime, Datenquellenauflösung und Waste-Repositories

- [ ] 4.1 In `packages/server-runtime` die serverseitige Auflösung der aktiven Waste-Datenquelle, Secret-Nutzung, Connection-Tests und technische Fehlerverträge kapseln
- [ ] 4.2 In `packages/data-repositories` die hostseitigen Repositories für die `waste_*`-Tabellenfamilie der instanzbezogenen Waste-Fachdatenbank implementieren
- [ ] 4.3 Die Waste-spezifische Einbindung in die generische Studio-Job-Fähigkeit für Initialisierung, Update-Migrationen, Import, Seed und Reset vorbereiten

## 5. Slice D: Host-Fassade, Routing, IAM und Audit

- [ ] 5.1 In `packages/auth-runtime` die HTTP-Handler für `/api/v1/waste-management/*` mit Validierung, Rechteprüfung, Fehlervertrag und Endpunkten für die generische Job-Fähigkeit implementieren
- [ ] 5.2 In `packages/routing` die freie Plugin-Route, Search-Param-Validierung, Guards und Sichtbarkeitsregeln für Waste-Management integrieren
- [ ] 5.3 In `packages/routing` und `packages/auth-runtime` die Host-Routen für `/api/v1/waste-management/*` einschließlich asynchroner Tool- und Migrationspfade in die bestehende Runtime- und Route-Registrierung aufnehmen
- [ ] 5.4 In `packages/iam-admin` die neuen `waste-management.*` Rechte in Rollen- und Permission-Verwaltung integrieren, soweit diese zentral vom Studio gepflegt werden
- [ ] 5.5 In `packages/iam-governance` die zentrale Audit-Integration und gegebenenfalls einfache Audit-basierte Verlaufsansichten für Waste-Mutationen anbinden
- [ ] 5.6 Audit-Events, Modul-IAM und Berechtigungsauflosung für `waste-management.*` im Zusammenspiel von `packages/plugin-sdk`, `packages/iam-admin` und `packages/iam-governance` verdrahten

## 6. Slice E: Fachplugin und Admin-UI

- [ ] 6.1 `packages/plugin-waste-management` anlegen und die fachliche Hauptoberfläche unter `/plugins/waste-management` mit typisierten Search-Params materialisieren
- [ ] 6.2 In `packages/plugin-waste-management` die Waste-Admin-UI für Tabs, Tabellen, Dialoge, Bulk-Flows sowie Lade-, Leer-, Fehler-, Job- und Berechtigungszustände umsetzen
- [ ] 6.3 In `packages/plugin-waste-management` die Host-API-Clients für CRUD, Settings, asynchrone Import-, Seed-, Reset- und Migrationsoperationen anbinden
- [ ] 6.4 In `packages/studio-ui-react` einen wiederverwendbaren Import-Dialog-Flow sowie allgemeine Job-, Monitoring-, Bulk-Action-, Hochrisiko-Confirm- und Statusbausteine ergänzen, soweit diese noch nicht vorhanden sind
- [ ] 6.5 In `packages/plugin-waste-management` Jahreskalender, Touren-, Ausweichtermin-, Abholort-, Fraktions- und Zuordnungsdialoge bewusst als fachliche Plugin-Komponenten halten und nur gegen die allgemeinen UI-Bausteine andocken
- [ ] 6.6 In `apps/sva-studio-react` die statische Plugin-Registrierung und die Einbettung der instanzbezogenen Waste-Einstellungen in die Studio-Shell ergänzen

## 7. Slice F: Tests, Dokumentation und Architektur

- [ ] 7.1 Unit- und Type-Tests in `packages/plugin-waste-management`, `packages/routing`, `packages/auth-runtime`, `packages/server-runtime`, `packages/data-repositories` und `packages/instance-registry` entlang der jeweiligen Slice-Verantwortung ergänzen
- [ ] 7.2 Integrations- und E2E-Tests in `apps/sva-studio-react` für Plugin-Navigation, Rechte, Settings, Rekonfiguration, CRUD, Import, Seed, Reset, Migrationen und Instanzisolation ergänzen
- [ ] 7.3 Relevante Arc42- und Entwicklerdokumentation für Persistenzgrenzen, Instanzkonfiguration, Runtime-Boundaries, asynchrone Data-Tools und Primärmodus aktualisieren
- [ ] 7.4 In der Architektur- und Entwicklerdokumentation die Portierungsstrategie gegen `Newcms` inklusive zulässiger UX-Anlehnung und verbotener Architekturkopplungen festhalten
