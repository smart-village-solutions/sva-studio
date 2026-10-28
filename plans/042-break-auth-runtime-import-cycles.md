# Plan 042: Importzyklen zwischen Registry, Lifecycle und Runner auflösen

## Status und Auftrag

- **Status:** IN PROGRESS – im isolierten Worktree umgesetzt und lokal geprüft; PR- und CI-Abnahme stehen aus.
- **Stand:** 27.10.2026, erneut geprüft gegen Commit `648f08c86e3e27b8aa644e1ddf621b7de5fe9d86`; ursprünglich geplant an `fdd1c72fa05d055a0cb54ca72e5d20109b23f646`.
- **Priorität:** P2, gezielte Architekturpflege; kein nachgewiesener Produktionsfehler.
- **Aufwand:** M; vorläufig 1–2 Entwicklertage für Umsetzung und lokale Nachweise, zusätzlich CI/Review. Der reale Datenbankvertrag wurde bei der Planung nicht ausgeführt.
- **Änderungsrisiko:** mittel wegen gemeinsamer Initialisierung und Datenbankzugriff; fachliche Zustandsautomaten bleiben unverändert.
- **Lieferung:** ein PR mit zwei sequenziellen Umbauabschnitten und abschließender Gesamtprüfung. Kein künstlicher PR-Stack.

Eine unabhängige, rein lesende Planprüfung hat die Graph-Trennung, die Map-/Pool-Ownership und die Kompatibilität zum bestehenden DB-Vertragslauf bestätigt. Das ersetzt nicht die Messungen und Verhaltensnachweise am späteren Implementierungsstand.

**Umsetzung am 28.10.2026:** Worktree `.worktrees/cycle-refactor`, Branch `refactor/auth-runtime-import-cycles`, Basis `648f08c86`. Fallow meldet nach den zwei Schritten `20 → 2 → 0` Datei-Zyklen sowie null Package- und Re-Export-Zyklen. Gezielte Unit-Tests, die Typprüfungen beider Packages, Lint, `check:server-runtime`, der reale Lifecycle-PostgreSQL-/Graphile-Vertrag, Dokumentationsprüfung und Komplexitätsgate sind lokal erfolgreich; der New-only-Audit meldet keine neu eingeführten Befunde. Ein erster parallel zum Runtime-Gate ausgeführter DB-Vertragslauf scheiterte in der Queue-Isolation; ein isolierter Wiederholungslauf bestand vollständig. Der anschließende lokale Systemtest lief nach der abschließenden Formatierung erfolgreich. Der Nutzer hat die PR-Erstellung beauftragt; endgültige CI-Evidenz für den PR-HEAD steht aus.

**Einmaliger lokaler Systemtest:** Der ignorierte Prüfstand `artifacts/local-lifecycle-system-check/run.mts` startete Studio und eigene, anschließend entfernte PostgreSQL-/Redis-Container. Ohne HTTP-Interception oder ersetzten Plugin-Handler wurden ausstehende Readiness, fehlende CSRF-Freigabe (403), zunächst gesperrter Modulzugriff über `/auth/me`, Queue-Persistenz bei deaktiviertem Worker, Wiederaufnahme nach Studio-Neustart und erfolgreiche Provisionierung durch den tatsächlichen Waste-Handler geprüft. Danach waren die Readiness-Evidenz gültig und das Modul in `/auth/me` freigegeben (`permissionStatus=ok`); Chromium lud die Studio-Oberfläche. Ergebnis: `LOCAL_LIFECYCLE_SYSTEM_CHECK PASS`, Exit 0. Admin-Anmeldung über Dev-Auth, synthetische Sitzung in Redis und vorab gesetzte Modulaktivierung sind Testvoraussetzungen; echter Keycloak-Login, Aktivierung über die Oberfläche, vollständige Tenant-Erstellung und gezielt ausgelöste Provisionierungsfehler sind damit nicht nachgewiesen. Keine regulären Tests, Nx-Targets oder CI-Workflows wurden für diesen einmaligen Lauf ergänzt.

### Aktualitätsprüfung nach den Zugriffs-/Session-Änderungen

Zwischen ursprünglicher Planung und erneut geprüftem Stand liegen 25 Commits. Die drei betroffenen Auth-Verzeichnisse `iam-instance-registry`, `plugin-tenant-lifecycle` und `plugin-operations` samt Tests, das Package `instance-registry`, der gemeinsame DB-/Secret-Pfad sowie die vorhandenen Lifecycle-DB-Vertragsskripte sind unverändert. Der erneut ausgeführte Fallow-Scan meldet dieselben 20 Zyklen über 12 Dateien, weiterhin ohne Package- oder Re-Export-Zyklen. Zielstruktur, Dateigrenzen und Prognose `20 → 2 → 0` passen weiterhin.

Eine Prüfvoraussetzung hat sich geändert: `auth-runtime:test:integration` führt inzwischen zusätzlich Redis-Session-CAS-Tests gegen `redis://127.0.0.1:6379` aus. Das vollständige Target setzt deshalb einen für diese Tests freigegebenen lokalen Redis voraus; für eine gezielte Lifecycle-Reproduktion bleibt der vorhandene PostgreSQL-/Graphile-Teilbefehl unten verfügbar. Die neuen Session-, Organisations- und Mainserver-Readiness-Pfade bleiben außerhalb des Umbauumfangs; ihre Ergänzungen in den arc42-Seiten müssen bei der späteren Dokumentationspflege erhalten bleiben.

Die vier gezielten Basistests wurden am erneut geprüften Stand wieder ausgeführt: 62 Fälle bestanden. Im ersten parallelen Lauf überschritten der erste Test in `runner-registry.test.ts` und der erste Test in `repository.test.ts` beim initialen Modulimport jeweils das unveränderte 5-Sekunden-Limit; die übrigen 60 Fälle bestanden. Beide Dateien liefen anschließend einzeln mit allen 11 Fällen grün durch, ohne Timeout-Anpassung oder Codeänderung. Die Zeitüberschreitungen sind damit im Einzellauf nicht reproduziert; eine stabile parallele Ausführung wird daraus nicht abgeleitet.

**PR-Ziel:** Die 20 gemeldeten Importzyklen im Registry-/Plugin-Lifecycle-/Runner-Knoten auflösen, während öffentliche Einstiege, Pool-Ownership und alle fachlichen Abläufe erhalten bleiben.

**Nicht-Ziele:** keine neuen Packages, Provider, Scheduler, globalen Registrierungs-Hooks, Gates, Dependencies oder Package-Subpaths; keine Änderungen an SQL, Schema, Migrationen, HTTP-Verträgen, Plugin-Verträgen, Berechtigungen, Queue-/Lane-Zuordnung, Retry-Zeiten, Worker-Supervision oder App-Bootstrap. Die dynamischen Lifecycle-Imports werden nicht allein zur optischen Bereinigung in statische Imports umgewandelt.

**Maximale Bereiche:** `packages/auth-runtime`, ein kleiner Zugriffsextrakt samt Tests in `packages/instance-registry/src/runtime-wiring.ts`, zugehörige bestehende Dokumentation und dieser Plan. Änderungen an Apps, Plugins, Skripten oder CI gehören nicht dazu.

## Befund und belegte Lücke

Fallow 3.34.0 meldet am Ausgangsstand 20 Dateizyklen über 12 Dateien, keine Workspace-Package-Zyklen und keine reinen Re-Export-Zyklen. Die 20 Wege bilden einen gemeinsamen Knoten. Der Scan berücksichtigt die vorhandenen Ignore-Regeln in `.fallowrc.json`; er ist kein Nachweis über ausgeschlossene Pfade oder Laufzeitrekursion.

Reproduktion aus dem Repository-Root:

```sh
pnpm exec fallow dead-code --circular-deps --package-cycles --re-export-cycles --format json --quiet --explain
```

Aktuell ist Exit 1 wegen der 20 Findings zu erwarten; Exit 0 ist das Ziel nach Umsetzung. Andere Exitcodes sind Analysefehler. Die Diagnose `rule-packs-not-configured` betrifft die nicht angeforderte Policy-Analyse und darf nicht als fehlgeschlagene Zyklenerkennung interpretiert werden.

Die entscheidenden Kanten:

| Quelle                          | Abhängigkeit                                                   | Beleg am Ausgangsstand                                                |
| ------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| Auth-Registry-Composition       | dynamisches Readiness-Read-Modell                              | `packages/auth-runtime/src/iam-instance-registry/repository.ts:56–64` |
| Auth-Registry-Composition       | dynamische Lifecycle-Runtime                                   | `packages/auth-runtime/src/iam-instance-registry/repository.ts:66–84` |
| Lifecycle-Runtime und Readiness | zurück zur vollständigen Registry-Composition                  | `plugin-tenant-lifecycle/runtime.ts:8`, `read-model.ts:5`             |
| Lifecycle und Recovery          | breiter Runner-Barrel statt unabhängiger Registry-Lesefunktion | `plugin-tenant-lifecycle/runtime.ts:13`, `enqueue-recovery.ts:7`      |
| Runner-Registrierung            | Job-Ausführung, Zugriffskontrolle und Scheduling               | `plugin-operations/runner-registry.ts:5–8`                            |
| Zugriffsentscheidung            | vollständige Registry-Composition                              | `plugin-tenant-lifecycle/access.ts:4–5`                               |

`repository.ts` ist trotz seines Namens bereits die Auth-spezifische Runtime-Verdrahtung. Diesen gesamten Baustein umzuziehen würde viele bisher unbeteiligte Verbraucher berühren. Die gezielte Lösung trennt seine Datenzugriffsabhängigkeit ab und lässt die bestehende Composition an ihrem Ort.

## Zielstruktur und bewusste Entscheidungen

### 1. Bestehendes `runner-internal.ts` für Registrierungszustand nutzen

Heute besitzt `runner-registry.ts:36–113` die Handler-Map und ihre Schreib-/Lesefunktionen, aber auch die Task-Erzeugung. `runner-internal.ts` enthält bereits Registry-Typen, `adaptPluginOperationExecutionHandler` und `toRegistryKey`; es hat am Ausgangsstand 83 Zeilen.

In dieses bestehende Modul werden verschoben:

- `registeredStudioJobHandlers` als einzige Map;
- `normalizePluginRegistration` und `replaceRegistrationsBySource`;
- `registerStudioJobExecutionHandlers`, `registerPluginOperationExecutionHandlers`;
- `getRegisteredStudioJobExecutionRegistry`, `getRegisteredPluginOperationExecutionRegistry`.

`normalizePluginRegistration` wird für die vorhandene Task-Factory intern exportiert. Für die bestehende Lifecycle-Handler-Adaption kann `isConfiguredLifecycleJob` aus `runner-lifecycle.js` importiert werden. Dessen Pfad führt nur zu `job-correlation.ts` und dem Plugin-SDK, nicht zum Runner zurück.

`runner-registry.ts` behält Task-Erzeugung und Ausführungsverdrahtung und re-exportiert die bisherigen Registrierungsfunktionen. `runner.ts` und `@sva/auth-runtime/server` bleiben kompatibel. Lifecycle-Runtime und Recovery lesen künftig direkt aus `runner-internal.js`; sie dürfen dafür weder `runner.ts` noch `runner-registry.ts` importieren.

**Erwartete Zwischenmessung:** Von den bestehenden 20 Zyklen bleiben die zwei direkten Registry-/Lifecycle-Zyklen. Dies ist eine aus den heutigen Kanten abgeleitete Prognose, kein bereits gemessener Umbauzustand.

### 2. Registry-Datenzugriff ohne Auth-Composition bereitstellen

Einziger neuer Produktionspfad: `packages/auth-runtime/src/iam-instance-registry/repository-access.ts`.

**Artefaktbegründung:** Lifecycle, Readiness und Access benötigen Registry-Datenzugriff ohne Rückimport der Auth-Composition. Der bisherige Pfad verdrahtet diese Verbraucher selbst; seine bloße Erweiterung löst den Zyklus deshalb nicht, während ein kleines Datenzugriffsmodul den bisherigen Pool mit der Composition teilen kann.

Das neue Modul besitzt ausschließlich:

- den bisherigen `createPoolResolver(getIamDatabaseUrl)` aus `repository.ts:40`, einmal erzeugt;
- dessen intern benötigten Export `resolveInstanceRegistryPool`;
- den reinen generischen `withRegistryRepository`-Zugriff;
- den bisherigen Shutdown dieses Pools.

Keine SQL-/Connection-Implementierung kopieren: Der bereits vorhandene Block in `packages/instance-registry/src/runtime-wiring.ts:203–216` wird im selben Modul als benannter Helper `withInstanceRegistryRepository<T>(deps, work)` herausgezogen. Für `deps` genügt `Pick<InstanceRegistryRuntimeDeps, 'resolvePool' | 'createRepository'>`; kein neues Konfigurationsmodell und keine weitere Factory einführen.

Der Helper übernimmt exakt:

```text
resolvePool → fehlenden Pool ablehnen → connect
→ createExecutor/createRepository → await work → finally release
```

`createInstanceRegistryRuntime` verwendet diesen Helper weiter für seinen bestehenden Accessor. Der neue Auth-Datenzugriff verwendet dieselbe Implementierung über den bereits vorhandenen Subpath `@sva/instance-registry/runtime-wiring`. Die Signaturen der bestehenden Factory und ihrer Rückgabe bleiben erhalten; `package.json` und der Package-Root-Barrel müssen nicht geändert werden.

`repository.ts` importiert den gemeinsamen Poolresolver und re-exportiert den Blatt-Accessor und Shutdown unter den bisherigen Namen; den gleichnamigen Accessor nicht zusätzlich aus `registryRuntime` destrukturieren. Die serviceinternen Zugriffe der generischen Runtime verwenden denselben Resolver und Helper. Es entstehen weder ein zweiter Pool noch eine alternative SQL-Implementierung.

Den Accessor dabei auch lokal importieren: `listActiveInstanceIdsForWorker` verwendet ihn innerhalb von `repository.ts`. Ein ausschließliches `export { withRegistryRepository } from './repository-access.js'` erzeugt keine lokale Bindung. Beispielsweise Resolver als `resolvePool` importieren, `withRegistryRepository` lokal importieren und diese Bindung zusätzlich exportieren.

`runtime.ts`, `read-model.ts` und `access.ts` importieren den Datenzugriff künftig aus `repository-access.js`. Die restlichen heutigen Verbraucher des bisherigen Registry-Einstiegs müssen nicht mechanisch migriert werden.

**Erwartetes Endergebnis:** Die zwei verbleibenden Rückkopplungen verschwinden; vollständiger Fallow-Zyklenscan meldet 0. `runtime-wiring.ts` lädt weiterhin eigene Service-Module; für diese begrenzte Entkopplung ist kein weiterer Package-Subpath nötig.

## Unveränderte Invarianten und Nachweise

Die bestehenden Lifecycle-Verträge `LC-01` bis `LC-06` und die Lease-/Lane-Verträge aus `openspec/changes/add-plugin-tenant-lifecycle/assurance.md` gelten unverändert. Es entsteht keine neue systemübergreifende Invariante.

| Zu erhaltende Eigenschaft                                                                                                                | Bestehender Nachweis und gezielte Ergänzung                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Genau ein Registrierungszustand; Queue, Lane und Capabilities bleiben erhalten                                                           | `runner-registry.test.ts:299`; Registrierung über bisherigen Einstieg und Lesen über `runner-internal` in beiden Importreihenfolgen ergänzen. Nach erneutem Register-Aufruf frisch lesen; keinen alten Map-Snapshot als Live-Referenz voraussetzen. |
| Aktivierungs-Follow-up nach Commit; gewöhnlicher Folgefehler macht Commit nicht rückgängig, explizites Warten propagiert Fehler          | `packages/instance-registry/src/runtime-wiring.test.ts:215`, `:243`, `:260`; erhalten.                                                                                                                                                              |
| Reiner Registry-Zugriff gibt Client auch bei Fehler frei, ohne neue Transaktion oder Rollenwechsel                                       | Bestehende `runtime-wiring.test.ts`; direkten Helper-Fall mit geworfenem `work` ergänzen und fehlenden Pool weiterhin prüfen.                                                                                                                       |
| Composition und Lifecycle verwenden denselben Pool; Shutdown schließt diesen                                                             | Kleines kolokiertes `repository-access.test.ts` ergänzen; nur DB-/Poolgrenze mocken, Resolver-/Accessor-Verdrahtung real lassen. Kein zusätzlicher Produktionsbaustein für Tests.                                                                   |
| Readiness und Access bleiben bei fehlender/ungültiger Evidenz gesperrt                                                                   | `read-model.test.ts:98`, `:127`; `access.test.ts:44–72`; Mocks auf neuen Datenzugriff umstellen, Assertions erhalten.                                                                                                                               |
| Provision/Reconcile/Reactivate/Suspend, Vertragsdrift und Retry-Zeitpunkte bleiben getrennt                                              | `runtime.test.ts:312–890`; nur Imports und erforderliche Mocks ändern.                                                                                                                                                                              |
| Stale Claims, falsche Generationen und fehlende Verträge verhindern Ausführung; Terminalzustand und persistenter Retry bleiben gekoppelt | Bestehende `runner-registry.test.ts:69–646`, insbesondere durable Retry und Retry-Erschöpfung; Assertions erhalten.                                                                                                                                 |
| Lifecycle-Ledger, Job, Event und Wake-up teilen ihre Commit-Entscheidung; Redelivery/Crash-Recovery bleiben korrekt                      | Vorhandener realer PostgreSQL-/Graphile-Vertrag `scripts/ci/verify-plugin-lifecycle-database-contract.ts`.                                                                                                                                          |

**Zusätzliche Verdrahtungslücke:** `repository.test.ts` mockt derzeit `createInstanceRegistryRuntime` und die Lifecycle-Runtime. Im bestehenden Test die tatsächlich erfassten Anschlüsse `serviceDeps.readProvisioningModuleReadiness` und `afterModuleActivationPolicyReconcile` aufrufen und Delegation, Input sowie Fehlerweitergabe prüfen. Isolierte Mocks allein ersetzen den realen Datenbankvertrag nicht.

Den bestehenden Mock von `@sva/instance-registry/runtime-wiring` um den tatsächlich verwendeten Helper ergänzen beziehungsweise partiell auf den echten Helper zurückgreifen; der bisherige reine Factory-Mock stellt ihn nicht bereit. Im Composition-Test außerdem prüfen, dass die an `createInstanceRegistryRuntime` übergebene `resolvePool`-Funktion exakt der Resolver des neuen Datenzugriffs ist.

Keine separaten neuen Tests allein für `enqueue-recovery.ts`, `runner-terminal-state.ts` oder `runner-tenant-guard.ts` erzeugen: Die vorhandenen Verhaltensfälle testen diese Pfade bereits über ihre echten Verbraucher.

## Dateigrenzen

Zulässige Produktionsänderungen:

```text
packages/auth-runtime/src/plugin-operations/runner-internal.ts
packages/auth-runtime/src/plugin-operations/runner-registry.ts
packages/auth-runtime/src/plugin-tenant-lifecycle/runtime.ts
packages/auth-runtime/src/plugin-tenant-lifecycle/enqueue-recovery.ts
packages/auth-runtime/src/plugin-tenant-lifecycle/read-model.ts
packages/auth-runtime/src/plugin-tenant-lifecycle/access.ts
packages/auth-runtime/src/iam-instance-registry/repository.ts
packages/auth-runtime/src/iam-instance-registry/repository-access.ts     # neu
packages/instance-registry/src/runtime-wiring.ts
```

Tests: bestehende `runner-internal.test.ts`, `runner-registry.test.ts`, `runtime.test.ts`, `read-model.test.ts`, `access.test.ts`, `repository.test.ts`, `runtime-wiring.test.ts` sowie neues `repository-access.test.ts`. Der neue Test besitzt eine konkrete Lücke: gemeinsamer Pool-/Shutdown-Pfad über die getrennten Zugriffe.

Dokumentation: bestehenden Runner-Abschnitt in `docs/development/plugin-operations-platform.md` und die betroffene Zuständigkeitsbeschreibung in `docs/architecture/05-building-block-view.md` fortschreiben. Abschnitte 04, 06 und 08 prüfen; bei unveränderten fachlichen Abläufen und Sicherheitsmustern keine neue ADR und keine umgeschriebenen Laufzeitverträge erzeugen.

Nicht ändern: `runner-worker.ts`, `runner-worker-support.ts`, `runner-repository.ts`, `runner-terminal-state.ts`, `runner-tenant-guard.ts`, HTTP-Handler, App-Bootstrap, Datenbankschema, Gates, Baselines und Komplexitätsgrenzen. Der vorhandene `runner.ts`-Barrel bleibt mit seiner bisherigen Fassade bestehen.

## Umsetzung in fester Reihenfolge

### 0. Stand und Referenzen prüfen

- [x] Lokalen Status und `git diff --stat 648f08c86e3e27b8aa644e1ddf621b7de5fe9d86..HEAD -- packages/auth-runtime packages/instance-registry` prüfen. Bei Drift die hier genannten Kanten und Verträge neu bestätigen.
- [x] Isolierten Checkout innerhalb des freigegebenen Projektbereichs verwenden; fremde Änderungen nicht anfassen. Noch kein Push, PR, Merge oder Rollout ist Bestandteil dieses Planungsauftrags.
- [x] Vor nichttrivialer Umsetzung den verfügbaren lokalen XERJ-Index mit `xerj_search` (`match` auf `body`) in `studio-code` sowie fachlich passender Referenz `payload-code` oder `keystone-code` konsultieren. Fundstellen, Quellstand und Lizenz prüfen; abweichende Begriffe gegebenenfalls über `xerj_semantic_search` auf `semantic_body` suchen. Keine Übernahme externer Architektur, wenn der bestehende lokale Pfad ausreicht.
- [x] Aktuelle Zyklen und vier bereits grüne Basistests unten reproduzieren. Keine Umsetzung auf rotem relevantem Ausgangsstand.

### 1. Handler-Registry von Ausführung entkoppeln

- [x] Die oben genannten Registrierungsfunktionen samt einziger Map nach `runner-internal.ts` verschieben und am alten Einstieg re-exportieren. Alten Zustand im selben Schritt entfernen.
- [x] Lifecycle-Runtime und Recovery auf den direkten Registry-Leseimport umstellen. Keine neue Registrierungsdatei oder doppelte Map anlegen.
- [x] Mocks in `runtime.test.ts` vom vollständigen Runner-Barrel auf den tatsächlich benutzten schmalen Import umstellen. Beim Mocken von `runner-internal` tatsächlich benötigte weitere Exporte erhalten.
- [x] Registry-Identität in beiden Importreihenfolgen absichern; Queue-/Lane-/Capability- und Handler-Adaption-Assertions erhalten.
- [x] `runner-internal.test.ts`, `runner-registry.test.ts`, `runtime.test.ts` und die Typprüfung ausführen. Erst bei grünem Stand weiterarbeiten.
- [x] Fallow erneut messen. Erwartet 2 verbleibende bestehende Zyklen; neue Kreise sofort untersuchen, nicht durch Ignore-Regeln ausblenden.

### 2. Registry-Datenzugriff abtrennen

- [x] Unscoped-Zugriffsblock in `runtime-wiring.ts` einmalig als Helper extrahieren; generische Runtime darauf delegieren lassen.
- [x] `repository-access.ts` mit genau einem bisherigen Poolresolver und demselben Shutdown anlegen. Auth-Composition auf diesen Resolver umstellen; bestehenden Accessor und Shutdown kompatibel re-exportieren.
- [x] Nur die drei Lifecycle-Verbraucher `runtime`, `read-model`, `access` auf den neuen Datenzugriff umstellen und ihre Mocks anpassen.
- [x] Pool-/Shutdown-, Helper-Fehler- und Callback-Verdrahtungstests ergänzen. Keine Transaktion, Bootstrap-Logik oder Rollenumschaltung im neuen unscoped Pfad hinzufügen.
- [x] Betroffene Unit- und Typchecks ausführen; Runtime-Pflichtgate früh ausführen. Fallow muss danach 0 Datei-, Package- und Re-Export-Zyklen melden.

### 3. Gesamtverhalten und Lieferung prüfen

- [x] Bestehenden Worker-Test als Verbrauchernachweis ausführen; Worker-Code bleibt unverändert.
- [x] Realen Lifecycle-Datenbankvertrag im dafür freigegebenen lokalen Testumfeld ausführen. Fehlende Docker-/Testberechtigung oder Infrastruktur als offenen Nachweis ausweisen; kein Produktionssystem als Ersatz verwenden.
- [x] Dokumentation der tatsächlichen Zuständigkeiten aktualisieren und Konzepte-/Dateibilanz prüfen: eine Registry-Map, ein Registry-Pool, eine SQL-Zugriffsimplementierung; ein neuer Produktionspfad und ein passender kolokierter Test, keine neue Infrastruktur.
- [x] Vor initialem Push den affected-Scope messen: zehn Projekte; die bereits erfolgreichen gezielten Checks verwenden und den breiten Lauf der CI überlassen. Baselines und Schwellenwerte unverändert lassen.
- [ ] Exakte finale HEAD-Gates der CI einmal terminal abwarten.

## Konkrete Prüfkommandos

Nx-Konfiguration von `auth-runtime` und `instance-registry` wurde bei der Planung über `nx show project --json` geprüft. Alle Dateifilter einzeln über `--testFiles=...` übergeben; ein Exit 0 mit null gefundenen Tests gilt wegen `--passWithNoTests` nicht als Nachweis.

```sh
# Baseline und Zwischenprüfungen – jede Zeile ist ein separater gezielter Lauf.
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-instance-registry/repository.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/plugin-operations/runner-registry.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/plugin-operations/runner-internal.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/plugin-tenant-lifecycle/runtime.test.ts
pnpm nx run instance-registry:test:unit --testFiles=src/runtime-wiring.test.ts

# Nach Abtrennung des Datenzugriffs zusätzlich:
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-instance-registry/repository-access.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/plugin-tenant-lifecycle/read-model.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/plugin-tenant-lifecycle/access.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/plugin-operations/runner-worker.test.ts

pnpm nx run instance-registry:test:types
pnpm nx run auth-runtime:test:types
pnpm check:server-runtime

# Vorhandenes Nx-Integrationstarget, einschließlich des realen Lifecycle-Vertrags.
# Benötigt inzwischen zusätzlich freigegebenen lokalen Test-Redis auf 127.0.0.1:6379.
pnpm nx run auth-runtime:test:integration

# Vor einem breiten affected-Unit-Lauf zuerst dessen Größe messen:
pnpm nx show projects --affected --withTarget=test:unit --base=origin/main

pnpm exec fallow dead-code --circular-deps --package-cycles --re-export-cycles --format json --quiet --explain
pnpm exec fallow audit --base origin/main --gate new-only --format json --quiet --explain
pnpm complexity-gate
pnpm check:file-placement
pnpm check:docs
```

Das bestehende Integrationstarget baut Dependencies und umfasst neben Lifecycle auch Redis-Sessions, Graphile und Media. Der Redis-Schritt benötigt einen bereits erreichbaren lokalen Test-Redis; er startet keinen eigenen Redis-Container. Für eine gezielte Lifecycle-Reproduktion ist sein vorhandener Teilbefehl `node --import tsx scripts/ci/verify-plugin-lifecycle-database-contract.ts` verfügbar; dieser startet und entfernt einen lokalen Docker-Testcontainer. Keinen neuen Nx-Wrapper nur für diesen Aufruf anlegen. Dieser echte DB-Nachweis muss auf dem finalen Stand vorliegen; kein zusätzlicher Zwang zum parallelen Wiederholen desselben Nachweises außerhalb eines bereits erfolgreichen vollständigen Integrationstargets.

**Bei der ursprünglichen Planung tatsächlich ausgeführt:** 26 Tests in `runtime.test.ts`, 11 in `runner-registry.test.ts`, 11 in `repository.test.ts` und 14 in `runtime-wiring.test.ts` – zusammen 62 grün, ohne Nx-Cachetreffer. Dazu der Fallow-Zyklenscan. Die erneuten Läufe am Stand `648f08c86` und ihre anfänglichen Zeitüberschreitungen sind oben dokumentiert. Typ-, Server-Runtime-, Integrations- und vollständige CI-Gates wurden weder für die reine Planung noch bei dieser Aktualitätsprüfung ausgeführt; keine Aussage über deren aktuellen Status.

## Abnahme und Stop-Bedingungen

Abgeschlossen ist der spätere Umbau erst, wenn:

- [x] derselbe vollständige Fallow-Scan 0 Datei-, Package- und Re-Export-Zyklen meldet;
- [x] Registrierung über die bestehenden Einstiege und Lesen über den schmalen Pfad denselben Zustand verwenden;
- [x] nur ein Poolresolver erzeugt wird und Shutdown, Client-Freigabe und Fehlerweitergabe erhalten sind;
- [ ] die genannten Unit-, Type-, Server-Runtime- und realen DB-Nachweise am finalen Stand grün sind;
- [x] der New-only-Audit keine neu eingeführten Befunde und das Komplexitätsgate keine neue Überschreitung zeigen;
- [ ] weder Laufzeitverhalten noch Schema-, Plugin-, HTTP- oder Berechtigungsverträge verändert wurden und die vorhandenen CI-Gates am exakten finalen HEAD terminal erfolgreich sind.

Stoppen und den Entwurf neu zuschneiden, wenn ein neuer Zyklus entsteht, ein zweiter Pool oder eine zweite Registry notwendig erscheint, scoped Transaktionen verändert werden müssten, neue Startup-Registrierungs-Hooks erforderlich scheinen oder Änderungen an App-/Plugin-/Queue-/Autorisierungsverträgen nötig würden. Keinen solchen Befund als kleinen Folgefix in diesen PR aufnehmen.

Die laufenden OpenSpecs `add-plugin-tenant-lifecycle` und `refactor-tenant-creation-readiness` wurden auf Überschneidungen geprüft. Ihre offenen Abnahme-/Betriebsaufgaben bleiben eigenständig. Für diesen verhaltenserhaltenden, lokal begrenzten Umbau ist nach Abschnitt 1.7 der Entwicklungsregeln kein zusätzlicher OpenSpec-Change vorgesehen; zeigt die Umsetzung notwendige Verhaltens- oder Vertragsänderungen, gilt die Stop-Bedingung.

## Verworfene Erweiterungen und Wartung

- Vollständige Composition verschieben oder ein neues Runtime-Framework einführen: unnötiger Verbraucher- und Initialisierungsumbau.
- Eigenes Package oder neuer Registry-Service: vorhandene interne Module und der bestehende Runtime-Subpath genügen.
- Nur dynamische Imports verändern: löst die fachliche Rückkopplung nicht.
- Nur den Runner-Barrel umgehen: beseitigt die direkte Datenzugriffs-Rückkopplung nicht.
- Datenzugriff kopieren oder auf den separaten Pool in `@sva/data-repositories/server` wechseln: würde Ownership und Fehler-/Poolsemantik verändern.
- Allgemeines Import-Smoke-Framework oder neue Tests für jede verschobene Datei: die wenigen Verdrahtungstests und der vorhandene echte DB-Vertrag decken die konkrete Änderung ab.

Künftige Lifecycle-Leser importieren den Datenzugriff, keine Auth-Composition. Registry-Zugriffe aus Lifecycle-/Recovery-Code bleiben unabhängig von Task-Erzeugung und Worker-Start. Die bisherigen Fassaden bleiben die Einstiege für bestehende externe Verbraucher.
