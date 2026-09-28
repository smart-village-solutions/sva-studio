## Kontext und belegte Lücke

Stand `origin/main` `dda6ea8c9` vom 27.09.2026: Core hat 84 Waste-Dateien und exportiert Verträge, Import-/Jahreswechselregeln und PDF-Ausgabe über `src/index.ts` und `./waste-output`. Das SDK reicht konkrete Waste-Typen und `wasteManagementOperationsContract` weiter; selbst `@sva/waste-management-contracts` importiert diese Waste-Exporte bisher aus dem SDK. Auth hat 83 Dateien unter `src/waste-management/`, Data-Repositories 30 unter `src/waste-management/`; Routing referenziert `authRuntimeRoutes.wasteManagementHandlers` fest. Die vorhandenen Waste-Contracts/Runtime-Pakete sind unmittelbare Verbraucher und Owner dieser Fachlogik; weitere Sammelpakete würden nur eine zweite Ownership-Grenze schaffen.

Die vorhandene Plugin-Server-Dispatch-Schicht (`plugin-server-runtime.server.ts` und `plugin-server-handlers/dispatcher.ts`) prüft validierte Descriptoren, Host-Authentifizierung, Tenant-Aktivierung, Rechte und CSRF, gleicht aber nur exakte URL-Pfade ab. Zusätzlich akzeptiert die SDK-Validierung nur `/api/v1/plugins/<pluginId>/*`, und der App-Einstieg ruft den Dispatcher nur für diesen und den internen Prefix auf. Die geltende Waste-Spezifikation verlangt dagegen `/api/v1/waste-management/*`, auch für `/$tourId` und weitere Parameter. Alle drei Stellen müssen im vorhandenen Dispatch-Pfad angepasst werden; ein Waste-Sonderdispatcher wäre ein paralleler Ausführungspfad.

## Entscheidungen

1. **Verträge und reine Logik:** Die Waste-Module aus Core werden nach Browser-/Server-Tauglichkeit inventarisiert und nach `@sva/waste-management-contracts` beziehungsweise für reine Serverausführung nach `@sva/waste-management-runtime` verschoben. Der öffentliche Kalender importiert nur die browserfähigen Verträge/reinen Funktionen sowie seine nötigen serverfähigen Waste-Subpaths. Generische Studio-Job-, Audit-, Medien- und IAM-Verträge bleiben im Core/SDK. `wasteManagementOperationsContract`, Jobinputs und Importprofile werden in der Waste-Ownership definiert; das SDK liefert nur generische Job-/Import-Bausteine. Zyklen zwischen SDK und Waste-Contracts sind ausgeschlossen.
2. **Gemeinsamer Instanzvertrag:** `IamInstanceDetail.wasteManagementSettings` ist eine fachliche Erweiterung eines Host-Typs. Der Basis-Typ im Core verliert dieses Feld. `@sva/waste-management-contracts` definiert einen zusammengesetzten Waste-Instanzdetailtyp auf Basis von `IamInstanceDetail`; `instance-registry` verwendet ihn für die bereits bestehende optionale Antwort-Erweiterung und die direkten Antworttypen/Tests werden mitgezogen. Die JSON-Antwort mit `wasteManagementSettings` bleibt für diesen Bestandsverbraucher gleich. Im aktuellen App-Code gibt es keinen direkten Feldzugriff; es wird kein zusätzlicher Settings-Endpoint eingeführt. Allgemeine Registry-Provisionierungsregeln bleiben #1508.
3. **Fachpersistenz:** Waste-Tabellen-SQL, Transaktionsgrenzen und Repository-Verträge ziehen in den bestehenden Waste-Serverbereich. Dafür wird ein schmaler Server-Subpath `@sva/waste-management-runtime/repositories` im vorhandenen Package genutzt: Die eigenständig veröffentlichte Public-Waste-App braucht genau diese Repository-Fassade, darf aber den bestehenden Job-Entry-Point `./server` nicht mitladen. Generische SQL-Ausführung, Verbindung/Secret-Auflösung und Tenant-Kontext bleiben Host-Capabilities. Das bestehende Jahreswechsel-Write bleibt eine atomare Transaktion mit unveränderter Konflikt- und Idempotenzsemantik.
4. **HTTP-Ausführung:** `packages/plugin-waste-management/src/server.ts` wird der Server-Entry-Point im bestehenden Manifest-/Snapshot-Pfad und bindet die Fachhandler aus `@sva/waste-management-runtime/server` über die schmale, nur für den Plugin-Server-Entry vorgesehene Host-Fassade `@sva/auth-runtime/waste-host`. Die SDK-Pfadvalidierung akzeptiert zusätzlich nur einen exakt zum Plugin-Namespace passenden fachlichen Prefix `/api/v1/<pluginId>/*`; sie verwirft fremde Prefixe. Beim Bootstrap werden Überschneidungen mit Host-Routen oder anderen Plugin-Descriptoren fail-closed abgewiesen. Der App-Einstieg leitet nur Pfade aus dem validierten Server-Snapshot an denselben Dispatcher; die Prefix-Erkennung allein registriert keinen Endpoint. Dieser matcht `$param`-Segmente, priorisiert statische Pfade und verwirft mehrdeutige Methode/Pfad-Kombinationen beim Aufbau; validierte Parameter gehen in den bestehenden Execution-Context. Descriptor, Plugin-Aktivierung, Tenant, Permission und CSRF werden vor dem Fachhandler geprüft. Die bisherigen `/api/v1/waste-management/*`-Pfade, Methoden, Status-/Fehlercodes und Audit-Ereignisse werden 1:1 abgebildet. Mit vollständiger Coverage werden die 49 Waste-Pfade aus `packages/auth-runtime/src/routes.ts`, ihre 62 Methodenbindungen aus `packages/routing/src/auth.route-handlers.waste.server.ts` und `auth.routes.server.handlers.ts` sowie `wasteManagementHandlers` aus `runtime-routes.ts` im selben Cutover entfernt. Dadurch erzeugen weder `getClientRouteFactories` noch `getServerRouteFactories` weiter feste Waste-Routen; `server.ts` dispatcht die deklarierten Fachpfade vor `dispatchAuthRouteRequest` und `startFetch`. Für nicht installiertes Waste gibt es keinen registrierten Handler und keinen Import der Waste-Server-Runtime.
5. **Keine technische Schattenmigration:** Keine dauerhaften allgemeinen Core-/SDK-/Auth-Reexports, kein zusätzlicher Router und kein eigener Waste-IAM-Entscheider. Bestehende Host-Funktionen dürfen über einen schmalen, typisierten Execution-Context injiziert werden. Wenn der vorhandene Kontext eine nötige Capability nicht trägt, wird genau diese Capability am bestehenden Vertrag ergänzt und samt Negativtest überprüft. Der Context wird nicht zu einem allgemeinen Service-Locator ausgebaut.

## Bestandsmatrix für HTTP und Actions

Quelle: `packages/routing/src/auth.routes.server.handlers.ts`, `auth.route-handlers.waste.server.ts` und die jeweils aufgerufenen `packages/auth-runtime/src/waste-management/core/**` am oben genannten HEAD. Alle Pfade haben den gemeinsamen Prefix `/api/v1/waste-management`. Es sind **49 Pfadmuster und 62 Methodenbindungen**; jeder Eintrag muss nach der Migration genau einmal im validierten Server-Snapshot vorkommen. Die Handlernamen bezeichnen die heutigen Keys von `wasteManagementHandlers`, nicht neue APIs.

Rechte: `R` = `waste-management.read`, `M` = `waste-management.master-data.manage`, `T` = `waste-management.tours.manage`, `S` = `waste-management.scheduling.manage`, `C` = `waste-management.settings.manage`, `I` = `waste-management.import.execute`, `E` = `waste-management.export.execute`, `B` = `waste-management.seed.execute`, `X` = `waste-management.reset.execute`.

| Pfad-Suffix | Methode → bisheriger Handler (Recht) |
| --- | --- |
| `/history` | GET → `getHistory` (R) |
| `/master-data` | GET → `getMasterDataOverview` (R) |
| `/fractions` | POST → `createFraction` (M) |
| `/fractions/$fractionId` | DELETE → `deleteFraction` (M); PUT → `updateFraction` (M) |
| `/regions` | POST → `createRegion` (M) |
| `/regions/$regionId` | PUT → `updateRegion` (M) |
| `/cities` | POST → `createCity` (M) |
| `/cities/$cityId` | PATCH/PUT → `updateCity` (M) |
| `/streets` | POST → `createStreet` (M) |
| `/streets/$streetId` | PUT → `updateStreet` (M) |
| `/house-numbers` | POST → `createHouseNumber` (M) |
| `/house-numbers/$houseNumberId` | PUT → `updateHouseNumber` (M) |
| `/collection-locations` | GET → `getCollectionLocations` (R); POST → `createCollectionLocation` (M) |
| `/collection-locations/selection` | GET → `getCollectionLocationIds` (R) |
| `/collection-locations/$locationId` | DELETE → `deleteCollectionLocation` (M); PUT → `updateCollectionLocation` (M) |
| `/location-tour-links` | POST → `createLocationTourLink` (T) |
| `/location-tour-links/bulk` | POST → `createLocationTourLinksBulk` (T) |
| `/location-tour-links/$linkId` | DELETE → `deleteLocationTourLink` (T); PUT → `updateLocationTourLink` (T) |
| `/scheduling` | GET → `getSchedulingOverview` (R) |
| `/location-tour-pickup-dates` | POST → `createLocationTourPickupDate` (S) |
| `/location-tour-pickup-dates/$pickupDateId` | DELETE → `deleteLocationTourPickupDate` (S); PUT → `updateLocationTourPickupDate` (S) |
| `/tour-assignments` | POST → `createTourAssignment` (S) |
| `/tour-assignments/$assignmentId` | DELETE → `deleteTourAssignment` (S); PUT → `updateTourAssignment` (S) |
| `/global-date-shifts` | POST → `createGlobalDateShift` (S) |
| `/global-date-shifts/$shiftId` | DELETE → `deleteGlobalDateShift` (S); PUT → `updateGlobalDateShift` (S) |
| `/holiday-rules/$holidayRuleId` | DELETE → `deleteHolidayRule` (S); PUT → `updateHolidayRule` (S) |
| `/tour-date-shifts` | POST → `createTourDateShift` (S) |
| `/tour-date-shifts/$shiftId` | DELETE → `deleteTourDateShift` (S); PUT → `updateTourDateShift` (S) |
| `/tours` | GET → `getToursOverview` (R); POST → `createTour` (T; bei `duplicateFromTourId` zusätzlich S) |
| `/tours/annual-transfer` | POST → `createAnnualTourTransfer` (T + S) |
| `/tours/annual-transfer/preview` | POST → `previewAnnualTourTransfer` (T + S) |
| `/tours/bulk-validity` | PUT → `updateTourValidityBulk` (T) |
| `/tours/bulk-status` | PUT → `updateTourStatusBulk` (T) |
| `/tours/$tourId` | DELETE → `deleteTour` (T); PUT → `updateTour` (T) |
| `/settings` | GET → `getSettings` (C); PUT → `updateSettings` (C) |
| `/settings/holiday-sync` | POST → `runHolidaySync` (C) |
| `/settings/provisioning/retry` | POST → `retryProvisioning` (C) |
| `/tools/initialize` | POST → `startInitialize` (C) |
| `/tools/imports` | POST → `startImport` (I) |
| `/tools/imports/upload` | POST → `uploadImportSource` (I) |
| `/tools/exports` | POST → `startExport` (E) |
| `/tools/imports/preview` | POST → `previewLocationTourPickupDateImport` (I) |
| `/tools/migrations` | POST → `startMigrations` (C) |
| `/tools/seed` | POST → `startSeed` (B) |
| `/tools/mainserver-sync` | POST → `startMainserverSync` (S) |
| `/mainserver-sync-status` | GET → `getMainserverSyncStatus` (R; im Routing `getSyncStatus`) |
| `/tools/sync-waste-types` | POST → `startSyncWasteTypes` (M) |
| `/tools/postal-codes/enrich` | POST → `startEnrichPostalCodes` (M) |
| `/tools/reset` | POST → `startReset` (X) |

**Autorisierungsentscheidung:** Der heutige Waste-Pfad nutzt `evaluateAuthorizeDecision` für `resource.type = 'waste-management'`; der vorhandene Plugin-Server-Dispatcher nutzt dagegen `evaluateUiAccess` und verlangt bei `resourceContext: 'collection'` zusätzlich eine aktive Organisation. Diese Semantiken sind nicht austauschbar. Für die namespacegleichen Fachpfad-Descriptoren prüft der Host `accessRequirement.actions.values` mit `evaluateAuthorizeDecision` und demselben Instanz-/Ressourcenkontext; der bisherige UI-Zugriffsmodus für `/api/v1/plugins/<id>/*` bleibt bestehen. Waste deklariert die neun bereits vorhandenen Permission-IDs zugleich als Plugin-Actions mit jeweils passendem Tenant-Requirement, damit die bestehende SDK-Validierung von `serverHandlers[].actionId` und `accessRequirement` erfüllt ist. Für beide Jahreswechsel-Endpunkte deklariert es zusätzlich eine Action `waste-management.annual-transfer.execute` mit `allOf(T,S)`; das ist nur ein Descriptor für zwei bestehende Rechte, keine neue Permission. `createTour` behält einen zusätzlichen hostgeführten `authorizeAction(S)`-Aufruf **nach** Body-Validierung und **vor** jeder fachlichen Mutation, falls `duplicateFromTourId` gesetzt ist. Für alle anderen Zeilen erfolgt die vollständige Rechteprüfung vor Eintritt in den Fachhandler. Der Host lässt weder fehlende Aktivierung noch einen anderen Tenant bis zur Fachausführung durch.

**Fehler- und Auditvertrag:** Die heutigen Host-Responses für 401, fehlenden Instanzkontext, 409 `plugin_tenant_access_blocked` mit `reason_code`, 403 `forbidden` mit `action`/`reason_code`, 503 `database_unavailable`, CSRF-Fehler und JSON-405 samt `Allow` werden als Vergleichsbaseline erfasst und im neuen Dispatch identisch gehalten. Fachhandler behalten ihre vorhandenen 400-/404-/409-/413-Fälle und Erfolgstatus, inklusive `ApiItemResponse` und Request-ID. Besonders zu vergleichen sind Jahreswechsel-Fehler `invalid_source_year`, `replacement_date_invalid`, `preview_stale`, `target_identity_conflict`, `target_conflict_unacknowledged`, `idempotency_key_required`, `idempotency_key_reuse`, `idempotency_in_progress` und `batch_limit_exceeded`; Bulk-Status/-Gültigkeit, Import-Upload und aktiver Postleitzahl-Job haben eigene Negativfälle. Fachliche Audit-Action-IDs, Ergebnis, Grund, Resource-ID und Batch-Zusammenfassung bleiben gleich; Host-Reporter emittiert die Events, nicht eine zweite Audit-Pipeline im Plugin.

**Benötigte Host-Fähigkeiten:** Der Dispatcher liefert den bereits geprüften Auth-/Tenant-Kontext, Pfadparameter und für die bedingte zweite Tour-Berechtigung eine hostgeführte Action-Prüfung. Fachhandler melden Audit-Daten über den vorhandenen Host-Reporter; Jobstart, Import-Artefaktspeicher und Jahreswechsel-Idempotenz bleiben hinter den bestehenden Host-Operationen. Fach-Repositories bekommen nur tenantgebundenen DB-/Transaktionszugriff; Secret-Auflösung und Poolwahl erfolgen davor im Host. Weder rohe Secrets noch frei wählbare Pools, Registry-/Runner-Interna oder Lease-Tokens werden zum öffentlichen Plugin-Kontext. Der bestehende `PluginServerHandlerExecutionContext` trägt diese Fähigkeiten heute nicht. PR 2 ergänzt nur konkret genutzte typisierte Eingaben an der vorhandenen Server-Factory beziehungsweise am Context; jede zusätzliche Fläche braucht einen benannten Waste-Verbraucher und einen Negativtest. Die Fach-Repository-Fassade bleibt für die eigenständig veröffentlichte Public-Waste-App ohne Studio-Session- oder Job-Kontext importierbar.

Die heutige `WasteManagementHandlerDeps` ist keine Vorlage für eine neue SDK-Schnittstelle: Sie enthält neben Host-Diensten zahlreiche Waste-Repository-Methoden und ungenutzte optionale Felder. Für PR 2 sind folgende **tatsächlich aufgerufene Grenzen** maßgeblich; die konkrete Signatur wird erst beim Verschieben des jeweiligen Verbrauchers festgelegt:

| Host-Grenze | Heutiger Verbraucher | Enger Vertrag beim Umzug |
| --- | --- | --- |
| Request-Identität und Berechtigung | `server-context.ts`, `core/auth.ts`, `tours.ts` | Geprüfte Instanz, Actor, Organisation, Request-/Trace-ID und Pfadparameter; `evaluateAuthorizeDecision` im Host, einschließlich bedingter zweiter Prüfung bei Tour-Duplikation. CSRF bleibt Host-Prüfung vor schreibenden Handlern. |
| Actor-Account und Audit | `operations.ts`, `settings.ts`, `annual-tour-transfer.ts`, `core/auth.ts` | Host löst den Actor-Account samt Mitgliedschaft auf und emittiert Waste-Audit-Metadaten mit eigener Identität/PII; das Plugin erhält keine IAM-Session oder Audit-Repository. |
| Tenantgebundene Datenbank | `server-loaders.ts`, `master-data.*` | Host wählt Waste-Datenquelle, entschlüsselt Verbindung und bindet Pool/Schema; Waste erhält nur einen auf die geprüfte Instanz begrenzten Executor samt Transaktionsmöglichkeit für Bulk- und Jahreswechsel-Schreibvorgänge. Studio-Job-/Audit-Lesezugriffe bleiben über vorhandene Host-Operationen gebunden. |
| Jobstart und Import-Artefakt | `operations-support.ts`, `operations.ts`, `fractions-support.ts`, `settings.ts` | Host-Operation für idempotenten Jobstart mit bestehender Queue-/Aktivjob-Semantik sowie bestehendes `storePluginOperationInput` für den validierten Upload. Keine Runner- oder Registry-Interna. |
| Jahreswechsel-Idempotenz | `annual-tour-transfer-idempotency.ts`, `annual-tour-transfer-execution.ts` | Host verwaltet Reservierung, Heartbeat, Replay, Audit-Deduplikation, Abschluss und Freigabe um die Waste-Transaktion; kein Lease-Token im öffentlichen Plugin-Context. |
| Einstellungen und Provisionierung | `settings-shared.ts`, `settings-write-support.interface-selection.ts`, `settings.ts` | Bestehende Host-Operationen für External-Interface-Lesen/-Schreiben, Connection-Check und Provisionierungsstatus/-Retry verwenden. Entschlüsselung und Probe bleiben hostseitig; keine rohe `revealSecret`-/`protectSecret`-Capability. |

`getSessionById`, `protectSecret` und `loadWasteAuditOverview` stehen zwar im bisherigen Dep-Typ, werden von den produktiven Core-Handlern aber nicht aufgerufen und begründen keine neue Capability. Die Waste-spezifischen Repository-Methoden sind nach dem Umzug interne Aufrufe der Waste-Runtime, keine einzelnen SDK-Context-Felder. Host-Dienste gehören nach Möglichkeit in die Server-Factory; der Request-Context enthält nur pro Request geprüfte Werte und die nötige bedingte Autorisierung.

**Oberflächenbudget:** Die Änderung nutzt `waste-management-contracts`, `waste-management-runtime`, Plugin-Server-Entry-Point und den vorhandenen Snapshot/Dispatcher. Sie fügt keine Package-Familie, Queue, Registry, Retry-Schicht, CI-Gate oder parallele HTTP-Fassade hinzu. Neue generische API-Fläche ist nur für den vorhandenen Waste-Vertrag zulässig: namespacegleicher Fachpfad, Parameter-Matching und die bestehende serverseitige Action-Entscheidung. Vor jedem PR-Push wird geprüft, ob eine geplante neue Option oder Capability von einem der 62 Bestandsaufrufe tatsächlich benötigt wird; ungenutzte Einträge entfallen.

## Systemgrenzen und Failure Modes

| Invariante | Fehlerbild | Nachweis bei Umsetzung |
| --- | --- | --- |
| Ohne Waste kein Handler oder Fach-SQL im allgemeinen Auth-/Routing-Pfad | Statischer Import über Core, SDK, Routing oder Auth | Paketgraph und gebaute Distribution ohne Waste prüfen; Import-/Starttest; verbleibende #1507/#1508/#1511/#1512-Kanten gesondert ausweisen |
| Nur ein produktiver HTTP-Pfad | Alte Route und Plugin-Dispatch antworten gleichzeitig oder TanStack materialisiert eine zweite Route | Route-Coverage für alle Methoden/Parameter, Abwesenheit der 49 Auth-Pfade in Client- und Server-Route-Factories, Server-Entry-Smoke mit und ohne installiertes Plugin |
| Host prüft vor Fachcode | Inaktives Plugin, falscher Tenant, fehlendes Recht oder CSRF erreicht SQL | Negativtests mit Schreib-Spies und Status-/Fehlercodevergleich |
| Fachschreibvorgänge bleiben atomar | Jahreswechsel/Bulk-Status erzeugt Teilzustand | Reale DB-Integration für Rollback, Konflikt und Idempotenz |
| Browser lädt keine Servermodule | PDF/Repository/Secret-Code im UI-Bundle | Browser-Importgraph und Build-Artefakt prüfen |
| Öffentliche Ausgabe bleibt gleich | Tourfilter, PDF/iCal oder Reminder weichen ab | Public-Waste-Integration und Ausgabe-Vergleich vor/nach Umzug |

## Abgleich vor Implementierung

- Die offenen Changes `add-waste-tour-status-bulk-update`, `add-waste-disruption-notification-settings`, `add-plugin-tenant-lifecycle` und der Public-Waste-Release-Change berühren dieselben Verträge/Verbraucher. Vor Codebeginn deren Merge- und Rollout-Stand gegen den dann aktuellen `origin/main` prüfen; fachliche Status- und Reminder-Semantik übernehmen, nicht mit diesem Refactor verändern.
- #1508 berührt ebenfalls `instance-registry`; nur die konkrete Waste-Settings-Antwort koppelt #1505 daran. #1511/#1512 können Server-Descriptor-/Loader-Flächen verändern; die endgültige Snapshot-/Entry-Point-Form koordinieren, ohne ihre allgemeine Implementierung in diesen Scope zu ziehen.
- Die Pfadöffnung ist durch den bestehenden Waste-HTTP-Vertrag begründet. Vor der Implementierung die vollständige Methode/Pfad/Action-Matrix aus den aktuellen `auth.route-handlers.waste.server.ts` und `auth.routes.server.handlers.ts` festhalten. Ein zusätzlicher kanonischer Waste-Endpoint unter `/api/v1/plugins/waste-management/*` wird nicht eingeführt.
- Vor dem Route-Cutover die tatsächliche Reihenfolge in `apps/sva-studio-react/src/server.ts` und beide TanStack-Route-Factories prüfen. Die 49 Auth-Pfade und 62 Handlerbindungen werden zusammen entfernt; Tests müssen zeigen, dass ein deklarierter Waste-Pfad genau einmal antwortet und ein nicht deklarierter oder ohne Waste angefragter Pfad weder eine feste Auth-Route noch einen Plugin-Handler erreicht.
- Die Public-Waste-App hat einen eigenen Releasepfad. Bei unverändertem Daten-/HTTP-Vertrag genügen passende Build-/Integrationsnachweise; jeder tatsächlich nötige gemeinsame Release-Schritt ist vor dem Implementierungs-PR festzuhalten.

## Verifikationsstrategie

Vor dem Verschieben die vorhandenen Jahreswechsel-, Import-, PDF-, Auth- und Repository-Tests als Baseline mit tatsächlicher Testzahl erfassen. Nach jedem Abschnitt die Tests unter dem neuen owning Nx-Projekt mit `--testFiles=...` ausführen; „No test files found“ zählt nicht. Dazu gezielte Typchecks der betroffenen Pakete und Apps, `pnpm check:server-runtime`, `pnpm check:plugin-architecture-boundary`, Browser-/Node-Importprüfung und `openspec validate refactor-waste-plugin-ownership --strict`. Für SQL-/Autorisierungsänderungen gelten zusätzlich die Pflicht-Gates aus `DEVELOPMENT_RULES.md` 5.2 und 5.2a. Den affected-Scope vor einem breiten Unit-Lauf zuerst messen. Die vollständige CI-Evidenz muss am exakten finalen PR-HEAD stehen.

**Risiko und Freigabegrenze:** #1505 hat ein mittleres Regressionsrisiko durch geänderte Exporte und Public-Waste-Ausgaben; #1506 hat ein hohes Risiko durch den Wechsel von 49 Pfaden/62 Methoden, Autorisierung, Tenantbindung, Jobs und transaktionalen Schreibvorgängen. Das sind qualitative Einschätzungen, keine Ausfallwahrscheinlichkeiten. Ein grüner Build oder OpenSpec-Check allein senkt das Risiko nicht ausreichend. #1505 ist erst mit direkter Verbraucher-Migration und Ausgabe-Vergleich freigabereif. #1506 ist erst freigabereif, wenn der neue Pfad die Bestandsmatrix samt Fehler- und Auditvertrag erfüllt, kein alter Waste-Route-Factory-Pfad verbleibt, Negativtests Fachzugriff bei fehlendem Recht/falschem Tenant/CSRF ausschließen und echte DB-Tests Rollback sowie Replay/Idempotenz des Jahreswechsels belegen. Fehlt einer dieser Nachweise, bleibt der Abschnitt offen; keine Freigabe aufgrund bloßer Typ- oder Unit-Test-Grünheit.

## Rücknahme

Jeder Lieferabschnitt muss ein eigenständig grüner Zustand sein. Ein fehlerhafter Abschnitt wird als ganzer Commit/PR zurückgenommen; weder ein permanenter Alias in Core/SDK noch ein zweiter Route-Pfad dient als Rollback-Schicht. Daten bleiben bestehen, da keine Migration vorgesehen ist.
