## Ausgangslage und Messung

Referenz: `origin/main` bei `64215aa9` am 02.10.2026. Der unveränderte Lauf
`pnpm complexity-gate` wertete 2.687 Dateien aus, meldete null unregistrierte
Findings und 445 registrierte Findings über alle vier Metriken. Davon sind
164 aktuelle `fileLines`-Überschreitungen. Das Register enthält 205
`fileLines`-Einträge; ältere oder bereits unter dem Limit liegende Einträge
sind kein aktueller Verstoß. Die PR-Planung zählt die **aktuellen Messwerte**,
nicht alle Registereinträge. Die Zahlen werden vor jeder Tranche erneut
ermittelt; parallele Arbeit kann sie verändern.

| Bereich                                 | Aktuelle Dateien über Limit | PR-Startbudget | Startzuschnitt für Liefer-PRs                                                                                                            |
| --------------------------------------- | --------------------------: | -------------: | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Core, Routing, Server-Runtime           |                          10 |              2 | Verträge/Exports; Routing und Runtime nach eigener Risiko- und Testgrenze                                                                |
| Studio-Frontend                         |                          24 |              8 | Shell/Navigation; IAM-API; IAM-Cockpit; Rollen/Gruppen; Benutzerseiten; Organisationen/Auswahl; Instanzen/Schnittstellen; Content/Medien |
| Auth-Runtime, IAM-Admin, IAM-Governance |                          37 |              5 | Account/Rollen; DSR/Governance; Auth/Session; Plugin-/Content-/Media-Pfade                                                               |
| Data-Repositories, Instance-Registry    |                          17 |              3 | Media/Operations; Instanz-Repository; Provisionierung/Keycloak                                                                           |
| Plugin-SDK, Studio-UI                   |                           7 |              2 | SDK-Vertragsfläche; bestehende UI-Primitives/Editoren                                                                                    |
| Fachplugins ohne Waste                  |                          11 |              6 | Events; News; Generic Items; POI; Projects; Cockpit Cards                                                                                |
| Waste-Plugin, -Runtime, -Contracts      |                          27 |              4 | Touren/Orte; Settings/Loader/Handler; öffentliche Verträge/Übersetzungen                                                                 |
| SVA-Mainserver                          |                           9 |              2 | Content-Routen; Service/Wiring; Typen und interne Mapper                                                                                 |
| Öffentlicher Waste-Kalender             |                           8 |              2 | öffentliche Daten-/Reminder-Pfade; Panels/Route                                                                                          |
| CI-/Ops-Skripte, Studio-MCP             |                          14 |              4 | Complexity/Coverage/Sonar; DB-/Runtime-Prüfer; Ops; MCP                                                                                  |
| **Gesamt**                              |                     **164** |         **38** |                                                                                                                                          |

Diese Tabelle ist eine vollständige Partition der aktuell gemessenen Befunde
nach bestehenden Ownership-Bereichen. Ein Bereich ist **kein** automatischer
PR: Die letzte Spalte benennt die fachlichen Schnittkandidaten. Das
Startbudget von 38 PRs wurde durch die konkrete Teilung von PR 06 bis PR 11
auf derzeit 62 einzeln beschriebene Aufgaben in `tasks.md` angepasst.
PR 06 wurde nach der Messung von 8.984 Zeilen über acht Dateien
in vier seriell bearbeitbare Teile 06a bis 06d aufgeteilt. Nach dem Merge
von 06c zeigte die erneute Messung für 06d 3.066 Zeilen über vier Dateien.
Die getrennten Benutzer- und Organisationsoberflächen werden daher als 06d1
und 06d2 nacheinander bearbeitet; der SearchableSelect bleibt beim
Organisationsabschnitt, der seine Filterfunktion direkt verwendet. Die Nummern
definieren eine serielle Reihenfolge, keine Quote:
Wenn neue Evidenz einen anderen Schnitt erfordert, wird die betreffende
Aufgabe vor ihrer Umsetzung konkret geändert. Ein Maximum geänderter Dateien
ersetzt die Risikoprüfung nicht.

Nach PR 06d2 ergab die Messung für PR 07 acht Dateien mit 6.959 Zeilen.
Sie liegen in unterschiedlichen Ausführungsgrenzen: Anlageassistent,
Betriebsmodelle mit Detailseite, serverseitige Speicherung mit Healthcheck,
API-Serverfunktionen, Dialoge und Instanz-Hook. Deshalb werden sie als
07a bis 07f in dieser Reihenfolge geliefert. Jeder Teil beseitigt
seinen benannten Befund und nutzt die bereits vorhandenen Pfadtests; die
Schnittstellenverträge bleiben dabei unverändert.

Vor PR 08 ergab die erneute Messung vier Dateien mit zusammen 3.607 Zeilen.
Content-Liste, Content-Editor, Waste-Import und Medien-Hook besitzen getrennte
Verbraucher und Ausführungsgrenzen. Sie werden als 08a bis 08d nacheinander
geliefert: Jede Änderung beseitigt ihren eigenen Befund, erhält die
betreffenden Bedien- und Datenverträge und besitzt einen eigenen Changelog.
Der separate Change `refactor-sva-studio-react-package-boundaries` bleibt
für die UI-Package-Konsolidierung zuständig.

Vor PR 09 ergab die erneute Messung sieben Dateien mit zusammen 3.995 Zeilen.
Die Profil-Handler in `auth-runtime` und Profil-Commands in `iam-admin`
bilden gemeinsam den Self-Service-Vertrag (09a). Schema-Readiness und
Fehlerdiagnose bleiben im selben Runtime-Pfad (09b). Der Tenant-Keycloak-Import
(09c) und Admin-Benutzerlesen/-aktualisierung (09d) besitzen getrennte
Mutations- und Testgrenzen. Diese vier PRs folgen seriell aufeinander, jeweils
direkt auf aktuellem `main`, und erhalten jeweils einen eigenen Changelog.

Vor PR 10 ergab die erneute Messung sieben Dateien mit zusammen 6.092 Zeilen.
Organisationslesen (10a) und Organisationsmutationen (10b) besitzen getrennte
Ausführungsgrenzen. Rollenpersistenz (10c) und Identity-Provider-Reconcile
(10d) werden wegen unterschiedlicher Fehler- und Auditpfade getrennt geprüft.
Moderne und Legacy-Gruppenmutationen (10e) betreffen denselben Gruppenvertrag
und werden gemeinsam, aber mit beiden vorhandenen Testpfaden bearbeitet.
Die öffentliche Package-Oberfläche (10f) benötigt einen eigenen Export- und
Runtime-Nachweis. Jeder Abschnitt startet nach dem Merge des vorigen auf
aktuellem `main` und enthält einen eigenen Studio-Changelog.

Vor PR 11 ergab die erneute Messung zehn Dateien mit zusammen 6.216 Zeilen.
Der einzelne bisherige PR würde HTTP-Autorisierung, DSR-Export und Queue,
Leseprojektionen, Governance-Workflow und Rechtstextmutationen zugleich
berühren. Diese Ausführungs- und Datengrenzen werden als 11a bis 11f
seriell geliefert: DSR-HTTP-Handler (11a), Exportkette über Runtime und
Governance-Package (11b), DSR-Leseprojektionen (11c), Workflow-Ausführung
(11d), Governance-HTTP-Handler (11e) und Rechtstextmutationen (11f).
Jeder Teil beseitigt alle eigenen aktuellen `fileLines`-Befunde, erhält
öffentliche Verträge und besitzt einen eigenen Changelog. Auth-/Tenant-
Grenzen, PII-Schutz, Audit, Idempotenz, Export-Vollständigkeit und
Transaktionen werden am jeweils betroffenen Pfad gezielt nachgewiesen.

Vor PR 12 zeigt die erneute Messung vier Dateien mit zusammen 3.173 Zeilen:
`auth-route-handlers.ts` (1.614), `redis-session.ts` (659),
`audit-db-sink.ts` (541) und `iam-authorization/shared.ts` (359).
HTTP-Auth, Redis-Session-State, Audit-Persistenz und IAM-Autorisierung
liegen an unterschiedlichen Trust- und Ausführungsgrenzen. Deshalb folgen
12a bis 12d seriell und direkt auf dem jeweils aktuellen `main`. Jeder
Teil beseitigt seinen eigenen `fileLines`-Befund und erhält einen eigenen
Changelog. Für 12a bleibt `auth-route-handlers.ts` der Importvertrag der
sieben `runtime-routes.ts`-Handler und löst die OTEL-Initialisierung weiter
beim Modulimport aus. Bestehende `auth-server/{login,callback,logout,session*}`-
Module werden als Verbraucher und Implementierungen genutzt; es entsteht
kein zweiter Auth-Pfad. Side-Effect-Reihenfolge, Cookie-/State-Lifecycle,
Tenant-/Session-Scope, Fail-Closed und PII-arme Audit-Logs sind mit den
vorhandenen Handler-, Auth-Server- und Session-Tests zu prüfen.

**PR-Auftrag 12a:** Die Datei `auth-route-handlers.ts` unter das
320-Zeilen-Limit bringen, indem ihre bestehenden Handler und Hilfen nach
fachlicher Verantwortung aufgeteilt werden, während Route-Exporte und
Auth-Verhalten unverändert bleiben. Nicht-Ziele sind 12b–12d, neue Features,
API-/DB-/Keycloak-Semantik, Migrationen, Dependencies und Gates. Maximal
betroffen sind `packages/auth-runtime/src/auth-route-handlers.ts`, seine
direkten neuen internen Module und gezielten Tests, die bestehende Package-
und Bausteindokumentation, die `fileLines`-Eintragung
in `tooling/quality/complexity-policy.json`, dieser OpenSpec-Change und der
eigene Changelog-Eintrag. Ausgangs-HEAD ist `8608bdf376f469b9d5510bcba2fb18dafac9795b`;
die benannte Datei hat 1.614 Zeilen und muss höchstens 320 Zeilen haben.

**PR-Auftrag 12b:** Die Datei `redis-session.ts` unter das 320-Zeilen-Limit
bringen, indem Session-Speicherung, Login-State und Session-Kontrolle in
direkt genutzte interne Module aufgeteilt werden; der öffentliche
`redis-session.js`-Importvertrag, TTL, Schlüsselpräfixe, Tenant-Bindung,
Rotation, Audit und Fail-Closed bleiben erhalten. Der genehmigte Nachweis
eines atomaren Login-State-Verbrauchs erfordert, das bestehende Redis-`GET`
plus `DEL` durch `GETDEL` zu ersetzen und konkurrierende Aufrufe zu testen;
die projektierten Redis-7-Images und ioredis 5 unterstützen dieses Kommando.
Nicht-Ziele sind 12c/12d, Produktfeatures, weitere API-/DB-/Keycloak-Semantik,
neue Dependencies und Gates. Maximal betroffen sind `redis-session.ts`,
direkt benötigte interne Module und Tests, tatsächlich betroffene Package-
oder Architekturdokumentation, der erledigte `fileLines`-Policy-Eintrag,
dieser OpenSpec-Change und ein eigener Changelog-Eintrag. Ausgangs-HEAD ist
`43e504339cab1a85442cbc54ce89502fe0df2f95`; die benannte Datei hat
659 Zeilen. Die bisher an `runWithRequiredRedisSessionStore` übergebenen
In-Memory-Callbacks sind unerreichbar, weil der Wrapper ausschließlich
Redis ausführt; ihre Entfernung erhält das produktive Fail-Closed-Verhalten.

**PR-Auftrag 12c:** Die Datei `audit-db-sink.ts` unter das 320-Zeilen-Limit
bringen, indem Account-Kontext samt PII-Verschlüsselung und tenantgebundener
Event-Write in direkt genutzte interne Module wandern; die beiden bestehenden
Audit-Exporte, Scope-Prüfung, SQL-Reihenfolge, Transaktion und Fehlerabbildung
bleiben erhalten. Nicht-Ziele sind 12d, neue Funktionen, DB-Schema und
Migrationen, weitere Audit-Semantik, Dependencies und Gates. Maximal betroffen
sind `packages/auth-runtime/src/audit-db-sink.ts`, direkt benötigte interne
Module und Audit-Tests, tatsächlich betroffene Package- oder
Architekturdokumentation, der erledigte `fileLines`-Policy-Eintrag, dieser
OpenSpec-Change und ein eigener Changelog-Eintrag. Ausgangs-HEAD ist
`5badc734e20e572c92cd010fce51a42ae18193ec`; die benannte Datei hat
541 Zeilen. Kritisch bleiben verschlüsselte Account-Felder, die
`instance_id`-gebundene Account-Abfrage, `account_created` vor dem Login-Event,
`BEGIN`/Rolle/Tenant-Setting/`COMMIT` und `ROLLBACK` samt `reasonCode`.

**PR-Auftrag 12d:** Die Datei `iam-authorization/shared.ts` unter das
320-Zeilen-Limit bringen, indem Scope-/DB-Zugriff und HTTP-Autorisierungsantwort
in unmittelbar genutzte interne Module wandern; die bisherigen Exporte,
Importzeit-Metriken, Cache- und Listener-Singletons sowie Tenant- und
Permission-Semantik bleiben erhalten. Nicht-Ziele sind PR 13, neue Features,
Berechtigungs-, DB- oder Keycloak-Semantik, neue Dependencies und Gates.
Maximal betroffen sind `shared.ts`, seine direkten internen Module und Tests,
tatsächlich betroffene Package- oder Architekturdokumentation, der erledigte
`fileLines`-Policy-Eintrag, dieser OpenSpec-Change und ein eigener Changelog-
Eintrag. Ausgangs-HEAD ist `6f8d1559ab1c2bcdb6406ad06b9a4003ca64afa2`;
die benannte Datei hat 359 Zeilen. Separate Cyclomatic- und `publicExports`-
Befunde bleiben bestehen, solange ihre Schwellen nicht tatsächlich erfüllt
sind.

Vor PR 13 liegen neun `fileLines`-Befunde in sechs unterschiedlichen
Ausführungspfaden vor. Die Content-Persistenz (13a), Media-Verarbeitung/S3
(13b), Plugin-HTTP-Dispatch (13c), Operations-Runner (13d), Job-State-Write
(13e) und Tenant-Lifecycle-Orchestrierung (13f) können jeweils direkt auf
`main` und mit eigenen fachlichen Tests geliefert werden. Runner und
Job-State-Writer bleiben getrennt, weil Ausführungssteuerung und persistente
Zustandsübergänge verschiedene Invarianten tragen. Sechs serielle PRs
erlauben je einen eigenen Changelog- und exakten Gate-/Merge-Nachweis;
`tasks.md` benennt jeden Abschnitt einzeln.

**PR-Auftrag 13a:** `iam-contents/repository.ts` und
`iam-contents/repository-write-helpers.ts` unter das 320-Zeilen-Limit
bringen, indem die vorhandenen Lese-, Ownership-, Mutations-,
Author-Display-, SQL-Write- und Activity-Verantwortungen in unmittelbar
genutzte interne Module getrennt werden und beide Importverträge sowie
Tenant-, Transaktions-, History-, Validierungs- und Fehlersemantik erhalten
bleiben. Nicht-Ziele sind 13b–13f, Features, Schema/Migrationen, neue
Dependencies und Gates. Maximal betroffen sind die zwei benannten Dateien,
unmittelbar benötigte interne Module und Tests, tatsächlich betroffene
fachliche/arc42-Dokumentation, die beiden erledigten `fileLines`-Einträge
in `tooling/quality/complexity-policy.json`, dieser OpenSpec-Change und der
eigene Changelog-Eintrag. Ausgangs-HEAD ist
`09a3dfd636d9c33a9ad7681742ff6449311fb492`; die Dateien haben 674
und 458 Zeilen. Vor der Extraktion sind das vorhandene DB-Sollschema und die
direkten Verbraucher `external-content-*` und `core.ts` zu prüfen.

**PR-Auftrag 13b:** `iam-media/processing.ts` und `iam-media/storage-s3.ts`
unter das 320-Zeilen-Limit bringen, indem Bild-/Variant-Verarbeitung sowie
S3-Konfiguration, Listing, Delivery und Objektoperationen in unmittelbar
genutzte Module getrennt werden; die Importverträge `processing.js` und
`storage-s3.js` sowie alle Upload-, Claim-, Quota-, Cleanup-, Tenant- und
S3-Fehlersemantiken bleiben erhalten. Nicht-Ziele sind 13c–13f, Features,
API-/Storage-Semantikänderungen, neue Dependencies und Gates. Maximal betroffen
sind die zwei benannten Dateien, unmittelbar benötigte interne Module und
Tests/Consumer, tatsächlich betroffene Package-/arc42-Dokumentation, nur
tatsächlich erledigte Complexity-Findings, dieser OpenSpec-Change und ein
eigener Changelog-Eintrag. Ausgangs-HEAD ist
`0126ed38d631bdf6762baeea8a93123242dbeed4`; die Dateien haben 488 und
480 Zeilen. PR #1673 wurde mit HEAD
`5bcf0b0d999f7cabc7bd511941906ab092194a09` als Merge-Commit
`0126ed38d631bdf6762baeea8a93123242dbeed4` integriert.

**PR-Auftrag 13c:** `plugin-server-handlers/dispatcher.ts` unter das
320-Zeilen-Limit bringen, indem Routenabgleich und Coverage-Prüfung sowie
Tenant-Autorisierung in unmittelbar genutzte interne Module getrennt werden;
der bestehende `dispatcher.js`-Importvertrag, die Routenpriorität und alle
Auth-/CSRF-/Fehler- und Response-Verträge bleiben erhalten. Nicht-Ziele sind
13d–13f, Produktfeatures, Änderungen an API- oder Plugin-Berechtigungssemantik,
neue Dependencies und Gates. Maximal betroffen sind die benannte Datei,
unmittelbar benötigte interne Module und Tests/Consumer, tatsächlich betroffene
Package-/arc42-Dokumentation, nur wirklich erledigte Complexity-Findings,
dieser OpenSpec-Change und ein eigener Changelog-Eintrag. Ausgangs-HEAD ist
`59c90bcac7d05ed6f2b1e3d0d9750ac01511c709`; `dispatcher.ts` hat 457
Zeilen. Kritische Invarianten sind statische Routenpriorität, Methodenauswahl
und `Allow`-Sortierung, ungültiges URL-Decoding ohne Match, Domain-405-Format,
Coverage-Kollisionen, Service-Ausführung vor User-Auth, Plugin-Namespace,
Tenant-Bindung, Permission-/CSRF-Fail-Closed und Domain-spezifische
Autorisierungsfehler.

**PR-Auftrag 13d:** `plugin-operations/runner-registry.ts` und
`plugin-operations/runner-worker.ts` unter das 320-Zeilen-Limit bringen,
indem Registrierung/Task-Komposition und tenantgebundene Ausführung sowie
Worker-Start, Health, Fehler und Stop in unmittelbar genutzte interne Module
getrennt werden; Importverträge, Singleton-Zustand, Lease-/Attempt-Prüfungen,
Lifecycle-Transaktionsreihenfolge, Retry und Terminal-Callbacks bleiben
erhalten. Nicht-Ziele sind 13e–13f, Job-State-Writer, Features, DB-/Queue-
Semantik, neue Dependencies und Gates. Maximal betroffen sind die zwei
benannten Dateien, unmittelbar benötigte interne Module und Tests/Consumer,
betroffene Package-/arc42-Dokumentation, nur tatsächlich erledigte
Complexity-Findings, dieser OpenSpec-Change und ein eigener Changelog-Eintrag.
Ausgangs-HEAD ist `22b05ec30f3f5a737aa6cc2d6d0e30e61677881f`; die
Dateien haben 384 und 356 Zeilen. `loadedJob` bleibt pro Task-Aufruf
geschlossen; Lifecycle complete/fail geht innerhalb derselben Transaktion
dem terminalen Jobübergang voraus. Worker-Pools, Health und WeakSets bleiben
Singletons, alte Pool-Events werden durch Identitätsprüfung ignoriert und der
Terminal-Callback folgt dem Shutdown.

**PR-Auftrag 13e:** `plugin-operations/job-state-writer.ts` unter das
320-Zeilen-Limit bringen, indem der bestehende Writer-Vertrag die laufenden
Status-/Event-Schritte behält und terminale Zustände samt Persistenz in direkt
genutzte interne Module getrennt werden; Zustandswerte und Aufrufreihenfolge
bleiben erhalten. Nicht-Ziele sind 13f, Produktfeatures, DB-Schema- oder
Queue-Semantik, zusätzliche Validierung, Dependencies und Gates. Maximal
betroffen sind die benannte Datei, unmittelbar benötigte interne Module und
Tests/Consumer, tatsächlich betroffene Package-/arc42-Dokumentation, nur
tatsächlich erledigte Complexity-Findings, dieser OpenSpec-Change und ein
eigener Changelog-Eintrag. Ausgangs-HEAD ist
`d63abc92556e4539ba795b18bbb08fd95bcf0c1b`; die Datei hat 339 Zeilen.
Die Repository-Ports prüfen Tenant-, Job-, Attempt-, Worker- und Lease-Bindung;
der Writer reicht die bisherigen Werte durch. Running und Retry schreiben
State vor Event, während terminale Zustände den atomaren Port nutzen oder den
bisherigen parallelen Legacy-Fallback beibehalten. Fehlermeldung,
Plugin-Details, Cancellation-Metadaten und Fortschritt bleiben je Übergang
identisch.

**PR-Auftrag 13f:** `plugin-tenant-lifecycle/orchestrator.ts` unter das
320-Zeilen-Limit bringen, indem die gemeinsame Operation-Resolution und
Transition-Prüfung in ein unmittelbar genutztes internes Planmodul wandern;
die bestehenden `orchestrator.js`-Exporte und beide Ausführungspfade behalten
ihre Reihenfolge, Generation-/Tenant-Bindung, Retry-Ausnahme und Host-Fehlercodes.
Nicht-Ziele sind PR 14, Produktfeatures, DB-Schema- oder Queue-Semantik, neue
Dependencies und Gates. Maximal betroffen sind die benannte Datei, das
direkt benötigte Planmodul, eng zugehörige Tests/Consumer, tatsächlich
betroffene Package-/arc42-Dokumentation, der erledigte `fileLines`-Eintrag,
dieser OpenSpec-Change und ein eigener Changelog-Eintrag. Ausgangs-HEAD ist
`9c4de06b19dbe0f1aeb72d8f315d8fa34777754d`; `orchestrator.ts` hat 371
Zeilen. Kritisch sind die getrennten atomaren und gestuften Startpfade,
`requestLifecycle → createJob → claimLifecycle → queueJob`, die
best-effort-Bereinigung bei jeder Fehlerstufe und der ursprüngliche
Host-Fehlercode auch bei sekundären Persistenzfehlern.


Vor PR 14 ergeben die vier benannten Repository-Dateien getrennte
Ausführungsgrenzen. Sie folgen als 14a Medien, 14b Plugin-Operations, 14c
IAM-Statements und 14d Instanz-Integrationen seriell auf dem jeweils
aktuellen `main`. Jeder Abschnitt beseitigt seinen `fileLines`-Befund,
behält seinen öffentlichen Entrypoint und erhält einen eigenen Changelog.

**PR-Auftrag 14a:** `media/index.ts` (1.930 Zeilen) unter 260 Zeilen
bringen. Nicht-Ziele sind die drei übrigen Dateien von PR 14,
Produktverhalten, DB-Schema und neue Gates. Maximal betroffen sind das
Media-Repository-Modul, unmittelbar zugehörige Tests/Imports, die tatsächlich
erledigten Complexity-Registereinträge, dieser Change, Architektur-Doku und
der eigene Studio-Changelog. Die bestehenden öffentlichen Typen,
`createMediaRepository` und die Keys von `mediaStatements` bleiben erhalten;
interne Statements und Row-Mappings werden nach Asset, Upload, Storage und
Content-Save getrennt. SQL-Text und Parameterreihenfolge bleiben bytegleich,
insbesondere Tenant-Filter, atomare Claim-/Quota-Updates und
Content-Save-Recovery. Die bestehenden Medien-Tests und Data-, Security- und
Server-Runtime-Gates belegen diese Grenzen.

**PR-Auftrag 14b:** `plugin-operations/index.ts` (958 Zeilen) unter das
260-Zeilen-Limit bringen. Nicht-Ziele sind 14c/14d, Schema,
Produktverhalten, Queue-/Worker-Semantik, Dependencies und neue Gates.
Maximal betroffen sind das Plugin-Operations-Repository, direkt betroffene
Tests/Exports/Dokumentation, tatsächlich erledigte Complexity-Einträge,
dieser Change und der eigene Studio-Changelog. Die öffentliche
`createStudioJobRepository`-Fassade und Typ-Exporte bleiben bestehen;
Row-Mapping, Job-, Zustands-, Lease-/Attempt-, Event- und Listen-SQL
werden nach Persistenzverantwortung getrennt. SQL-Text und
Platzhalter-Reihenfolge bleiben gleich; Tenant-/Job-Bindung,
CAS-/Lease-Guards, idempotente Wiederholung und atomare Terminal-Event-
Reihenfolge werden durch Repository-/Worker-Tests sowie Data-, Security-
und Server-Runtime-Gates nachgewiesen.

**PR-Auftrag 14c:** `iam/repositories/statements.ts` (381 Zeilen) unter das
260-Zeilen-Limit bringen. Nicht-Ziele sind 14d, Schema/Migration,
IAM-Fachsemantik, neue Abstraktionen, Gates und Dependencies. Maximal betroffen
sind die IAM-Statement-Module, direkt zugehörige Tests und Dokumentation,
der erledigte `fileLines`-Policy-Eintrag, dieser Change und der eigene
Studio-Changelog. `iamSeedStatements` und der Importpfad `./statements.js`
bleiben bestehen; Statements werden nach Organisation, Zugriff und Account
geordnet. SQL-Text, Platzhalter, UUID-Array-Parameter, Tenant-Filter und
Rückgabewerte bleiben identisch. Die bestehenden IAM-Repository-Tests,
ein Vergleich aller Statement-Methoden mit `origin/main` und Data-, Security-
und Server-Runtime-Gates belegen die Grenze.

**PR-Auftrag 14d:** `integrations/instance-integrations.server.ts` (273
Zeilen) unter das 260-Zeilen-Limit bringen. Nicht-Ziele sind PR 15,
Schema, Features, externe Schnittstellen, Gates und Dependencies. Maximal
betroffen sind der Instanz-Integrations-Serverpfad, direkte Tests/Imports,
der erledigte `fileLines`-Eintrag, dieser Change, Architektur-Doku und der
eigene Studio-Changelog. DB-Transaktion, Pool und SQL-Executor werden vom
Cache-Loader getrennt. Der bestehende `external-interfaces.db.ts`-Pfad
besitzt andere Logger-Ereignisse und einen eigenen Pool; seine Übernahme
würde den aktuellen Laufzeitvertrag ändern. Die öffentlichen Server-Exporte,
Tenant-`set_config`, Transaktionsreihenfolge, Fehlerpriorität bei Rollback,
Pool-Reset sowie Cache-Schlüssel/Invalidierung bleiben erhalten.

Vor PR 15 ergeben die sieben verbliebenen Instanz-Registry-Dateien fünf
eigenständig prüfbare Grenzen. Auf `origin/main` nach #1682 liegen die
Repository-Dateien bei 463/389/451 Zeilen und die Service-Dateien bei
623/427/402/335 Zeilen. 15a bearbeitet den Repository-Vertrag und die
Parent-Provisionierung; 15b den Server-Einstieg; 15c den Keycloak-Zustand;
15d Evaluation und Plan; 15e die Tenant-Schritte. Jeder Abschnitt wird
seriell auf dem aktuellen `main` aufgebaut und erhält einen eigenen
Studio-Changelog.

**PR-Auftrag 15a:** `repository-contract.ts` und
`repository-provisioning.ts` unter das jeweilige Dateilimit bringen.
Nicht-Ziele sind `server.ts`, die vier Service-Dateien aus PR 15, Schema,
Produktverhalten, neue Dependencies und Gates. Maximal betroffen sind die
beiden Repository-Dateien, unmittelbar verwendete interne Segmente und Tests,
betroffene Architektur-Doku, tatsächlich erledigte `fileLines`-Einträge,
dieser Change und der eigene Changelog. Der bisherige
`InstanceRegistryRepository`-Importpfad und seine Signatur bleiben erhalten.
Der Vertrag trennt allgemeine Instanz-/Modul-/Leseoperationen von
Provisionierungs-/Mutationsoperationen. Die Planbestätigung und
Remediation werden im bestehenden Provisionierungsrepository fokussiert;
SQL-Text und Parameterreihenfolge bleiben identisch. Tenant-Bindung,
Run-Status, Idempotenz, Claim-/Lease-/Retry-Grenzen und Audit-Reihenfolge
werden mit gezielten Repository-Tests und Data-/Security-/Runtime-Gates
abgesichert.

**PR-Auftrag 15b:** `packages/data-repositories/src/instance-registry/server.ts`
unter das Dateilimit bringen; Nicht-Ziele sind 15c–15e, Schema und neue
Server-Verträge. Die vorhandenen Pool-, Host- und Fassaden-Verbraucher
bestimmen den Schnitt; öffentliche Exporte, URL-Auflösung,
Pool-/Client-Lifecycle, Host-Cache/Fallback, Repository-Aufrufe mit
Instance-ID-Filter und Fehlerweitergabe bleiben erhalten.

Der konkrete Schnitt hält `server.ts` als bisherigen öffentlichen Einstieg,
`server-client.ts` für URL-Auflösung, Pool und Client-Lifecycle sowie
`server-host.ts` für Host-Cache und Fallback. Beide internen Module werden
direkt vom Einstieg beziehungsweise Hostpfad genutzt. Der bisherige
`withClient`-Pfad öffnet keine Transaktion und setzt keinen Tenant-Kontext;
nur die bereits vorhandene Waste-Provisionierungsfassade nutzt
`BEGIN`/`set_config`/`COMMIT` mit `ROLLBACK` im Fehlerfall. Der eigene
`publicExports`-Policy-Befund für diese Fassade bleibt als separater Backlog
stehen.

**PR-Auftrag 15c:** `packages/instance-registry/src/provisioning-auth-state.ts`
unter das Dateilimit bringen; Nicht-Ziele sind Evaluation, Plan und
Tenant-Schritte. Der bestehende Subpath und die Root-Exporte bleiben eine
Fassade. Interne, direkt genutzte Module trennen Client-Vertrag und Factory,
Tenant-Admin-Bootstrap, Realm-Readback sowie Artifact-Reconcile. Diese
konkreten Verantwortungen sprengen das Dateilimit; die Fassade allein kann
keine von ihnen aufnehmen, ohne erneut zu wachsen. Realm-Bindung, Ownership,
Secret-Readback, Client-Reihenfolge, Idempotenz und Cleanup-/Fehlerpriorität
bleiben an den bestehenden Provisionierungs-Verbrauchern nachweisbar. Plan-,
Run- und Retry-Zustände liegen in anderen Modulen und gehören zu späteren
Abschnitten.

**PR-Auftrag 15d:** `provisioning-auth-evaluation.ts` und
`provisioning-auth-plan.ts` unter das Dateilimit bringen; Nicht-Ziele sind
15e und neue Auth-Verträge. Preflight, Ownership, Fingerprint und Gate-Status
bleiben in der bisherigen Reihenfolge und Fehlerklassifikation erhalten.
Die bestehende Evaluation-Importfläche bleibt eine Fassade. Direkt genutzte
Module halten Preflight-Checks, die geordnete Realm-Ownership-Diagnose und den
Live-Status getrennt; `buildPlan` und der Fingerprint bleiben im Plan-Modul,
die einzelnen Artefakt-Schritte liegen in einem internen Modul. Die beiden
Ausgangsdateien überschreiten mit 427 und 402 Zeilen die geltende Grenze;
ihre vorhandenen Fassaden können die getrennten Verantwortungen nicht
aufnehmen, ohne erneut zu wachsen.

**PR-Auftrag 15e:** `tenant-provisioning-steps.ts` unter das Dateilimit
bringen; Nicht-Ziele sind die übrigen PR-15-Dateien, Schema und Features.
Schrittfolge, idempotente Wiederaufnahme, Lease, Retry, Terminalstatus und
Audit-Ereignisse bleiben durch Orchestrator-Tests belegt.
Die sichere Fehlercode-Diagnostik und der geschützte Property-Zugriff werden
im bereits von den Tenant-Schritten genutzten `observability.ts` gebündelt;
damit bleibt die bestehende Step-Map an einem Ort und es entsteht kein neuer
Ausführungspfad. Ausgangs-HEAD ist `85cf9cded0b1b6334142e0beadc77eff438dff3e`;
`tenant-provisioning-steps.ts` sinkt von 335 auf 315 Zeilen und
`observability.ts` wächst von 264 auf 271 Zeilen. Der direkte Verbraucher ist
`runTenantProvisioningStep`; die bestehenden Observability- und Orchestrator-
Tests decken Fehlercode-Redaction, Step-Fortschritt und Lease-Verlust ab.

Für 10a bleibt `organization-query.ts` der bestehende Importvertrag für
`iam-admin`-Index, Read-Handler und Tests. Interne Module trennen
Projektion/Filter von tenantgebundenen Lesequeries und Hierarchieoperationen;
die bisherigen Exporte und SQL-Parameter bleiben identisch. Kritische
Invarianten sind `instance_id` auf allen Organisations- und
Mitgliedschaftsqueries, verschlüsselte Account-Felder nur über `revealField`,
escapte ILIKE-Suche, stabile Sort-/Seitenreihenfolge sowie Zyklus- und
Inaktivitätsfehler vor dem rekursiven Subtree-Update. Die vorhandenen
Query-/Read-Handler-Tests und Package-/Runtime-Gates belegen diese Grenzen.

**PR-Auftrag 16a:** Auf `origin/main` nach #1689 hat
`packages/instance-registry/src/service-keycloak-execution.ts` 715 Zeilen;
der aktuelle `fileLines`-Befund und zwei bereits registrierte Complexity-
Befunde betreffen diese Datei. Ziel ist eine kleinere Execution-Datei mit
unveränderten öffentlichen Exporten. Nicht-Ziele sind die fünf weiteren
PR-16-Dateien sowie API-, Keycloak- und Datenbankverhalten. Der direkte
Verbraucher bleibt `service-keycloak.ts` und der öffentliche Package-Index.
Die bereits vorhandenen Shared-, Failure-, Payload-, Finalize- und Worker-
Claim-Module werden weiterverwendet; sie können die noch in der 715-Zeilen-
Datei zusammenliegenden Snapshot-, Post-Provisioning- und Worker-Phasen nicht
ohne erneutes Dateiwachstum aufnehmen. Kleine interne Module besitzen jeweils
eine dieser Phasen, während die bisherigen Handler am Importpfad bleiben.
Der Worker bindet Run, Tenant und Fingerprint an den geladenen Snapshot;
Secret-Sync, Parent-Abschluss und Realm-Cleanup behalten ihre Reihenfolge und
Fehlerklassen. Execution-, Failure-, Payload-, Finalize- und Reconcile-Tests
sowie Auth-/Data-/Security-/Runtime-Gates weisen diese Grenzen nach.

PR 16 wird seriell und einzeln reviewbar in 16a Execution, 16b Readers,
16c Audit Keycloak, 16d Module Mutations und 16e Draft Readiness plus
Service Helpers umgesetzt. Jeder Abschnitt beseitigt seine benannten
Dateilängenbefunde und enthält einen eigenen Studio-Changelog-Eintrag.

**PR-Auftrag 16e:** Nach #1693 überschreiten `service-draft-readiness.ts`
(482 Zeilen) und `service-helpers.ts` (347 Zeilen) das Dateilimit. Ziel ist
die Trennung der Entwurfs-Readiness von ihren Projektionen und der
Tenant-IAM-Evidenz von allgemeinen Service-Projektionen bei unveränderten
Exportpfaden. Nicht-Ziele sind neue Readiness-Funktionen, Vertrags- oder
Datenmodelländerungen und andere Services. Aktivierungsprüfungen gehören in
das bestehende `service-active-provisioning.ts`, die Tenant-IAM-Projektion
in `tenant-iam-evidence.ts`. Die Entwurfs-Fingerprints, Capability-Anzeigen
und Provisioning-Eingabe benötigen ein direkt genutztes kleines
`service-draft-readiness-projection.ts`, weil keines der bestehenden Module
diese Entwurfsprojektionen aufnimmt, ohne wieder über das Dateilimit zu
wachsen. Die Realm-Eignung bleibt direkt am Readiness-Handler. Status,
Validierung, Tenantbezug, Fehlerklassen und Projektionen
bleiben erhalten; Readiness- und Service-Tests sowie Auth-/Data-/Security-/
Runtime-Gates prüfen die Parität.

**PR-Auftrag 16d:** Nach #1692 hat `service-module-mutations.ts` 516 Zeilen
und einen registrierten `fileLines`-Befund. Ziel ist die Trennung des
Bootstrap-/IAM-Baseline-Syncs von Zuweisung und Entzug bei unverändertem
öffentlichen Service-Importpfad. Das direkt genutzte interne
`service-module-mutations-sync.ts` hält die Core-IAM-Synchronisierung,
Reconcile-Zusammenführung, Bootstrap-Zuweisungen samt Rollback und das
Baseline-Seeding. Zuweisung und Entzug bleiben im bisherigen Modul;
Statuscodes, Modulreihenfolge, Idempotenz, Aktivierungsschutz, Audit-Details,
Cache-Invalidierung und Waste-Provisioning bleiben unverändert. Nicht-Ziele
sind neue Modul-Funktionen, Auth-Verträge und andere Services. Gezielte
Service-Tests sowie Auth-/Data-/Security-/Runtime-Gates prüfen die Parität.

**PR-Auftrag 16b:** Nach #1690 hat `service-keycloak-readers.ts` 432 Zeilen
und einen registrierten `fileLines`-Befund. Der bestehende Service-Importpfad
bleibt für Status, Preflight, Plan, Run-Read und Runtime-Resolver erhalten.
Preflight und Plan erhalten je ein direkt genutztes internes Modul; die von
Status, Preflight und Plan gemeinsam verwendete rungebundene
Snapshot-Fingerprint-Berechnung liegt beim vorhandenen Snapshot-Reader.
Tenant-/Instance-Bindung, Policy-/Secret-Versionen, Plugin-OIDC-Snapshot,
lokale Fallbacks, `forceLive`, New-Realm-Anpassung und Host-Klassifikation
bleiben unverändert. Nicht-Ziele sind 16c–16e, neue Keycloak-Semantik, Schema,
Gates oder Dependencies. Service- und Snapshot-Tests sowie Auth-/Data-/
Security-/Runtime-Gates weisen die Verhaltensparität nach.

**PR-Auftrag 16c:** Nach #1691 hat `service-audit-keycloak.ts` 511 Zeilen
und einen registrierten `fileLines`-Befund. Ziel ist ein kleinerer
Keycloak-Audit-Pfad bei unveränderten öffentlichen Exporten, Check-IDs,
Statuswerten, Reihenfolgen und Fehlercodes. Nicht-Ziele sind neue
Auditfunktionen, Auth-Vertragsänderungen und andere Module. Der bestehende
Reader bleibt unter `service-audit-keycloak.ts`; das bislang nur separat
getestete `service-audit-keycloak-checks.ts` wird zur produktiven Quelle der
Check-Ableitung. Die Checks für nicht live lesbare Realms benötigen wegen
des Dateilimits ein eigenes internes Modul. Seine direkten Verbraucher sind
die Check-Ableitung und damit `service-audit.ts`. Live-Fehler dürfen keine
PII aus Exceptions in Logs oder Audit-Details übertragen; ein Snapshot ist
nur sekundärer Befund und ersetzt keinen erfolgreichen Live-Read. Gezielte
Audit-Tests sowie Auth-/Data-/Security-/Runtime-Gates prüfen diese Grenzen.

### PR 17: Events-Editor

Ausgangsstand nach PR 16e: `events.detail-page.tsx` 1.183 Zeilen,
`plugin.translations.ts` 800 Zeilen und `events.detail-form.ts` 307 Zeilen
bei einem Limit von 260. Die bestehende `EventsDetailPage` bleibt der
Einstiegspunkt. Paketinterne Module übernehmen Laden und Rechte, Medienauswahl,
Validierung und Speichern sowie die Tab-Darstellung. Der Formular-Mapper
behält seine bisherigen Imports und trennt Typen und Defaultwerte; die
Übersetzungen werden je Sprache in Feld-/Aktions- und Editor-/Meldungsgruppen
zusammengesetzt. Die ersetzten Blöcke entfallen in den Ausgangsdateien.

Kritische Invarianten: Die geschützten Feldpfade und Fokusziele bleiben
identisch; Mainserver-Deviations werden nur nach Bestätigung überschrieben;
die Medienreferenz-Speichersequenz, Create-Navigation und Delete-Rückmeldung
bleiben erhalten. Die bestehenden Events-Detail-, Formular- und Plugin-Tests
sowie Type-, Lint-, Build- und Complexity-Gates belegen den Schnitt. Nur die
drei behobenen `fileLines`-Einträge werden aus der Policy entfernt.

### PR 18: News-Editor

Ausgangsstand nach PR 17: `news.detail-page.tsx` 1.347 Zeilen,
`plugin.translations.ts` 961 Zeilen und `news.detail-form.ts` 910 Zeilen.
`NewsDetailPage` bleibt der öffentliche Einstiegspunkt. Die Seite delegiert
Zugriff, Optionen, Laden, Medienauswahl, Speichern/Löschen und Darstellung an
direkt genutzte paketinterne Module. Der bestehende Formularimport bleibt für
API und Tests erhalten; Schema, Legacy-Aliasse, Snapshot-Synchronisierung,
Mutation und Dirty-Tab-Ableitung besitzen jeweils eine zuständige Quelle.
Die Übersetzungen werden pro Sprache in Feld-/Navigations- und
Editor-/Meldungsgruppen zusammengesetzt. Ersetzte Implementierungen entfallen
aus den Ausgangsdateien.

Kritische Invarianten: Der bestehende Feld- und Übersetzungsschlüsselvertrag,
Datums- und Medienvalidierung, Legacy-Fallbacks, Berechtigungen,
Waste-Targeting und globale Push-Bestätigung bleiben erhalten. Bei Save bleibt
die Reihenfolge aus Content-Persistierung, Medienreferenz-Synchronisierung,
Create-Navigation beziehungsweise Edit-Reset samt Retry-Rückmeldung erhalten.
Die News-Detail-, Formular-, Editor-Modell- und Übersetzungstests sowie Type-,
Lint-, Build- und Complexity-Gates prüfen diesen Schnitt. Nur die drei
behobenen `fileLines`-Einträge werden aus der Policy entfernt.

### PR 19: Generic-Items-Editor

Ausgangsstand nach PR 18: `generic-items.detail-content-tab.tsx` 1.336 Zeilen
und `generic-items.detail-page.tsx` 764 Zeilen. Der Content-Tab bleibt der
öffentliche Einstieg für Text, Kontakte/Orte, Medien/Links, Zusatzangaben und
Termine. Direkt genutzte, paketinterne Sektionen binden dieselben
`react-hook-form`-Feldpfade und Feldarray-IDs. Die Detailseite hält Laden,
Zugriff und Navigation zusammen; Medienauswahl, Referenzabgleich,
Speichervorgang und Darstellung liegen in direkt verwendeten Modulen. Die
öffentlichen Exporte der beiden Ausgangsdateien bleiben erhalten.

Kritische Invarianten: Content-Ownership, Berechtigungen und
Sichtbarkeitswechsel, Feldvalidierung, Geocoding, öffentliche persistierbare
Medien-URLs, Reihenfolge der Medienreferenzen, Draft-Auflösung sowie
Save-/Retry-Rückmeldung bleiben unverändert. Die Generic-Items-Content-,
Detailseiten-, Medienadapter- und Formular-Tests sowie Type-, Lint-, Build-
und Complexity-Gates prüfen den Schnitt. Die fünf erledigten
`trackedFindings` der beiden Ausgangsdateien entfallen aus der Policy;
die lange Controller-Funktion der Detailseite bleibt als gesonderter
Bestandsbefund registriert.

### PR 20: POI-Editor

Ausgangsstand nach PR 19: `poi.detail-page.tsx` 1.092 Zeilen. Der öffentliche
Einstieg bleibt `PoiDetailPage`; er hält Formularzustand, Zugriff und die
Verbindung der direkt genutzten POI-Module. Laden und Principal-Wechsel,
Medienauswahl, Validierung und Speichern, Löschen sowie die bestehenden
POI-Tabs besitzen jeweils eine zuständige Implementierung. Die ersetzten
Blöcke entfallen aus der Ausgangsdatei; weder ein öffentlicher Export noch ein
API-, Daten- oder Berechtigungsvertrag ändert sich.

Kritische Invarianten: Die Reihenfolge von Formularvalidierung, Fokus und
Tabwechsel, der eingeschränkte Sichtbarkeitswechsel, Principal-abhängiger
Zugriff, Medienentwürfe und Referenzabgleich samt Retry, Geocoding und
Create-/Edit-/Delete-Navigation bleiben erhalten. Gezielte POI-Detail-,
Formular-, Medien- und Geocoding-Tests sowie Type-, Lint-, Build- und
Complexity-Gates prüfen den Schnitt. Das erledigte `fileLines`-Finding und
das ebenfalls behobene Cyclomatic-Finding entfallen; das bestehende
`functionLines`-Finding der Einstiegsfunktion bleibt separat registriert.

### PR 21: Projects-Seite

Ausgangsstand nach PR 20: `projects.pages.tsx` 1.109 Zeilen. Der öffentliche
Einstieg für Liste, Anlegen und Bearbeiten bleibt erhalten. Die Liste sowie
Editor-Tabs, Bildfeld, Medienauswahl, Laden, Speichern und Darstellung werden
von den drei Seiten direkt genutzt. Die ersetzten Blöcke entfallen aus der
Ausgangsdatei; API-, Daten- und Berechtigungsverträge bleiben bestehen.

Kritische Invarianten: Listenstatus und Pagination, Principal-abhängiger
Zugriff, Create-/Edit-/Delete-Navigation, Formularvalidierung und Tabwechsel,
öffentliche Medien-URLs, Referenzreihenfolge und Retry-Rückmeldung bleiben
unverändert. Projects-Seitentests und Ownership-Konformitätstest sowie Type-,
Lint-, Build- und Complexity-Gates prüfen den Schnitt. Die erledigten
`fileLines`-, `functionLines`- und Cyclomatic-Findings der Ausgangsdatei
entfallen aus der Policy; es entstehen keine neuen Findings.

### PR 22: Cockpit-Cards-Seite

Ausgangsstand nach PR 21: `cockpit-cards.pages.tsx` 1.183 Zeilen.
Die bestehenden öffentlichen Seiten-Exporte bleiben erhalten. Listenansicht,
Editor-Felder, Medienauswahl, Laden, Speichern und die Ansicht werden von den
Seiten direkt genutzt; die ersetzten Blöcke entfallen aus der Ausgangsdatei.
Die zugehörigen `fileLines`-, `functionLines`- und Cyclomatic-Findings dieser
Datei werden nach dem Schnitt aus der Complexity-Policy entfernt.

Kritische Invarianten: Sichtbarkeit und Lebenszyklusberechtigung, Listen- und
Medienreihenfolge, Laden/Speichern/Löschen, Referenz-Retry, öffentliche
Medien-URLs, Principal und Ownership sowie Fehlerrückmeldungen bleiben
unverändert. Cockpit-Cards-Seitentests, Ownership-Konformitätstest und Type-,
Lint-, Build- und Complexity-Gates prüfen den Schnitt. Ein eigener Studio-
Changelog-Eintrag dokumentiert den Abschnitt.

### PR 27: Mainserver-Content-Routen

Die fünf bestehenden Routeneinstiege bleiben die einzigen Dispatcher. Ihre
internen Eingabe-, Zugriffs-, Lese- und Mutationsschritte liegen in privaten
Modulen desselben Mainserver-Pakets. News behält insbesondere die Reihenfolge
von Berechtigungs- und CSRF-Prüfung, Idempotenzreservierung,
Provider-Schreibzugriff, Audit und Idempotenzabschluss. Events behält den bestehenden
Mutationsworkflow samt Teilerfolg bei Sichtbarkeitsfehlern. Generic Items
behält FAQ- und Kachel-Sonderfälle sowie Autoren- und Identitätserhalt. POI
und Projects behalten die lokalen Berechtigungen, DataProvider-Bindung und
Antwortformate. Die Route-Tests für News, Events/POI, Generic Items,
Cockpit-Cards und Projects prüfen diese Verträge vor und nach dem Schnitt;
Type-, Lint-, Server-Runtime- und vollständiges Complexity-Gate prüfen die
Paketgrenze und die fünf beseitigten `fileLines`-Befunde.

### PR 28: Mainserver-Service und interne Typen

`service.ts` behält die öffentliche API und delegiert die bestehende
Komposition an private Module für Verbindung, Diagnostik, Kategorien,
Content-Operationen sowie Surveys und Waste. `types.ts` erhält die bisherigen
öffentlichen Namen und trennt die Typen nach Domäne. Der Interface-Vertrag
trennt Lese- und Speicherpfad samt gemeinsamer Validierung;
`mappers-shared.ts` behält seine bisherigen Exporte und verteilt Schemas und
Mapper auf interne Module. Relative Runtime-Imports verwenden `.js`.
Service-, Interface- und Mapping-Tests prüfen die bestehenden Rückgaben,
Fehler und Reihenfolgen; Type-, Lint-, Server-Runtime- und Complexity-Gates
prüfen die Paketgrenze und die vier `fileLines`-Befunde.

### PR 29: Öffentliche Waste-Daten und Reminder

Die sechs bestehenden Importpfade bleiben Einstiegspunkte. Private Module
derselben App enthalten Demo-Daten und Feiertagsregeln, Repository-Mapping
und Reminder-Abfragen, PDF-/iCal-/Reminder-Antworten sowie Signup-,
Seiten- und Runtime-Schritte. Der Schnitt folgt den bestehenden
Verantwortungen; er ändert weder öffentliche Typen noch API- oder
Datenbankverträge. Repository- und Runtime-Tests prüfen Mandantenfilter,
Terminberechnung, Antwortformate, Transaktionsreihenfolge mit Advisory Lock
und Subscription-Limit sowie die Fehlerfälle. Type-, Unit-, Lint-, Build-,
Server-Runtime- und Complexity-Gates prüfen die sechs `fileLines`-Befunde
und die importierbaren Serverpfade.

### PR 30: Öffentliche Waste-Oberfläche

Die Index-Route behält ihre öffentlichen Exporte und den React-Seitenzustand;
private Module derselben App lösen Regionsbindung, gespeicherte Auswahl und
Auswahlschritte auf. Die Kalender-Panels behalten Tab-Zustand,
Tastatursteuerung und Jahresmeldung; private Presentational-Module zeichnen
Liste, Monats- und Jahresraster aus den bisherigen Datums- und Zellregeln.
Bestehende Route- und Panel-Tests prüfen Fail-Closed bei URL-Regionen,
Cookie-Restore und Reset, Tab-Fokus, Monats-/Jahresnavigation,
Terminaktivierung und HTML-Sanitization. Type-, Unit-, A11y-, Lint-,
Build- und Complexity-Gates prüfen die beiden `fileLines`-Befunde und die
unveränderte öffentliche Oberfläche.

## Lieferreihenfolge

1. **Pilot:** Je ein begrenzter Schnitt in `packages/server-runtime` und
   `packages/studio-ui-react`. Vorhandene Tests und Metriken dienen als
   Referenz. Nach beiden Reviews wird geprüft, ob der Zuschnitt verständlich
   und die Prüfzeit angemessen war.
2. **Grundlagen:** `plugin-sdk`, `core` und `routing` nur entlang bestehender
   Konsumenten/Verträge bearbeiten. Wenn ein konkreter Vertrag mit einem
   späteren Bereich gekoppelt ist, werden beide im selben fachlichen PR
   behandelt oder die Grundlage zuerst abgeschlossen.
3. **Produktbereiche:** PR 05 bis PR 22 einschließlich 06a bis 06d2, 07a
   bis 07f, 08a bis 08d, 09a bis 09d, 10a bis 10f, 11a bis 11f, 12a bis
   12d und 13a bis 13f wurden seriell geliefert. Ab PR 23 laufen höchstens
   zwei getrennte Worktrees parallel: Strang A bearbeitet PR 23, PR 24a,
   PR 24b, PR 25a, PR 25b, PR 26a bis PR 26d und danach PR 31a bis PR 31d
   sowie PR 32 bis PR 34;
   Strang B bearbeitet PR 27 bis PR 30. PR 29
   wartet auf den Merge von PR 26d. PR 24 wurde nach der ersten
   Complexity-Prüfung in zwei fachliche Abschnitte getrennt: PR 24a umfasst
   Import-Wizard, Job-Aktionen und Tourenlogik; PR 24b umfasst die drei
   großen UI-Ansichten für Orte, Zuordnungen und individuelle Termine.
   Die zunächst gemeinsame Extraktion hätte 21 private Module und zwölf
   neue Complexity-Findings in einem PR erzeugt. PR 25 ist an der
   Package-Grenze geteilt: PR 25a bearbeitet vier Vertragsfunktionen für
   öffentliche Settings, CSV-Import und PDF-Ausgabe; PR 25b bearbeitet
   vier Runtime-Dateien für HTTP-Validierung und Settings-Handler.
   Die acht ursprünglichen Ziele umfassen 3.737 Zeilen und haben getrennte
   Typ-, Unit- und Runtime-Targets. PR 26 ist nach sieben Ziel-Dateien
   mit zusammen 4.612 Zeilen in vier eigenständig prüfbare Grenzen geteilt:
   26a Server-Lader, 26b Reminder-Repository, 26c Handler-Komposition und
   Lesen sowie 26d Operations- und Mutationspfade. PR 29 prüft die erst
   nach 26d vollständig integrierte Waste-Runtime. Die fünf CI-Gate-Dateien
   mit zusammen 4.259 Zeilen bilden getrennte CLI-Verträge. PR 31 wird daher
   seriell in 31a Complexity-Gate, 31b Coverage-Gate, 31c dessen zwei
   Patch-/New-Code-Verbraucher und 31d Sonar-Hotspots geteilt. Jeder Abschnitt
   erhält eigene Skript-Tests und behält Exitcodes und Berichtformat bei;
   PR 31b beginnt erst nach dem Merge von 31a, die folgenden entsprechend.
   Innerhalb jedes Strangs
   ist der vorherige Merge
   Voraussetzung für den nächsten Abschnitt. Vor jedem Merge wird der Branch
   gegen das aktuelle `origin/main` synchronisiert und sein neuer exakter
   HEAD vollständig geprüft. Nur ein PR wird zur selben Zeit gemergt.
4. **Schlusslauf:** Nach allen PRs 23 bis 34 wird der vollständige Scope erneut gemessen.
   Ein Restbefund wird als konkret benannter weiterer PR-Task ergänzt und
   abgearbeitet, bevor der Change abgeschlossen wird.

## Regeln für jeden PR-Abschnitt

- Vor Codeänderungen das PR-Ziel in einem Satz, Nicht-Ziele, maximal betroffene
  Bereiche und den Satz der aktuell zu beseitigenden `fileLines`-Findings
  festhalten. Ausgangs-HEAD, Ist-/Soll-Zeilen und betroffene Tests notieren.
- Nur eine zusammenhängende Verantwortung pro PR. Mehrere Dateien und auch
  zwei eng gekoppelte Packages sind zulässig, wenn sie gemeinsam denselben
  Vertrag bilden. Unabhängige Bereiche werden nicht zur PR-Reduktion gebündelt.
- Vor einer Extraktion bestehende Modulgrenzen, Exporte, Plattformmittel und
  Tests prüfen. Tote oder doppelte Logik entfernen. Neue Module besitzen eine
  fachliche Aufgabe; reine Weiterleitungsdateien, zusätzliche öffentliche
  Fassaden und parallele Pfade sind kein Zielbild.
- Den ersetzten Code im selben PR löschen. Keine Änderung an Verhalten,
  Autorisierung, Validierung, Datenformaten, i18n oder Accessibility als
  „Refactor“ tarnen. Solche Änderungen gesondert planen und prüfen.
- Der PR beseitigt seine benannten `fileLines`-Befunde vollständig, ohne neue
  `fileLines`-, Funktions-, Cyclomatic- oder Export-Findings zu erzeugen. Ist
  das im gesetzten Scope nicht korrekt möglich, den Schnitt vor dem Push neu
  zuschneiden statt Limits oder Baseline zu lockern.
- Gezielte Characterization-Tests vor riskanten Verschiebungen; nach jedem
  Codeblock das kleinste echte Unit-/Type-Gate. Bei serverseitigen Änderungen
  die bestehenden Runtime-Pflichtprüfungen und bei Auth/Security/Datenpfaden
  die Spezial-Gates aus `DEVELOPMENT_RULES.md` Abschnitt 5.2 ausführen.
- Vor breiten lokalen Unit-Läufen den Nx-affected-Scope messen. CI prüft den
  finalen PR-HEAD; lokale Wiederholungen bleiben auf den geänderten Pfad
  begrenzt. `pnpm complexity-gate --base <base-sha>` dient dem PR-Signal,
  der vollständige Lauf dem Portfolio-Fortschritt.
- Nach nachgewiesener Behebung nur die betreffenden `fileLines`-Findings aus
  `trackedFindings` entfernen. Weitere Metriken derselben Datei bleiben
  registriert, solange sie aktuell überschritten sind. Keine
  `--update-baseline`-Ausführung als Teil dieses Programms.

## Abhängigkeiten und bestehende Changes

Vor jedem Liefer-PR `openspec list`, offene PRs und den aktuellen Code prüfen.
Insbesondere `refactor-sva-studio-react-package-boundaries`,
`refactor-cross-cutting-runtime-guardrails`,
`refactor-ci-gate-orchestration`, `refactor-waste-plugin-ownership` und
`refactor-events-detail-content-tab` berühren mögliche Zielbereiche. Ein
bereits laufender, fachlich passender Refactor darf ein Finding erfüllen;
dieses Portfolio eröffnet dafür keinen konkurrierenden Pfad. Der Status
„Complete“ im OpenSpec-Ordner ist ohne Merge-/HEAD-Prüfung kein Beleg.

## Risiken und Nachweis

- **Verhaltensdrift bei großen Dateien:** Bestehende Ein-/Ausgabe-, Fehler-
  und Berechtigungsfälle vor der Verschiebung charakterisieren; Review anhand
  des entfernten alten Pfads und gezielter Tests.
- **Verschobene statt beseitigte Komplexität:** Vorher-/Nachher-Metriken für
  alle betroffenen produktiven Dateien und alle vier Gate-Metriken vergleichen;
  keine neue Überschreitung akzeptieren.
- **Lange Integrationszeit:** PRs direkt auf aktuellem `main`, kein
  monatelanger Sammelbranch; den nächsten Schnitt nach jedem Merge neu messen.
- **Überlappende Arbeit:** Aktive Changes und PRs vor Beginn abgleichen.
  Überschneidungen zusammenführen oder zeitlich ordnen, nicht parallel
  dieselbe Datei refaktorieren.
- **Systemgrenzen in IAM/Waste/Mainserver:** Trust Boundaries, Failure Modes
  und kritische Invarianten je betroffenem Liefer-PR konkret festhalten. Bei
  neuer Architekturwirkung arc42 aktualisieren; keine schematische
  Gesamtdokumentation ohne konkrete Änderung.
