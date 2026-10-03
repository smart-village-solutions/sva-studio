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

Für 10a bleibt `organization-query.ts` der bestehende Importvertrag für
`iam-admin`-Index, Read-Handler und Tests. Interne Module trennen
Projektion/Filter von tenantgebundenen Lesequeries und Hierarchieoperationen;
die bisherigen Exporte und SQL-Parameter bleiben identisch. Kritische
Invarianten sind `instance_id` auf allen Organisations- und
Mitgliedschaftsqueries, verschlüsselte Account-Felder nur über `revealField`,
escapte ILIKE-Suche, stabile Sort-/Seitenreihenfolge sowie Zyklus- und
Inaktivitätsfehler vor dem rekursiven Subtree-Update. Die vorhandenen
Query-/Read-Handler-Tests und Package-/Runtime-Gates belegen diese Grenzen.

## Lieferreihenfolge

1. **Pilot:** Je ein begrenzter Schnitt in `packages/server-runtime` und
   `packages/studio-ui-react`. Vorhandene Tests und Metriken dienen als
   Referenz. Nach beiden Reviews wird geprüft, ob der Zuschnitt verständlich
   und die Prüfzeit angemessen war.
2. **Grundlagen:** `plugin-sdk`, `core` und `routing` nur entlang bestehender
   Konsumenten/Verträge bearbeiten. Wenn ein konkreter Vertrag mit einem
   späteren Bereich gekoppelt ist, werden beide im selben fachlichen PR
   behandelt oder die Grundlage zuerst abgeschlossen.
3. **Produktbereiche:** PR 05 bis PR 34 einschließlich 06a bis 06d2, 07a
   bis 07f, 08a bis 08d, 09a bis 09d, 10a bis 10f, 11a bis 11f und 12a bis
   12d und 13a bis 13f werden genau
   in der Reihenfolge von `tasks.md` bearbeitet. Ein Task wird erst nach Merge- und Gate-Nachweis
   abgeschlossen, bevor die nächste Nummer beginnt.
4. **Schlusslauf:** Nach PR 34 wird der vollständige Scope erneut gemessen.
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
