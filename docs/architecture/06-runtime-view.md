# 06 Laufzeitsicht

## Zweck

Dieser Abschnitt beschreibt kritische Laufzeitszenarien und Interaktionen.

## Mindestinhalte

- Mindestens 3 kritische End-to-End-Szenarien
- Sequenz der beteiligten Bausteine pro Szenario
- Fehler- und Ausnahmeverhalten für kritische Flows

## Aktueller Stand

### Medien-Upload und Referenzierung

1. Host-UI unter `/admin/media` initialisiert einen Upload.
2. `@sva/auth-runtime` prüft Instanzkontext, IAM-Rechte und Speicherkontingent.
3. Der interne Storage-Port erzeugt eine signierte Upload-Möglichkeit gegen den S3-/MinIO-kompatiblen Objektspeicher.
4. Nach Upload-Abschluss validiert der Host den Inhalt, extrahiert Metadaten und erzeugt häufige Varianten synchron.
5. Asset-, Varianten-, Session- und Usage-Daten werden über `@sva/data-repositories` persistiert.
6. Fachmodule wie News, Events und POI speichern nur hostseitige Medienreferenzen und keine Storage-Artefakte.

### Generischer Studio-Jobstart und Statusabruf

1. Ein Host- oder Fachclient ruft `POST /api/v1/plugin-operations/jobs` mit Plugin-ID, Jobtyp, optionalem Importprofil und fachlichem Input auf.
2. `@sva/auth-runtime` prüft Session, Instanzkontext, Idempotency-Key und den generischen Request-Vertrag.
3. Der Host legt über `@sva/data-repositories` einen führenden Studio-Jobdatensatz mit `source = 'plugin'` sowie das technische Initialevent `job.queued` im Studio-Postgres an.
4. Die interne Worker-Anbindung queued den generischen Task `studio_job_execute` runner-agnostisch und baut für den fachlichen Handler einen Host-Context mit `job`, `progressReporter`, `abortSignal`, `logger` und Request-/Actor-Bezug.
5. Laufende Worker-Schritte schreiben Progress, Heartbeat und technische Lifecycle-Events gegen denselben zentralen Host-Store zurück.
6. Falls ein Fachhandler strukturierte Fortschrittsdetails wie `processedRows` und `totalRows` kennt, meldet er diese über denselben generischen Progress-Vertrag und nicht über einen separaten Plugin-Endpunkt.
7. Der Client liest Status, Progress, Heartbeat und Verlauf über `GET /api/v1/plugin-operations/jobs/:jobId`.
8. Eine Abbruchanforderung wird über `POST /api/v1/plugin-operations/jobs/:jobId/cancel` zunächst nur als gespeicherter Cancel-Request modelliert; die kooperative Reaktion bleibt Worker-Verantwortung.
9. Status, Progress, Verlauf, Ergebnis- und Fehlerfelder stammen immer aus derselben zentralen Persistenz `iam.studio_jobs` plus `iam.studio_job_events`.

Fehlerpfad:

- Ohne gültigen Instanzkontext oder Idempotency-Key antwortet der Host fail-closed mit einem stabilen Fehlervertrag.
- Datenbankfehler beim Anlegen oder Lesen werden als hostgeführte `database_unavailable`-Antworten abgebildet.
- Die öffentliche API bleibt runner-agnostisch; eine interne Worker-Technologie darf den Fehler- und Statusvertrag nicht verändern.

### Self-Service-Datenexport über Host-Worker

1. Ein authentifizierter Benutzer ruft `POST /iam/me/data-export` für das eigene Konto auf.
2. `@sva/auth-runtime` validiert Session, Instanzkontext und Format und delegiert an `@sva/iam-governance`.
3. `@sva/iam-governance` legt den fachlichen Exportdatensatz in `iam.data_subject_export_jobs` an und erzeugt zusätzlich einen generischen Studio-Job mit `source = 'host'`.
4. Der Exportdatensatz speichert die Verknüpfung `studio_job_id`, bleibt aber weiterhin die fachliche Source of Truth für Status, Fehler und Download-Payloads.
5. Der generische Worker verarbeitet den Host-Job, claimt den Exportdatensatz atomar (`queued -> processing`) und schreibt nach erfolgreicher Payload-Erzeugung `completed` plus Download-Inhalt zurück.
6. Statusabfragen und Downloads bleiben auf den bestehenden DSR-Endpunkten; die UI liest keinen Studio-Job direkt.

Fehlerpfad:

- Schlägt die Job-Erzeugung oder das Enqueue fehl, markiert der Host den Exportdatensatz als `failed`; es bleibt kein dauerhaft `queued` hängender Export ohne Worker-Pfad zurück.
- Retries dürfen terminale Exporte nicht doppelt erzeugen; der Host-Handler bleibt idempotent.
- Der DSR-Maintenance-Endpunkt ist für Exportverarbeitung nicht mehr verantwortlich; er deckt nur übrige Housekeeping-Läufe ab.

### Waste-Management: Settings, CRUD, PDF-Stamminhalte und technische Tools

1. Ein berechtigter Instanzbenutzer öffnet `/plugins/waste-management`.
2. Die App-Shell materialisiert die freie Plugin-Route hostgeführt über `@sva/routing` und prüft Guard plus Modulfreigabe fail-closed.
3. Das Plugin lädt fachliche Leseansichten ausschließlich über `/api/v1/waste-management/settings`, `/history`, `/master-data`, `/tours`, `/scheduling` und `/outputs`.
4. `@sva/auth-runtime` prüft Session, Instanzkontext, modulbezogene `waste-management.*`-Rechte und den stabilen Fehlervertrag.
5. Für Settings, Ausgabe-Stamminhalte, Seed, Reset, Migrations- und Importpfade löst `@sva/server-runtime` die aktive Waste-Datenquelle der Instanz auf und verwendet dabei serverseitig geschützte Secrets.
6. Zentrale Governance-Daten wie Waste-Datenquelle, letzter Connection-Check und Auditspur liegen im Studio-Postgres; die fachlichen Waste-Daten liegen in der instanzbezogenen Waste-Fachdatenbank.
7. Mutationen gegen Fraktionen, Orte, Abholorte, Touren, Ausweichtermine und Bulk-Zuordnungen laufen immer über dieselbe Host-Fassade und erzeugen zentrale Audit-Events.
8. Erfolgreiche Fraktionsmutationen starten zusätzlich asynchron den dedizierten Job `waste-management.sync-waste-types`.
9. Die Studio-Runtime lädt dafür die aktiven Fraktionen, baut in `@sva/core` das `wasteTypes`-JSON mit stabilen PDF-Kürzel-Keys und schreibt es über `@sva/sva-mainserver` per `createOrUpdateStaticContent` auf den Mainserver.
10. Der Tab `Ausgabe` pflegt nur statische PDF-Inhalte wie Branding und Kontaktblock; operative PDF-Erzeugung gehört nicht mehr zum Studio-Laufzeitpfad.
11. Technische Operationen wie Import, Migration, Seed, Reset und `sync-waste-types` starten als generische Plugin-Jobs über den gemeinsamen Host-Jobpfad; das Plugin zeigt nur die fachnahe Bedienhülle und Statusprojektion.
12. Der Waste-CSV-Spezialimport veröffentlicht während des Commit-Pfads blockweise Fortschritt für gültige Zeilen, inklusive fachlicher Phasen `Vorbereitung`, `Importlauf` und `Abschluss`; die Plugin-UI pollt diesen aktiven Fall enger als die generische Historienansicht.

Fehlerpfad:

- Fehlt die Modulfreigabe oder die spezifische `waste-management.*`-Berechtigung, blockiert der Host fail-closed vor der Mutation oder dem Jobstart.
- Fehlt oder driftet die Waste-Datenquelle einer Instanz, antwortet die Fassade mit technischem Fehlervertrag; Secrets werden nie im Plugin oder Browser aufgelöst.
- Scheitert nach einer erfolgreichen Fraktionsmutation nur der Mainserver-Sync, bleibt die lokale Änderung bestehen; die UI zeigt stattdessen einen Warning-Hinweis mit Retry über denselben technischen Startpfad.
- Ein `Newcms`-ähnlicher Direktzugriff auf Supabase-Funktionen, direkte DB-Connections oder mitportierte Runtime-Hooks ist kein zulässiger Alternativpfad.

### Öffentlicher Abfallkalender: Auswahl, Restore und Detailansicht

1. Der Browser lädt `apps/public-waste-calendar-web` direkt als öffentliche Oberfläche.
2. Beim Start liest die App höchstens einen stabilen Standortschlüssel aus genau einem Cookie und versucht daraus die letzte vollständige Auswahl wiederherzustellen.
3. Ohne gültigen Cookie startet die App im reduzierten Auswahlmodus und zeigt nur die nächste gültige Stufe des Standortflusses an.
4. Nach vollständiger Auswahl projiziert die App die bekannten Termine in Listenansicht, Fraktionsfilter, PDF-Export und iCal-URL.
5. Ein Klick auf einen Termin öffnet ein Modal mit Datum, Fraktion und Hinweistext; die globalen Export-Aktionen bleiben außerhalb des Modals sichtbar.
6. Ein Reload mit gültigem Cookie stellt denselben Standort wieder her und zeigt einen expliziten Hinweis auf die automatisch geladene Adresse.

Erweiterter Reminder-Pfad:

1. Im vollständig aufgelösten Standortkontext zeigt die App zusätzlich die Aktion `E-Mail-Erinnerung einrichten`.
2. Der Browser öffnet ein Formular in derselben App, das nur Fraktionen mit aktivem Kanal `E-Mail` sowie nur deren freigegebene Reminder-Slots anbietet.
3. Nach Zustimmung zur Datenverarbeitung sendet die Public-Waste-Runtime ein Pending-Abo an die Waste-Persistenz und erzeugt sofort einen DOI-Outbox-Eintrag.
4. Der Benutzer bestätigt den Link auf einer Unterseite derselben Public-Waste-App; erst danach wird das Abo aktiv.
5. Die Waste-Operations-Runtime materialisiert anschließend ressourcenschonend Reminder-Einzelaufträge pro Abo, Fraktion, Slot und Abholdatum in die Waste-Outbox.
6. Ein separater Mail-Dispatch-Adapter oder eine eigenständige Mail-App leased fällige Outbox-Einträge in kleinen Batches und verschickt daraus die eigentlichen E-Mails über die zentrale Schnittstelle `mail_transport`.
7. Jede Reminder-E-Mail enthält einen Abmeldelink zurück in dieselbe Public-Waste-App; der Link deaktiviert das Abo idempotent.

Erweiterter Exportpfad:

1. Für einen vollständig aufgelösten Standort kann der Browser einen PDF-Export für ein gewähltes Jahr und gewählte Fraktionen anfordern.
2. Die öffentliche Runtime lädt dafür alle wirksamen Termine des finalen Standortkontexts einschließlich fachlich vererbter übergeordneter Abholorte.
3. Der Server rendert das PDF ad hoc und liefert es unmittelbar zurück.
4. Es werden keine persistenten PDF-Artefakte oder später wiederverwendbaren Delivery-Links gespeichert.

Fehlerpfad:

- Fehlt die öffentliche Konfiguration, liefert die Bootstrap-Schicht einen deterministischen Fehlerzustand `missing_config`.
- Ungültige oder unvollständige Konfiguration endet deterministisch in `invalid_config` statt in einer teilweise geladenen Auswahloberfläche.
- Ungültige oder veraltete Standort-Cookies werden ignoriert; die App fällt ohne Halbzustand auf die erste gültige Auswahlstufe zurück.
- Fehlt die Reminder-Konfiguration, bleibt der Kalender funktionsfähig; nur CTA, Formular und Reminder-Seiten werden nicht aktiviert.
- Überschreiten Formularanfragen die konfigurierten IP-/E-Mail-Limits oder das Standortlimit pro Adresse, antwortet die Runtime deterministisch mit fachlichen 4xx-Fehlern ohne technische Leaks.
- Fehlt der technische Mail-Dispatcher, bleiben die Reminder-Aufträge in der Waste-Outbox; Waste-Konfiguration, DOI und Abmeldung funktionieren davon unabhängig weiter.

### Account-Self-Service: Datenschutzcockpit, Detail und Kontoregeln

1. Ein authentifizierter Benutzer öffnet über das Header-Menü `/account/privacy` oder `/account/rules`.
2. `/account/privacy` lädt `GET /iam/me/data-subject-rights/requests` und projiziert Requests, Exportjobs, Legal Holds und privacy-nahe Governance-Ereignisse als gemeinsame Aktivitätsliste.
3. Ein Klick auf `Details` navigiert nach `/account/privacy/$caseId`; die Detailseite lädt `GET /iam/me/data-subject-rights/cases/$caseId` gezielt per `caseId` statt über einen Lookup in der Overview-Menge.
4. Ein Klick auf `Kontoregeln` navigiert nach `/account/rules`; die Seite lädt `GET /iam/me/deletion-rules` und schreibt persönliche Inhaltsregeln über `POST /iam/me/deletion-rules/content-preference`.
5. Asynchrone Self-Service-Exporte laufen im Hintergrund über den generischen Host-Worker; Export-Downloads bleiben hostgeführt und verwenden weiterhin den bestehenden Status-/Download-Pfad für abgeschlossene Exportjobs.

Fehlerpfad:

- Fehlt der authentifizierte Kontokontext oder gehört die angefragte `caseId` nicht zum eigenen Konto, antwortet der Host fail-closed mit `404 not_found`.
- Die Detailansicht darf historische Vorgänge nicht implizit aus einer limitierten Overview-Liste rekonstruieren; der Laufzeitpfad bleibt immer ein expliziter Detail-Read.
- Regeln und Datenschutzaktivitäten bleiben UI-seitig getrennt, teilen sich aber denselben Account-Self-Service-Einstieg im Header-Menü.

### Account-Self-Service: Passwort- und E-Mail-Wechsel über Keycloak-AIA

1. Ein authentifizierter Benutzer wählt im Header-Menü `Passwort ändern`.
2. Das Studio navigiert nicht zu einer eigenen Formularseite, sondern ruft den serverseitigen Einstieg `/auth/account-action?action=...&returnTo=/account` auf.
3. Der Auth-Runtime-Handler validiert die angeforderte Aktion, normalisiert `returnTo`, erzwingt einen frischen interaktiven Login-Flow und hängt `kc_action` für Keycloak an.
4. Keycloak führt die eigentliche Credential-Änderung im eigenen Required-Action-Flow aus; sensible Eingaben und Policies bleiben vollständig im IdP.
5. Nach erfolgreichem Abschluss oder Abbruch landet der Benutzer wieder auf `/account`; der Callback ergänzt dort nur einen kleinen Statusmarker wie `accountAction=password-updated`, `email-update-finished` oder `cancelled`.

Fehlerpfad:

- Unbekannte oder manipulierte Aktionen enden bereits im Host mit `400 invalid_request`.
- Unsichere oder Auth-nahe Rücksprungziele werden fail-closed auf `/` beziehungsweise `/account` zurückgeführt.
- Ein Abbruch in Keycloak wird nicht als lokaler Formularfehler interpretiert, sondern als kontrollierter Rücksprungstatus auf die Studio-Kontoseite projiziert.

### Szenario 1: App-Start + Route-Komposition

1. App lädt `getRouter()` in `apps/sva-studio-react/src/router.tsx`
2. Core-Route-Factories werden client- oder serverseitig geladen
3. Der Host liest die statische Plugin-Liste sowie deklarative Admin-Ressourcen und materialisiert daraus Plugin-Sonderrouten und host-owned Admin-Routen
4. Core-/Auth-Runtime-Routen, host-owned Admin-Routen und verbleibende Plugin-Sonderrouten werden zu einem gemeinsamen Route-Tree kombiniert
5. Router wird mit RouteTree und SSR-Kontext erstellt

Fehlerpfad:

- Fehlerhafte Route-Factory oder server-only Import im Client kann Build/Runtime brechen.
- Plugin-Routen außerhalb `/plugins/<pluginNamespace>` oder mit unbekanntem Guard werden vor Veröffentlichung des Route-Trees mit deterministischem Guardrail-Code abgewiesen.
- Standardisierte Content-Plugins dürfen zusätzlich keine parallelen CRUD-Hauptrouten unter `/plugins/<pluginNamespace>` veröffentlichen; dieser Bypass bricht den Build-time-Snapshot fail-fast.

### Szenario 1c: Plugin-Guardrail-Validierung beim Build-time-Snapshot

1. Die App übergibt statische Plugin-Packages an `createBuildTimeRegistry()`.
2. Das Plugin-SDK führt die bestehende Registry-Erzeugung in festen Phasen aus: Preflight, Content, Admin, Audit, Permissions, Routing und Publish.
3. Jede Phase erzeugt die bisherigen `BuildTimeRegistry`-Outputs; bestehende Consumer müssen keinen neuen Snapshot-Typ verwenden.
4. Erlaubte UI-Komponenten und host-invoked Payload-Validatoren bleiben im Snapshot erhalten.
5. Verbotene Felder wie eigene Route-Handler, Autorisierungsresolver, Audit-Sinks, Persistenzhandler oder dynamische Registrierung brechen die Initialisierung fail-fast ab.

Fehlerpfad:

- Der Host veröffentlicht keinen teilweise materialisierten Plugin-Snapshot.
- Die Fehlermeldung folgt `<guardrailCode>:<pluginNamespace>:<contributionId>:<fieldOrReason>`.
- Plugin-Routen, Navigation oder Actions mit produktiven `content.*`-Guards, fremden Namespaces oder nicht registrierten Permission-IDs brechen den Snapshot vor der Route-Materialisierung ab.

### Zielbild 2026-05: Plugin-Load über Manifest, Katalog und Loader

1. Der Host liest einen Plugin-Katalog mit lokalen Development-Einträgen und installierten Distributions-Einträgen.
2. Für jeden aktiven Katalogeintrag liest der Host zunächst den serialisierbaren Manifest-Vertrag und prüft Identität, Version, Host-Kompatibilität und deklarierte Capabilities.
3. Der Loader löst daraus die technischen Entry-Points auf und materialisiert lokale wie installierte Plugins in denselben kanonischen Host-Snapshot.
4. Routing, Navigation, IAM, Audit und Job-Orchestrierung konsumieren ausschließlich diesen validierten Snapshot.
5. Pluginseitige Request-, Job- oder Integrationsbeiträge laufen nur innerhalb host-owned Execution-Contexts.

Fehlerpfad:

- Inkompatible oder deaktivierte Plugins werden vor Snapshot-Publikation fail-closed ausgeschlossen.
- Ein Plugin ohne gültiges Manifest oder mit unzulässigen Runtime-Beiträgen wird nicht teilweise geladen.
- Runtime-Consumer erhalten nie einen partiell inkonsistenten Mischzustand aus rohen Plugin-Deskriptoren und validierten Snapshot-Daten.

### Szenario 1b: Materialisierung registrierter Admin-Ressourcen

1. Die App lädt neben Seiten-Bindings auch die statische Liste `appAdminResources`.
2. `@sva/routing` validiert die Admin-Ressourcen gegen den Plugin-SDK-Vertrag und materialisiert daraus Listen-, Create- und Detailrouten.
3. Für Content-Ressourcen mit `contentUi` rendert der Host optionale plugin-spezifische `list`-, `detail`- oder `editor`-Bindings innerhalb einer host-owned Shell-Region; ohne Spezialisierung bleibt die generische Host-Ansicht aktiv.
4. Der Host wendet den deklarativ referenzierten Guard auf alle Teilrouten der Ressource an.
5. Legacy-Pfade wie `/content`, `/content/new` und `/content/$contentId` werden im Routing-Layer auf `/admin/content*` umgeleitet.

Fehlerpfad:

- Doppelte Ressourcen-IDs oder kollidierende Basispfade brechen die Registrierungsphase fail-fast ab.
- `contentUi`-Ressourcen ohne registrierten `contentType` brechen den Build-time-Snapshot vor der Routenveröffentlichung fail-fast ab.
- Ohne gültige Ressourcendefinition wird kein teilweise inkonsistenter Admin-Route-Baum veröffentlicht.

### Szenario 4a: Plugin-Registrierung und Mainserver-Content-CRUD

1. Die App initialisiert `studioPlugins` und merged Plugin-Übersetzungen in die i18n-Ressourcen.
2. Der Router materialisiert host-owned Admin-Ressourcen für News, Events und POI unter `/admin/news`, `/admin/events` und `/admin/poi`.
3. Beim Aufruf der Route wendet der Host den registrierten Plugin-Guard an, zum Beispiel `news.read`, `events.read` oder `poi.read`, und rendert optional die spezialisierte Plugin-Fläche innerhalb der Host-Shell.
4. Die gemeinsame Übersicht `/admin/content` ruft ausschließlich `GET /api/v1/iam/contents` auf.
5. Die App-Fassade liest hinter dieser Route aus der persistierten Listenprojektion `iam.content_list_projection`; lokale IAM-Inhalte landen dort triggerbasiert, Mainserver-News, -Events und -POI werden bei Bedarf serverseitig refresht, bevor Sortierung, Filterung und Pagination datenbankseitig greifen.
6. Die Fachlisten und Detailseiten unter `/admin/news`, `/admin/events` und `/admin/poi` rufen weiterhin ihre jeweiligen Host-Fassaden auf: `/api/v1/mainserver/news`, `/api/v1/mainserver/events` oder `/api/v1/mainserver/poi`.
7. Die tab-basierten Detail-/Editorseiten senden Create-, Update- und Delete-Requests an die jeweilige Fassade und Detailroute.
8. Die App-Fassade prüft Session, `instanceId`, aktiven Organisationskontext, plugin-spezifische IAM-Permission und Mainserver-Credentials serverseitig.
9. `@sva/sva-mainserver/server` lädt über getrennte interne Provider Endpunktkonfiguration, organisationsgebundene oder persönliche Credentials, OAuth2-Token und den GraphQL-Transport.
10. Ressourcenspezifische Operations-Module für News, Events und POI rufen denselben Transport-Port auf; das News-Plugin übersetzt dabei den vereinfachten Redaktionseditor in ein Save-Plan-Modell mit `contentBlocks[0]`, Veröffentlichungsmodus und optionaler Push-Auslösung, während Events und POI ihre tab-basierten Detailseiten mit festen Bereichen `Basis`, `Inhalt`, `Einstellungen` und `Historie` über eigene Mapping-Adapter für Termine, Adressen, Kontakte, URLs, Medien, Preise, Barrierefreiheit, Tags und POI-Bezug anbinden.
11. Beim Speichern von News laufen zwei technische Schritte: zuerst `createNews` oder `updateNews`, danach für den redaktionellen Zustand ein separater `changeVisibility(recordType: "NewsItem")`-Aufruf.
12. Die host-owned Studio-Newsliste liest denselben Pfad mit `includeInvisible=true` und filtert redaktionelle Stati (`Entwurf`, `Geplant`, `Veröffentlicht`) erst auf Studio-Seite aus Sichtbarkeit und `publishedAt`.
13. Es gibt keinen Dual-Write und keine Legacy-Migration in lokale IAM-Contents.
14. Nach erfolgreichem Speichern oder Löschen zeigt die host-owned Route Statusfeedback und navigiert zurück zur jeweiligen Admin-Liste.

Fehlerpfad:

- fehlt die Berechtigung, blendet die Shell die Admin-Navigation fail-closed aus, blockiert der Host die Admin-Route vor dem Rendern oder verweigert die serverseitige Mutation mit `capability_authorization_denied` im Diagnosekontext.
- ist das News-Input-Modell ungültig, enthält schreibgeschützte Felder oder fehlt `publishedAt`, antwortet die Mainserver-News-Fassade mit HTTP `400`.
- schlägt ein API-Call fehl, zeigt das Plugin eine verständliche Fehlermeldung und behält den Formzustand.

### Szenario 4b: Plugin-Custom-View mit gemeinsamer Studio-UI

1. Die App lädt das statisch registrierte Plugin und validiert dessen Routen, Admin-Ressourcen und Guard-Metadaten über `@sva/plugin-sdk`.
2. Der Host materialisiert entweder eine freie Plugin-Sonderroute unter `/plugins/<pluginNamespace>` oder eine host-owned Admin-Ressource mit spezialisierter Fachfläche und bettet beide Varianten in die normale App-Shell ein.
3. Die Plugin-Komponente rendert ihre fachliche Oberfläche mit `@sva/studio-ui-react`-Bausteinen für Seitenstruktur, Formularfelder, Aktionen, Tabellen und Lade-/Fehlerzustände.
4. Fachliche Datenzugriffe laufen über hostkontrollierte HTTP- oder Server-Funktionsverträge; die Custom-View erhält keine eigenen Host-Handler, Audit-Sinks oder Persistenzpfade.
5. Die App- und Plugin-Lint-/Boundary-Checks verhindern App-interne UI-Imports und lokale Basis-Control-Duplikate in Plugin-Packages.

Fehlerpfad:

- Importiert ein Plugin App-interne Komponenten, bricht ESLint oder der Plugin-UI-Boundary-Check mit Verweis auf `@sva/studio-ui-react` ab.
- Definiert ein Plugin eigene wiederverwendbare Basiscontrols für Button, Input, Tabelle, Tabs, Dialog oder Alert, wird der Beitrag als UI-Drift behandelt und muss in einen fachlichen Wrapper um Studio-Primitives geändert werden.
- Versucht eine Custom-View Shell, Guard, Route-Materialisierung oder Persistenz zu übernehmen, greift der bestehende Plugin-Guardrail-Pfad fail-fast.

### Szenario 1a: Tenant-Request mit Registry-Lookup

1. Request trifft mit Host-Header auf die Runtime.
2. Middleware klassifiziert Root-Host, Tenant-Host oder ungültigen Host.
3. Tenant-Hosts werden über die Instanz-Registry aufgelöst.
4. Nur `active`-Instanzen erhalten Traffic.
5. Unbekannte, suspendierte und archivierte Hosts werden identisch fail-closed beantwortet.

Fehlerpfad:

- Registry-Eintrag fehlt oder ist nicht traffic-fähig -> identische fail-closed-Antwort.

### Szenario 2: OIDC Login-Flow

1. Browser ruft `/auth/login` auf
2. `loginHandler()` erstellt PKCE-LoginState, setzt signiertes State-Cookie und redirectet zum IdP
3. IdP redirectet nach `/auth/callback?code=...&state=...`
4. `callbackHandler()` validiert State, tauscht Code gegen Tokens und erstellt eine versionierte Session mit `issuedAt`, `expiresAt` und `sessionVersion`
   - Bei Tenant-Hosts wird `instanceId` aus dem zuvor aufgelösten Auth-Scope aus Host, Registry und Realm in den Session-User übernommen.
   - Ein fehlender `instanceId`-Claim blockiert den Tenant-Login nicht; ein widersprüchlicher Claim beendet den Callback fail-closed als Scope-Konflikt.
5. Session-Cookie wird mit expliziter Laufzeit aus `expiresAt` gesetzt; Redis-TTL wird technisch aus der Restlaufzeit plus Puffer abgeleitet
6. App ruft `/auth/me` fuer minimalen Auth-Kontext (`id`, `instanceId`, kanonische IAM-`roles`, technische `keycloakRoles`)
7. Falls UI Profildaten wie Name oder E-Mail braucht, laedt sie diese ueber dedizierte Profil-Endpunkte getrennt nach

Fehlerpfad:

- Fehlender/abgelaufener State -> Redirect mit Fehlerstatus
- Token-/Refresh-Fehler -> Session invalidiert oder unauthorized Antwort
- Profilfehler beruehren die Session-Hydration nicht; die App behaelt ihren minimalen Auth-State
- Host-/Realm-/Claim-Konflikte erzeugen keinen tenant-losen Fallback, sondern bleiben als Auth-Fehler sichtbar.

### Szenario 2c: Root-Host-Instanzverwaltung

1. Admin öffnet `/admin/instances` auf dem Root-Host.
2. UI lädt `GET /iam/instances`.
3. Das Detail lädt zusaetzlich Preflight, Plan, Status und vorhandene Provisioning-Runs.
4. `Instanzdaten speichern` sendet CSRF-Header, Idempotency-Key und Reauth-Bestaetigung und schreibt nur Registry-Daten.
5. `Provisioning ausfuehren` oder `Reconcile` startet einen expliziten Run mit Realm-Modus `new` oder `existing`; der validierte `Idempotency-Key` wird zusammen mit Mutation und stabilem Payload-Fingerprint persistent dedupliziert.
6. `packages/auth-runtime` delegiert an die gemeinsame Provisioning-Fassade in `packages/instance-registry`.
7. Die Fassade provisioniert getrennt Login-Client (`authClientId`) und Tenant-Admin-Client (`tenantAdminClient.clientId`) inklusive separater Secret-Aufloesung.
8. Die Fassade persistiert Run, Schritte und Audit-Event und invalidiert anschliessend betroffene Host-Caches.

Fehlerpfad:

- Tenant-Host statt Root-Host -> `403 forbidden`.
- fehlende Re-Authentisierung -> `403 reauth_required`.
- blockierter Preflight oder Plan -> kein Keycloak-Mutationslauf.
- wiederholter Keycloak-Request mit identischem `Idempotency-Key` und identischer stabiler Payload -> kein zweiter Run; abweichende Payload im selben Scope -> `409 idempotency_key_reuse`.
- fehlt nur der Tenant-Admin-Client, darf Reconcile gezielt `provision_admin_client` nachziehen, ohne den Login-Pfad zu veraendern.

### Szenario 2d: Datensatzautorisierung mit Rollen-Scope

1. Ein Benutzer ruft eine datensatzbezogene Lese- oder Mutationsroute auf, deren Permission als scope-faehig modelliert ist.
2. `packages/auth-runtime` laedt die effektiven Rollen-Permissions inklusive `accessScope` aus dem Snapshot- oder Recompute-Pfad.
3. Die Fachroute baut einen kanonischen `AuthorizeRequest` mit `actorAccountId` im Kontext sowie `createdByAccountId` und optional `organizationId` am Resource-Objekt; `organizationId` bleibt dabei ein expliziter Fachkontext und kein blanket Scope für instanzweite Rechte.
4. Die Authorization-Engine wertet zuerst den Assignment-Scope aus und kombiniert ihn danach mit den bestehenden RBAC-/ABAC-Regeln.
5. Bei `all` bleibt die bisherige Freigabe unveraendert.
6. Bei `own` wird der Zugriff nur freigegeben, wenn `createdByAccountId` dem aktuellen Actor entspricht.
7. Bei `organization` wird der Zugriff freigegeben, wenn der Actor den Datensatz selbst erstellt hat oder der Datensatz zur aktiven Session-Organisation gehoert.
8. Die Rollen-UI schreibt denselben Scope als `permissionAssignments[]`, und die Nutzeransicht zeigt den wirksamen Scope read-only im Permission-Trace.
9. Für instanzweite Rechte wie `media.*`, `waste-management.*`, `app.read` oder `cockpit.read` bleibt die Entscheidung auch bei aktivem Organisationskontext instanzweit; der Permission-Trace zeigt dies über `runtimeScope = instance` statt über eine künstliche Organisationsbindung.

Fehlerpfad:

- Fehlen fuer einen scope-faehigen Datensatz die kanonischen Resource-Attribute, entscheidet die Engine fail-closed.
- Nicht scope-faehige Permissions duerfen keinen Assignment-Scope tragen; Mutationen werden serverseitig validiert und bei Verstoessen abgewiesen.
- Ein Organisationswechsel in der Session veraendert nur Entscheidungen fuer `organization`, nicht fuer `all` oder `own`.

### Szenario 2a: Silent Session-Recovery nach `401`

1. `AuthProvider` ruft `/auth/me` auf und erhält `401`.
2. Das Frontend startet genau einen stillen Recovery-Versuch über `/auth/login?silent=1` in einem versteckten iframe.
3. `loginHandler()` setzt `prompt=none` und verwendet weiterhin `state`, `nonce` und PKCE.
4. `callbackHandler()` antwortet im Silent-Fall mit einer iframe-sicheren HTML-Response statt mit einem normalen Redirect.
5. Bei Erfolg lädt das Frontend `/auth/me` erneut und übernimmt den aktualisierten Sessionzustand.
6. Bei Fehlschlag bleibt der Benutzer ausgeloggt und muss aktiv den regulären Login starten.

Fehlerpfad:

- Browser-/IdP-Cookies verhindern Silent SSO -> Recovery endet ohne Schleife im ausgeloggten Zustand.
- Ein expliziter Logout blockiert den automatischen Silent-Recovery-Pfad zeitlich begrenzt.

### Szenario 2d: IAM-Diagnosepfad von Tenant-Host bis UI

1. Ein Request trifft auf Tenant-Host oder Root-Host ein.
2. Hostvalidierung und Registry-Auflösung entscheiden, ob der Request fail-closed abgewiesen oder weiterverarbeitet wird.
3. Auth- und Session-Schicht prüfen Cookie, Session-Store, Session-Hydration und optional Token-Refresh.
4. IAM-nahe Handler klassifizieren Actor-, Membership-, Keycloak-, DB- oder Schema-Probleme und erzeugen allowlist-basierte Details.
5. Browserpfade lesen Fehlercode, `requestId` und freigegebene Detailfelder.
6. UI und Betrieb sollen daraus künftig denselben Diagnosekern ableiten, auch wenn die konkrete Formulierung kontextabhängig bleibt.

Fehlerpfad:

- Recovery-Pfade wie Silent-Recovery, Session-Hydration oder Host-Fallbacks können Symptome kurzfristig überdecken; der degradierte Zustand muss daher für Diagnose und Folgeentscheidungen erhalten bleiben.
- Runtime-IAM-Fehler und Instanz-/Provisioning-Drift dürfen nicht in getrennten Diagnosewelten landen.

### Szenario 2e: Deterministischer User-Sync und Rollen-Reconcile

1. Ein Administrator startet in `/admin/users` den Keycloak-User-Sync oder in `/admin/roles` den Rollen-Reconcile.
2. Der Server unterscheidet Root-Host-Platform-Scope und Tenant-Instance-Scope. Im Platform-Scope nutzt er den Plattform-Realm ohne `instanceId`; im Tenant-Scope lädt er den Instanzkontext und prüft vor jeder tenantlokalen Admin-Mutation blockerrelevanten Drift aus Registry, Preflight und Provisioning-Plan.
3. Beim Keycloak-User-Sync ist der aktive Tenant-Realm die führende Benutzergrenze; fehlende `instanceId`-Attribute blockieren den Import nicht.
4. Liegt ein Blocker vor, endet der Lauf sofort fail-closed mit technischem Fehlervertrag inklusive `classification`, `requestId` und freigegebenen Safe-Details.
5. Ohne Blocker führt `packages/iam-admin` den Sync oder Reconcile deterministisch aus. Der Rollen-Reconcile repariert nur technische Sonderrollen; nicht-technische Keycloak-Rollen werden als Legacy-/Drift-Diagnose oder fachlicher Restzustand `manual_review` berichtet.
6. Die Handler antworten immer mit genau einem Abschlusszustand `success`, `partial_failure`, `blocked` oder `failed` sowie aggregierten Zählwerten.
7. Read-Pfade für Profil, User-Liste und Rollenansicht laden anschließend denselben kanonischen Projektionskern nach, damit UI und Fachzustand übereinstimmen.

Fehlerpfad:

- fehlender Tenant-Admin-Client, Secret-Drift oder blockierter Provisioning-Plan verhindern den Start des Laufs vollständig.
- tenantlokale Reconcile-Läufe verwenden keinen Plattform-Fallback; ein versehentlich funktionsfähiger globaler Admin-Pfad gilt nicht als zulässige Kompensation.
- `IDP_FORBIDDEN` und `IDP_UNAVAILABLE` bleiben als technische oder Berechtigungsfehler sichtbar und werden nicht als `manual_review` kaschiert.
- einzelne fachlich mehrdeutige Fälle können in `manual_review` enden, ohne dass der Gesamt-Request hängen bleibt.

### Szenario 2g: Tenant-IAM-Detailansicht mit expliziter Access-Probe

1. Ein Root-Host-Administrator öffnet `/admin/instances/$instanceId`.
2. Die Detailseite lädt `GET /api/v1/iam/instances/:instanceId` und erhält neben Registry- und Keycloak-Strukturdaten auch `tenantIamStatus`.
3. `packages/instance-registry` aggregiert `configuration` aus Registry-/Provisioning-Evidenz, `reconcile` aus Rollen- und Activity-Log-Signalen und `access` aus der letzten bekannten Access-Probe.
4. Die UI rendert diese Achsen getrennt und leitet `overall` strikt aus `blocked` vor `degraded` vor `unknown` vor `ready` ab.
5. Startet der Operator die Aktion `Tenant-IAM-Zugriff prüfen`, sendet die UI `POST /api/v1/iam/instances/:instanceId/tenant-iam/access-probe`.
6. `packages/auth-runtime` löst dafür ausschließlich `resolveIdentityProviderForInstance(..., { executionMode: 'tenant_admin' })` auf und führt eine read-only-`listRoles()`-Probe gegen den tenantlokalen Admin-Client aus.
7. Das Ergebnis wird als Audit-Evidenz persistiert, danach neu aggregiert und unmittelbar als aktualisierter `tenantIamStatus` an die Detailseite zurückgegeben.

Fehlerpfad:

- existiert kein tenantlokaler Admin-Client oder fehlt das Secret, endet die Probe fail-closed mit einem geblockten oder degradierten Access-Befund statt mit einem Plattform-Fallback.
- `IDP_FORBIDDEN` bleibt als Berechtigungsfehler sichtbar; temporäre Erreichbarkeitsstörungen werden als `IDP_UNAVAILABLE` eingeordnet.
- ohne bisherige Probe-Evidenz bleibt `access` explizit `unknown`; die Detailseite erzeugt daraus keinen künstlichen Erfolgszustand.

### Szenario 2h: Fail-closed Modulaktivierung zur Laufzeit

1. Ein Instanzbenutzer ruft `/auth/me` auf.
2. `packages/auth-runtime` lädt effektive Permissions und die kanonische Liste `assignedModules` aus der Registry.
3. Die Client-Shell speichert diese Modulliste im Session-Kontext.
4. Beim Aufruf einer Plugin-Route prüft `@sva/routing` zuerst den deklarativen Guard und danach die Modulzuweisung.
5. Die Sidebar blendet Plugin-Navigation aus, wenn das Modul der aktiven Instanz nicht zugewiesen ist.
6. Die Sidebar blendet die Links `App` und `Cockpit` separat über die Rechte `app.read` und `cockpit.read` aus; ohne beide Rechte verschwindet der gesamte Abschnitt `Anwendungen`.
7. Bei Modulzuweisung oder Entzug rekonstruiert `packages/instance-registry` die IAM-Basis und invalidiert betroffene Registry-Caches.

Fehlerpfad:

- fällt der Modul-Lookup im Session-Pfad aus, wird `assignedModules` fail-closed als leer behandelt.
- fehlt die Zuweisung, blockiert das Routing die Plugin-Route vor dem Rendern.
- direkte API-Aufrufe bleiben zusätzlich durch fehlende modulbezogene Permissions abgesichert.

### Szenario 2f: IAM-User- und Rollenverwaltung mit technischem Keycloak-Schnitt

1. `/admin/users` verbindet Keycloak-Identität mit der IAM-DB-Projektion; `/admin/roles` lädt tenantlokale Fachrollen kanonisch aus der IAM-Datenbank.
2. Im Platform-Scope wird nur der Platform-Admin-Keycloak-Client verwendet.
3. Im Tenant-Scope wird nur der Tenant-Admin-Keycloak-Client der Instanz verwendet; fehlt dieser, endet der Request mit `tenant_admin_client_not_configured`.
4. Tenant-Userlisten lesen den vollständigen Realm-Ausschnitt aus Keycloak und verbinden ihn anschließend mit Studio-Read-Models.
5. Keycloak-Rollen ohne technische Sonderrollenbedeutung bleiben als `keycloakRoles`, `unmapped` oder `manual_review` sichtbar, begründen aber keine fachliche Tenant-Autorisierung.
6. Mutierende Rollenaktionen für normale Tenant-Rollen schreiben DB-only und erzeugen Audit-Events. Keycloak-Mutationen bleiben auf technische Sonderrollen, Identität und Credential-nahe Operationen begrenzt.
7. Read-only- oder blockierte Objekte werden in der UI mit Diagnosecode angezeigt und serverseitig erneut vor der Mutation geprüft.

Fehlerpfad:

- Keycloak `403` wird als `IDP_FORBIDDEN` beziehungsweise `idp_forbidden` eingeordnet.
- föderierte oder profilrichtliniengeschützte Felder werden als `read_only_federated_field` sichtbar und nicht überschrieben.
- verbotene technische Rollenzuordnungen werden als `forbidden_role_mapping` sichtbar.
- Built-in- und Legacy-Keycloak-Rollen bleiben technische Diagnoseobjekte und dürfen nicht als tenantlokale Fachrollen materialisiert werden.

### Szenario 2b: Forced Reauth für einen Benutzer

1. Ein interner Serverpfad ruft `forceReauthUser({ userId, mode, reason })` auf.
2. Der Auth-Server erhöht `minimumSessionVersion`, setzt `forcedReauthAt` und invalidiert bekannte Studio-Sessions des Benutzers.
3. Bei `app_and_idp` beendet der Keycloak-Admin-Client zusätzlich aktive IdP-Sessions des Benutzers.
4. Nachfolgende Requests mit älteren Sessions schlagen bei der Session-Auflösung fehl.
5. Das Frontend erhält dadurch spätestens beim nächsten `/auth/me` oder geschützten Request einen unauthentifizierten Zustand.

Fehlerpfad:

- Bei `app_only` kann eine vorhandene Keycloak-Session einen nachfolgenden interaktiven Login ohne Passwort erlauben.
- Bei `app_and_idp` ist eine echte Re-Authentifizierung erforderlich.

### Szenario 3: Logging/Observability bei Server-Requests

1. Server-Code loggt via `createSdkLogger(...)` aus `@sva/server-runtime`
2. Context (workspace/request) wird über AsyncLocalStorage injiziert
3. In Development schreiben Console- und Dev-UI-Transport die redaktierten Logs sofort lokal aus
4. Sobald OTEL bereit ist, werden bestehende Logger um den Direct-OTEL-Transport erweitert
5. OTEL Processor redacted und filtert Labels
6. Export via OTLP an Collector -> Loki/Prometheus

Fehlerpfad:

- Development ohne OTEL-Readiness: Console und Dev-Konsole bleiben aktiv, die App bleibt lauffähig
- Production ohne OTEL-Readiness: der Start gilt als Fehlerzustand und wird fail-closed behandelt

### Szenario 3a: Auth-Route wirft Fehler außerhalb des Request-Kontexts

1. Eine Auth- oder IAM-Route wirft in `packages/routing/src/auth.routes.server.ts` einen unerwarteten Fehler.
2. Die äußere JSON-Error-Boundary liest `X-Request-Id` und `traceparent` best effort aus den Request-Headern.
3. Der SDK-Logger schreibt einen strukturierten Fehler mit `request_id`, `trace_id`, `route`, `method`, `error_type` und `error_message`.
4. Die Response wird über `toJsonErrorResponse()` als JSON mit flachem Fehlervertrag und Header `X-Request-Id` zurückgegeben.

Fehlerpfad:

- Sind Header ungültig oder fehlen sie, bleiben `request_id` und `trace_id` leer; die Response bleibt trotzdem JSON.
- Schlägt der Logger selbst fehl, schreibt die Routing-Schicht einen sanitisierten Minimal-Eintrag auf `stderr`.

### Szenario 3b: Prod-naher Studio-Deploy mit Drift-Gates

1. Ein Operator startet `pnpm env:release:studio:local` fuer einen konkreten Digest.
2. `environment-precheck` liest den Live-Stack bevorzugt ueber die Portainer-API und vergleicht Soll-/Ist-Drift fuer `app`.
3. `image-smoke` prueft Root-Host, Tenant-Hosts und OIDC-Verhalten prod-nah gegen das Zielartefakt.
4. Wenn derselbe Digest bereits live laeuft, darf der Gate-Schritt die Live-Paritaet nur wiederverwenden, wenn Ingress-Konsistenz, Tenant-Auth-Proof, Runtime-Flags und `app-db-principal` fuer genau dieses Digest gruen sind.
5. Erst danach folgen optional `migrate` und `bootstrap`, dann der eigentliche Live-Rollout.
6. `internal-verify`, `smoke` und `precheck` bestaetigen den Zustand erneut aus Sicht der laufenden App.

Fehlerpfad:

- Weicht der Root-/Tenant-/OIDC-Vertrag ab, blockiert der Rollout vor jeder Live-Mutation.
- Ist `/health/ready` aus Sicht von `APP_DB_USER` nicht stabil, gilt der Stack auch bei gruener Superuser-Sicht als nicht freigegeben.
- Manueller Incident-Recovery ueber Portainer oder Quantum bleibt temporaer; abgeschlossen ist der Fall erst nach kanonischem `app-only`-Reconcile und erneut gruener Verifikation.

### Szenario 4: Initialer Shell-Ladezustand mit Skeleton UI

1. Root-Shell rendert initial in einem kurzen Loading-Zustand
2. `Header` zeigt Skeleton für Auth-Aktion in der Kopfzeile
3. `Sidebar` zeigt Skeleton-Navigation
4. `AppShell` zeigt Skeleton-Platzhalter im Contentbereich
5. Nach Abschluss des initialen Zustands wird auf regulären Inhalt gewechselt

Fehlerpfad:

- Falls Route-/Inhaltsdaten verzögert verfügbar sind, bleibt die Shell strukturell stabil (kein Layout-Springen), bis regulärer Inhalt rendert.

### Szenario 5: IAM Authorize mit ABAC, Hierarchie und Snapshot-Cache

1. Client ruft `POST /iam/authorize` mit `instanceId`, `action`, `resource` und optionalem ABAC-Kontext auf; `GET /iam/me/permissions` nutzt denselben Snapshot-Pfad optional mit `organizationId`, `geoUnitId` und `geoHierarchy`, wobei `organizationId` nur für scope-sensitive Rechte fachlich wirksam wird.
2. Server erzwingt Instanzgrenze und wertet Hard-Deny-Regeln zuerst aus.
3. Permission-Snapshot wird zuerst im lokalen L1-Cache und danach in Redis über User-/Instanz-/Org-/Geo-Kontext gesucht.
4. Bei Cache-Hit wertet die Engine die Entscheidung in fester Reihenfolge aus: RBAC-Basis, danach ABAC-Regeln und Hierarchie-Restriktionen; instanzweite Rechte behalten dabei ihre instanzweite Semantik und erhalten keine künstliche `organizationId`-Projektion.
5. Bei Miss, Stale oder Integritätsfehler erfolgt Recompute aus Postgres als fachlicher Quelle; ein erfolgreicher Recompute schreibt zuerst Redis und danach den L1-Cache.
6. Bei Redis- oder Recompute-Fehler im sicherheitskritischen Pfad greift Fail-Closed mit HTTP `503` und Fehlercode `database_unavailable`.

Fehlerpfad:

- Eventverlust bei Invalidation: TTL begrenzt die Stale-Dauer; ein stale Snapshot darf bei technischem Fehler nicht fachlich weiterverwendet werden.
- DB-Ausfall ohne nutzbaren Snapshot: `503 database_unavailable`.

### Szenario 5a: GUI-gestuetzter Authorize-Performance-Lauf im Monitoring

1. `system_admin` oeffnet `/monitoring`; die UI liest optional das letzte bekannte Ergebnis ueber `GET /api/v1/iam/authorize-performance`.
2. Startet der Operator den Lauf, sendet die UI `POST /api/v1/iam/authorize-performance` mit `action`, `resourceType` sowie optional `resourceId` und `organizationId`.
3. `@sva/auth-runtime` validiert Session, CSRF-Header und Admin-Recht, erzeugt daraus einen sessiongebundenen Benchmark-Run und misst die Dauer im Serverprozess.
4. Fuer `cache-hit`, `cache-miss` und `recompute` baut der Lauf echte `POST /iam/authorize`-Payloads gegen denselben Runtime-Pfad; Browser-Rendering und Netzwerklatenz des Clients gehen nicht in die Messung ein.
5. Der gemessene Runtime-Pfad nutzt fuer wiederholte Requests derselben Session kurzlebige In-Process-Caches fuer Session-Resolution und Account-Lifecycle-Pruefung (`TTL 500 ms`), damit der Benchmark denselben produktiven Hot-Path wie die reale UI-Interaktion abbildet.
6. Im Szenario `recompute` invalidiert der Lauf nur den Permission-Snapshot des aktuellen Actors im aktuellen Instanzkontext und erzwingt danach den Neuaufbau aus Postgres.
7. Das Ergebnis wird als gemeinsamer Vertrag fuer UI und Nachweis aufbereitet, im Prozess als letztes Ergebnis gehalten und zusaetzlich als JSON- und Markdown-Bericht unter `docs/reports/` persistiert.
8. Die UI zeigt Samples, `p50`, `p95`, `p99`, Cache-Status, Bewertung und Report-Referenzen an; fuer historische Joblaeufe bleibt der bestehende Link nach `/monitoring/jobs` erhalten.

Fehlerpfad:

- Fehlende Admin-Berechtigung: `403 forbidden`.
- Ungueltige oder unvollstaendige Benchmark-Parameter: `400 invalid_request`.
- Recompute oder Authorize-Pfad koennen keinen sicheren Lauf liefern: `503 database_unavailable`.

### Szenario 6: IAM Governance-Workflow mit Approval, Delegation und Impersonation

1. Client ruft `POST /iam/governance/workflows` mit `operation`, `instanceId` und `payload` auf.
2. Server validiert Instanzscope, Ticketstatus und Vier-Augen-Regeln.
3. Workflow-Status wird in Governance-Tabellen persistiert (Request, Delegation, Impersonation, Legal-Text-Akzeptanz).
4. Sicherheitsrelevante Schritte erzeugen Dual-Write-Audit-Events (`iam.activity_logs` + SDK-Logger/OTEL).
5. Bei Acting-As-Zugriff prüft `POST /iam/authorize` aktive, nicht abgelaufene Impersonation.
6. Compliance-Nachweis wird über `GET /iam/governance/compliance/export` in CSV/JSON/SIEM exportiert.

Fehlerpfad:

- Ticket fehlt oder ist ungültig: Denial mit Governance-Reason-Code.
- Self-Approval: Aktion wird fail-closed abgewiesen.
- Impersonation abgelaufen: Session wird als `expired` markiert, Acting-As wird verweigert.

### Szenario 6a: Root-Host-Login und Plattform-Audit

1. Request trifft auf dem Root-Host ein und wird als `scope_kind=platform` klassifiziert.
2. Der Auth-Resolver lädt den Plattform-Auth-Kontext ohne Tenant-Fallback-Instanz.
3. Login, Logout und Silent-Reauth emittieren operative Logs mit `workspace_id=platform`, `reason_code`, `request_id` und `trace_id`.
4. DB-Audit wird in `iam.platform_activity_logs` persistiert.
5. Optionale Audit-Fehler bleiben non-blocking; die Auth-Antwort wird nur bei fachlichem Scope- oder Provider-Fehler fail-closed.

### Szenario 7: Cache-Invalidierung nach Rollen-/Policy-Änderung

1. Änderung an Rollen, Permission-Zuordnung oder Policy wird in Postgres persistiert.
2. Writer emittiert ein Invalidation-Ereignis über `NOTIFY` mit `eventId`, `instanceId` und betroffenem Scope.
3. Der Autorisierungspfad prüft zuerst den lokalen L1-Snapshot und danach Redis als Shared-Read-Path.
4. Cache-Worker in `packages/auth-runtime` empfängt das Event, dedupliziert per `eventId` und invalidiert passende Redis-Snapshots gezielt per `keycloakSubject` oder instanzweit.
5. Nachfolgende `POST /iam/authorize`-Aufrufe erzwingen Recompute für invalidierte Einträge und schreiben zuerst Redis, danach den L1-Cache.
6. Invalidation, Recompute, Cold-Start und Degraded-State werden mit `request_id`/`trace_id` strukturiert geloggt.

Fehlerpfad:

- Event kommt verspätet oder gar nicht an: TTL begrenzt die Stale-Dauer, ein stale Snapshot darf nach Recompute-Fehler aber nicht fachlich weiterverwendet werden.
- Redis-Lookup, Snapshot-Write oder Recompute schlagen fehl: der Entscheidungspfad bleibt fail-closed mit HTTP 503.
- Invalidation schlägt fehl: `cache_invalidate_failed` wird geloggt; der Readiness-Status kann auf `degraded` oder `failed` kippen.

Referenzen:

- `apps/sva-studio-react/src/router.tsx`
- `apps/sva-studio-react/src/routes/__root.tsx`
- `packages/auth-runtime/src/runtime-routes.ts`
- `packages/iam-core/src/index.ts`
- `packages/iam-admin/src/index.ts`
- `packages/iam-governance/src/index.ts`
- `packages/server-runtime/src/index.ts`
- `packages/monitoring-client/src/otel.server.ts`
- `docs/architecture/iam-service-architektur.md`

### Szenario 8: Login -> JIT-Provisioning -> Profilpflege

1. User meldet sich über `/auth/login` und `/auth/callback` an.
2. `handleCallback()` erstellt Session und triggert `jitProvisionAccount(...)`.
3. Account wird per `INSERT ... ON CONFLICT (keycloak_subject, instance_id)` idempotent angelegt/aktualisiert.
4. Erstanlage wird als `user.jit_provisioned` auditierbar protokolliert.
5. User oeffnet `/account`, Profil wird ueber `GET /api/v1/iam/users/me/profile` geladen.
6. Tenantlokale Profilaenderungen werden ueber `PATCH /api/v1/iam/users/me/profile` gespeichert.
7. Passwort- und E-Mail-Wechsel laufen davon getrennt ueber `/auth/account-action` und Keycloak-AIA; `/account` zeigt nach Rueckkehr nur die Statusmeldung an.

Fehlerpfad:

- JIT-Fehler blockiert den Login nicht, wird aber strukturiert geloggt.
- Profil-Update ohne gueltigen CSRF-Header wird serverseitig abgewiesen.
- Session und Autorisierung bleiben auch bei temporaer nicht verfuegbaren Profildaten stabil, da Name/E-Mail nicht Teil des Session-Kerns sind.

### Szenario 9: Admin-Flow User- und Rollenverwaltung

1. `system_admin` oder ein anderer tenantlokal berechtigter Admin öffnet `/admin/users`.
2. Liste wird paginiert über `GET /api/v1/iam/users` geladen.
3. Bearbeitung erfolgt in `/admin/users/$userId` per Tabs und `PATCH /api/v1/iam/users/$userId`.
4. Rollen-Änderungen triggern Permission-Invalidierung über `pg_notify`.
5. `system_admin` verwaltet Custom-Rollen auf `/admin/roles` mit `POST/PATCH/DELETE /api/v1/iam/roles`.
6. Auf Tenant-Hosts löst der Backend-Service den Adminpfad strikt aus `iam.instances.authRealm` plus `tenantAdminClient.clientId` und tenantlokalem Admin-Secret auf und führt Rollen- und Nutzer-CRUD Keycloak-First innerhalb desselben Tenant-Realms aus.
7. Root-/Plattform-Pfade verwenden einen separaten Plattform-Admin-Client nur für Instanz-Provisioning, Reconcile und explizites Break-Glass.
8. Beim Löschen einer Custom-Rolle entfernt der Service nach erfolgreichem Tenant-Sync zuerst direkte Benutzer- und Gruppenzuordnungen der Rolle und danach das lokale IAM-Mapping.
9. Die Admin-UI zeigt vor dem Bestätigen nur eine allgemeine Warnung an, dass damit auch bestehende Benutzer- und Gruppenzuordnungen entfernt werden.
10. Bei Erfolg werden `role.sync_succeeded` und `role.created|updated|deleted` auditierbar protokolliert; der Löschpfad ergänzt dabei Zähler für entfernte Benutzer- und Gruppenzuordnungen.
11. Bei Fehlern werden `sync_state`, `last_error_code`, Metriken und `role.sync_failed` aktualisiert.

Fehlerpfad:

- Nicht autorisierte Rollen werden via Route-Guard umgeleitet.
- Last-Admin-/Self-Protection wird serverseitig mit Konfliktantwort geschützt.
- Fehlen tenantlokaler Admin-Client oder tenantlokales Secret, schlagen Tenant-Mutationen fail-closed mit `tenant_admin_client_not_configured` oder `tenant_admin_client_secret_missing` fehl.
- Schlägt der DB-Schritt nach erfolgreichem Keycloak-Write fehl, läuft eine Compensation; misslingt auch diese, bleibt der Vorgang als `COMPENSATION_FAILED` sichtbar.

### Szenario 9a: Manueller Keycloak-User-Sync mit Realm-gebundener Projektion

1. Ein Admin ruft `POST /api/v1/iam/users/sync-keycloak` auf.
2. Der Service löst den fachlichen Ziel-Realm pro Instanz aus `iam.instances.authRealm` auf und verwendet fuer normale Tenant-Syncs ausschliesslich den tenantlokalen Adminpfad aus `tenantAdminClient`.
3. Der Import lädt Keycloak-Benutzer seitenweise und projiziert sie deterministisch nach `iam.accounts` und `iam.instance_memberships`.
4. Läuft der Import bereits gegen einen instanzspezifischen Realm, werden Benutzer ohne explizites `instanceId`-Attribut trotzdem dem aktiven Instanzkontext zugeordnet.
5. Nicht passende Benutzer werden nur bei aktivem Debug-Level begrenzt geloggt; das Log enthält `subject_ref`, `user_instance_id` und `expected_instance_id`.
6. Die API-Antwort und das Summary-Log enthalten knappe Diagnostik zum verwendeten Realm, zur Provider-Quelle, zum `executionMode` und zu übersprungenen Instanz-IDs.

Fehlerpfad:

- Bei großen Batches bleiben Detail-Logs gecappt; die Diagnose erfolgt dann primär über das Summary-Log und die additiven Sync-Diagnosefelder.
- Ein fehlender tenantlokaler Adminpfad wird nicht mehr durch einen globalen Fallback kaschiert.

### Szenario 10: Geplanter oder manueller Rollen-Reconcile-Lauf

1. `system_admin` triggert `POST /api/v1/iam/admin/reconcile` oder der Scheduler startet den Lauf über `IAM_ROLE_RECONCILE_INTERVAL_MS`.
2. Der Service lädt studio-verwaltete Rollen aus `iam.roles` und den aktuellen Realm-Rollenbestand aus Keycloak.
3. Fehlende Keycloak-Rollen werden erstellt, abweichende Beschreibungen oder Anzeigenamen werden aktualisiert.
4. Orphaned, studio-markierte Keycloak-Rollen werden nur als `requires_manual_action` gemeldet.
5. Das Ergebnis wird als Report zurückgegeben, über Audit-Events geschrieben und über `iam_role_drift_backlog` messbar gemacht.

Fehlerpfad:

- Fehlt die Keycloak-Verbindung oder der Service-Account hat zu wenige Rechte, endet der Lauf mit `keycloak_unavailable`.
- Einzelne Rollen können im Report als `failed` auftauchen, ohne den gesamten Drift-Kontext zu verlieren.

### Szenario 10a: Tenant-Rollenverwaltung blendet Root-only-Artefakte fail-closed aus

1. `system_admin` öffnet `/admin/roles` oder `/admin/users/$userId` auf einem Tenant-Host.
2. Der Backend-Service liefert ausschließlich tenantseitig sichtbare Rollen und Permissions; `instance_registry_admin` und `instance.registry.manage` bleiben im Tenant-Katalog unsichtbar.
3. Versucht ein API-Client dennoch, Root-only-Permissions in einer Tenant-Rolle zu speichern, antwortet der Server bereits vor dem Keycloak-Write mit `invalid_request`.
4. Historische Altrollen aus früheren Seeds bleiben in Bestandsinstanzen nur so lange sichtbar, bis Cleanup-, Repair- oder manuelle Migrationspfade sie ersetzt oder neutralisiert haben; neue Default- oder Systemrollen entstehen daraus nicht mehr.

Fehlerpfad:

- Tenantseitige Altartefakte aus früheren Seeds oder manuellen Zuweisungen werden durch die Cleanup-Migration neutralisiert und verlieren ihre wirksamen Permission-Zuordnungen.
- Root-/Plattformrechte eskalieren nicht über Tenant-Rollen, Gruppen oder Permission-Snapshots in den Plattform-Scope.

### Szenario 11: Zielpackage-Fassaden delegieren in Fachkern

1. Routing oder ein externer Konsument importiert eine stabile Zielpackage-Fassade wie `@sva/auth-runtime/server`, `@sva/iam-admin`, `@sva/iam-governance` oder `@sva/instance-registry`.
2. Die Fassade delegiert in fachliche Bausteine des jeweiligen Zielpackages.
3. Der Fachbaustein orchestriert Request-Handling, Authentifizierungskontext, Autorisierung und Response-Mapping über injizierte Runtime-Dependencies.
4. Alte Sammelpackage-Fassaden bleiben nur als Kompatibilitätsadapter bestehen und begründen keine neue fachliche Ownership.

Fehlerpfad:

- Bleibt Restkomplexität im `core.ts` bestehen, wird sie über `QUAL-*`-Tickets im Complexity-Gate nachverfolgt und nicht stillschweigend toleriert.

### Szenario 12: Admin verwaltet Organisationen

1. `system_admin` oder ein anderer tenantlokal berechtigter Admin öffnet `/admin/organizations`.
2. Die UI lädt `GET /api/v1/iam/organizations` und erhält ein instanzgebundenes Read-Model mit Parent-, Typ- und Zählerdaten.
3. Beim Anlegen oder Bearbeiten sendet die UI `POST` oder `PATCH /api/v1/iam/organizations/:organizationId`.
4. Der Server validiert Instanzscope, Parent-Bezug, Zyklusfreiheit, CSRF-Contract und Deaktivierungsregeln.
5. Bei Erfolg schreibt der Service Organisationsdaten, emittiert Audit- und Betriebslogs und liefert das aktualisierte Read-Model zurück.
6. Membership-Änderungen laufen über die dedizierten Membership-Endpunkte und aktualisieren anschließend die Detailansicht.

Fehlerpfad:

- Parent aus fremder Instanz oder Zyklusversuch führt zu einer deterministischen Konflikt- oder Validierungsantwort.
- Löschung mit aktiven Children wird fail-closed abgewiesen; Memberships blockieren den Löschpfad nicht.

### Szenario 13: Benutzer wechselt aktiven Organisationskontext

1. Die Shell lädt `GET /api/v1/iam/me/context` und erhält aktiven Kontext plus zulässige Organisationsoptionen.
2. Der Org-Switcher rendert die Optionen nur für aktive Mitgliedschaften und kündigt den aktuellen Zustand über eine Live-Region an.
3. Beim Wechsel sendet die UI `PUT /api/v1/iam/me/context` mit der gewählten `organizationId`.
4. Der Server validiert CSRF-Contract, Session, Instanzscope, Membership und Aktivstatus der Zielorganisation.
5. Bei Erfolg wird der aktive Kontext serverseitig in der Session aktualisiert und ein Audit-/Betriebsereignis für `organization_context_switched` erzeugt.

### Ergänzung 2026-03: Produktionsnahe Release-Validierung

1. Ein Release-Workflow baut genau ein `linux/amd64`-Image und ermittelt den Manifest-Digest.
2. `Studio Image Verify` startet exakt dieses Image isoliert im Runner und prüft `/health/live`, `/health/ready` und `/`.
3. Der lokale Operator-Einstieg `env:release:studio:local` fuehrt danach `env:precheck:studio`, `env:deploy:studio` und `env:smoke:studio` gegen denselben Digest aus; `env:precheck:studio` dokumentiert zusätzlich, ob ein passendes `Studio Image Verify`-Artefakt fuer diesen Digest vorliegt.
4. Nach optionaler Migration wird der Stack aktualisiert.
5. `internal-verify` kombiniert interne HTTP-Probes gegen den App-Service mit `doctor`-Diagnostik.
6. `external-smoke` prüft öffentliche URL, Health-Pfade, Auth-Entry und IAM-Kontext.
7. Erst danach wird eine technische `release-decision` erzeugt und als Artefakt persistiert.

Fehlerpfad:

- Fehlschlag vor dem Rollout bleibt auf `config`, `image` oder `migration` klassifiziert.
- Fehlschlag nach erfolgreichem Stack-Update, aber vor öffentlicher Verifikation, bleibt als `health` oder `ingress` sichtbar und wird nicht als erfolgreicher Release bewertet.
- Fehlende Image-Verify-Evidenz fuer einen expliziten Digest ist mindestens ein Warnsignal im Precheck und darf nicht als stiller Erfolgsfall verschwinden.
6. Nachgelagerte UI- und Backend-Pfade lesen den aktiven Organisationskontext aus dem kanonischen Sessionzustand.

### Szenario 14: Admin verwaltet Gruppen und weist Rollenbündel zu

1. `system_admin` öffnet `/admin/groups`.
2. Die UI lädt `GET /api/v1/iam/groups` und erhält instanzgebundene Gruppen inklusive Rollenbündeln und Mitgliederzahl.
3. Beim Anlegen oder Bearbeiten sendet die UI `POST` oder `PATCH /api/v1/iam/groups/:groupId` mit `groupKey`, `displayName`, optionaler Beschreibung und `roleIds`.
4. Der Server validiert Instanzscope, CSRF, Idempotency und dass alle referenzierten Rollen in derselben Instanz existieren.
5. Bei Erfolg persistiert der Service `iam.groups` und `iam.group_roles`, schreibt Audit-/Betriebslogs und invalidiert Permission-Snapshots über `pg_notify`.
6. `DELETE /api/v1/iam/groups/:groupId` deaktiviert die Gruppe fail-closed statt sie physisch zu löschen.

Fehlerpfad:

- Unbekannte oder instanzfremde Rollen führen zu `invalid_request`.
- Fehlende Admin-Rolle oder deaktiviertes IAM-Admin-Feature führt zu `forbidden` oder `feature_disabled`.
- Datenbankfehler werden als `database_unavailable` bzw. `internal_error` nach außen stabilisiert.

### Szenario 15: Gruppenzuweisung erweitert effektive Rechte eines Benutzers

1. Ein Admin öffnet `/admin/users/:userId` und lädt `GET /api/v1/iam/users/:userId`.
2. Die Detailansicht zeigt direkte Rollen, Gruppenmitgliedschaften, deren Herkunft (`manual|seed|sync`) und Gültigkeitsfenster.
3. Beim Speichern sendet die UI `PATCH /api/v1/iam/users/:userId` additiv mit `groupIds`.
4. Der Backend-Service validiert alle Gruppen im aktiven `instanceId`-Scope und ersetzt die aktiven Einträge in `iam.account_groups`.
5. Anschließend wird ein `user_group_changed`-Invalidation-Event emittiert; der nächste `GET /iam/me/permissions`- oder `POST /iam/authorize`-Aufruf recomputet den Snapshot.
6. Transparenzansichten zeigen die daraus abgeleiteten Rechte mit `sourceRoleIds`, `sourceGroupIds`, Provenance der Quelle und der expliziten Laufzeitklassifikation `runtimeScope` an.

Fehlerpfad:

- Nicht existente Gruppen oder instanzfremde IDs werden mit `invalid_request` abgewiesen.
- Läuft die Invalidation nicht sofort durch, begrenzen TTL und Recompute den Stale-Zeitraum fail-closed.

### Szenario 15a: Admin pflegt direkte Nutzerrechte

1. Ein Admin öffnet `/admin/users/:userId` und wechselt in den Tab `Berechtigungen`.
2. Die UI lädt den globalen Permission-Katalog sowie die direkten Nutzerrechte aus `GET /api/v1/iam/users/:userId`.
3. Pro Permission wird eine direkte Wirkung `nicht gesetzt`, `allow` oder `deny` gewählt und mit `PATCH /api/v1/iam/users/:userId` gespeichert.
4. Der Server validiert die referenzierten `permissionId`s instanzgebunden und ersetzt die aktiven Einträge in `iam.account_permissions`.
5. Anschließend wird ein `user_permission_changed`-Invalidation-Event emittiert; der nächste `GET /iam/me/permissions`- oder `POST /iam/authorize`-Aufruf recomputet den Snapshot.
6. `me/permissions` und `authorize` liefern die Quelle als `direct_user`; direkte `deny`-Einträge schlagen konfliktäre Allows aus Rollen oder Gruppen deterministisch.

Fehlerpfad:

- Unbekannte Permissions oder doppelte Zuordnungen im Payload werden mit `invalid_request` abgewiesen.
- Fehlt der Admin-Kontext oder ist die Zielperson außerhalb des zulässigen Manage-Scope, endet der Vorgang fail-closed mit `forbidden`.
- Reine Nutzerrechte-Änderungen schreiben nur Studio-IAM-Daten und lösen keinen Keycloak-Write aus.

### Szenario 15b: Admin legt einen Benutzer gruppenbasiert an

1. Ein Admin öffnet `/admin/users/new`.
2. Die UI bietet primär aktive Gruppen der aktuellen Instanz zur Auswahl an und führt direkte Rollen als optionale erweiterte Einstellung.
3. Beim Speichern sendet die UI `POST /api/v1/iam/users` mit Basisprofil, optionalen `groupIds`, optionalen additiven `roleIds` und optional `sendPasswordSetupEmail`.
4. Der Backend-Service erstellt zuerst die Identität in Keycloak und schreibt danach Account, Membership, Gruppenmitgliedschaften und direkte Rollen im Instanzkontext.
5. Gruppen- und Rollenänderungen invalidieren die Permission-Snapshots des neuen Benutzers deterministisch über `user_group_changed` und `user_role_changed`.
6. Wenn angefordert, stößt der Service anschließend die Keycloak-Einladungs-E-Mail zum Passwortsetzen an.

Fehlerpfad:

- Unbekannte oder instanzfremde Gruppen werden fail-closed mit `invalid_request` abgewiesen.
- Scheitert der lokale Persistenzschritt nach erfolgreicher Keycloak-Anlage, deaktiviert der Service den externen Benutzer kompensierend.
- Fehlschlägt nur die Einladungs-E-Mail, bleibt die Benutzeranlage erfolgreich und markiert den Einladungstatus als `failed`.

### Szenario 16: Authorize wertet Geo-Hierarchie mit restriktiver Priorität aus

1. Client oder interne Serverlogik ruft `POST /iam/authorize` mit `instanceId`, `action`, `resource` und optional `context.attributes.geoHierarchy` bzw. `resource.attributes.geoUnitId` auf.
2. Die Auth-Middleware validiert Session und Tenant-Kontext, darf dafuer aber bei wiederholten Requests derselben Session kurzlebige In-Process-Caches fuer Session-Resolution und Account-Lifecycle-Pruefung nutzen (`TTL 500 ms`).
3. Der Server lädt effektive Permissions aus direkten Rollen und gruppenvermittelten Rollen und normalisiert `sourceKinds`.
4. Die Engine prüft zuerst Instanzscope und Hard-Deny-Regeln, danach passende RBAC-Kandidaten für `action`, `resourceType`, `resourceId` und Organisationshierarchie.
5. Für Geo-Scopes wertet sie `allowedGeoUnitIds` gegen `geoHierarchy` bzw. `geoUnitId` aus; Parent-Allows dürfen auf Children vererben.
6. `restrictedGeoUnitIds` werden mit derselben Hierarchie aufgelöst; ein spezifischerer Child-Deny schlägt den Parent-Allow deterministisch.
7. Die Antwort enthält neben `allowed` und `reason` auch `diagnostics.stage` sowie Provenance-Felder wie `inheritedFromGeoUnitId` oder `restrictedByGeoUnitId`.

Fehlerpfad:

- Fehlen erforderliche Geo-Attribute trotz `requireGeoScope`, wird der Kandidat verworfen und die Entscheidung endet fail-closed.
- `instanceId`-Mismatch führt immer zu `instance_scope_mismatch`, bevor weitere Scope- oder Rollenregeln ausgewertet werden.

Fehlerpfad:

- Ungültige oder deaktivierte Zielorganisationen liefern einen stabilen Fehlercode; der bisherige Kontext bleibt unverändert.
- Technische Fehler werden im Org-Switcher verständlich, internationalisiert und ohne inkonsistenten Zwischenzustand angezeigt.

### Szenario 14: Separates IAM-Acceptance-Gate

1. Ein dedizierter Runner validiert Pflicht-Env, Testrealm und Testbenutzer gegen Keycloak.
2. Vor dem Lauf werden Acceptance-spezifische IAM-Datensätze und Organisationsartefakte in der Testumgebung kontrolliert zurückgesetzt.
3. Der Runner prüft `GET /health/ready` fail-closed auf Datenbank, Redis, Keycloak und den Tenant-Login-Vertrag aktiver Instanzen.
4. Browsergestützte OIDC-Logins validieren `/auth/me`, Claims und JIT-Provisioning.
5. API- und UI-Smokes prüfen Organisations-CRUD, Membership-Zuweisung und Sichtbarkeit in den Admin-Oberflächen.
6. Der Lauf schreibt einen versionierten JSON-/Markdown-Bericht nach `docs/reports/`.

Fehlerpfad:

- Fehlende Pflicht-Env oder fehlende Testbenutzer beenden den Lauf vor dem Browserstart.
- Nicht bereite Dependencies oder fehlerhafte Laufzeitnachweise erzeugen deterministische Failure-Codes im Bericht.

### Szenario 15: Serverseitige Mainserver-Diagnostik mit organisationsbezogener Delegation

1. Ein berechtigter Studio-Benutzer löst eine serverseitige Mainserver-Funktion aus.
2. Die App prüft lokal Rollen und aktiven `instanceId`-Kontext, bevor ein Upstream-Call gestartet wird.
3. `@sva/sva-mainserver/server` lädt die aktive Endpunktkonfiguration für die Instanz aus `iam.instance_integrations`.
4. Ein dedizierter Credential-Resolver prüft `contentAuthorPolicy` und den aktiven Organisationskontext: bei `org_only` werden ausschließlich organisationsgebundene Credentials geladen, bei `org_or_personal` sind persönliche Keycloak-Attribute nur Fallback.
5. Ein separater Token-Provider fordert per OAuth2-Client-Credentials ein Access-Token an und cached es kurzlebig pro `(instanceId, keycloakSubject, activeOrganizationId, credentialSignature)`.
6. Ein eigener GraphQL-Transportbaustein sendet danach den serverseitigen Request an den SVA-Mainserver; `request_id` und `trace_id` werden als Korrelation weitergereicht.
7. Die Server-Funktion gibt ein kuratiertes Diagnose-Read-Model an die App zurück; Credentials oder rohe Upstream-Fehlerdetails verlassen den Server nicht.

Fehlerpfad:

- Fehlende lokale Studio-Berechtigung blockiert den Aufruf vor dem Upstream-Zugriff.
- Fehlende organisationsgebundene Credentials bei `org_only` liefern einen stabilen Fehlerzustand wie `organization_mainserver_credentials_missing`.
- Fehlende persönliche Keycloak-Attribute liefern nur dann `missing_credentials`, wenn auch kein zulässiger organisationsgebundener Pfad greift.
- `401`/`403` vom Mainserver werden in deterministische Integrationsfehler übersetzt; Netzwerk- oder Tokenfehler bleiben fail-closed.

### Ergänzung 2026-03: Strukturierte Permission-Vererbung im Recompute-Pfad

1. `POST /iam/authorize` oder `GET /iam/me/permissions` löst bei Cache-Miss den Permission-Store aus.
2. Der Store lädt strukturierte Permission-Felder (`action`, `resource_type`, `resource_id`, `effect`, `scope`) zusammen mit Rollen- und Membership-Kontext.
3. Bei org-spezifischen Anfragen werden Parent-Mitgliedschaften über `hierarchy_path` des Zielkontexts aufgelöst.
4. Die Engine prüft zuerst Matching von `action`, `resource_type` und optionaler `resource_id`.
5. Danach werden `deny`-Permissions vor `allow`-Permissions ausgewertet; lokale Restriktionen können vererbte Parent-Freigaben blockieren.
6. Anschließend werden ABAC-Attribute wie Geo-Scope, Acting-As und Restriktionslisten gegen den Requestkontext ausgewertet.
7. Das Ergebnis wird als effektiver Permission-Snapshot mit Scope-Daten gecacht.

Fehlerpfad:

- Fehlen strukturierte Felder noch in Alt-Daten, greift der Kompatibilitätspfad über `permission_key`.
- Widersprechen `allow` und `deny`, gewinnt deterministisch die restriktivere Regel.

### Ergänzung 2026-03: IAM-Transparenz-Cockpit und Privacy-Self-Service

1. Admin öffnet `/admin/iam?tab=rights|governance|dsr` oder Benutzer `/account/privacy`.
2. Die Route validiert und kanonisiert den Tab über Search-Parameter; unzulässige Tabs werden per `replace` auf den ersten erlaubten Tab umgelenkt.
3. Nur der aktive Tab lädt Daten: Rights über `GET /iam/me/permissions`, Governance über `GET /iam/governance/workflows`, DSR über `GET /iam/admin/data-subject-rights/cases`, Self-Service über `GET /iam/me/data-subject-rights/requests`.
4. User-Historie unter `/admin/users/:userId` lädt die vereinte Actor+Target-Timeline über `GET /api/v1/iam/users/:userId/timeline`.
5. Die UI rendert nur normalisierte Read-Modelle; Rohstatus oder Diagnosefelder bleiben sekundär und allowlist-basiert.

Fehlerpfad:

- Fehlende Rollen blockieren die Route oder den Tab fail-closed.
- Bei 403 auf Transparenz-Reads invalidiert die UI den Session-/Permission-Kontext.

### Ergänzung 2026-03: Instanz-Host-Validierung im Multi-Host-Betrieb

> Hinweis: Dieser Abschnitt beschreibt den Soll-Zustand. Die vollständige
> Verdrahtung als zentraler Request-Guard (403 + Kontext-Propagation) ist als
> Folgearbeit geplant.

1. Eingehende Anfrage trifft Traefik, wird über `HostRegexp` an den App-Service geroutet.
2. App extrahiert den Host-Header und normalisiert ihn (Lowercase, Port-Stripping, Trailing-Dot).
3. Host wird gegen die Parent-Domain und die zentrale Instanz-Registry geprüft:
   - Root-Domain → Kanonischer Auth-Host, `instanceId = null`
   - Gültige Instanz-Subdomain → `instanceId` aus Subdomain abgeleitet
   - Ungültiger oder unbekannter Host → `403` mit identischem Body (`{ error, message }` + `X-Request-Id`)
4. Bei Auth-Endpunkten auf Instanz-Hosts: fail-closed, Redirect zum kanonischen Auth-Host.
5. Gültige `instanceId` wird im Request-Kontext propagiert (analog zu `workspace_id` in AsyncLocalStorage), sobald der zentrale Request-Guard verdrahtet ist.

Fehlerpfad:

- Bei fehlender `SVA_PARENT_DOMAIN` (Entwicklungsmodus) wird die Host-Validierung übersprungen.
- Bei lokalen oder migrationsbezogenen Fallback-Pfaden bricht die App bei ungültigen Einträgen in `SVA_ALLOWED_INSTANCE_IDS` weiterhin fail-fast ab.

### Ergänzung 2026-06: POI-Ort- und Medienfluss

1. Redaktion öffnet `/admin/poi/$id` oder den Create-Pfad; `PoiDetailPage` lädt POI-Daten, Host-Media-Assets und bestehende Media-Referenzen getrennt.
2. Im Bereich `Ort` fragt der Browser zunächst die hostseitige Map-Konfiguration ab und verwendet danach nur die normierten IAM-Endpunkte für Adresssuche oder Reverse-Geocoding.
3. Ein übernommener Treffer synchronisiert Adressfelder sowie Koordinaten; Geocoding-Fehler bleiben lokal im Bereich und blockieren den restlichen Editor nicht.
4. Im Bereich `Medien & Dateien` startet ein Upload den Host-Flow `initialize -> signed PUT -> complete`; danach wird die Asset-Liste neu geladen und als Referenz auswählbar gemacht.
5. Beim Speichern persistiert der Editor den strukturierten POI-Write-Pfad zuerst im Mainserver und schreibt anschließend die Host-Media-Referenzen für Teaser und zusätzliche Medien.
