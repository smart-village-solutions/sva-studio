## 1. Specification

- [x] 1.1 Neue Capability `waste-management` mit Scope, UI-Vertrag und Ressourcenmodell spezifizieren
- [x] 1.2 Freie Plugin-Route `/plugins/waste-management` samt Search-Param-Erwartungen spezifizieren
- [x] 1.3 Host-Fassade `/api/v1/waste-management/*` und deren Boundary gegen Plugin und Datenzugriff spezifizieren
- [x] 1.4 Instanzbezogene Weiterentwicklung des `waste_*`-Schemas und Migrationsrichtung spezifizieren
- [x] 1.5 Feingranulares Modul-IAM fuer Lesen, Pflege, Import, Seed, Reset und Einstellungen spezifizieren
- [x] 1.6 Audit- und Historienerwartungen fuer Mutationen, CSV-Import, Seed und Reset spezifizieren
- [x] 1.7 Relevante Arc42-Auswirkungen fuer Plugin-, Runtime-, Sicherheits- und Risiko-Sicht dokumentieren
- [x] 1.8 Betrieb als fuehrendes oder sekundaeres Waste-System und daraus folgende Integrationsoffenheit spezifizieren
- [x] 1.9 Erweiterte Terminlogik fuer Einzelverschiebungen und Folgeeffekte spezifizieren
- [x] 1.10 Detaillierte Portierungsregeln fuer zulaessige `Newcms`-Uebernahmen und verbotene Architekturkopplungen spezifizieren
- [x] 1.11 Datenquellen-, Primaermodus- und asynchrone Tool-Entscheidungen spezifizieren
- [x] 1.12 `openspec validate add-waste-management-plugin --strict` ausfuehren

## 2. Slice A: Contracts und Portierungsinventar

- [ ] 2.1 Vor dem Portieren aus `Newcms` eine Artefaktliste fuer die geplante UI-Uebernahme erstellen und je Artefakt festhalten, ob es praesentational, fachlogisch oder infrastrukturell ist
- [ ] 2.2 In `packages/core` gemeinsame Contracts fuer Waste-Settings, Datenquellenstatus, generische Job-Status und instanzbezogene Verwaltungsmodelle ergaenzen
- [ ] 2.3 Fuer alle aus `Newcms` angelehnten Artefakte dokumentieren und pruefen, dass keine produktiven `Newcms`-Hooks, API-Clients, Stores oder Rechteannahmen verbleiben

## 2a. Slice A2: Generische Job-Faehigkeit

- [ ] 2a.1 Eine allgemeine Studio-Job-Faehigkeit fuer langlaufende Plugin-Operationen als tragfaehige Plattformbasis definieren, die fuer Waste und weitere reale Plugins direkt wiederverwendbar ist
- [ ] 2a.2 Die minimale Persistenz-, Status- und Lifecycle-Schnittstelle dieser generischen Job-Faehigkeit festlegen und in die betroffenen Plattform-Packages einhaengen
- [ ] 2a.3 Im `packages/plugin-sdk` einen expliziten Plugin-Vertrag fuer die Registrierung fachlicher Jobtypen vorsehen

## 2b. Slice A3: Generische Import-Faehigkeit

- [ ] 2b.1 Eine allgemeine Studio-Import-Faehigkeit fuer CSV, Excel sowie schema-nahe JSON- und XML-Quellen als tragfaehige Plattformbasis definieren, die fuer Waste und weitere reale Plugins direkt wiederverwendbar ist
- [ ] 2b.2 Pluginseitige Importprofile mit kanonischer Vorlage, Mapping-Regeln und Validierungsvertrag als allgemeines Plattformmuster festlegen
- [ ] 2b.3 Die erste automatische Mapping-Strecke mit manueller Korrekturfunktion so schneiden, dass spaeter eine externe KI-basierte Vorschlagslogik als austauschbare Integrationsstelle angeschlossen werden kann
- [ ] 2b.4 Den allgemeinen Import-Dialog als mehrstufigen Wizard mit Quellwahl, Profilwahl, Mapping, Validierungsvorschau, Job-Start und Ergebnisansicht festlegen
- [ ] 2b.5 Einfache gespeicherte Mapping-Vorlagen pro Instanz und Importprofil als wiederverwendbares Plattformmuster vorsehen, ohne bereits komplexe Versionierungslogik einzufuehren
- [ ] 2b.6 Im `packages/plugin-sdk` einen expliziten Plugin-Vertrag fuer die Registrierung fachlicher Importprofile vorsehen

## 3. Slice B: Zentrale Governance- und Instanzkonfiguration

- [ ] 3.1 In `packages/instance-registry` die instanzbezogene technische Waste-Modulkonfiguration als Teil der Studio-Governance modellieren
- [ ] 3.2 In `packages/data-repositories` die primaere Persistenz fuer Waste-Datenquellen-Konfiguration, Connection-Checks und Governance-Queries im zentralen Studio-Postgres implementieren
- [ ] 3.3 In `packages/data` nur bei Bedarf eine duenne Orchestrierungs- oder Kompositionsschicht ergaenzen, ohne dort neue primaere Waste-SQL-Heimat aufzubauen

## 4. Slice C: Runtime, Datenquellenauflosung und Waste-Repositories

- [ ] 4.1 In `packages/server-runtime` die serverseitige Aufloesung der aktiven Waste-Datenquelle, Secret-Nutzung, Connection-Tests und technische Fehlervertraege kapseln
- [ ] 4.2 In `packages/data-repositories` die hostseitigen Repositories fuer die `waste_*`-Tabellenfamilie der instanzbezogenen Waste-Fachdatenbank implementieren
- [ ] 4.3 Die Waste-spezifische Einbindung in die generische Studio-Job-Faehigkeit fuer Initialisierung, Update-Migrationen, Import, Seed und Reset vorbereiten

## 5. Slice D: Host-Fassade, Routing, IAM und Audit

- [ ] 5.1 In `packages/auth-runtime` die HTTP-Handler fuer `/api/v1/waste-management/*` mit Validierung, Rechtepruefung, Fehlervertrag und Endpunkten fuer die generische Job-Faehigkeit implementieren
- [ ] 5.2 In `packages/routing` die freie Plugin-Route, Search-Param-Validierung, Guards und Sichtbarkeitsregeln fuer Waste-Management integrieren
- [ ] 5.3 In `packages/routing` und `packages/auth-runtime` die Host-Routen fuer `/api/v1/waste-management/*` einschliesslich asynchroner Tool- und Migrationspfade in die bestehende Runtime- und Route-Registrierung aufnehmen
- [ ] 5.4 In `packages/iam-admin` die neuen `waste-management.*` Rechte in Rollen- und Permission-Verwaltung integrieren, soweit diese zentral vom Studio gepflegt werden
- [ ] 5.5 In `packages/iam-governance` die zentrale Audit-Integration und gegebenenfalls einfache Audit-basierte Verlaufsansichten fuer Waste-Mutationen anbinden
- [ ] 5.6 Audit-Events, Modul-IAM und Berechtigungsauflosung fuer `waste-management.*` im Zusammenspiel von `packages/plugin-sdk`, `packages/iam-admin` und `packages/iam-governance` verdrahten

## 6. Slice E: Fachplugin und Admin-UI

- [ ] 6.1 `packages/plugin-waste-management` anlegen und die fachliche Hauptoberflaeche unter `/plugins/waste-management` mit typisierten Search-Params materialisieren
- [ ] 6.2 In `packages/plugin-waste-management` die Waste-Admin-UI fuer Tabs, Tabellen, Dialoge, Bulk-Flows sowie Lade-, Leer-, Fehler-, Job- und Berechtigungszustaende umsetzen
- [ ] 6.3 In `packages/plugin-waste-management` die Host-API-Clients fuer CRUD, Settings, asynchrone Import-, Seed-, Reset- und Migrationsoperationen anbinden
- [ ] 6.4 In `packages/studio-ui-react` einen wiederverwendbaren Import-Dialog-Flow sowie allgemeine Job-, Monitoring-, Bulk-Action-, Hochrisiko-Confirm- und Statusbausteine ergaenzen, soweit diese noch nicht vorhanden sind
- [ ] 6.5 In `packages/plugin-waste-management` Jahreskalender, Touren-, Ausweichtermin-, Abholort-, Fraktions- und Zuordnungsdialoge bewusst als fachliche Plugin-Komponenten halten und nur gegen die allgemeinen UI-Bausteine andocken
- [ ] 6.6 In `apps/sva-studio-react` die statische Plugin-Registrierung und die Einbettung der instanzbezogenen Waste-Einstellungen in die Studio-Shell ergaenzen

## 7. Slice F: Tests, Dokumentation und Architektur

- [ ] 7.1 Unit- und Type-Tests in `packages/plugin-waste-management`, `packages/routing`, `packages/auth-runtime`, `packages/server-runtime`, `packages/data-repositories` und `packages/instance-registry` entlang der jeweiligen Slice-Verantwortung ergaenzen
- [ ] 7.2 Integrations- und E2E-Tests in `apps/sva-studio-react` fuer Plugin-Navigation, Rechte, Settings, Rekonfiguration, CRUD, Import, Seed, Reset, Migrationen und Instanzisolation ergaenzen
- [ ] 7.3 Relevante Arc42- und Entwicklerdokumentation fuer Persistenzgrenzen, Instanzkonfiguration, Runtime-Boundaries, asynchrone Data-Tools und Primaermodus aktualisieren
- [ ] 7.4 In der Architektur- und Entwicklerdokumentation die Portierungsstrategie gegen `Newcms` inklusive zulaessiger UX-Anlehnung und verbotener Architekturkopplungen festhalten
