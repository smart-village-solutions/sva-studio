# 08 Querschnittliche Konzepte

## Zweck

Dieser Abschnitt sammelt übergreifende Konzepte, die mehrere Bausteine
gleichzeitig beeinflussen.

## Mindestinhalte

- Security- und Privacy-Konzepte
- Logging/Observability-Konzept
- Fehlerbehandlung, Resilienz, i18n und Accessibility-Leitlinien

## Aktueller Stand

### Formular- und Frontend-Test-Foundations

- Neue oder grundlegend überarbeitete Formular-Flows folgen repo-weit dem Standard `react-hook-form` plus `zodResolver`.
- Neue oder grundlegend überarbeitete HTTP-nahe Frontend-Tests folgen repo-weit dem Standard `msw`.
- Modul-Mocks bleiben für rein lokale Logik ohne HTTP-Bezug zulässig, sind aber kein gleichwertiger Ersatz für HTTP-Verhalten.
- Für kritische framework-agnostische Kernlogik wird `fast-check` selektiv über dokumentierte Hotspots und Review-Entscheidungen eingesetzt.
- Legacy- und Spezialausnahmen müssen in `docs/development/studio-foundations-governance.md`, in der konkreten Formularinventur `docs/development/studio-form-migrationsinventur.md` und im PR- oder Arbeitskontext nachvollziehbar dokumentiert werden.
- Coverage-Gates bleiben wichtig, ersetzen aber diese Foundation-Governance nicht.

### Medienmanagement

- Medienzugriffe bleiben mandantengetrennt und hostgeführt.
- Plugins erhalten ausschließlich rollenbasierte Referenzverträge, keine MinIO-/S3-Artefakte.
- Upload, Metadatenänderung, Bildbearbeitung, Delivery und Löschblockierung werden auditierbar verarbeitet.
- Löschungen bleiben fail-closed bei aktiven Referenzen oder unvollständigem Upload-/Processing-Zustand.
- i18n für Medienrollen und Fehlerzustände folgt denselben Dot-Notation-Regeln wie übrige Host- und Plugin-Oberflächen.

### Ad-hoc-PDF-Export im öffentlichen Abfallkalender

- Die PDF-Erzeugung für Waste folgt keinem browserseitigen Renderpfad; Dokumentmodell, Terminauflösung und PDF-Rendering bleiben vollständig serverseitig.
- Das Studio pflegt nur statische PDF-Stamminhalte wie Branding oder Kontakttexte und erzeugt selbst keine PDFs mehr.
- Die führende Persistenz für diese PDF-Stamminhalte liegt im Waste-Schema der angebundenen Supabase-DB; ältere Werte aus `iam.instance_external_interfaces.public_config` dienen nur noch als Legacy-Fallback.
- Die öffentliche Web-App löst den PDF-Export ad hoc für den vollständig aufgelösten Standort, das gewählte Jahr und die gewählten Fraktionen aus.
- Persistente Waste-PDF-Artefakte, deterministische Storage-Schlüssel und wiederverwendbare Delivery-Links sind kein Teil des Zielbilds.

### Hintergrundprozesse und Workflow-Orchestrierung

- Hostseitige Hintergrundprozesse folgen einem runner-agnostischen Plattformvertrag mit zentralem Jobdatensatz im Studio-Postgres.
- Eine erste interne Worker-Implementierung wird bevorzugt mit Graphile Worker umgesetzt, bleibt aber ausdrücklich hinter der Host-Runtime verborgen.
- Der kanonische Jobdatensatz unterscheidet explizit zwischen `source = 'plugin' | 'host'`; Plugin-Operationen und Host-Fachjobs teilen sich dieselbe Lifecycle- und Progress-Infrastruktur.
- Job-Starts, Actor-Kontext, Mandantenbezug, Korrelation, Status, Retry-Metadaten und Fehlerabbildung müssen im Hostvertrag explizit modelliert werden; ad-hoc Hintergrundjobs ohne gemeinsamen Orchestrierungsvertrag sind nicht der Zielpfad.
- Fachliche Worker erhalten einen Host-Context mit `job`, `progressReporter`, `abortSignal`, `logger`, `requestId` und `actorAccountId`; sie kennen weder Graphile-Helper noch direkte Repository-Fabriken.
- Progress ist ein erstklassiger Hostvertrag mit stabilen Feldern für Schritte, Phase, Details und Zeitstempel; Fortschritt darf mehrfach ohne terminalen Statuswechsel geschrieben werden.
- Technische Job-Lifecycle-Events bleiben zunächst hostintern und werden zusammen mit Heartbeat und Job-History zentral persistiert; UI und spätere Integrationen lesen vorerst denselben Polling-Vertrag statt eines Brokers.
- Öffentliche Plugin- und Client-Verträge dürfen keine Graphile-spezifischen Begriffe oder Tabellenkenntnis voraussetzen.
- Self-Service-DSR-Exporte sind der erste Host-Fachjob auf diesem Pfad; der fachliche Exportstatus bleibt in `iam.data_subject_export_jobs`, während `iam.studio_jobs` nur die Orchestrierung trägt.
- Temporal bleibt als spätere Eskalationsoption für komplexere Orchestrierung offen, ist aber noch kein zweiter aktiver Standard.
- Trigger.dev ist für Studio kein zulässiger Workflow-Pfad.
- Outbox, n8n-Anbindung, SSE/WebSocket und Broker-Pfade wie NATS bleiben explizite Folgearbeit hinter derselben Hostgrenze.

### Öffentlicher Waste-Web-Releasevertrag

- Die öffentliche Waste-Webversion ist betriebsseitig strikt vom Studio-Releasepfad getrennt: eigenes Image, eigener Stack, eigener Workflow, eigener Variablenraum.
- Produktive Konfiguration für diesen Pfad wird ausschließlich über getrennte `PUBLIC_WASTE_*`-Variablen modelliert; ein zusammengefasster JSON-Blob ist nur noch lokaler Fallback.
- Git-Tags `waste-web-vX.Y.Z` sind die kanonische Freigabe für diese Bürgeroberfläche; andere Branch- oder Studio-Releases dürfen den Stack `web-waste-calendar` nicht mitverändern.
- Der Portainer-Updatepfad verändert ausschließlich `PUBLIC_WASTE_IMAGE_TAG` und belässt alle übrigen Stack-Variablen unverändert, damit Host, Datenbankpfad und PDF-Konfiguration operativ getrennt steuerbar bleiben.
- Für diesen speziellen Bürger-Frontend-Stack ist bewusst das einfache SemVer-Tag-Modell führend; Digest-Pinning des Studio-Referenzpfads wird hier nicht auf den Waste-Web-Stack übertragen.

### Security und Privacy

- OIDC Authorization Code Flow mit PKCE
- Signiertes Login-State-Cookie (HMAC)
- Session-Cookies: `httpOnly`, `sameSite=lax`, `secure` in Production
- `Session.expiresAt` ist die fachlich führende Session-Gültigkeit; Cookie und Redis-TTL werden daraus abgeleitet
- Sessions bleiben datensparsam und tragen nur Auth-Kern plus Lifecycle-Felder (`issuedAt`, `expiresAt`, `sessionVersion`)
- Optionale Verschlüsselung von Tokens im Redis-Store via `ENCRYPTION_KEY`
- Sessionen führen nur den minimalen Auth-Kern (`sub/id`, `instanceId`, Rollen); Profilattribute wie Name und E-Mail gehören nicht zum Pflichtumfang der Session
- Tenant-Sessions beziehen `instanceId` aus Host, Registry und Realm-Scope. Ein optionaler Token-Claim `instanceId` darf diesen Scope bestätigen, aber nicht ersetzen.
- Forced Reauth pro Benutzer erfolgt über `minimumSessionVersion` und `forcedReauthAt`; Keycloak-Logout ist optional zuschaltbar
- Silent SSO ist nur ein einmaliger Recovery-Versuch nach `401` und wird nach explizitem Logout temporär unterdrückt
- Application-Level Column Encryption für IAM-PII-Felder (`email_ciphertext`, `display_name_ciphertext`)
- Schlüsselverwaltung über `IAM_PII_ACTIVE_KEY_ID` + `IAM_PII_KEYRING_JSON` (außerhalb der DB)
- Secret-Blöcke für externe Schnittstellen werden mit datensatzgebundener AAD verschlüsselt; Browser- und Plugin-Verträge sehen nur konfigurierte Marker, nie Klarwerte oder Ciphertexts.
- Fehlertexte der Feldverschlüsselung enthalten keine internen Key-IDs; technische Key-Kontexte werden nur als strukturierter Fehlerkontext geführt
- Redaction sensibler Logfelder in `@sva/server-runtime` und im OTEL Processor
- Governance-Gates: Ticketpflicht, Vier-Augen-Prinzip, keine Self-Approvals
- Harte Laufzeitgrenzen: Impersonation max. 120 Minuten, Delegation max. 30 Tage
- Impersonation ohne Governance-Export-Capability benötigt zusätzlichen Security-Approver
- DSGVO-Betroffenenrechte im IAM: Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch
- Account-Self-Service trennt bewusst zwischen Aktivitätscockpit (`/account/privacy`) und Regelseite (`/account/rules`); die UI darf beide Bereiche gemeinsam navigierbar machen, ohne DSR- und Governance-Verträge fachlich zu verwischen
- Credential-Self-Service im Studio bleibt bewusst delegierend: Sichtbar angeboten wird derzeit nur der Passwort-Wechsel über den serverseitigen Pfad `/auth/account-action`; das Studio speichert oder validiert Credential-nahe Daten nie selbst. Ein E-Mail-Wechsel wird erst nach Keycloak-seitiger Freischaltung von `UPDATE_EMAIL` wieder exponiert.
- Deep-Links auf einzelne Datenschutzvorgänge laufen immer über einen expliziten `caseId`-Detailread; historische Fälle dürfen nicht aus begrenzten Overview-Listen rekonstruiert werden
- Löschprozess zweistufig: Soft-Delete (SLA <= 48h) und finale Anonymisierung nach Retention
- Davon getrennt existiert ein privilegierter Admin-Hard-Delete nur für Tenant-Accounts: Er verlangt ausschließlich die explizite Permission `iam.accounts.delete`, entfernt die Identität auch in Keycloak und bleibt für Zielaccounts mit `system_admin` gesperrt, bis diese Rolle zuvor entzogen wurde.
- Legal Hold blockiert irreversible Löschschritte bis zur Freigabe
- Art.-19-Nachweisdaten für Empfängerbenachrichtigung werden revisionssicher persistiert
- Trust-Boundary-Validierung mit Zod in IAM-Endpoints (`authorize`, `governance`, `data-subject-rights`)
- Rechtstext-HTML wird serverseitig vor Persistenz sanitisiert; erlaubte Statuswerte bleiben auf `draft`, `valid`, `archived` begrenzt
- Inhaltsverwaltung bleibt im ersten Schnitt auf einen stabilen Core-Kern begrenzt: `title`, `contentType`, `publishedAt`, `createdAt`, `updatedAt`, `author`, `payload`, `status`, `history`
- Inhaltstypen dürfen über das SDK zusätzliche Validierung, UI-Sektionen und Listenmetadaten registrieren, aber keine Core-Semantik oder das Statusmodell überschreiben
- Plugin-Vertrag v1 bleibt statisch und bundlegebunden: Plugins deklarieren Metadaten über `PluginDefinition`, aber weder Runtime-Loading noch Plugin-eigene Sicherheits- oder Routing-Bypässe sind erlaubt
- Im Zielbild der Plugin-Plattform v2 bleiben Manifest, Katalog, Loader und Runtime host-owned. Plugins dürfen diese Verträge konsumieren, aber keine parallelen Aktivierungs-, Routing-, Secret- oder Auditpfade etablieren.
- Externe technische Schnittstellen sind ebenfalls host-owned: Typkatalog, Instanzdatensätze, Default-Regeln, Secret-Verschlüsselung, Statusprojektion und Resolver liegen zentral im Host.
- Plugin-deklarierte `externalInterfaceTypes` beschreiben nur Metadaten und Feldschemas; Persistenz, Secret-Auflösung, Health-Checks und Audit bleiben verpflichtend hostseitig.
- Plugin-Guards werden grundsätzlich hostseitig angewendet; ein Plugin deklariert nur die fachliche Guard-Anforderung und darf keine eigene Autorisierungsschicht am Host vorbei etablieren
- Pluginseitige Request-, Job- und Integrationsbeiträge laufen ausschließlich in host-owned Execution-Contexts mit Auth-, Instanz-, Logger-, Audit- und Fehlervertrag des Hosts
- Plugin-Contributions werden beim Build-time-Snapshot phasenweise gegen Runtime-Allowlists geprüft; eigene Route-Handler, Autorisierungsresolver, Audit-Sinks, Persistenzhandler und dynamische Nachregistrierung werden mit `plugin_guardrail_*`-Codes fail-fast abgewiesen
- Die phasenweise Registry-Erzeugung ordnet bestehende Outputs für Content, Admin, Audit und Routing, führt aber keine neuen Plugin-Beitragstypen oder Breaking-API ein
- Standardisierte Content-Plugins registrieren ihre CRUD-Hauptflächen über `adminResources` mit optionalem `contentUi`-Spezialisierungsblock; `/admin/news`, `/admin/events` und `/admin/poi` sind host-owned Pfade mit pluginseitig beigestellten Fachflächen, nicht plugin-owned Routen
- Dasselbe Pattern gilt jetzt auch für `/admin/surveys`: der Pfad bleibt host-owned, während `@sva/plugin-surveys` nur die fachlichen Listen-/Detail-/Editor-Bindings und UI-Bausteine beisteuert
- Für solche standardisierten Content-Plugins sind produktive CRUD-Hauptrouten unter `/plugins/<namespace>`, `/plugins/<namespace>/new` und `/plugins/<namespace>/$id` ausdrücklich verboten; freie `plugin.routes` bleiben nur für echte Nicht-CRUD-Sonderfälle zulässig
- `contentUi.contentType` muss einen registrierten plugin-eigenen `contentType` referenzieren; Bindings sind auf `list`, `detail` und `editor` begrenzt und dürfen keine Host-Responsibilities wie Guards, Persistenz oder Shell übernehmen
- Plugin-UI und fachliche Client-Interaktion bleiben zulässig, wenn sie in host-materialisierten Routen laufen und hostkontrollierte Actions, Validierung, Persistenz und Auditierung verwenden
- Plugin-Custom-Views müssen gemeinsame Seitenstruktur, Controls, Tabellen, Aktionen und Zustandsdarstellung aus `@sva/studio-ui-react` verwenden; App-interne Komponentenpfade und parallele Basis-Control-Systeme in Plugins sind nicht zulässig
- News laufen produktiv über die hostgeführte Mainserver-News-Fassade; dedizierte Mainserver-Felder und `contentBlocks` sind das Schreibmodell. Legacy-`payload` ist nur Lesefallback, lokale IAM-Content-Validierung ist für News keine Persistenzquelle mehr
- Surveys laufen produktiv über denselben hostgeführten Mainserver-Pfad: Liste, Detail, Upsert, Freitext-Freigabe und Ergebnisabruf bleiben serverseitig gekapselt; das Plugin konsumiert nur hostkontrollierte HTTP-/SDK-Verträge.
- Der Survey-Adapter in `@sva/sva-mainserver` hält bewusst zwei Verträge gleichzeitig stabil: snapshot-nahe Mainserver-Reads/Writes auf `SurveyPoll` sowie das bestehende Studio-Fachmodell im Plugin. Snapshot-Spezifika wie `date` und `payload` bleiben vollständig serverseitig.
- Survey-Studio-only-Felder (`startAt`, `endAt`, `resultVisibility`, `showResultsInApp`, `privacyNotice`, `transparencyNotice`) werden kontrolliert im Survey-`payload` serialisiert und daraus wieder gelesen, bis der Mainserver dafür native Felder bereitstellt.
- Freitext-Löschungen werden nicht mehr als scheinbar unterstützte Mutation emuliert. Wenn das Snapshot-Schema dafür keinen gültigen Input anbietet, antwortet die Host-Fassade explizit mit `501 unsupported_operation`.
- Ergebnisexporte für Surveys sind bewusst Studio-Funktionalität auf Basis des hostgeführten JSON-Ergebnisvertrags. GraphQL liefert keine formatgebundenen Exportartefakte, und das Plugin führt keinen eigenen Export- oder Transformationspfad am Host vorbei ein.
- Survey-UI folgt denselben Frontend- und Accessibility-Grundsätzen wie andere Content-Plugins: gemeinsamer Editor-Rahmen, keine verschachtelten Cards oder inneren Tabs, bestätigte destruktive Aktionen und read-only Historien-/Ergebniszustände außerhalb expliziter Mutationspfade.
- Modulbezogene IAM-Verträge haben genau eine kanonische Vertragsfamilie: Build-time-Host-Registry, Plugin-Deklaration, Runtime-Seeding und Provisioning leiten ihre Daten aus `@sva/studio-module-iam` ab und pflegen keine separaten Parallelkataloge
- Mainserver-Listen für News, Events und POI verwenden typsichere Search-Params als kanonischen UI-State; paginierte Host-Antworten serialisieren mindestens `page`, `pageSize` und `hasNextPage`, während `total` optional bleibt
- DataClient unterstützt optionale Runtime-Schema-Validierung (`get(path, schema)`) für API-Responses
- IAM-Server-Fassaden bleiben bewusst dünn; fachliche Erweiterungen gehören in Unterordner und nicht zurück in Monolith-Dateien
- Profil-Synchronisation mit Keycloak bleibt zulässig, erfolgt aber ausschließlich über dedizierte Profil-/Sync-Flows und nicht implizit über Session- oder Logging-Pfade
- Profilpflege und Credential-Pflege sind getrennte Verträge: lokale Profildaten laufen über IAM-v1-Profilendpunkte, Credential-Änderungen ausschließlich über Keycloak-Required-Actions mit hostkontrolliertem Rücksprungstatus

### IAM Multi-Tenancy, Caching und Audit-Logging

- Mandantenisolation basiert auf kanonischem Scope `instanceId` als fachlichem String-Schlüssel (inkl. Mapping zu `workspace_id` in Logs)
- Im tenant-spezifischen Login ist Host/Registry/Realm die führende Quelle für diesen Scope; ein fehlender benutzerbezogener `instanceId`-Claim blockiert die Session nicht.
- Keycloak ist führend für Authentifizierung, Realm-Zugang und technische Sonderrollen; Postgres ist führend für Studio-verwaltete IAM-Fachdaten inklusive tenantlokaler Rollen, Gruppen und Permissions
- Autorisierungspfade erzwingen `instanceId`-Filterung vor Rollen-/Policy-Evaluation
- Effektive Berechtigungen aggregieren direkte Rollen und gruppenvermittelte Rollen; die Provenance hält `direct_role` und `group_role` als strukturierte Quelle fest
- Rollen-Permission-Zuordnungen koennen fuer explizit scope-faehige Datensatzrechte zusaetzlich einen Assignment-Scope `all|own|organization` tragen; dieser Scope lebt auf `iam.role_permissions.access_scope` und nicht im generischen `iam.permissions.scope`
- `all` bedeutet unveraenderte globale Freigabe innerhalb des Instanzkontexts; `own` bindet die Freigabe an `ownerUserId`; `organization` erweitert `own` um Datensaetze der aktiven Session-Organisation über `ownerOrganizationId`
- Verwaltete Permissions tragen zusätzlich eine explizite Laufzeitklassifikation `runtimeScope = instance | record | organization_context`; nur `record`- und `organization_context`-Rechte werten zusätzlichen Organisations- oder Ownership-Kontext fachlich aus
- Ein aktiver `organizationId`-Kontext ist deshalb kein blanket Projektionssignal für alle effektiven Permissions; instanzweite Rechte wie `media.*`, `waste-management.*`, `app.read` oder `cockpit.read` bleiben im Snapshot- und Transparenzpfad instanzweit
- Scope-faehige Fachmodule muessen fuer Authorize-Entscheidungen die kanonischen Resource-Attribute `ownerUserId` und bei organisationsrelevanten Datensaetzen `ownerOrganizationId` liefern; fehlt dieser Kontext, bleibt die Entscheidung fail-closed
- Mainserver-Projektionen trennen externe Quellidentität (`sourceDataProviderId`, `sourceDataProviderName`, `credentialSource`) von kanonischer IAM-Ownership; DataProvider, Credential-Kontext und aktive UI-Organisation erzeugen keine implizite `ownerOrganizationId`
- Gruppen sind instanzgebundene Rollenbündel (`group_type = role_bundle`); direkte Gruppen-Permissions sind bewusst nicht Teil des ersten Schnitts
- Direkte Nutzerrechte und fachliche `deny`-Permissions sind nicht Teil des Zielmodells; effektive Permissions sind Allow-Grants aus Rollen und Gruppen.
- Gruppenmitgliedschaften werden mit Herkunft (`manual|seed|sync`) und optionalen Gültigkeitsfenstern in `iam.account_groups` geführt
- Geo-Scopes werden kanonisch über `allowedGeoUnitIds` und `restrictedGeoUnitIds` gegen das Read-Modell `iam.geo_units` ausgewertet; `allowedGeoScopes` bleibt nur als Kompatibilitäts-Fallback bestehen
- Geo-Vererbung ist strikt restriktiv: Parent-Allow darf auf Children vererben, ein spezifischer Child-Deny schlägt diesen Allow deterministisch
- Die zentrale Permission Engine arbeitet fail-closed bei fehlendem Kontext, unvollständigen Pflichtattributen oder inkonsistenten Laufzeitdaten
- RLS-Policies und service-seitige Guards verhindern organisationsfremde Datenzugriffe
- Permission-Snapshot-Cache ist instanz- und kontextgebunden; der Leseweg läuft deterministisch über lokalen L1-Cache, Redis-Shared-Read-Path und erst dann Recompute aus Postgres
- Invalidation erfolgt event-first über Postgres `NOTIFY` mit `eventId`; TTL begrenzt Eventverlust, ersetzt aber keinen technischen Failover-Pfad
- Permission-Snapshots sind reine Laufzeitoptimierung und keine fachliche Source of Truth
- Änderungen an direkten Nutzerrechten invalidieren dieselben Snapshot-Pfade wie Rollen- und Gruppenänderungen; Cache-Konsistenz ist damit für `me/permissions` und `authorize` identisch abgesichert
- Audit-Logging für IAM-Ereignisse folgt Dual-Write:
  - Tenant-Scope: `iam.activity_logs` + OTEL via Server-Runtime-Logger
  - Plattform-Scope: `iam.platform_activity_logs` + OTEL via Server-Runtime-Logger
- Audit-Daten enthalten korrelierbare IDs (`request_id`, `trace_id`) und pseudonymisierte Actor-Referenzen
- Der Root-Host ist ein expliziter Plattform-Scope und keine Pseudo-Instanz in `iam.instances`
- Studio-verwaltete Rollen werden über `managed_by = 'studio'` und `instance_id` in der IAM-Datenbank abgegrenzt; Keycloak spiegelt tenantseitig nur die technische Sonderrolle `system_admin`
- Keycloak bleibt von direkten Nutzerrechten fachlich entkoppelt; diese Konfiguration ist ausschließlich Studio-intern und wird nicht in den IdP gespiegelt
- `role_key` ist die stabile technische Identität, `display_name` der editierbare UI-Name
- Rohe Keycloak-Rollen aus `realm_access` werden separat als `keycloakRoles` geführt; tenantseitige Fachautorisierung nutzt ausschließlich IAM-Rollen, Gruppen und Permissions. Nur der technische Tenant-Schnitt `system_admin` bleibt Keycloak-relevant.
- Idempotency-Schlüssel für mutierende IAM-Endpoints sind mandantenspezifisch gescoped: (`instance_id`, `actor_account_id`, `endpoint`, `idempotency_key`)
- Keycloak-Provisioning-Runs nutzen denselben kanonischen Header `Idempotency-Key`, aber einen plattformweiten Run-Scope aus (`instance_id`, `mutation`, `idempotency_key`); der gespeicherte Payload-Fingerprint basiert nur auf stabilen Request-Eingaben, nicht auf aus aktuellem Instanzzustand abgeleiteten Reconcile-Intents.
- Inhalts-Schreibpfade folgen denselben Guardrails: CSRF-Header, Idempotency-Key bei Create, permission-basierte Freigabe (`content.read|create|update`) und revisionssichere History-Events
- Medien-Uploads folgen im Browser dem dreistufigen Vertrag `initialize -> signed PUT -> complete`; dabei laufen nur Initialisierung und Abschluss über hostseitige IAM-Endpunkte, der Binärtransfer selbst geht direkt an den signierten Storage-Pfad
- Upload-Logging bleibt URL- und payload-arm: Frontend und Host protokollieren Phasen, Asset-/Session-IDs und redigierte Fehlercodes, aber keine signierten Upload-URLs oder Binärinhalte
- Mutierende Inhaltsaktionen deklarieren eine fachliche `domainCapability`; `@sva/auth-runtime` löst sie serverseitig auf bestehende primitive `content.*`-Actions auf und prüft ausschließlich diese primitive Action über die zentrale Permission Engine.
- Globale Instanzmutationen verwenden die dedizierte Plattformrolle `instance_registry_admin`
- `instance.registry.manage` ist ebenso Root-only: tenantseitige Rollen-, Gruppen- und Permission-Kataloge dürfen dieses Recht nicht als wirksame Tenant-Berechtigung auswerten.
- Instanzverwaltung ist nur auf dem Root-Host zulässig; Tenant-Hosts rendern keine globale Control Plane
- Kritische Root-Host-Mutationen der Instanz- und Keycloak-Control-Plane verlangen zusätzlich eine serverseitig gebundene Fresh-Reauth-Evidenz innerhalb eines begrenzten Frischefensters; Header, Query-Parameter oder UI-Marker gelten dabei nie als Sicherheitsnachweis
- Die fachliche Modulfreigabe einer Instanz ist kanonisch in `iam.instance_modules` modelliert; Build-time-Plugin-Registrierung, `featureFlags` und Integrationsdaten sind keine alternative Aktivierungsquelle
- `auth/me` liefert für tenantgebundene Sessions die fail-closed behandelte Liste `assignedModules`; Client-Routing und Plugin-Navigation dürfen modulbezogene Einstiege nur bei expliziter Zuweisung materialisieren
- Modulentzug entfernt modulbezogene Permissions und `role_permissions` hart; zurückbleibende Restrechte gelten als Drift
- Experimentelle Shell-Funktionen werden zusätzlich über die explizite Permission `experimental.read` gegated; sie ersetzt keine Fachrechte, sondern ergänzt sie.
- Für experimentelle Menüpunkte gilt das additive Prinzip: fachliche Sichtbarkeit wie `app.read`, `cockpit.read` oder `iam.monitoring.read` bleibt führend und wird nur zusammen mit `experimental.read` materialisiert.
- Normale Tenant-Administration nutzt ausschließlich einen tenantlokalen Keycloak-Adminpfad; Plattform-/Root-Credentials sind dafür kein zulässiger Fallback
- Tenant-IAM-Betriebsdiagnostik auf der Instanz-Detailseite hält `configuration`, `access`, `reconcile` und `overall` getrennt; `overall` folgt strikt der Präzedenz `blocked` vor `degraded` vor `unknown` vor `ready`
- Explizite Tenant-IAM-Access-Probes sind read-only, werden manuell ausgelöst und als korrelierbare Audit-Evidenz mit `requestId`, `errorCode`, `checkedAt` und stabiler Quelle `access_probe` persistiert
- Die Instanz-Detailseite priorisiert im Erstblick aktuelle Betriebswahrheit vor historischer Evidenz. Ältere fehlgeschlagene Provisioning-Läufe bleiben diagnostisch sichtbar, dürfen aber nicht denselben Rang wie aktuelle blockierende Befunde erhalten.
- Hervorgehobene Cockpit-Zustände folgen dem Prinzip `state + freshness + provenance`: sichtbarer Status soll nach Möglichkeit immer mit belastbarer Zeitmarke und ableitbarer Quelle wie Preflight, Access-Probe, Reconcile oder letztem Provisioning-Lauf gekoppelt sein.
- Aktionshierarchien auf operativen Detailseiten verwenden genau eine Primäraktion im Überblick; Spezial- und Folgeaktionen werden sichtbar nachgeordnet gruppiert, damit Operatoren nicht mehrere gleichgewichtete Handlungsoptionen im Erstblick interpretieren müssen.
- Dezente Motion auf der Instanz-Detailseite ist nur zulässig, wenn sie Blickführung, Statusfeedback oder Prozesszustände unterstützt; `prefers-reduced-motion`, Fokusindikatoren, Statuskontrast und Incident-Lesbarkeit haben stets Vorrang vor dekorativer Wirkung.
- Root-/Plattform-Zugriff umfasst Instanz-Lifecycle, Provisioning, Platform-User, Platform-Rollen, Platform-Sync und explizites Break-Glass; tenantlokale Daten bleiben davon getrennt
- User-Identity-Änderungen folgen weiter dem Keycloak-Admin-Vertrag. Rollen- und Rollenzuordnungsänderungen für normale Tenant-Rollen sind DB-only; Keycloak-Sync ist auf `system_admin`, `instance_registry_admin` und explizit technische Realm-Artefakte begrenzt.
- `system_admin` bleibt die einzige geschützte tenantlokale Defaultrolle; frühere Standardrollen wie `app_manager`, `designer` oder `editor` gehören nicht mehr zum tenantlokalen Sollmodell, werden nicht mehr als Systemrollen behandelt und sind höchstens noch historische Altartefakte für explizite Migrations- und Repair-Pfade.
- Privilegierte Tenant-Account-Löschungen bleiben strikt permission-basiert: `system_admin` ist kein Rollen-Bypass, sondern nur deshalb zugelassen, weil die effektive Permission-Menge `iam.accounts.delete` enthält.
- Tenant-Userlisten richten sich nach dem Tenant-Realm in Keycloak; ungemappte oder mehrdeutige Benutzer werden als `unmapped` beziehungsweise `manual_review` angezeigt.
- Keycloak-Built-in-Rollen bleiben als Rollenobjekte read-only, werden aber in Listen nicht ausgeblendet.
- Keycloak-Provisioning für Instanzen ist ein expliziter mehrstufiger Root-Host-Workflow aus Preflight, Plan, Ausführung und persistiertem Schrittprotokoll
- Registry-Daten und Keycloak-Mutation sind getrennte Aktionen; ein Speichern von Instanzdaten führt keine implizite Keycloak-Änderung aus
- Registry-Lookups verwenden einen kurzen In-Process-L1-Cache mit expliziter Invalidation, aber ohne Stale-Serve-Strategie
- Tenant-gebundene Requests arbeiten fail-closed, wenn der Session-User keinen gültigen `instanceId`-Kontext mehr trägt. Neue Login-Sessions erhalten diesen Kontext bereits beim Callback aus dem Auth-Scope; Middleware-Hydration bleibt nur Absicherung für alte oder beschädigte Sessions.
- `roleLevel` bleibt in Admin-Read-Models und Mutationsverträgen als Kompatibilitätsfeld sichtbar, ist aber kein Ersatz für die Root-/Tenant-Scope-Trennung und keine normative Quelle neuer Governance-Entscheidungen.

### Logging und Observability

- Einheitlicher Server-Logger über `@sva/server-runtime`
- AsyncLocalStorage für `workspace_id`/request context
- OTEL Pipeline für Logs + Metrics
- Development nutzt lokale Console-Logs als Diagnosepfad; produktionsnahe Telemetrie läuft über OTEL
- Operative Logs enthalten keine Tokens, keine tokenhaltigen Redirect- oder Logout-URLs und keine decodierbaren JWT-Strings; zulässig sind nur sichere Summary-Felder
- Runtime-Diagnostik folgt einem zweistufigen Modell: öffentliche Health-/API-Responses liefern knappe, nicht-sensitive `reason_code`s; OTEL liefert die tiefe technische Korrelation über Span-Attribute und Events
- Der Server-Entry-Diagnosevertrag ist env-gesteuert: `SVA_SERVER_ENTRY_DEBUG=true` aktiviert strukturierte Logs für Request-Eingang, Auth-Dispatch, Delegation an TanStack Start und Antwortstatus, ohne Secrets oder Tokeninhalte zu protokollieren
- Für produktionsnahe Remote-Profile ist `app-db-principal` ein eigener Diagnosevertrag: `/health/ready` muss `db`, `redis` und `keycloak` aus Sicht des laufenden `APP_DB_USER` als bereit ausweisen
- Derselbe Readiness-Vertrag umfasst für aktive Tenant-Instanzen zusätzlich vollständige Login-Grunddaten (`primary_hostname`, `auth_realm`, `auth_client_id`) und ein lesbares tenant-spezifisches `auth_client_secret`; globale Plattform-Secrets sind dafür kein zulässiger Ersatz
- Die Studio-Root-Shell rendert in allen Environments einen sichtbaren Runtime-Health-Indikator auf Basis des bestehenden IAM-Readiness-Endpunkts; die UI zeigt nur sichere Statuszustände und `reason_code`s, keine rohen Provider- oder Stack-Details
- Label-Whitelist und PII-Blockliste in OTEL/Promtail
- IAM-Authorize/Cache-Logs nutzen strukturierte Operations (`cache_lookup`, `cache_invalidate`, `cache_stale_detected`, `cache_invalidate_failed`)
- Cold-Start-, Recompute- und Store-Fehler im Snapshot-Pfad werden als strukturierte Cache-Events (`cache_cold_start`, `cache_store_failed`) geloggt
- Der GUI-gestuetzte Authorize-Performance-Lauf misst denselben Serverpfad wie produktive `POST /iam/authorize`-Requests; Browser-Timing oder lokale Renderdauer sind kein Teil des Nachweises
- Das Monitoring exponiert fuer diesen Lauf nur sichere Zusammenfassungen (`samples`, `p50`, `p95`, `p99`, Bewertung, Cache-Status, Report-Pfade) und keine rohen Snapshot- oder SQL-Dumps
- Das Szenario `recompute` invalidiert gezielt nur den Snapshot des aktuellen Session-Actors im aktuellen Instanzkontext; globale Cache-Leerungen sind fuer diesen Betriebsnachweis unzulaessig
- Korrelationsfelder `request_id` und `trace_id` sind im IAM-Pfad verpflichtend
- Scope-aware Logs enthalten zusätzlich `scope_kind`, `workspace_id` und im Tenant-Scope `instance_id`
- Außerhalb des `AsyncLocalStorage`-Kontexts werden `request_id` und `trace_id` best effort aus validierten Headern (`X-Request-Id`, `traceparent`) extrahiert
- Serverseitige JSON-Fehlerantworten für Auth-/IAM-Hotspots nutzen einen strukturierten Fehlervertrag mit `error.code`, `error.message`, optionalen `details`, `classification`, `status`, `recommendedAction` und allowlist-basierten `safeDetails`; `X-Request-Id` bleibt best effort und API-v1-Antworten dürfen zusätzlich `requestId` tragen
- IAM-v1-Fehlerantworten dürfen additive `details` tragen, enthalten dort aber nur nicht-sensitive Diagnosefelder wie `reason_code`, `dependency`, `schema_object`, `expected_migration`, `actor_resolution` und `instance_id`
- Für den Zielpfad der IAM-Diagnostik ist derselbe allowlist-basierte Feldsatz die Grundlage für einen classification-basierten öffentlichen Diagnosevertrag; tiefe Rohfehler bleiben weiterhin OTEL- und Serverlog-intern
- Der öffentliche Diagnosekern umfasst neben IAM-, Keycloak-, Schema- und Provisioning-Klassen auch `auth_resolution`, `oidc_discovery_or_exchange`, `frontend_state_or_permission_staleness` und `legacy_workaround_or_regression`; neue Klassen werden zentral in `@sva/core` ergänzt
- Tenant-Host-Validierung unterscheidet öffentlich zwischen `tenant_not_found`, `tenant_inactive`, `tenant_lookup_failed` und Session-Hydration-Defekten wie `missing_session_instance_id`; UI und Betrieb erhalten damit denselben sicheren Diagnosekern statt generischer `403`-/`401`-Fälle
- Widerspricht ein vorhandener OIDC-Claim `instanceId` dem Host-/Realm-Scope, wird der Callback mit `tenant_scope_conflict` fail-closed protokolliert und nicht als tenant-lose Session fortgesetzt.
- Tenant-Admin-Fehler dürfen zusätzlich `execution_mode`, `auth_realm` und `provider_source` tragen, damit Realm- oder Control-Plane-Drift ohne Rohfehler analysierbar bleibt
- Auth-, Resolver- und Audit-Fehler protokollieren redigiert nur `error_type`, `reason_code`, `dependency`, `scope_kind` und Korrelationsfelder; rohe Provider-/DB-Fehltexte bleiben außerhalb des Standard-Logs
- IAM-Readiness und Diagnosepfade exponieren Schema-Drift bewusst knapp (`schema_drift`, `missing_table`, `missing_column`) statt rohe SQL-, Redis- oder Provider-Fehler an UI oder Browser weiterzugeben
- Runtime-Doctor und Deploy-Report ergänzen den fachlichen Schema-Guard um die verwendete `goose`-Version sowie Metadaten des dedizierten Swarm-Migrations- und Bootstrap-Jobs, ohne Secrets oder Roh-SQL nach außen zu exponieren
- Keycloak-User-Sync loggt übersprungene Benutzer nur begrenzt, auf Debug-Level und ohne Klartext-PII; Summary-Logs enthalten `auth_realm`, `provider_source`, `execution_mode`, `skipped_count` und `sample_instance_ids`
- Der Sync-Report darf additive, nicht-sensitive Diagnosefelder wie `authRealm`, `providerSource`, `executionMode`, `matchedWithoutInstanceAttributeCount` und `skippedInstanceIds` zurückgeben, damit UI und Doctor Realm-/Instanz-Drift ohne `kcadm.sh` eingrenzen können
- Role-Sync- und Reconcile-Pfade verwenden ausschließlich den Server-Runtime-Logger; `console.*` ist serverseitig ausgeschlossen
- Role-Sync-Audit nutzt ein einheitliches Schema mit `workspace_id`, `operation`, `result`, `error_code?`, `request_id`, `trace_id?`, `span_id?`
- Keycloak-Admin-UI-Diagnosen verwenden stabile objektbezogene Codes wie `missing_instance_attribute`, `mapping_missing`, `forbidden_role_mapping`, `read_only_federated_field` und `idp_forbidden`.
- Sync- und Reconcile-Reports dürfen betroffene Objektlisten enthalten; öffentliche Payloads bleiben auf nicht-sensitive IDs, Zähler, Codes und Korrelationsdaten begrenzt.
- Zusätzliche Metriken für den Rollenpfad: `iam_role_sync_operations_total` und `iam_role_drift_backlog`
- Zusätzliche Cache-Metriken für IAM: `sva_iam_cache_lookup_total`, `sva_iam_cache_invalidation_duration_ms`, `sva_iam_cache_stale_entry_rate`
- Redis-Infrastrukturmetriken werden über `redis-exporter` in denselben Monitoring-Stack eingespeist und mit den IAM-Cache-Metriken korreliert
- Governance-Logs nutzen `component: iam-governance` und strukturierte Events:
  `impersonate_start`, `impersonate_end`, `impersonate_timeout`, `impersonate_abort`
- Governance-Audit folgt Dual-Write: DB (`iam.activity_logs`) + OTEL-Pipeline
- PII-Schutz in Governance-Events: nur pseudonymisierte Actor-/Target-Referenzen
- DSR-Wartungslauf emittiert strukturierte Audit-Events (`dsr_maintenance_executed`, `dsr_deletion_sla_escalated`)
- Der DSR-Wartungslauf verarbeitet keine Export-Queues mehr; Self-Service-Exporte laufen ausschließlich über den generischen Host-Worker.
- Finale Löschung pseudonymisiert Audit-Referenzen (`subject_pseudonym`) statt Klartext-PII
- Server-Runtime-Logger nutzt typisierte OTEL-Bridge (keine `any`-Casts in Transport/Bootstrap)
- Sensitive-Keys-Redaction umfasst zusätzlich Cookie-, Session-, CSRF- und API-Key-Header/Felder
- Pseudonyme technische IDs bleiben personenbezogen und werden nur geloggt, wenn sie fuer Betrieb, Audit oder Korrelation wirklich erforderlich sind
- Auth-Audit und Betriebslogs unterscheiden `login`, `silent_reauth_success`, `silent_reauth_failed`, `forced_reauth` und `logout`
- Auth-Diagnostik für `/auth/me` verwendet denselben strukturierten Fehlervertrag wie übrige IAM-Endpunkte: `classification`, `status`, `recommendedAction`, `requestId` und allowlist-basierte `safeDetails`
- Auth-Unterbrechungen klassifizieren zusätzlich nicht-sensitive `reason_code`-Werte wie `missing_session_cookie`, `invalid_session`, `session_expired`, `silent_recovery_timeout` oder `forced_reauth`
- Eine neue Fresh-Reauth-Evidenz entsteht nur über einen serverseitig kontrollierten interaktiven Auth-Callback; Silent-SSO, Token-Refresh und reine Request-Marker erneuern dieses Sicherheitsfenster nicht
- Browser-seitige Auth-Recovery-Flows erzeugen pro Vorfall eine `authFlowId`, damit `/auth/me`, Silent-SSO, Redirect auf `session-expired` und nachgelagerte Retry-Schritte gemeinsam korrelierbar bleiben
- Ein lokaler Browser-Ringpuffer in `sessionStorage` darf in Development- oder Diagnosemodi die letzten Auth-Ereignisse eines Tabs speichern; er enthält keine Tokens und keine PII, sondern nur sichere Diagnosemetadaten wie `authFlowId`, `requestId`, `reason_code` und `recovery_step`
- Zusätzlich darf ein explizit aktivierter lokaler Dev-Auth-Modus den OIDC-Loginpfad nur auf Entwicklerrechnern umgehen; er bleibt an lokale Env-Flags, sichtbare UI-Kennzeichnung und einen synthetischen Benutzerkontext gebunden
- Für lokale Dev-/Mock-Auth-Profile darf der Fresh-Reauth-Guard nur über einen expliziten serverseitigen Nicht-Produktiv-Bypass gelockert werden; dieselbe Abweichung bleibt in produktionsnahen Profilen unzulässig
- Der lokale Dev-Auth-Modus ist kein gültiger Ersatznachweis für Realm-Auflösung, Session-Lifecycle, Silent-SSO, Forced-Reauth oder feingranulare IAM-Entscheidungen und darf deshalb nicht in Staging- oder Shared-Dev-Verträgen vorausgesetzt werden
- Workspace-Context-Warnungen erfolgen über lazy `process.emitWarning` statt `console.warn`
- Mainserver-Logs enthalten nur `instanceId`/`workspace_id`, `operation_name`, `request_id`, `trace_id`, Status und abstrahierte Fehlercodes; API-Key, Secret, Token und unredactete Variablen werden nie geloggt
- Die Mainserver-Integration hält dieselbe Fehler- und Logging-Semantik auch intern modular: Credential-, Token-, Transport- und Fachmapping-Module verwenden denselben strukturierten Log-Kontext und denselben Hop-Observability-Vertrag
- IAM-Request-Spans tragen konsistente Diagnoseattribute wie `iam.endpoint`, `iam.instance_id`, `iam.actor_resolution`, `iam.reason_code`, `iam.feature_flags`, `db.schema_guard_result`, `dependency.redis.status` und `dependency.keycloak.status`
- Der Runtime-Doctor- und Migrationspfad emittiert eigene OTEL-Ereignisse für Schema-Guard, Actor-Diagnose und verifizierte Migrationsläufe, damit Betriebsfehler mit `request_id` und `trace_id` korrelierbar bleiben
- Inhalts-Historie nutzt ein eigenes Read-Modell statt Roh-Logs; jede Erstellung, Aktualisierung und jeder Statuswechsel erzeugt zusätzlich Audit-Ereignisse im bestehenden IAM-Auditpfad. Audit-Payloads für Content-Aktionen enthalten additiv fachliche Capability, primitive Action, Ergebnis, Reason-Code und Korrelationsfelder, ohne bestehende Exportformate zu migrieren.
- Hostgeführte Bulk-Actions fuer Content reusen denselben Audit-/Mutation-Backbone: der Host protokolliert nur sichere Metadaten wie Resource-ID, Action-ID, Selection-Mode, Counts und Sort-/Filter-Scope, waehrend die fachliche Mutation und serverseitige Audit-Persistenz in den bestehenden Content-Endpunkten bleibt
- Studio-Deploys erzeugen zusätzlich strukturierte Release-Evidenz unter `artifacts/runtime/deployments/`; enthalten sind Release-Modus, Actor, Workflow, Image-Referenz, Schrittstatus und Stack-Zusammenfassung, jedoch keine Secrets oder PII
- Produktionsnahe Releases erzeugen zusätzlich eigenständige Artefakte für Release-Manifest, Phasenstatus, Migration, Bootstrap, Migrationsjob, Bootstrap-Job, interne Probes und externe Probes; diese Artefakte bleiben bewusst ohne Secrets oder PII
- Remote-Prechecks für `studio` vergleichen zusätzlich die Live-Service-Spec der App mit dem gerenderten Sollzustand aus dem Deploy-Compose; dabei sind Netzwerke und ingressrelevante Labels eigene Drift-Signale

### Routing-Observability-Vertrag

- `@sva/routing` verwendet einen optional injizierten `RoutingDiagnosticsHook` für client-shared Routing-Entscheidungen.
- Browser-Produktion bleibt ohne expliziten Hook No-op; es entsteht kein implizites Tracking normaler Navigation.
- Client-shared Routing-Dateien importieren kein `@sva/server-runtime`.
- Serverseitige Bindung an den Server-Runtime-Logger erfolgt nur in serverseitigen Routing- und Runtime-Adaptern.
- Guard-Denials, unbekannte Plugin-Guard-Mappings, unbehandelte Handler-Fehler und `405`-Dispatch-Anomalien nutzen einen gemeinsamen Safe-Feldsatz.
- Health-Check-Routen sind explizit vom `routing.handler.method_not_allowed`-Logging ausgenommen.

### Fehlerbehandlung und Resilienz

- OTEL-Init ist in Development fehlertolerant; in Production wird fehlende OTEL-Readiness fail-closed behandelt
- Die Routing-Error-Boundary liefert auch bei unerwarteten Fehlern immer JSON statt HTML-Fallbackseiten
- Redis-Reconnect mit Backoff und Max-Retry Logik
- Auth-Flow mit klaren Redirect-Fehlerpfaden (`auth=error`, `auth=state-expired`)
- Silent Session-Recovery arbeitet ohne Retry-Schleifen und fällt bei Browser-/IdP-Limits deterministisch auf aktiven Login zurück
- Recovery-Pfade wie Silent-Recovery, Session-Hydration, Host-Fallbacks oder degradierte Projektionen gelten diagnostisch nicht automatisch als gesunder Zustand; ein erfolgreicher Workaround darf die zugrunde liegende Fehlerklasse nicht unsichtbar machen
- Fehlende `instanceId` in bestehenden tenantgebundenen Sessions gilt explizit als Defektklasse `session_store_or_session_hydration` mit empfohlener Aktion `erneut_anmelden`, nicht als automatisch reparierbarer Zwischenzustand
- Root-Route nutzt ein zentrales `errorComponent` für unbehandelte Laufzeitfehler mit Retry-Option
- Runtime-Profile verwenden einen verbindlichen Diagnosepfad `pnpm env:doctor:<profil>`; manuelle `psql`-/Browser-Netzwerkdiagnose ist nur Fallback
- Read-only Remote-Diagnostik trennt strikt zwischen Portainer-API als Primaerkanal und `quantum-cli` als Mutations-/Fallback-Kanal
- Mutierende `studio`-Kommandos laufen regulär über den expliziten lokalen Operator-Kontext `local-operator`; der bisherige CI-/Runner-Deploypfad ist höchstens noch Legacy-Fallback
- `studio` verwendet einen verbindlichen, fehlertoleranten Deploypfad über `Studio Image Build`, `Studio Image Verify` und den lokalen Einstieg `env:release:studio:local`; direkte `up`-/`update`-Deploys sind für Serverrollouts gesperrt
- `pnpm test:release:studio` ist das gebündelte lokale Release-Gate aus `test:pr` und `verify:runtime-artifact`; normale PRs behalten `test:pr` als Standard-Gate
- Der produktionsnahe Releasevertrag klassifiziert Fehler verbindlich in `config`, `image`, `migration`, `bootstrap`, `startup`, `health`, `ingress` und `dependency`; spätere Phasen dürfen frühere Resultate nicht überschreiben
- Release-Modus `schema-and-app` arbeitet fail-closed: ohne dokumentiertes Wartungsfenster startet kein orchestrierter Studio-Deploy
- Release-Modus `schema-and-app` arbeitet zusätzlich fail-closed auf Basis dedizierter Swarm-Jobs: ohne erfolgreichen Exit-Code von `migrate` und `bootstrap`, Post-Migration-Assertions und Schema-Guard startet kein App-Rollout
- Studio-Releases arbeiten fail-closed ohne `SVA_IMAGE_DIGEST`; ein nicht bestehender `image-smoke` blockiert jeden Rollout vor dem Stack-Update
- Prod-nahe Parität für `studio` muss Root-Host, Tenant-Host und OIDC-Verhalten bewerten. Wenn dasselbe Digest bereits live läuft, darf nur die Live-Evidenz dieses Digests wiederverwendet werden.
- Der Live-Rollout-Render validiert vor `quantum-cli stacks update`, dass `app` die Netzwerke `internal` und `public` sowie die benoetigten Traefik-Labels weiterhin enthält; fehlende Einträge blockieren den Rollout fail-fast
- Temp-Job-Stacks für `migrate` und `bootstrap` sind von Live-Rollouts strikt getrennt. Sie nutzen nur `<stack>_internal`, enthalten keinen `app`-Service und dürfen die Live-Spec von `studio_app` nicht mutieren
- Deploy-Reports unterscheiden explizit zwischen `migration`, `bootstrap`, `health`, `verify` und `ingress_consistency`; ein Zustand `app 1/1`, aber externer `502` wird als eigener Drift-/Ingress-Fehler ausgewiesen
- Vor dem Docker-Build prüft `verify:runtime-artifact` den finalen Node-Output `apps/sva-studio-react/.output/server/index.mjs` mit Artefakt-Assertions, temporären Migrationen und Health-Probes. Das Image-Verify prüft danach denselben Vertrag erneut am gepushten Digest.
- `env:precheck:studio` dokumentiert die passende Image-Verify-Evidenz fuer den Ziel-Digest als eigenen Check `studio-image-verify-evidence`; fehlende Evidenz wird sichtbar als Warnung behandelt
- Laufzeit-Patching im Container ist kein Normalpfad mehr. Wenn `SVA_ENABLE_RUNTIME_RECOVERY_PATCH` nicht explizit gesetzt ist, muss der Container mit dem unveränderten Build-Output start- und health-fähig sein.
- IAM-Cache-Invalidierung folgt Event-first (Postgres NOTIFY) mit TTL/Recompute-Fallback
- Redis-Lookup-, Snapshot-Write- und Recompute-Fehler im Autorisierungspfad enden fail-closed mit HTTP `503` und Fehlercode `database_unavailable`
- Der Authorization-Cache gilt als `degraded`, wenn Redis-Latenz > `50 ms` oder die Recompute-Rate > `20/min` steigt; nach drei Redis-Fehlern wechselt der Zustand auf `failed`
- DSR-Resilienz über asynchrones Export-Statusmodell (`queued|processing|completed|failed`)
- Restore-Sanitization nach Backup-Restore stellt DSGVO-konforme Nachbereinigung sicher
- Mainserver-Delegation arbeitet fail-closed: ohne lokalen Rollencheck, Instanzkontext, Konfiguration oder gültige Credentials wird kein Upstream-Call ausgeführt
- Pagination gegen den Mainserver arbeitet ebenfalls fail-closed: ungültige `page`-/`pageSize`-Eingaben werden auf den kanonischen Vertrag normalisiert, und ohne belastbaren Nachweis für weitere sichtbare Einträge wird `hasNextPage` nicht optimistisch gesetzt
- Technische Entflechtung ist für serverseitige Integrationspfade verbindlich: öffentliche Host-Fassaden bleiben stabil, während Transport-, Cache- und Fachlogik in getrennten internen Modulen liegen und nicht wieder in Sammeldateien zusammengeführt werden
- Der IAM-Acceptance-Runner arbeitet ebenfalls fail-closed: fehlende Env, fehlende Testbenutzer, nicht bereite Dependencies oder unvollständige Laufzeitnachweise beenden den Lauf mit dokumentierten Fehlercodes
- Der Gruppen-CRUD arbeitet fail-closed: unbekannte `roleIds`, instanzfremde Gruppen oder fehlerhafte CSRF-/Idempotency-Header erzeugen stabile `invalid_request`-, `forbidden`- oder `csrf_validation_failed`-Antworten
- Die Rechtstext-Verwaltung arbeitet fail-closed: ungültige Statuswechsel, fehlendes `publishedAt` bei `valid` oder nicht reloadbare Neuanlagen liefern stabile `invalid_request`- bzw. `database_unavailable`-Antworten
- Die Inhaltsverwaltung arbeitet fail-closed: ungültiges JSON, fehlendes `publishedAt` bei `published`, nicht erlaubte Rollen oder nicht auflösbare Inhalte liefern stabile `invalid_request`-, `forbidden`- bzw. `not_found`-Antworten
- Geo-Hierarchie-Konflikte werden deterministisch diagnostiziert: `hierarchy_restriction` für wirksame Restriktionen, `instance_scope_mismatch` für Instanzverletzungen und `permission_missing` für fehlende Kandidaten

### Review-Governance fuer Studio-Foundations

- Review prüft bei neuen oder grundlegend überarbeiteten Formular-Flows explizit, ob der RHF-/`zodResolver`-Standard eingehalten wird.
- Review prüft bei HTTP-nahen Frontend-Tests explizit, ob `msw` statt Modul-Mocks verwendet wird.
- Review prüft für geänderte kritische Hotspots explizit, ob eine `fast-check`-Property ergänzt wurde oder eine belastbare Gegenbegründung vorliegt.
- Dokumentierte Ausnahmen bleiben nur zulässig, wenn Governance-Artefakt, Formularinventur und PR-/Arbeitskontext konsistent sind sowie Scope, Risiko und spaeterer Nachzieh-Trigger sichtbar benannt sind.

### Öffentlicher Abfallkalender: Accessibility und Embed-Konzept

- Auswahlfluss, Kalenderansicht und Modal folgen als Mindestziel WCAG 2.1 AA für Tastaturbedienbarkeit, semantische Rollen und sichtbare Fokusführung.
- Die reduzierte Bürgeroberfläche bleibt iFrame-tauglich: kein Studio-Layout, keine Auth-Abhängigkeit, keine versteckten Pflichtinteraktionen außerhalb des sichtbaren Bereichs.
- Export-Aktionen für PDF und iCal bleiben als globale Links außerhalb des Termin-Dialogs erreichbar, damit eingebettete Oberflächen keine Modal-Blockade für Primäraktionen erzeugen.
- Der Termin-Dialog nutzt `role="dialog"` plus `aria-modal="true"` und trägt seinen Titel über `aria-labelledby`.
- Der öffentliche Präferenzspeicher bleibt auf genau einen stabilen Standortschlüssel begrenzt; ungültige Cookies werden verworfen statt heuristisch repariert.

### Fortschreibung 2026-04: IAM-Diagnostik als Cross-Cutting-Konzept

- Der heutige Bestand liefert bereits gute Einzelbausteine für `requestId`, `reason_code`, Schema-Drift und Provisioning-Drift.
- Die zentrale Folgearbeit besteht nicht primär im Sammeln neuer Rohdaten, sondern im Vereinheitlichen dieser Signale zu einem sicheren, öffentlichen Diagnosekern.
- Maßgeblicher Zwischenstand und offene Live-Triage sind in `../reports/iam-diagnostics-analysis-2026-04-19.md` dokumentiert.

### Fortschreibung 2026-04: Kanonische IAM-Projektion und driftblockierter Reconcile

- Read-Modelle für Profil, User-Liste und Rollenansicht werden fachlich aus demselben Projektionskern abgeleitet; UI-Hooks dürfen keinen separaten Identitäts- oder Rollenwahrheitskern aufbauen.
- Ersatzbilder wie leere Rollen, UUID-Anzeigenamen oder `Ausstehend` sind nur zulässig, wenn der kanonische Projektionskern genau diesen Fachzustand liefert.
- `IamHttpError` bleibt bis in die Browser-Schicht mit `classification`, `requestId` und `safeDetails` erhalten; relevante Klassen sind insbesondere `registry_or_provisioning_drift`, `keycloak_reconcile`, `auth_resolution`, `oidc_discovery_or_exchange`, `frontend_state_or_permission_staleness` und `legacy_workaround_or_regression`.
- Reconcile- und Sync-Berichte serialisieren deterministische Abschlusszustände und Aggregationen statt impliziter Erfolgssignale.
- Rollen-Reconcile materialisiert keine tenantlokalen Fachrollen mehr in Keycloak; technische Sonderrollen werden repariert, nicht-technische Keycloak-Rollen werden als Legacy-/Drift-Diagnose ausgewiesen.
- Tenant-Admin-abhängige Mutationen arbeiten fail-closed gegen blockerrelevanten Drift; ein grüner Basis-Health-Status überschreibt diesen Befund nicht.

### Fortschreibung 2026-04: Tenant-IAM-Status als öffentlicher Diagnosekern

- Die Instanz-Detailseite veröffentlicht für Tenant-IAM nur einen sicheren, kuratierten Diagnosekern; tiefe IdP- oder Laufzeitfehler bleiben im OTEL- und Serverlog-Pfad.
- Access-Probe- und Reconcile-Befunde nutzen stabile Fehlercodes wie `tenant_admin_client_not_configured`, `tenant_admin_client_secret_missing`, `IDP_FORBIDDEN` und `IDP_UNAVAILABLE`, damit UI, Runbook und Audit auf demselben Vokabular arbeiten.
- Die Access-Probe wird nie automatisch beim Seitenladen ausgeführt, um unnötige IdP-Last, irreführende Zeitpunktevidenz und verdeckte Schreibnebenwirkungen zu vermeiden.
- `seedIamBaseline` rekonstruiert ausschließlich `Core + zugewiesene Module` und erzeugt keine Rollenmitgliedschaften für den ausführenden Benutzer.

### Build-, Test- und Cache-Konzept der Frontend-App

- `apps/sva-studio-react` nutzt dedizierte Nx-Executor für Vite (`build`, `serve`, `preview`), Vitest (`test:unit`, `test:unit:ui`, `test:unit:routes`, `test:unit:hooks`, `test:unit:server`, `test:coverage`) und Playwright (`test:e2e`)
- `apps/sva-studio-react:verify:runtime-artifact` ist der verbindliche Final-Artifact-Check nach dem Build; er validiert den finalen `.output/server/**`-Vertrag gegen echte Health-Probes und klassifiziert Fehler als `artifact-contract-failed`, `dependency-failed`, `runtime-start-failed` oder `http-dispatch-failed`
- Cache-relevante Frontend-Konfigurationen werden über `frontendTooling` in `nx.json` explizit modelliert
- Environment-Einflüsse mit Build-/Serve-/E2E-Relevanz (`CODECOV_TOKEN`, `TSS_DEV_SERVER`, `CI`) werden explizit in die Nx-Hash-Bildung aufgenommen
- Pre-Build-Checks für i18n und Account-UI-Foundation bleiben als separate Nx-Targets vor dem App-Build erzwungen
- Die App-Unit-Tests erzwingen wegen Node-25-/`jsdom`-Instabilitäten einen einzelnen Vitest-Worker im Thread-Pool
- Der PR-Unit-Pfad darf bei isolierten App-Änderungen gezielt nur die betroffenen App-Slices ausführen; gemischte oder unklare Änderungen fallen bewusst auf das aggregierte `test:unit`-Target zurück

### Studio-UI-Boundary und Design-System-Kapselung

- `@sva/studio-ui-react` ist der gemeinsame Kapselungspunkt für shadcn-/Radix-Primitives, semantische Design-Tokens und wiederverwendbare Studio-Komponenten.
- Host-Seiten und Plugin-Custom-Views verwenden dieselben Page-, Form-, State-, Table- und Action-Primitives, damit Accessibility, Fokusverhalten, Fehlermeldungen und visuelle Varianten nicht pro Fachpaket auseinanderlaufen.
- Fachplugins dürfen Domain-Wrapper bauen, wenn diese Studio-Primitives komponieren und keine eigenen visuellen Varianten, ARIA-Semantik oder Token-Schicht neu definieren.
- Spezialcontrols wie Rich-Text, Upload, Medienauswahl, Farbe, Icon und Geo-Auswahl werden erst bei nachgewiesenem pluginübergreifendem Bedarf in die gemeinsame UI-Basis aufgenommen; vorher bleiben sie bewusst fachnah und schmal.
- Enforcement erfolgt über Nx-`depConstraints`, ESLint-Importverbote und den CI-Check `pnpm check:plugin-ui-boundary`.
- Das IAM-Acceptance-Gate ist bewusst ein separates Nx-Target ohne PR-CI-Zwang, weil es reale Laufzeitabhängigkeiten gegen eine dedizierte Testumgebung prüft

### TypeScript-, Bundler- und Node-ESM-Vertrag

- Das Monorepo nutzt `moduleResolution: "Bundler"` für produktive Dev-Tooling-Pfade mit Vite, `tsx` und Vitest
- Diese Bundler-Auflösung ist bewusst nicht identisch mit der Laufzeitauflösung von Node-ESM für gebaute `dist/*.js`-Packages
- Serverseitig direkt von Node geladene Workspace-Packages müssen deshalb ESM-strikte relative Runtime-Imports mit expliziter Laufzeitendung (`.js`) verwenden
- Runtime-Imports auf andere Workspace-Packages bleiben nur dann gültig, wenn die jeweilige Dependency im lokalen `package.json` des importierenden Packages deklariert ist
- Der technische Schutz gegen Drift liegt im zentralen Guard `pnpm check:server-runtime`, der statische Source-Prüfung und `dist`-Smoke-Imports kombiniert
- `pnpm test:types` gilt dadurch zugleich als Typ- und Node-ESM-Kompatibilitäts-Gate für die serverseitigen Workspace-Packages und aggregiert die vorhandenen `test:types`-/`typecheck`-Targets workspaceweit

### i18n und Accessibility

- Core- und Plugin-UI-Texte werden über gemeinsame i18n-Ressourcen aufgelöst; Plugin-Namespaces folgen der Konvention `<pluginId>.*`
- Plugin-beigestellte registrierte Host-Identifier folgen einem einheitlichen Namespace-Modell:
  - `contentType` im Format `<pluginId>.<name>`
  - plugin-spezifische Admin-Ressourcen-IDs im Format `<pluginId>.<name>`
  - plugin-spezifische Audit-Event-Typen im Format `<pluginId>.<name>`
- Die technische Ownership liegt bei `PluginDefinition.id`; Plugins dürfen keine fremden oder reservierten Core-Namespaces wie `content`, `iam`, `admin` oder `core` belegen
- Core-Identifier wie `generic`, `legal` oder hosteigene Admin-Ressourcen wie `content` bleiben ausdrücklich außerhalb dieser Plugin-Namespace-Pflicht
- A11y wird pro Review/Template eingefordert, aber noch nicht zentral automatisiert
- Rollen-Statusindikatoren in `/admin/roles` verwenden i18n-Labels für `synced`, `pending` und `failed`
- Retry- und Reconcile-Aktionen bleiben über semantische Buttons und Testabdeckung tastatur- und screenreader-freundlich prüfbar
- Die neue `/content`-Verwaltung verwendet ausschließlich bestehende `shadcn/ui`-Kompositionen und orientiert sich visuell an vorhandenen Admin-Tabellen statt eine parallele Tabellenbasis einzuführen
- Plugin-Ansichten folgen denselben Shell-Konventionen für Fokus, Breadcrumbs, `document.title`, Heading-Hierarchie und `aria-live`-Feedback wie Core-Ansichten
- CRUD-artige Admin-Ressourcen folgen einer einheitlichen Navigationskonvention:
  - Liste unter `/admin/<resource>`
  - Erstellungsansicht unter `/admin/<resource>/new`
  - Detail- und Bearbeitungsansicht unter `/admin/<resource>/$id`
- Create- und Edit-Flows dieser Ressourcen werden nicht über lokalen Dialog-State der Listenansicht gesteuert; Listenaktionen navigieren immer auf die kanonische Zielroute
- Die technische Quelle dieser Navigationskonvention ist ein deklarativer Admin-Ressourcenvertrag im SDK; Packages liefern nur Bindings und Guard-Referenzen, keine eigene Admin-Shell oder abweichende Top-Level-Pfade
- Legacy-Einstiege dürfen nur als explizite Host-Aliase bestehen bleiben; für die Inhaltsverwaltung redirectet der Host `/content*` kontrolliert auf `/admin/content*`

### UI-Theming, Design-Tokens und Shell-Verhalten

- Die Shell verwendet semantische CSS-Tokens (`background`, `foreground`, `card`, `sidebar`, `primary`, `border`, `ring`, `destructive`) statt direkter Tailwind-Farbwerte
- Das Default-Light-Theme ist aktuell als KERN-2-nahe blau-graue Foundation umgesetzt; die grüne Linie bleibt als separate Instanzvariante `sva-forest` erhalten
- Light- und Dark-Mode werden über denselben Token-Satz aufgelöst; der aktive Modus wird im Frontend per `ThemeProvider` auf das Dokument angewendet
- Der initiale Theme-Modus wird zusätzlich schon im Root-Dokument per Bootstrap-Skript gesetzt, damit die Shell vor der Hydration nicht erst im Fallback-Farbschema rendert
- Theme-Varianten sind instanzfähig vorbereitet: `instanceId` kann eine Theme-Auswahl beeinflussen, ohne die Shell-Komponenten selbst zu verzweigen
- `@kern-ux/native` dient in Phase 1 nur als gebündelte Font-Quelle (`Fira Sans`), nicht als globaler CSS-Reset oder konkurrierende Komponentenlaufzeit
- Mobile Navigation nutzt ein zugängliches Drawer-/`Sheet`-Muster statt projektspezifischer Spezialinteraktionen
- Komplexe Alt-Muster wie kollabierte Flyout-Submenüs oder pixelgenaue Active-Indikatoren bleiben bewusst außerhalb des Initial-Scope

### Review-Governance

- Proposal-Reviews werden über einen dedizierten Proposal-Orchestrator konsolidiert
- PR- und Code-Reviews werden über einen separaten PR-Orchestrator konsolidiert
- Spezialisierte Review-Agents decken ergänzend Testqualität, i18n/Content, User Journey & Usability und Performance ab
- Relevante Bot-Kommentare von `Copilot` und `chatgpt-codex-connector[bot]` werden zusaetzlich ueber ein eigenes PR-Gate auf Bearbeitungsnachweise geprueft
- Zentrale und kritische Module werden zusätzlich über ein eigenes Komplexitäts-Gate mit Ticketpflicht überwacht
- Das Modulregister und die Schwellwerte liegen versioniert unter `tooling/quality/complexity-policy.json`
- Bekannte Überschreitungen bleiben nur dann zulässig, wenn sie in `trackedFindings` mit Refactoring-Ticket hinterlegt sind
- Bei modularem IAM-Refactoring wird Restschuld am tatsächlichen Kernmodul (`core.ts` oder feingranulare Teilbausteine) und nicht am historischen Fassadenpfad dokumentiert
- Kritische Coverage-Hotspots werden in `tooling/testing/coverage-policy.json` als `hotspotFloors` geführt
- Workflow- und CI-Dateiänderungen werden im PR-Pfad gezielt über `tooling-testing` abgesichert und nicht automatisch durch volle Produkt-Suiten eskaliert
- Normative Accessibility und heuristische Nutzersicht sind bewusst getrennt:
  - `ux-accessibility.agent.md` für WCAG/BITV, Fokus, Tastatur und Screenreader
  - `user-journey-usability.agent.md` für Friktion, Verständlichkeit und Aufgabenbewältigung
- i18n/harte Strings werden als eigener Governance-Strang behandelt und nicht nur implizit im Code-Review geprüft
- Der Bearbeitungsnachweis fuer Bot-Kommentare nutzt standardisierte Marker fuer `accepted`, `rejected` und `resolved`; Diff-Threads muessen zusaetzlich als resolved markiert sein
- Konflikte zwischen Review-Perspektiven werden auf Orchestrator-Ebene explizit gemacht, die Entscheidung bleibt beim Menschen

### Package-Boundaries und Runtime-Imports

- Neue Fachlogik wird direkt im Zielpackage umgesetzt: `@sva/auth-runtime`, `@sva/iam-core`, `@sva/iam-admin`, `@sva/iam-governance`, `@sva/instance-registry`, `@sva/data-client`, `@sva/data-repositories`, `@sva/plugin-sdk` oder `@sva/server-runtime`.
- Alte Sammelpackages begruenden keine neue fachliche Ownership; die fruehere Sammelfassade `@sva/sdk` ist aus dem aktiven Workspace entfernt.
- Nx-`depConstraints` und ESLint-Importverbote verhindern Rückfälle auf alte Sammelimporte in produktiven Consumer-Pfaden.
- Serverseitig von Node geladene Workspace-Packages verwenden explizite `.js`-Endungen für relative Runtime-Imports und bestehen `check:runtime`.
- Runtime-Imports auf andere Workspace-Packages stehen im lokalen `package.json` unter `dependencies`.

### Job-Fortschritt und Persistenzlast

- Strukturierter Laufzeitfortschritt bleibt ein generischer Host-Vertrag und wird über `StudioJobProgress` plus optionale `details` transportiert.
- Fachplugins dürfen zusätzliche Kurzsichtdaten wie `processedRows` und `totalRows` melden, müssen diese aber über denselben zentralen Jobstore und dieselben Host-Endpunkte veröffentlichen.
- Für zeilenreiche Importpfade werden Progress-Events blockweise persistiert und zusätzlich an fachlichen Phasenwechseln geschrieben; zeilenfeine Persistenz pro Datensatz ist kein Default.
- UI-Polling darf für explizit laufende Fachfälle enger takten als die generische Historienansicht, solange nur aktive Jobs betroffen sind.

### UI-Shell, Responsivität und Skeleton UX

- Die Root-Shell trennt die Bereiche Kopfzeile, Seitenleiste und Hauptinhalt explizit
- Ein Skip-Link ermöglicht direkten Sprung in den Contentbereich (`#main-content`)
- Skeleton-Zustände werden konsistent über alle drei Kernbereiche bereitgestellt
- Mobile-first Layout: Sidebar bleibt auf kleinen Viewports nutzbar, auf großen Viewports als feste Seitenleiste
- Am unteren Ende jeder Studio-Seite wird ein kompakter Runtime-Health-Indikator mit Polling für Postgres, Redis, Keycloak und den Autorisierungs-Cache angezeigt; ein Fehler beim Polling degradiert nur die Anzeige, nicht die restliche Shell

Referenzen:

- `packages/auth-runtime/src/runtime-routes.ts`
- `packages/auth-runtime/src/index.server.ts`
- `packages/iam-core/src/index.ts`
- `packages/iam-admin/src/index.ts`
- `packages/iam-governance/src/index.ts`
- `packages/instance-registry/src/index.ts`
- `packages/iam-core/src/authorization-engine.ts`
- `packages/server-runtime/src/index.ts`
- `packages/monitoring-client/src/otel.server.ts`
- `docs/adr/ADR-014-postgres-notify-cache-invalidierung.md`
- `docs/architecture/iam-service-architektur.md`
- `docs/architecture/iam-datenklassifizierung.md`
- `docs/development/complexity-quality-governance.md`
- `docs/development/iam-server-modularization.md`
- `docs/development/runtime-profile-betrieb.md`
- `docs/development/review-agent-governance.md`
- `docs/development/server-package-runtime-guards.md`
- `docs/development/iam-schluesselmanagement-strategie.md`
- `docs/guides/iam-governance-runbook.md`
- `docs/guides/iam-governance-freigabematrix.md`
- `docs/guides/iam-data-subject-rights-runbook.md`
- `docs/guides/iam-authorization-api-contract.md`
- `docs/guides/iam-service-api-dokumentation.md`
- `docs/guides/swarm-deployment-runbook.md`
- `apps/sva-studio-react/src/routes/__root.tsx`
- `apps/sva-studio-react/src/components/AppShell.tsx`
- `apps/sva-studio-react/src/providers/theme-provider.tsx`
- `apps/sva-studio-react/src/lib/theme.ts`
- `docs/development/ui-shell-theming.md`

### Ergänzung 2026-03: AuthProvider-Pattern und Permission-Checking

- `AuthProvider` kapselt Session-Status zentral in der Root-Shell.
- UI-Bausteine konsumieren Auth-Daten ausschließlich über `useAuth()`.
- Route-Guards (`createProtectedRoute`, `createAdminRoute`) erzwingen Auth/Rollenprüfung vor Seitenrendering.
- Bei `403` in IAM-Hooks wird `invalidatePermissions()` ausgelöst, um Session-/Rollenkontext konsistent zu halten.

### Ergänzung 2026-03: CSRF-Strategie in IAM-v1

- Alle mutierenden IAM-Endpunkte prüfen serverseitig den Header `X-Requested-With: XMLHttpRequest`.
- Client-Hooks setzen den Header standardisiert über gemeinsame API-Utilities.
- Fehlercode bei Verstoß: `csrf_validation_failed`.

### Ergänzung 2026-03: Organisationsverwaltung und Org-Kontext

- Organisationspfade bleiben strikt instanzzentriert; `instanceId` ist führend, `activeOrganizationId` ist daraus abgeleiteter Session-Fachkontext.
- `GET/PUT /api/v1/iam/me/context` bilden den kanonischen Session-Contract; requestbasierte Org-Overrides sind im ersten Schnitt ausgeschlossen.
- Organisationsmutationen und Kontextwechsel folgen denselben CSRF-, Audit- und Logger-Leitplanken wie übrige IAM-v1-Schreibpfade.
- Der Org-Switcher nutzt i18n-Keys für Label, Status und Fehlerzustände und kündigt Wechsel über `aria-live="polite"` an.
- Fehlercodes wie `invalid_organization_id`, `organization_inactive` und `csrf_validation_failed` bleiben stabil, damit UI, Audit und Betriebsanalyse konsistent korrelieren können.
- Organisations-Read-Models liefern Parent-, Typ-, Policy- und Zählerdaten serverseitig aus einem lesefähigen Modell, um N+1-Abfragen in der UI zu vermeiden.

### Ergänzung 2026-06: Strukturierte Permissions und Allow-only-Vererbung

- `iam.permissions` bleibt rückwärtskompatibel über `permission_key`, nutzt im Read-/Compute-Pfad aber strukturierte Felder (`action`, `resource_type`, `resource_id`, `scope`) als kanonisches Modell.
- Org-bezogene Vererbung wird nur innerhalb derselben `instanceId` ausgewertet; Parent-Scopes werden über die `hierarchy_path` des aktiven Zielkontexts gelesen.
- Effektive Permissions sind Allow-Grants; fehlende oder unpassende Allows bleiben fail-closed.
- Scope-Daten für Geo, Acting-As und Restriktionen werden in effektive Permissions übernommen und im Snapshot mitgeführt.
- Der Kompatibilitätspfad liest fehlende strukturierte Felder deterministisch aus `permission_key`, bis alle relevanten Alt-Daten migriert sind.

### Ergänzung 2026-04: Plugin-spezifische Permissions

- Produktive Fachplugins deklarieren eigene Rechtefamilien über `PluginDefinition.permissions`; die Permission-ID folgt `<pluginId>.<actionName>`.
- `content.*` bleibt ein Core-/Legacy-Content-Vertrag und darf nicht mehr als produktiver Guard für Fachplugins verwendet werden.
- Build-time-Validierung verhindert reservierte Plugin-Namespaces, doppelte Permission-IDs, fremde Namespace-Referenzen und nicht registrierte Guards.
- IAM speichert Plugin-Rechte als normale strukturierte Permissions mit `action` und `resourceType` aus dem Plugin-Namespace, zum Beispiel `news.update` und `news`.
- Navigation, Routing und Server-Fassaden prüfen dieselbe plugin-spezifische Permission; UI-Gates sind Komfort- und Transparenzschicht, die serverseitige Autorisierung bleibt maßgeblich.
- Die Rollenverwaltung gruppiert Plugin-Rechte fachlich, nutzt aber weiterhin den bestehenden Rollen-Permission-Vertrag.

### Ergänzung 2026-03: Gruppen und Geo-Provenance im IAM

- `EffectivePermission` erweitert die bisherige Rollentransparenz um `sourceGroupIds`; Clients erhalten damit direkte und gruppenvermittelte Herkunft ohne Zusatz-Queries.
- `MePermissionsResponse.provenance` fasst verdichtet zusammen, ob gruppenvermittelte Rechte oder Geo-Vererbung im aktuellen Snapshot enthalten sind.
- `AuthorizeResponse.provenance` benennt bei Hierarchieentscheidungen die wirksame Quelle (`inheritedFromOrganizationId`, `inheritedFromGeoUnitId`) sowie restriktive Gegenquellen (`restrictedByGeoUnitId`).
- `AuthorizeResponse.diagnostics.stage` bleibt eine allowlist-basierte Diagnosehilfe und exponiert keine internen SQL-, Cache- oder Policy-Dumps.
- UI- und API-Filter dürfen gruppenbasierte Herkunft nur auf Basis der strukturierten Felder (`sourceGroupIds`, `sourceKinds`) auswerten; implizite String-Heuristiken sind nicht zulässig.

### Ergänzung 2026-03: Multi-Host-Betrieb und Secrets-Handling

- **Instanz-Routing:** Eingehende Hosts werden über ein Subdomain-Modell (`<instanceId>.<SVA_PARENT_DOMAIN>`) auf `instanceId`s abgebildet. Im produktiven Multi-Tenant-Betrieb ist die zentrale Instanz-Registry die autoritative Freigabequelle; `SVA_ALLOWED_INSTANCE_IDS` bleibt nur als lokaler oder migrationsbezogener Fallback. Ablehnungen liefern identische `403`-Antworten (kein Host-Enumeration-Vektor).
- **Kanonischer Auth-Host:** OIDC-Flows laufen ausschließlich über die Root-Domain. Zielbild: Auth-Cookies werden auf die Parent-Domain gesetzt (`Domain=.<SVA_PARENT_DOMAIN>`) für SSO über Instanz-Subdomains. Aktuell ist das Cookie-Scoping host-only (siehe [ADR-020](../adr/ADR-020-kanonischer-auth-host-multi-host-grenze.md)).
- **Kanonische Runtime-Profile:** Die Betriebsmodi `local-keycloak`, `local-builder` und `studio` werden über `SVA_RUNTIME_PROFILE` sowie versionierte Profildefinitionen unter `config/runtime/` gesteuert. Die einheitliche Bedienoberfläche ist `pnpm env:*:<profil>`.
- **Secrets-Klassifizierung:** Vertrauliche Werte (Auth-Secrets, DB-Passwörter, Encryption-Keys) werden im Acceptance-Swarm als geschützte Stack-Umgebungsvariablen betrieben. Das Entrypoint-Skript (`entrypoint.sh`) validiert und normalisiert diese Werte, protokolliert sie aber nie. Nicht-vertrauliche Konfiguration bleibt ebenfalls als Stack-Umgebungsvariable versioniert beschrieben.
- **Startup-Validierung:** Lokale oder migrationsbezogene Fallback-Scopes über `SVA_ALLOWED_INSTANCE_IDS` werden beim Startup gegen ein Regex validiert (fail-fast). Ungültige Einträge oder IDN/Punycode-Labels führen in diesen Pfaden zum sofortigen Abbruch.

### Ergänzung 2026-06: Organisationsgebundene SVA-Mainserver-Integration

- Die Mainserver-Integration ist eine reine Server-Side-Integration; es gibt keinen generischen Browser-Proxy auf den externen GraphQL-Endpunkt.
- Fachadapter wie News stellen getypte, eng zugeschnittene Fassaden bereit; Browser-Plugins sprechen nur hosteigene HTTP-Endpunkte und importieren keine Mainserver-Servermodule.
- Events und POI folgen demselben Host-Fassadenmuster. Der Event-Editor bezieht POI-Auswahldaten über `/api/v1/mainserver/poi`, nicht über einen direkten Import von `@sva/plugin-poi`.
- Die Übersicht `/admin/content` nutzt `GET /api/v1/iam/contents` als host-geführten Read-Model-Vertrag. Browser-seitige Vollscans über mehrere Mainserver-Listen sind für diesen Pfad nicht zulässig; lokale IAM-Inhalte werden triggerbasiert in `iam.content_list_projection` gespiegelt und Mainserver-Typen serverseitig in dieselbe Projektion refresht.
- `apps/sva-studio-react` bleibt bewusst Host für TanStack-`createServerFn`-Bindings, Request-Matching und die Dispatch-Reihenfolge im Server-Entry. Diese Transport- und Framework-Bindung ist keine fachliche Package-Ownership.
- Organisationsgebundene Mainserver-Credentials werden verschlüsselt in einem dedizierten IAM-Speicher gehalten; persönliche Keycloak-Credentials (`mainserverUserApplicationId`, `mainserverUserApplicationSecret`) bleiben nur Fallback bei `org_or_personal`.
- Die Studio-Datenbank hält nur instanzbezogene Endpunktkonfiguration (`graphql_base_url`, `oauth_token_url`, Prüfstatus) in `iam.instance_integrations`.
- Der Credential-Resolver verwendet ausschließlich den aktiven Organisationskontext aus der Session; es gibt keinen impliziten Fallback auf andere Mitgliedsorganisationen.
- Credential-Caching bleibt kurzlebig im Prozessspeicher; Access-Tokens werden ebenfalls nur in-memory und vor Ablauf mit Skew erneuert.
- OAuth-Token werden pro `(instanceId, keycloakSubject, activeOrganizationId, credentialSignature)` gecacht; eine Persistenz in Session, Redis oder Postgres ist ausgeschlossen.
- Downstream-Headers propagieren `X-Request-Id` und Tracing-Kontext, damit Studio- und Mainserver-Logs korrelierbar bleiben.

### Ergänzung 2026-03: IAM-Transparenz-UI und Privacy-Self-Service

- Transparenz-Views verwenden ausschließlich getypte Read-Modelle aus `@sva/core`; Roh-JSON aus Einzelquellen bleibt außerhalb des Standard-UI-Pfads.
- Diagnoseinformationen aus `POST /iam/authorize` folgen einer festen Allowlist; nicht spezifizierte interne Gründe, Stacktraces oder verschachtelte Rohdaten werden nicht exponiert.
- Der Zugriff auf `/admin/iam` und seine Tabs folgt einer abgestuften Rollenmatrix:
  - Route und Tabs `rights`/`dsr`: `iam_admin`, `support_admin`, `system_admin`
  - Tab `governance` lesend zusätzlich: `security_admin`, `compliance_officer`
- Der Tab `/admin/iam?tab=deletion-rules` ist tenantgebunden und bleibt Root-/Plattform-Accounts ohne aktive `instanceId` verborgen.
- `/account/privacy` verarbeitet ausschließlich das eigene Subjekt; der Client akzeptiert dort keine fremden User- oder Account-IDs.
- Die Konten-Löschregeln im Datenschutz-Cockpit erscheinen nur für Tenant-Accounts; Root-/Plattform-Accounts ohne Tenant-Scope sehen diese Box nicht.
- Self-Service-Inhaltspräferenzen dürfen nur für das eigene Tenant-Konto geschrieben werden und nur dann, wenn der Tenant `allowContentPreferenceOverride = true` gesetzt hat.
- V1 leitet Inaktivität für Tenant-Löschregeln ausschließlich aus `MAX(iam.activity_logs.created_at WHERE event_type = 'login' AND result = 'success')` pro `instanceId` ab; fehlgeschlagene Login-Versuche halten den Lifecycle bewusst nicht künstlich aktiv, und neue Aktivitätstelemetrie gehört nicht zu diesem Scope.
- Das DSR-UI verwendet ein kanonisches Statusmodell (`queued`, `in_progress`, `completed`, `blocked`, `failed`) und zeigt Rohstatus nur sekundär zur Betriebsdiagnose.
- Transparenzlisten laden tab-spezifisch, serverseitig paginiert und filterbar; Detaildaten und User-Timeline-Ereignisse werden on demand geladen.
- Neue IAM-/Privacy-Texte laufen vollständig über Translation-Keys in `de` und `en`; harte Strings in den neuen Views sind nicht zulässig.

### Ergänzung 2026-06: Karten-, Geocoding- und Media-Querschnitt

- Tenantkonfiguration für Karten/Geocoding liegt ausschließlich im Interface-Typ `mapGeocoding`; Browser-Code erhält nur normalisierte Laufzeitflags und eine Style-URL.
- Host-Observability für Geocoding loggt nur normierte Outcomes wie `success`, `no_result`, `provider_error`, `timeout` oder `rate_limited`; Roh-Providerpayloads, Secrets und unredigierte Volladressen bleiben aus Logs ausgeschlossen.
- Der POI-Editor behandelt Geocoding- und Upload-Probleme als lokale, nicht blockierende Teilfehler; manuelle Felder und der übrige Save-Pfad bleiben nutzbar.
