# Assurance: Content-Mutationen durch Plugin-Beiträge

## Invarianten

| ID    | Invariante                                                                                                                   | Nachweis                                                                                                                                                                                                                                                                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CMI-1 | Nur ein im validierten Snapshot registrierter Beitrag darf die Mutation für seinen Content-Typ ausführen.                    | Registry-Positivtests und Negativtest für fehlenden/entfernten Beitrag; Host-Test ohne aufrufbaren Fallback.                                                                                                                                                                                                                                                        |
| CMI-2 | Der Host zeigt und startet Mutationen nur bei verfügbarer, passender Action; serverseitige Autorisierung bleibt unverändert. | Listen-/Berechtigungstests sowie bestehende Server-Auth-Gates und Tests.                                                                                                                                                                                                                                                                                            |
| CMI-3 | Ein Statuswechsel ändert ausschließlich die fachlich dafür vorgesehenen Felder.                                              | Plugin-Tests mit vollständigem Ausgangsdatensatz und Assertion aller unveränderten Felder; Negativtests erfolgreicher degradierter Event-/POI-Detailantworten mit Deviation in einem zurückzuschreibenden Feld und Assertion, dass kein Update erfolgt; Positivfälle für ausschließlich gezielt ersetzte Statusfelder oder Read-only-Metadaten ohne Schreibwirkung. |
| CMI-4 | Lösch-Bulk-Ergebnisse bleiben pro Eintrag korrekt; Fehler eines Eintrags verschleiern keine anderen Ergebnisse.              | Listen- und Hook-Tests für gemischte Erfolgs-/Fehlerantworten.                                                                                                                                                                                                                                                                                                      |
| CMI-5 | Browser-Funktionshandler gelangen nicht in Manifeste, Node-Deskriptoren oder Job-Runtimes.                                   | Bestehende Descriptor-/Packed-Artifact-Tests plus gezielte Abwesenheitsassertion für den neuen Handler.                                                                                                                                                                                                                                                             |

## Failure Modes

- **Beitrag fehlt oder wurde entfernt:** Fähigkeit wird nicht angeboten; ein direkter Aufruf wird kontrolliert abgelehnt.
- **Action passt nicht zu Namespace oder Content-Typ:** Snapshot-Validierung schlägt deterministisch fehl.
- **Status-API liefert unvollständige Daten oder schlägt fehl:** Event-/POI-Handler prüfen die `deviations` der vorhandenen Detailclients. Bei Abweichungen in unverändert zurückzuschreibenden Feldern oder fehlgeschlagenem Read erfolgt kein Update; Fehler wird über den bestehenden UI-Fehlerpfad gemeldet.
- **Ein Element eines Bulk-Vorgangs scheitert:** Der bestehende IAM-Bulk-Pfad verarbeitet erfolgreiche und fehlgeschlagene Elemente sowie Retry-Auswahl und Refresh wie bisher; die neuen Einzelhandler erweitern seine Auswahlberechtigung nicht.

## Grenzen

Die Plugin-Beiträge implementieren keine neue Berechtigungsinstanz und umgehen keine Serverprüfung. Es gibt keine Schema- oder Datenbankänderung. Die Evidenz muss auf dem finalen PR-HEAD erneut anhand der zugehörigen GitHub-Gates geprüft werden.

Registry-Validierung belegt Struktur, Zuordnung und Aufrufbarkeit der Deklarationen; sie analysiert keine Handler-Funktionskörper. Verhaltensgrenzen werden über Plugin-Tests, bestehende Server-Gates und Review nachgewiesen. Die Detailabweichungsprüfung berücksichtigt ausschließlich tatsächliche Schreibwirkungen gemäß `design.md`, einschließlich Ersatzwerten und Leerungen; eine allgemeine Sperre bei jeder Deviation ist nicht vorgesehen.

## Lokaler Umsetzungsnachweis (2026-10-07)

Umgesetzt im Worktree `issue-1510-content-mutations` auf Basis von `4dea7a59094a5cf08f1f923c724f7acf836544aa`. Die Nachweise gelten für den lokalen uncommitteten Arbeitsstand, nicht für einen PR-HEAD oder ein Deployment.

- **CMI-1:** SDK-Content-/Guardrail-Tests: 24 Tests grün; Studio-Status-/Katalogloader-Tests: 23 Tests grün. Falscher Namespace, falsche Operationsaction, fehlende deklarierte Action, fehlender Handler, doppelte/ungültige Zielstatus, doppelte Content-Typen und bestehende Guardrail-Codes werden geprüft. Handler werden über den bestehenden Content-Beitrag bis `studioContentTypes` materialisiert; fehlende/entfernte Beiträge haben keinen Fallback.
- **CMI-2:** Die abschließenden Listen-/Dialogtests sind mit 53 Tests grün. Sie enthalten einen zusätzlichen Test-Content-Typ, fehlende Fähigkeiten, entzogene Action und entzogenen Zeilenzugriff während eines offenen Löschdialogs. Die Statusprüfungen sichern zusätzlich Laufzeitfreigabe, Principal und nicht deklarierte Zielstatus. Bestehende Mainserver-Principal-, Event-/POI-Routen- und Detailmapper-Tests: 47 Tests grün, einschließlich Autorisierung und CSRF.
- **CMI-3:** Alle acht Plugin-Pakete haben ihre neuen `tests/content-mutations.test.ts` erfolgreich ausgeführt. Event-/POI-Tests prüfen alle unbeteiligten FormInput-Felder, fehlgeschlagene Reads, schreibrelevante und unbekannte Deviation-Gruppen sowie nicht blockierende Status-/Read-only-Gruppen. Generic Items erhält alle FormInput-Felder; News nutzt weiterhin die Visibility-API. Survey prüft die drei Statusabbildungen, Locale-Auflösung, den vollständigen bestehenden Update-Vertrag und die zusätzliche Laufzeitfreigabe.
- **CMI-4:** Die bestehenden IAM-Bulk-Tests für gemischte Ergebnisse, explizite Auswahl, Retry-Auswahl und Refresh sind Bestandteil der grünen Listenprüfung. Der IAM-Bulk-Ausführungspfad und die bisherige Auswahlberechtigung bleiben erhalten; es gibt keinen Plugin-Bulk-Dispatch.
- **CMI-5:** Alle acht Plugin-Tests prüfen den Descriptor ohne Mutationshandler. Server-Katalog und Job-Runtime: 18 Tests grün; die separate Prüfung installierter Plugin-Artefakte ist mit 12 Tests grün. Zusätzlich prüft der Browser-Katalogloader den Unterschied zwischen Browser- und Server-Snapshot.

### Ausgeführte Gates

```sh
pnpm nx run plugin-sdk:test:unit --testFiles=tests/content-types.test.ts --testFiles=src/guardrails.test.ts
pnpm nx run-many -t test:unit -p plugin-news,plugin-events,plugin-poi,plugin-surveys,plugin-generic-items,plugin-faq,plugin-cockpit-cards,plugin-projects --testFiles=tests/content-mutations.test.ts --parallel=2
pnpm nx run plugin-surveys:test:unit --testFiles=tests/content-mutations.test.ts --testNamePattern='surveys content mutations'
pnpm nx run plugin-generic-items:test:unit --testFiles=tests/content-mutations.test.ts --testNamePattern='generic-items content mutations'
pnpm nx run sva-studio-react:test:unit:hooks --testFiles=src/lib/content-status-mutation.test.ts --testFiles=src/lib/plugin-catalog-loader.test.ts
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routes/content/-content-list-page.test.tsx --testFiles=src/routes/content/-content-status-dialog.test.tsx
pnpm nx run sva-studio-react:test:unit:server --testFiles=src/lib/plugin-catalog.server.test.ts --testFiles=src/lib/plugin-installed-inputs.vite.test.ts --testFiles=src/lib/plugin-operation-runtime.server.test.ts
pnpm nx run sva-studio-react:test:unit:hooks --testFiles=src/lib/plugin-installed-inputs.vite.test.ts
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/events-poi-routes.test.ts --testFiles=src/server/content-route-core.test.ts --testFiles=src/server/service-internals/resilient-detail-mappers.test.ts
pnpm nx run sva-studio-react:test:types
pnpm check:server-runtime
pnpm nx run plugin-sdk:check:runtime
pnpm nx run-many -t lint -p plugin-sdk,plugin-news,plugin-events,plugin-poi,plugin-surveys,plugin-generic-items,plugin-faq,plugin-cockpit-cards,plugin-projects,sva-studio-react --parallel=2
pnpm check:plugin-ui-boundary
pnpm check:plugin-architecture-boundary
pnpm check:file-placement
pnpm exec openspec validate refactor-plugin-content-mutations --strict
```

Der erste Plugin-Sammellauf war für sieben Pakete grün; Survey meldete einen falschen Page-Export im neuen Test-Mock. Nach Korrektur war der gezielte Survey-Lauf grün. Generic Items wurde nach Erweiterung des Feld-Erhaltungstests erneut gezielt erfolgreich geprüft. Bei einigen bestehenden Plugin-Targets umfasst der im Target festgelegte Filter `tests` trotz `--testFiles` weitere Testdateien; die neuen Mutationsdateien wurden tatsächlich ausgeführt. Kein Ergebnis mit „No test files found“ zählt als Nachweis.

Das App-Server-Target nimmt nur Server-Testdateien auf; die Prüfung installierter Artefakte lief deshalb separat über das Hooks-Target mit zwölf tatsächlich ausgeführten Tests.

Eine parallele App-Prüfung kollidierte beim Synchronisieren injizierter Workspace-Pakete mit `ENOTEMPTY`; die abschließenden App-/Server-/Typ-/Runtime-Gates wurden nacheinander erfolgreich ausgeführt. Test-Fixture- und Responsive-View-Assertionfehler wurden korrigiert und gezielt nachgeprüft; der abschließende vollständige Listen-/Dialog-Dateilauf ist grün.

Der Plugin-Architekturguard beendet seinen bestehenden Warnmodus erfolgreich, meldet aber weiterhin die unveränderten Pfadsignale `packages/plugin-ssf/src/server.ts` und `packages/plugin-waste-management/src/server.ts`. Beide Dateien stimmen bytegenau mit dem Basis-HEAD überein; es wurden keine neuen unerlaubten Importkanten gemeldet. Dieser Warnbefund wird nicht als fehlerfreier Architekturguard ausgegeben.

### Oberfläche und verbleibende Grenzen

Keine neuen Produktionsdateien, Packages, Dependencies, Provider, Registries, Workflows oder DB-Schemata. Die bestehenden Content-Beiträge, Browser-Einstiege und Katalogmaterialisierung wurden erweitert; die acht neuen Testdateien gehören zu ihren Plugin-Paketen. Die fachlichen Host-Dispatches und Statusmappings wurden entfernt. Die bestehende Liste der Mainserver-Typen dient ausschließlich der unveränderten IAM-Bulk-Auswahlgrenze.

Die Plugin-Mutationshandler werden im Browser-Einstieg an die Descriptor-Contenttypen gebunden. Der Loader vergleicht die übrigen Metadaten unverändert mit dem Descriptor und lässt die Fähigkeiten anschließend durch dieselbe Registry-Validierung laufen. Node-Deskriptoren und Manifeste bleiben unverändert.

Kein Commit, Push, PR, Merge, Rollout oder produktiver Schreibtest wurde ausgeführt. Vor Merge sind die GitHub-Gates für den exakten PR-HEAD und die erforderliche Review-Evidenz noch zu prüfen. Es wird keine neue Concurrency-, Upstream-Reparatur- oder Live-Abnahmegarantie behauptet.
