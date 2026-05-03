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
3. Beim Aufruf der Liste liest die Route typsichere Search-Params wie `page` und `pageSize`, normalisiert sie und hält damit URL, Browser-Historie und Listen-Navigation synchron.
4. Der Host wendet den registrierten Plugin-Guard an, zum Beispiel `news.read`, `events.read` oder `poi.read`, und rendert optional die spezialisierte Plugin-Fläche innerhalb der Host-Shell.
5. Die Fachlisten rufen ihre Host-Fassaden auf: `/api/v1/mainserver/news`, `/api/v1/mainserver/events` oder `/api/v1/mainserver/poi`; lokale IAM-Contents werden nicht mehr produktiv gelesen.
6. Die Host-Fassaden delegieren serverseitig an `@sva/sva-mainserver`, liefern nur die angeforderte Seite und serialisieren `pagination.page`, `pagination.pageSize` sowie `pagination.hasNextPage`.
7. `apps/sva-studio-react/src/server.ts` bleibt bewusst Owner für Request-Matching, Dispatch-Reihenfolge und TanStack-Start-/Nitro-Transport, während die fachlichen News-, Event-, POI- und Interfaces-Verträge in Packages liegen.
8. Die Editoren senden Create-, Update- und Delete-Requests an die jeweilige Fassade und Detailroute.
9. Die App-Fassade prüft Session, `instanceId`, plugin-spezifische IAM-Permission und Mainserver-Credentials serverseitig.
10. `@sva/sva-mainserver/server` führt typisierte GraphQL-Operationen für News, Events und POI mit Benutzer-Credentials aus.
11. News nutzt das vollständige Mainserver-Modell mit dedizierten Feldern; Events und POI nutzen eigene Mapping-Adapter für Termine, Adressen, Kontakte, URLs, Medien, Preise, Barrierefreiheit, Tags und POI-Bezug.
12. Es gibt keinen Dual-Write und keine Legacy-Migration in lokale IAM-Contents.
13. Nach erfolgreichem Speichern oder Löschen zeigt die host-owned Route Statusfeedback und navigiert zurück zur jeweiligen Admin-Liste.

Fehlerpfad:

- fehlt die Berechtigung, blendet die Shell die Admin-Navigation fail-closed aus, blockiert der Host die Admin-Route vor dem Rendern oder verweigert die serverseitige Mutation mit `capability_authorization_denied` im Diagnosekontext.
- kann der Host keinen belastbaren Gesamtzähler ermitteln, bleibt `pagination.total` leer; die Navigation verlässt sich ausschließlich auf `hasNextPage`.
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
6. App ruft `/auth/me` fuer minimalen Auth-Kontext (`id`, `instanceId`, Rollen)
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
5. Ohne Blocker führt `packages/iam-admin` den Sync oder Reconcile deterministisch aus und trennt pro Eintrag zwischen korrigiert, fehlgeschlagen und fachlichem Restzustand `manual_review`.
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
2. `packages/auth-runtime` lädt effektive Permissions und die kanonische Liste `assignedModules` aus der Registry; modulbezogene Baseline-Verträge stammen aus `@sva/studio-module-iam`.
3. Die Client-Shell speichert diese Modulliste im Session-Kontext.
4. Beim Aufruf einer Plugin-Route prüft `@sva/routing` zuerst den deklarativen Guard und danach die Modulzuweisung.
5. Die Sidebar blendet Plugin-Navigation aus, wenn das Modul der aktiven Instanz nicht zugewiesen ist.
6. Bei Modulzuweisung oder Entzug rekonstruiert `packages/instance-registry` die IAM-Basis aus derselben Vertragsfamilie und invalidiert betroffene Registry-Caches.

Fehlerpfad:

- fällt der Modul-Lookup im Session-Pfad aus, wird `assignedModules` fail-closed als leer behandelt.
- fehlt die Zuweisung, blockiert das Routing die Plugin-Route vor dem Rendern.
- direkte API-Aufrufe bleiben zusätzlich durch fehlende modulbezogene Permissions abgesichert.

### Szenario 2f: Keycloak-first User- und Rollenverwaltung

1. `/admin/users` und `/admin/roles` laden Listen über den aktiven Keycloak-Admin-Pfad.
2. Im Platform-Scope wird nur der Platform-Admin-Keycloak-Client verwendet.
3. Im Tenant-Scope wird nur der Tenant-Admin-Keycloak-Client der Instanz verwendet; fehlt dieser, endet der Request mit `tenant_admin_client_not_configured`.
4. Tenant-Userlisten lesen den vollständigen Realm-Ausschnitt aus Keycloak und verbinden ihn anschließend mit Studio-Read-Models.
5. Keycloak-Objekte ohne Studio-Zuordnung bleiben als `unmapped` oder `manual_review` sichtbar.
6. Mutierende Aktionen schreiben zuerst Keycloak, synchronisieren anschließend Studio-Read-Models und erzeugen Audit-Events.
7. Read-only- oder blockierte Objekte werden in der UI mit Diagnosecode angezeigt und serverseitig erneut vor der Mutation geprüft.

Fehlerpfad:

- Keycloak `403` wird als `IDP_FORBIDDEN` beziehungsweise `idp_forbidden` eingeordnet.
- föderierte oder profilrichtliniengeschützte Felder werden als `read_only_federated_field` sichtbar und nicht überschrieben.
- verbotene Rollenzuordnungen werden als `forbidden_role_mapping` sichtbar.
- Built-in-Rollen bleiben als Rollenobjekt read-only, dürfen aber abhängig von der aktiven Rechte-Matrix zugewiesen oder entfernt werden.

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

1. Client ruft `POST /iam/authorize` mit `instanceId`, `action`, `resource` und optionalem ABAC-Kontext auf; `GET /iam/me/permissions` nutzt denselben Snapshot-Pfad optional mit `organizationId`, `geoUnitId` und `geoHierarchy`.
2. Server erzwingt Instanzgrenze und wertet Hard-Deny-Regeln zuerst aus.
3. Permission-Snapshot wird zuerst im lokalen L1-Cache und danach in Redis über User-/Instanz-/Org-/Geo-Kontext gesucht.
4. Bei Cache-Hit wertet die Engine die Entscheidung in fester Reihenfolge aus: RBAC-Basis, danach ABAC-Regeln und Hierarchie-Restriktionen.
5. Bei Miss, Stale oder Integritätsfehler erfolgt Recompute aus Postgres als fachlicher Quelle; ein erfolgreicher Recompute schreibt zuerst Redis und danach den L1-Cache.
6. Bei Redis- oder Recompute-Fehler im sicherheitskritischen Pfad greift Fail-Closed mit HTTP `503` und Fehlercode `database_unavailable`.

Fehlerpfad:

- Eventverlust bei Invalidation: TTL begrenzt die Stale-Dauer; ein stale Snapshot darf bei technischem Fehler nicht fachlich weiterverwendet werden.
- DB-Ausfall ohne nutzbaren Snapshot: `503 database_unavailable`.

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
6. Aenderungen werden ueber `PATCH /api/v1/iam/users/me/profile` gespeichert.

Fehlerpfad:

- JIT-Fehler blockiert den Login nicht, wird aber strukturiert geloggt.
- Profil-Update ohne gueltigen CSRF-Header wird serverseitig abgewiesen.
- Session und Autorisierung bleiben auch bei temporaer nicht verfuegbaren Profildaten stabil, da Name/E-Mail nicht Teil des Session-Kerns sind.

### Szenario 9: Admin-Flow User- und Rollenverwaltung

1. `system_admin`/`app_manager` öffnet `/admin/users`.
2. Liste wird paginiert über `GET /api/v1/iam/users` geladen.
3. Bearbeitung erfolgt in `/admin/users/$userId` per Tabs und `PATCH /api/v1/iam/users/$userId`.
4. Rollen-Änderungen triggern Permission-Invalidierung über `pg_notify`.
5. `system_admin` verwaltet Custom-Rollen auf `/admin/roles` mit `POST/PATCH/DELETE /api/v1/iam/roles`.
6. Auf Tenant-Hosts löst der Backend-Service den Adminpfad strikt aus `iam.instances.authRealm` plus `tenantAdminClient.clientId` und tenantlokalem Admin-Secret auf und führt Rollen- und Nutzer-CRUD Keycloak-First innerhalb desselben Tenant-Realms aus.
7. Root-/Plattform-Pfade verwenden einen separaten Plattform-Admin-Client nur für Instanz-Provisioning, Reconcile und explizites Break-Glass.
8. Nach erfolgreichem Tenant-Sync schreibt der Service das lokale IAM-Mapping.
9. Bei Erfolg werden `role.sync_succeeded` und `role.created|updated|deleted` auditierbar protokolliert.
10. Bei Fehlern werden `sync_state`, `last_error_code`, Metriken und `role.sync_failed` aktualisiert.

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

### Szenario 11: Zielpackage-Fassaden delegieren in Fachkern

1. Routing oder ein externer Konsument importiert eine stabile Zielpackage-Fassade wie `@sva/auth-runtime/server`, `@sva/iam-admin`, `@sva/iam-governance` oder `@sva/instance-registry`.
2. Die Fassade delegiert in fachliche Bausteine des jeweiligen Zielpackages.
3. Der Fachbaustein orchestriert Request-Handling, Authentifizierungskontext, Autorisierung und Response-Mapping über injizierte Runtime-Dependencies.
4. Alte Sammelpackage-Fassaden bleiben nur als Kompatibilitätsadapter bestehen und begründen keine neue fachliche Ownership.

Fehlerpfad:

- Bleibt Restkomplexität im `core.ts` bestehen, wird sie über `QUAL-*`-Tickets im Complexity-Gate nachverfolgt und nicht stillschweigend toleriert.

### Szenario 12: Admin verwaltet Organisationen

1. `system_admin` oder berechtigter `app_manager` öffnet `/admin/organizations`.
2. Die UI lädt `GET /api/v1/iam/organizations` und erhält ein instanzgebundenes Read-Model mit Parent-, Typ- und Zählerdaten.
3. Beim Anlegen oder Bearbeiten sendet die UI `POST` oder `PATCH /api/v1/iam/organizations/:organizationId`.
4. Der Server validiert Instanzscope, Parent-Bezug, Zyklusfreiheit, CSRF-Contract und Deaktivierungsregeln.
5. Bei Erfolg schreibt der Service Organisationsdaten, emittiert Audit- und Betriebslogs und liefert das aktualisierte Read-Model zurück.
6. Membership-Änderungen laufen über die dedizierten Membership-Endpunkte und aktualisieren anschließend die Detailansicht.

Fehlerpfad:

- Parent aus fremder Instanz oder Zyklusversuch führt zu einer deterministischen Konflikt- oder Validierungsantwort.
- Deaktivierung mit aktiven Children oder Memberships wird fail-closed abgewiesen.

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
6. Transparenzansichten zeigen die daraus abgeleiteten Rechte mit `sourceRoleIds`, `sourceGroupIds` und Provenance der Quelle an.

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

### Szenario 16: Authorize wertet Geo-Hierarchie mit restriktiver Priorität aus

1. Client oder interne Serverlogik ruft `POST /iam/authorize` mit `instanceId`, `action`, `resource` und optional `context.attributes.geoHierarchy` bzw. `resource.attributes.geoUnitId` auf.
2. Der Server lädt effektive Permissions aus direkten Rollen und gruppenvermittelten Rollen und normalisiert `sourceKinds`.
3. Die Engine prüft zuerst Instanzscope und Hard-Deny-Regeln, danach passende RBAC-Kandidaten für `action`, `resourceType`, `resourceId` und Organisationshierarchie.
4. Für Geo-Scopes wertet sie `allowedGeoUnitIds` gegen `geoHierarchy` bzw. `geoUnitId` aus; Parent-Allows dürfen auf Children vererben.
5. `restrictedGeoUnitIds` werden mit derselben Hierarchie aufgelöst; ein spezifischerer Child-Deny schlägt den Parent-Allow deterministisch.
6. Die Antwort enthält neben `allowed` und `reason` auch `diagnostics.stage` sowie Provenance-Felder wie `inheritedFromGeoUnitId` oder `restrictedByGeoUnitId`.

Fehlerpfad:

- Fehlen erforderliche Geo-Attribute trotz `requireGeoScope`, wird der Kandidat verworfen und die Entscheidung endet fail-closed.
- `instanceId`-Mismatch führt immer zu `instance_scope_mismatch`, bevor weitere Scope- oder Rollenregeln ausgewertet werden.

Fehlerpfad:

- Ungültige oder deaktivierte Zielorganisationen liefern einen stabilen Fehlercode; der bisherige Kontext bleibt unverändert.
- Technische Fehler werden im Org-Switcher verständlich, internationalisiert und ohne inkonsistenten Zwischenzustand angezeigt.

### Szenario 14: Separates IAM-Acceptance-Gate

1. Ein dedizierter Runner validiert Pflicht-Env, Testrealm und Testbenutzer gegen Keycloak.
2. Vor dem Lauf werden Acceptance-spezifische IAM-Datensätze und Organisationsartefakte in der Testumgebung kontrolliert zurückgesetzt.
3. Der Runner prüft `GET /health/ready` fail-closed auf Datenbank, Redis und Keycloak.
4. Browsergestützte OIDC-Logins validieren `/auth/me`, Claims und JIT-Provisioning.
5. API- und UI-Smokes prüfen Organisations-CRUD, Membership-Zuweisung und Sichtbarkeit in den Admin-Oberflächen.
6. Der Lauf schreibt einen versionierten JSON-/Markdown-Bericht nach `docs/reports/`.

Fehlerpfad:

- Fehlende Pflicht-Env oder fehlende Testbenutzer beenden den Lauf vor dem Browserstart.
- Nicht bereite Dependencies oder fehlerhafte Laufzeitnachweise erzeugen deterministische Failure-Codes im Bericht.

### Szenario 15: Serverseitige Mainserver-Diagnostik mit Per-User-Delegation

1. Ein berechtigter Studio-Benutzer löst eine serverseitige Mainserver-Funktion aus.
2. Die App prüft lokal Rollen und aktiven `instanceId`-Kontext, bevor ein Upstream-Call gestartet wird.
3. `@sva/sva-mainserver/server` lädt die aktive Endpunktkonfiguration für die Instanz aus `iam.instance_integrations`.
4. `@sva/auth-runtime/server` liest `mainserverUserApplicationId` und `mainserverUserApplicationSecret` aus Keycloak-User-Attributen des aktuellen Benutzers; Legacy-Attribute werden nur noch als Fallback berücksichtigt.
5. Die Integrationsschicht fordert per OAuth2-Client-Credentials ein Access-Token an und cached es kurzlebig pro `(instanceId, keycloakSubject, apiKey)`.
6. Danach wird der GraphQL-Request serverseitig an den SVA-Mainserver gesendet; `request_id` und `trace_id` werden als Korrelation weitergereicht.
7. Die Server-Funktion gibt ein kuratiertes Diagnose-Read-Model an die App zurück; Credentials oder rohe Upstream-Fehlerdetails verlassen den Server nicht.

Fehlerpfad:

- Fehlende lokale Studio-Berechtigung blockiert den Aufruf vor dem Upstream-Zugriff.
- Fehlende Keycloak-Attribute liefern einen stabilen Fehlerzustand `missing_credentials`.
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
