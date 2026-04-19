# IAM-Diagnostik: Analysebericht und Folgechange-Vorlage

**Datum:** 2026-04-19
**Status:** Repo-Analyse abgeschlossen, Hybrid-Live-Triage auf `studio` gestartet
**Zuordnung:** `openspec/changes/update-iam-diagnostics-analysis-and-followup-plan`
**Vorbereiteter Folgechange:** `openspec/changes/refactor-iam-runtime-diagnostics-contract`

## 1. Ziel und aktueller Abschlussgrad

Dieser Bericht konserviert die repo-interne Analyse des heutigen IAM-Diagnosepfads. Er ersetzt kein Incident-Runbook und kein Refactoring, sondern bündelt:

- den tatsächlich vorhandenen Laufzeitpfad zwischen Tenant-Host, Auth, Session, Actor-/Membership-Auflösung, IAM-API, Keycloak, Registry und UI
- die heute schon vorhandenen Diagnose-, Recovery- und Drift-Signale
- die Lücken zwischen vorhandenen Signalschichten und einer UI-tauglichen, konsistenten Diagnose
- die Entscheidungsvorlage für die Folgearbeit

Der Bericht ist **nicht** der Abschluss des Changes. Der verpflichtende Live-Triage-Block gegen eine reale Umgebung läuft bereits auf `studio`, ist aber in diesem Arbeitskontext noch nicht vollständig abgeschlossen.

## 2. Analysierter Bestand im Repo

Die Analyse stützt sich primär auf diese Bausteine:

- `packages/auth/src/middleware.server.ts`
- `packages/auth/src/middleware-hosts.ts`
- `packages/auth/src/auth-server/session.ts`
- `packages/auth/src/iam-account-management/diagnostics.ts`
- `packages/auth/src/iam-account-management/schema-guard.ts`
- `packages/auth/src/iam-account-management/platform-handlers.ts`
- `packages/data/src/instance-registry/server.ts`
- `apps/sva-studio-react/src/providers/auth-provider.tsx`
- `apps/sva-studio-react/src/lib/iam-api.ts`
- `apps/sva-studio-react/src/routes/account/-account-profile-page.tsx`
- `docs/adr/ADR-018-auth-routing-error-contract-und-korrelation.md`
- `docs/adr/ADR-023-session-lifecycle-forced-reauth-und-silent-sso.md`
- `docs/adr/ADR-030-registry-basierte-instance-freigabe-und-provisioning.md`
- `docs/adr/ADR-031-tenant-spezifisches-realm-auth-routing.md`

## 3. End-to-End-Laufzeitpfad

### 3.1 Host, Registry und Tenant-Grenze

1. Requests werden hostbasiert klassifiziert.
2. Tenant-Hosts werden über die Instanz-Registry geprüft.
3. Fehlende oder nicht traffic-fähige Einträge werden in `packages/auth/src/middleware-hosts.ts` fail-closed mit `403 forbidden` abgewiesen.
4. Die eigentliche Host-Auflösung in `packages/data/src/instance-registry/server.ts` besitzt bereits strukturierte Drift- und Fallback-Signale wie `tenant_host_resolution_failed`, `tenant_host_resolution_primary_hostname_fallback` und `tenant_host_resolution_fallback_failed`.
5. `SVA_ALLOWED_INSTANCE_IDS` ist in diesem Pfad nicht mehr führend für die produktive Tenant-Freigabe, lebt aber noch in Fallback- und Ops-Pfaden fort.

### 3.2 OIDC, Session und Silent-Recovery

1. Der Browser bezieht seinen Auth-Zustand primär über `/auth/me`.
2. `AuthProvider` startet bei `401` genau einen stillen Recovery-Versuch über `/auth/login?silent=1`.
3. `packages/auth/src/auth-server/session.ts` deckt Session-Lesen, Hydration aus dem Access-Token, Token-Refresh und fail-soft-Verhalten bei nicht abgelaufener Session ab.
4. Session- und Refresh-Probleme sind heute über Logs und teils über `requestId` nachvollziehbar, werden in der UI aber weitgehend auf „nicht eingeloggt“ oder generische Fehlermeldungen reduziert.

### 3.3 Actor-/Membership-Auflösung und IAM-API

1. Admin-nahe Lesepfade erzwingen Actor- und Membership-Auflösung.
2. `packages/auth/src/iam-account-management/diagnostics.ts` klassifiziert bereits mehrere Datenbank- und Driftursachen und erzeugt allowlist-basierte Details.
3. Auf Browserseite liest `apps/sva-studio-react/src/lib/iam-api.ts` bereits `requestId` und `safeDetails`, hält diese Informationen aber nicht im Fehlerobjekt fest.
4. Folge: Der Browser kann Diagnoseinformationen zwar loggen, Seiten und Hooks können darauf heute aber kaum strukturiert reagieren.

### 3.4 Runtime-, Schema- und Provisioning-Diagnose

1. `platform-handlers.ts` kombiniert Datenbank-, Redis-, Keycloak- und Authorization-Cache-Readiness.
2. `schema-guard.ts` liefert bereits hochwertige Drift-Indikatoren mit `schema_object` und `expected_migration`.
3. Die Instanz-Registry und Provisioning-Pfade besitzen mit `driftSummary`, `details` und `requestId` bereits eigene Diagnoseartefakte.
4. Es fehlt jedoch noch ein gemeinsamer Klassifikationskern zwischen Runtime-IAM-Fehlern und Instanz-/Keycloak-Drift.

## 4. Vorhandene Diagnose- und Recovery-Mechanismen

### 4.1 Bereits vorhandene Stärken

- `requestId` ist auf mehreren Server- und Browserpfaden bereits vorhanden.
- allowlist-basierte Safe-Details existieren bereits für IAM-v1-Fehler.
- Schema-Drift wird nicht nur generisch behandelt, sondern mit `schema_object` und `expected_migration` angereichert.
- Silent-Recovery, Session-Hydration und Token-Refresh sind bereits als eigenständige Recovery-Pfade im Code sichtbar.
- Instanz- und Provisioning-Diagnosen liefern bereits run- und driftbezogene Evidenz.

### 4.2 Heute erkennbare Brüche

- Auth-, IAM-, Readiness- und Provisioning-Pfade verwenden noch keine einheitliche öffentliche Fehlerklasse.
- `IamHttpError` trägt `status`, `code` und `requestId`, aber keine `safeDetails`, keine Fehlerklasse und keinen handlungsleitenden Status.
- Self-Service-UI wie `/account` verzweigt faktisch vor allem auf `401` versus generische Fehler.
- Recovery-Erfolge und degradierte Zustände werden aus UI-Sicht noch nicht sauber unterschieden.
- Historische Fallbacks und Kompatibilitätspfade sind operativ nützlich, aber als Diagnose-Trade-off nicht zentral dokumentiert.
- Runtime-Realität und Konfigurations-/Ops-Realität sind bei der Instanzfreigabe nicht vollständig synchron: die produktive Laufzeit prüft Tenant-Hosts gegen die DB-Registry, während `SVA_ALLOWED_INSTANCE_IDS` weiter in SDK-Fallbacks, `parseInstanceIdFromHost(...)` und `doctor`-/`smoke`-/`tenant-auth-proof`-Scopes steckt.

## 5. Fehlertaxonomie und Problemkarte

### 5.1 `auth_resolution`

- Betroffene Schichten: Auth-Konfiguration, Login-/Callback-Einstieg, Auth-Middleware
- Heutige Signale: `unauthorized`, `internal_error`, korrelierbare `requestId`, Auth-Routing-Error-Contract
- Sichere Details: `requestId`
- Empfohlene nächste Handlung: Root-Host/Tenant-Kontext, Login-Einstieg und Callback-Reproduktion prüfen
- Diagnose-Lücke: Die UI sieht meist nur den Ausfall, nicht die Unterscheidung zwischen Konfigurationsfehler und allgemeinem Auth-Fehler

### 5.2 `tenant_host_validation`

- Betroffene Schichten: Host-Klassifikation, Registry-Lookup, Middleware
- Heutige Signale: `403 forbidden`, Logs mit `registry_found`, `registry_status`, `tenant_host_resolution_*`
- Sichere Details: `instance_id` nur wenn bereits freigegeben; sonst nur `requestId`
- Empfohlene nächste Handlung: Registry-Eintrag, Hostname, Status und Cache prüfen
- Diagnose-Lücke: Außenwirkung ist bewusst fail-closed und generisch; die betriebliche Trennschärfe lebt nur im Serverpfad
- Zusätzlicher Analysebefund: Für den eigentlichen Tenant-Traffic ist die DB-Registry führend, aber Hilfspfade zur `instanceId`-Ableitung und Ops-/Doctor-Scopes nutzen noch die Env-Allowlist. Dadurch können beobachtbare gesunde Tenants außerhalb des aktuellen `SVA_ALLOWED_INSTANCE_IDS`-Scopes liegen.

### 5.3 `oidc_discovery_or_exchange`

- Betroffene Schichten: OIDC-Discovery, Token-Refresh, Login-/Callback-Vertrag
- Heutige Signale: `token_refresh_failed`, Auth-Fehlervertrag, Silent-Recovery-Logs
- Sichere Details: `requestId`
- Empfohlene nächste Handlung: IdP-Erreichbarkeit, Tenant-Realm, Client-Konfiguration und Cookie-/Iframe-Bedingungen prüfen
- Diagnose-Lücke: Browserpfade unterscheiden OIDC-Fehler aktuell kaum von allgemeiner Session-Erosion

### 5.4 `session_store_or_session_hydration`

- Betroffene Schichten: Redis-Session-Store, Session-Hydration, Token-Refresh
- Heutige Signale: `SessionStoreUnavailableError`, `session_user_diagnostics`, `token_refresh_failed`
- Sichere Details: `dependency=redis`, `requestId`
- Empfohlene nächste Handlung: Redis-Readiness, Session-Ablauf, Hydration aus Access-Token und Refresh-Token prüfen
- Diagnose-Lücke: Ein Teil der Probleme wird als unauthentifiziertes Frontend-Verhalten sichtbar, obwohl eigentlich degradierte Session-Infrastruktur vorliegt

### 5.5 `actor_resolution_or_membership`

- Betroffene Schichten: IAM-Actor-Auflösung, Membership, JIT-/Read-Pfade
- Heutige Signale: `actor_resolution`, `missing_actor_account`, `missing_instance_membership`
- Sichere Details: `actor_resolution`, `instance_id`, `requestId`
- Empfohlene nächste Handlung: Account-/Membership-Konsistenz, JIT- oder Reconcile-Pfade prüfen
- Diagnose-Lücke: UI und Betrieb haben noch keinen gemeinsamen Statuspfad für „Benutzer eingeloggt, aber fachlich nicht vollständig auflösbar“

### 5.6 `keycloak_dependency`

- Betroffene Schichten: Keycloak-Admin-Client, Readiness, Rollen-/User-Projektionen
- Heutige Signale: `keycloak_dependency_failed`, `keycloak_admin_not_configured`, `keycloak_unavailable`, degradierte Projektionen
- Sichere Details: `dependency=keycloak`, `requestId`
- Empfohlene nächste Handlung: Realm, Client, Secret, Rechte und Connectivity prüfen
- Diagnose-Lücke: Keycloak-Ausfall, Realm-Drift und fehlende Admin-Rechte erscheinen noch nicht als getrennte Nutzerzustände

### 5.7 `database_or_schema_drift`

- Betroffene Schichten: Postgres, Schema-Guard, IAM-Repositories
- Heutige Signale: `schema_drift`, `missing_table`, `missing_column`, `policy_mismatch`, `expected_migration`
- Sichere Details: `schema_object`, `expected_migration`, `dependency=database`, `requestId`
- Empfohlene nächste Handlung: Goose-Stand, Drift zwischen Runtime und Datenbank sowie Schema-Guard-Befund prüfen
- Diagnose-Lücke: Die Signale sind serverseitig gut, werden aber UI-seitig bislang nur punktuell transportiert

### 5.8 `database_mapping_or_membership_inconsistency`

- Betroffene Schichten: IAM-Datenmodell, Account-/Membership-/Mapping-Daten
- Heutige Signale: `jit_provision_failed`, `foreign_key_violation`, Actor-/Membership-Signale, degradierte User-Projektionen
- Sichere Details: `constraint`, `instance_id`, `requestId`
- Empfohlene nächste Handlung: widersprüchliche Account-, Membership- und Mapping-Zeilen prüfen
- Diagnose-Lücke: Dieser Fehlerraum ist fachlich relevant, wird heute aber teilweise noch als allgemeiner DB- oder Actor-Fehler sichtbar

### 5.9 `registry_or_provisioning_drift`

- Betroffene Schichten: Instanz-Registry, Preflight, Plan, Provisioning-Runs
- Heutige Signale: `driftSummary`, `details`, `tenant_admin_client_not_configured`, Preflight-/Plan-Blocker
- Sichere Details: `requestId`, driftbezogene Summary-Felder
- Empfohlene nächste Handlung: betroffenen Tenant im Instanzpanel mit Preflight und Run-Historie korrelieren
- Diagnose-Lücke: Runtime-IAM-Fehler und Instanzpanel sprechen noch nicht durchgehend dieselbe Begriffswelt

### 5.10 `frontend_state_or_permission_staleness`

- Betroffene Schichten: Browserstate, `AuthProvider`, Hooks, Refetch-/Invalidate-Pfade
- Heutige Signale: `isRecoveringSession`, erneute `/auth/me`-Ladung, invalidierte Permissions
- Sichere Details: `requestId` nur indirekt über API-Fehler
- Empfohlene nächste Handlung: stilles Recovery, Hook-Invalidierung und UI-Refetch-Pfade prüfen
- Diagnose-Lücke: Es fehlt ein expliziter UI-Status zwischen „gesund“ und „hart fehlgeschlagen“

### 5.11 `legacy_workaround_or_regression`

- Betroffene Schichten: Registry-Fallbacks, Session-Kompatibilität, abwärtskompatible Sonderpfade
- Heutige Signale:
  - `tenant_host_resolution_primary_hostname_fallback`
  - `tenant_host_resolution_fallback_failed`
  - `fallback: return_encrypted` in `redis-session.server.ts`
  - Ableitung einer fehlenden `instanceId` aus dem Request-Host in `middleware-hosts.ts`
- Sichere Details: `requestId`, `reason_code`
- Empfohlene nächste Handlung: Sonderpfad erhalten, sichtbar machen oder gezielt abbauen
- Diagnose-Lücke: Diese Pfade stabilisieren den Betrieb, verschleiern aber ohne zentrale Dokumentation die eigentliche Root Cause

## 6. Historische Sonderpfade und potenziell verschlimmbesserte Fixes

Die Analyse identifiziert folgende Pfade als gezielte Beobachtungskandidaten für die Folgearbeit:

- Host-Auflösung mit `primary_hostname`-Fallback in der Registry
- Env-Allowlist `SVA_ALLOWED_INSTANCE_IDS` als verbleibender Fallback in SDK-/Ops-Pfaden trotz registrygeführter Runtime-Freigabe
- Rückgabe verschlüsselter oder Legacy-Sessiondaten bei fehlgeschlagener Token-Entschlüsselung
- Ableitung fehlender `instanceId` aus dem Request-Host statt harter Session-Inkonsistenz
- fail-soft bei Refresh-Fehlern, solange die Session formal noch nicht abgelaufen ist
- env-gesteuerte Profildiagnostik über `IAM_DEBUG_PROFILE_ERRORS`

Diese Pfade sind nicht automatisch falsch. Sie müssen aber künftig pro Fehlerklasse explizit als:

- erwünschter Recovery-Mechanismus
- Übergangs-/Kompatibilitätspfad
- Refactoring-Kandidat

klassifiziert werden.

## 7. UI-Diagnosevertrag als Zielbild

Für Folgearbeit wird dieser minimale öffentliche Diagnosekern empfohlen:

- `code`
- `classification`
- `requestId`
- `safeDetails`
- `status`
- `recommendedAction`

Statuswerte:

- `gesund`
- `degradiert`
- `recovery_laeuft`
- `manuelle_pruefung_erforderlich`

Leitplanken:

- `safeDetails` bleiben allowlist-basiert.
- Self-Service und Admin nutzen denselben Klassifikationskern.
- Unterschiedlich sind nur Formulierung, Detailtiefe und Handlungsempfehlung.
- Erfolgreiche stille Recovery darf einen degradierten Zustand nicht unsichtbar machen.

## 8. Hybrid-Live-Triage

### 8.1 Status

Der Live-Triage-Block wurde gegen das Runtime-Profil `studio` **teilweise ausgeführt**. Stand dieses Berichts:

- `pnpm env:doctor:studio --json` erfolgreich, Gesamtstatus `warn`
- `pnpm env:smoke:studio` erfolgreich
- `pnpm env:precheck:studio -- --json` erfolgreich, Gesamtstatus `warn`

Offen bleiben weiterhin:

- tenantbezogene Reproduktion in Self-Service- und Admin-Flows
- Konsolidierung aller realen Befunde in die Fehlerklassenmatrix

### 8.2 Zielprofil und Ausführungsmodus

Das frühere Profil `acceptance-hb` ist nicht mehr maßgeblich. Der verpflichtende Live-Triage-Block wird daher auf dem Runtime-Profil **`studio`** ausgeführt.

Begründung:

- `studio` ist das verbleibende produktionsnahe Remote-Profil mit Root-Host-, Tenant-Host-, Registry-, Provisioning- und OIDC-Vertrag.
- Die vorhandenen Betriebswerkzeuge `env:doctor:studio`, `env:smoke:studio`, `env:precheck:studio` und der lokale Operator-Pfad decken die kritischen IAM-Diagnosepfade bereits ab.
- Frühere Incident-Berichte wie `docs/reports/studio-runtime-recovery-2026-04-05.md` zeigen, dass gerade Registry-, RLS-, Tenant-Auth- und Driftprobleme auf `studio` real beobachtbar waren.

Pflichtquellen für die Live-Triage auf `studio`:

- `config/runtime/studio.vars`
- lokale Overrides bzw. Secret-Store für `studio`
- `pnpm env:doctor:studio --json`
- `pnpm env:smoke:studio`
- `pnpm env:precheck:studio -- --json`
- Root-Host-Ansicht `/admin/instances`
- bestehende Deploy- und Recovery-Evidenz unter `artifacts/runtime/deployments/` und `docs/reports/`

### 8.2 Pflicht-Szenario-Matrix

Für die Live-Triage müssen mindestens diese Kombinationen geprüft werden:

- Tenant-Host gültig/ungültig
- Session gültig/abgelaufen/Refresh fehlgeschlagen
- Silent-Recovery erfolgreich/fehlgeschlagen
- Actor-Auflösung erfolgreich/fehlend
- Membership konsistent/inkonsistent
- Keycloak erreichbar/nicht erreichbar
- Schema im Soll/Drift erkannt
- Registry-/Provisioning-Zustand konsistent/widersprüchlich

### 8.3 Konkrete Kommandoreihenfolge für `studio`

1. Operative Konfiguration prüfen
   - `config/runtime/studio.vars`
   - lokale Overrides und Secret-Quelle auf Vollständigkeit für `KEYCLOAK_ADMIN_*`, DB-, Redis- und Auth-Secrets prüfen
2. Primäre Diagnostik starten
   - `pnpm env:doctor:studio --json`
3. Öffentliche Runtime-Signale gegen die laufende App prüfen
   - `pnpm env:smoke:studio`
4. Produktnahe Soll-/Ist- und Driftprüfung ergänzen
   - `pnpm env:precheck:studio -- --json`
5. Root-Host-Control-Plane für betroffene Tenants prüfen
   - `/admin/instances`
   - Preflight, Plan, `driftSummary`, Run-Historie und `requestId`-nahe Hinweise erfassen
6. Tenant-spezifische Reproduktion durchführen
   - Login
   - Callback
   - `/auth/me`
   - Self-Service-Pfade unter `/account`
   - relevante Admin-Pfade
7. Falls nötig bestehende Deploy- und Recovery-Evidenz dazunehmen
   - letzte Reports unter `artifacts/runtime/deployments/`
   - bekannte Incident-Berichte unter `docs/reports/`

Bevorzugte Auswertungsreihenfolge:

- zuerst `doctor`
- dann `smoke`
- dann `precheck`
- erst danach tiefer in Root-Host-UI, Logs oder DB-/Keycloak-Evidenz gehen

### 8.4 Pflichtfelder je Befund

Jeder reale Befund dokumentiert:

- Symptom
- Fehlerklasse
- Reproduktionspfad
- vermutete Ursache
- vorhandene Signale
- fehlende Signale
- Sicherheitsgrenze der UI-Ausgabe
- empfohlene Maßnahme

### 8.5 Studio-spezifische Beobachtungsschwerpunkte

Für `studio` sind zusätzlich diese Fehlerbilder priorisiert zu prüfen:

- Tenant-Host-Auflösung gegen `iam.instances` und `iam.instance_hostnames`
- RLS- oder App-User-Sichtprobleme auf Registry-Tabellen
- fehlende oder widersprüchliche `authRealm`-, `authClientId`- oder `authIssuerUrl`-Daten aktiver Instanzen
- Tenant-Admin-Client-Drift und Provisioning-Blocker
- Tenant-spezifische OIDC-Redirects und `instanceId`-Claim-Auflösung
- Unterschiede zwischen Root-Host-Diagnose, Tenant-Host-Verhalten und `APP_DB_USER`-Sicht

### 8.6 Bisherige Live-Befunde auf `studio`

#### Gesamtbild

Die bisherige Live-Triage zeigt **keinen aktuellen harten IAM-Ausfall** auf `studio`. Die produktionsnahen Checks sind funktional grün; der verbleibende Warnzustand betrifft aktuell die Observability-Evidenz und nicht den Kernpfad von Registry, Auth, Session, Keycloak oder Schema.

#### Bestätigte positive Befunde

- Runtime-Konfiguration vollständig; sensible und nicht-sensible Pflichtschlüssel sind gesetzt.
- `/health/live` und `/health/ready` antworten erfolgreich.
- Datenbank, Redis, Keycloak und Authorization-Cache sind laut `doctor` und `ready` im Status `ready`.
- `app-db-principal` ist grün; die App bestätigt Registry-/Auth-Readiness aus Sicht von `APP_DB_USER`.
- `tenant-auth-proof` ist grün; für `bb-guben` und `de-musterhausen` wurden tenant-spezifische Redirects gegen die jeweils erwarteten Realms beobachtet.
- Zusätzlich wurde `https://hb-meinquartier.studio.smart-village.app` direkt von außen geprüft:
  - `/` antwortet mit `200`
  - `/health/live` antwortet mit `200`
  - `/health/ready` antwortet mit `200`
  - `/auth/login` leitet per `302` tenant-spezifisch auf den Realm `saas-hb-meinquartier` weiter
  - die Readiness-Payload zeigt `activeRealm=saas-hb-meinquartier`, `scopeKind=instance`, einen konfigurierten Login-Client `sva-studio` und einen konfigurierten Tenant-Admin-Client `sva-studio-admin`
- `image-platform`, `acceptance-services`, `acceptance-ingress-consistency` und `runtime-env-live` sind im `precheck` grün.
- Schema-, Instance-Auth-, Tenant-Admin- und Hostname-Verträge werden auf `studio` aktuell über die dedizierten Job-/Bootstrap-Evidenzen als erfüllt bewertet.

#### Root-Host-Befunde unter `/admin/instances`

- `bb-guben`
  - Status `Active`, Konfigurationsstatus `complete`, `13 / 13 requirements satisfied`
  - Root-Host-Formdaten sind konsistent mit dem beobachteten Tenant-Pfad: `authRealm=bb-guben`, `authClientId=sva-studio`, `tenantAdminClientId=sva-studio-admin`
  - Preflight vollständig `OK`; Preview meldet nur `verify` beziehungsweise `skip`
  - Keycloak-Status vollständig `OK`
  - Run-Historie zeigt aktuell erfolgreiche `provision`- und `rotate_client_secret`-Läufe; ältere fehlgeschlagene Läufe dokumentieren frühere Secret-Drift, aber keinen aktuellen Blocker
- `de-musterhausen`
  - Status `Active`, aber Konfigurationsstatus `incomplete`, nur `11 / 13 requirements satisfied`
  - Root-Host-Formdaten sind grundsätzlich konsistent (`authRealm=de-musterhausen`, `authClientId=sva-studio`, `tenantAdminClientId=sva-studio-admin`)
  - Preflight bleibt grün, aber die Keycloak-Statuskarte markiert `Tenant admin client exists`, `Tenant admin client secret configured`, `Tenant admin client secret readable` und `Tenant admin client secret aligned with Keycloak` als `Missing`
  - Die Preview plant entsprechend einen `update` am OIDC-Client und ein `create` für den Tenant-Admin-Pfad
  - Die aktuelle Root-Host-Sicht widerspricht damit dem zuvor grünen äußeren Tenant-Zugriff nicht, zeigt aber einen aktiven `registry_or_provisioning_drift`-Befund im Tenant-Admin-Teilpfad
- `hb-meinquartier`
  - Status `Active`, Konfigurationsstatus `complete`, `13 / 13 requirements satisfied`
  - Root-Host-Formdaten passen zum extern beobachteten Tenant-Verhalten: `authRealm=saas-hb-meinquartier`, `authClientId=sva-studio`, `tenantAdminClientId=sva-studio-admin`
  - Preflight, Preview und Keycloak-Status sind aktuell vollständig grün
  - Die Run-Historie ist deutlich länger und enthält mehrere ältere fehlgeschlagene `provision`, `rotate_client_secret` und `reset_tenant_admin`-Läufe mit Secret-Drift, fehlendem Tenant-Admin und `create_user failed: User exists with same email`
  - Ein zusätzlicher Altlast-Hinweis ist sichtbar: frühere `new`-Provisioning-Läufe scheiterten auf `Realm saas-hb-meinquartier already exists`; das ist heute kein aktueller Blocker mehr, aber ein klarer Kandidat für `legacy_workaround_or_regression`

#### Tenant-Reproduktion in Self-Service- und Admin-Flows

- `bb-guben`
  - `/account` leitet korrekt auf den Realm `bb-guben` um, Callback und Session-Wiederaufnahme funktionieren
  - `/auth/me`, `iam/me/context`, Profil, Permissions und Readiness laden mit `200`
  - `/admin/users` lädt erfolgreich und zeigt eine konsistente Benutzerliste inklusive Tenant-Admin-Eintrag
  - Ergebnis: Root-Host-, Auth-, Session- und Admin-Sicht sind für diesen Tenant aktuell konsistent
- `de-musterhausen`
  - `/account` leitet korrekt auf den Realm `de-musterhausen` um; Callback, `/auth/me`, Permissions und Readiness laden technisch mit `200`
  - `auth/me` enthält einen technisch vollwertigen User mit `instanceId=de-musterhausen` und Keycloak-Rollen inklusive `system_admin`
  - Die Account-UI zeigt aber einen fachlich degradieren Zustand: UUID statt normalem Profilnamen, `Status: Ausstehend`, leere Rolle
  - `/admin/users` lädt zwar, zeigt aber nur einen einzelnen `Ausstehend`-Datensatz mit fehlender E-Mail und fehlender Rolle
  - Ergebnis: kein Auth-/OIDC-Ausfall, sondern eine reale Inkonsistenz zwischen technischem Login-Zustand und fachlicher IAM-/Membership-/Profilauflösung
- `hb-meinquartier`
  - `/account` leitet korrekt auf den Realm `saas-hb-meinquartier` um; Callback, `/auth/me`, Permissions und Readiness laden technisch mit `200`
  - `auth/me` enthält einen technisch vollwertigen User mit `instanceId=hb-meinquartier` und mehreren Rollen inklusive `system_admin`
  - `/admin/users` lädt erfolgreich und zeigt einen großen aktiven Benutzerbestand
  - Die Account-UI ist dabei nur teilweise konsistent: Name und Status sind korrekt, die Rollenanzeige bleibt jedoch leer; zusätzlich liefert `api/v1/iam/users/me/profile` in diesem Lauf keinen fachlich befüllten Profilkörper
  - Ergebnis: der Tenant ist operativ nutzbar, zeigt aber weiterhin einen weicheren Mapping-/Profilbefund unterhalb der erfolgreichen Auth- und Admin-Funktion

#### Keycloak-User- und Rollenabgleich als eigener Hauptbefund

- Der Abgleich von Studio-Usern und Studio-Rollen mit Keycloak ist **kein Randproblem**, sondern ein eigener Fehlerraum mit real beobachtbaren UI- und Runtime-Auswirkungen.
- `bb-guben`
  - die Rollenverwaltung zeigt bereits vor dem Test eine gemischte beziehungsweise überwiegend fehlerhafte Sync-Lage
  - sichtbare Fehlercodes sind `IDP_FORBIDDEN`, `IDP_UNAVAILABLE` und `DB_WRITE_FAILED`
  - ein expliziter Rollen-Reconcile über `/api/v1/iam/admin/reconcile` wird technisch mit `200` angenommen, verbessert den Zustand aber nicht; die Rollenliste bleibt praktisch vollständig im Status `failed`
- `de-musterhausen`
  - die Rollenverwaltung hatte vor dem Test **gar keine Rollenprojektion**
  - der Rollen-Reconcile wird technisch erfolgreich abgeschlossen, meldet aber sinngemäß `geprüft`, `korrigiert: 0`, `manuell prüfen: 2`
  - die Rollenliste bleibt danach leer; parallel bleibt die User-Projektion fachlich inkonsistent
- `hb-meinquartier`
  - die Rollenverwaltung enthält vor dem Test nur eine einzelne fehlgeschlagene Rolle mit `IDP_FORBIDDEN`
  - der Rollen-Reconcile schlägt real mit `503` fehl
  - parallel kippt die Health-Karte in der UI auf `unknown` und liefert eine korrelierbare `requestId`
- Einordnung:
  - der User-/Rollenabgleich mit Keycloak muss künftig als eigener Diagnose- und Folgechange-Arbeitsstrang behandelt werden
  - betroffen sind nicht nur Root-Host- oder Provisioning-Pfade, sondern konkrete Admin- und Self-Service-Flows in der produktnahen UI

#### Retest nach neuem Online-Stand

- Der nachgelagerte Retest gegen den neu ausgerollten Stand zeigt eine **klar verbesserte Fehlerdarstellung**, aber keinen durchgehenden fachlichen Fix des Keycloak-User-/Rollenabgleichs.
- `de-musterhausen`
  - `/admin/roles` lädt jetzt stabil; der Rollen-Reconcile ist in Browser-Logs und UI nachvollziehbar sichtbar
  - Browser-Logs zeigen `roles_reconcile_started` und `roles_reconcile_succeeded`
  - die UI meldet: `Reconcile abgeschlossen. Geprüft: 2, korrigiert: 0, fehlgeschlagen: 0, manuell prüfen: 2.`
  - die Rollenliste bleibt trotzdem leer (`Keine Rollen gefunden.`)
  - `/admin/users` ist gegenüber dem ersten Lauf deutlich verbessert: statt UUID-/`Ausstehend`-Befund werden zwei echte Benutzer mit Name und E-Mail angezeigt
  - gleichzeitig bleibt die Rollenspalte leer (`-`), und der manuell ausgelöste User-Sync `Aus Keycloak synchronisieren` führt weiterhin in einen instabilen Pfad; nach `user_sync_keycloak_started` hing der Tab beziehungsweise der DevTools-Zugriff erneut auf Timeout
- `bb-guben`
  - `/admin/roles` bleibt fachlich deutlich degradiert, ist aber nun diagnostisch besser lesbar
  - Browser-Logs zeigen auch hier `roles_reconcile_started` und `roles_reconcile_succeeded`
  - die UI meldet: `Reconcile abgeschlossen. Geprüft: 17, korrigiert: 0, fehlgeschlagen: 16, manuell prüfen: 1.`
  - die Rollen bleiben weitgehend im Status `Fehlgeschlagen`; konkrete Fehlercodes sind weiterhin `IDP_FORBIDDEN` und `IDP_UNAVAILABLE`
  - zusätzlich bleibt die Diskrepanz bestehen, dass der allgemeine Systemstatus `Alles grün` meldet, während der fachliche Rollenabgleich massiv fehlschlägt
- `hb-meinquartier`
  - der frühere `503`-Zusammenbruch auf `/admin/roles` war im Retest nicht mehr reproduzierbar
  - die Seite lädt stabil, der Systemstatus bleibt `Alles grün`, und der Rollen-Reconcile ist sichtbar instrumentiert
  - Browser-Logs zeigen `roles_reconcile_started` und `roles_reconcile_succeeded`
  - die UI meldet: `Reconcile abgeschlossen. Geprüft: 3, korrigiert: 0, fehlgeschlagen: 1, manuell prüfen: 2.`
  - der fachliche Fehler bleibt aber bestehen: die vorhandene Rolle `admin` steht weiter auf `Fehlgeschlagen` mit `Synchronisierungsfehlercode: IDP_FORBIDDEN`
- Retest-Einordnung:
  - verbessert wurden vor allem Korrelation, Statussichtbarkeit und UI-taugliche Rückmeldung
  - nicht behoben ist der eigentliche tenantübergreifende Keycloak-User-/Rollenabgleich
  - `de-musterhausen` bleibt der Referenzfall für einen gemischten Befund aus verbesserter Benutzerprojektion, leerer Rollenprojektion und instabilem User-Sync
  - `bb-guben` bleibt der Referenzfall für breit sichtbare Reconcile-Fehler mit konkreten IDP-Fehlercodes
  - `hb-meinquartier` bleibt der Referenzfall dafür, dass frühere harte Laufzeitfehler in bessere Diagnose überführt wurden, der fachliche Rollenabgleich aber weiter fehlschlägt

#### Aktueller Warnbefund

- `observability-readiness` meldet in `doctor` und `precheck` den Status `warn` mit `observability_probe_empty`.
- Einordnung:
  - Kein Hinweis auf einen aktuellen funktionalen IAM-Fehler
  - Hinweis auf fehlende frische Loki-Evidenz trotz aktivem Console-to-Loki-Modus
  - passt zu dem bereits bekannten Muster aus früheren `studio`-Recovery-Berichten, in denen Observability-Evidence und harte Funktionsfähigkeit getrennt bewertet werden mussten

#### Vorläufige Zuordnung zur Fehlertaxonomie

- Primäre aktuelle Zuordnung: kein aktiver Befund in `tenant_host_validation`, `keycloak_dependency` oder `database_or_schema_drift`
- Aktiver Teilbefund: `de-musterhausen` zeigt in der Root-Host-Control-Plane einen konkreten `registry_or_provisioning_drift` rund um Tenant-Admin-Client und Tenant-Admin-Client-Secret
- Laufzeitnaher Zusatzbefund: `de-musterhausen` zeigt zusätzlich einen realen `actor_resolution_or_membership`- beziehungsweise `database_mapping_or_membership_inconsistency`-Symptompfad, weil technische Rollen vorhanden sind, die fachliche Profil- und Rollenauflösung in UI und Admin-Liste aber degradieren
- Laufzeitnaher Zusatzbefund: `hb-meinquartier` zeigt keinen harten Ausfall, aber einen weicheren `database_mapping_or_membership_inconsistency`- oder Profilprojektionsbefund, weil Auth und Admin funktionieren, die Rollen-/Profildarstellung im Self-Service aber unvollständig bleibt
- Eigenständiger Hauptbefund: der Keycloak-User- und Rollenabgleich zeigt tenantübergreifend reale `keycloak_dependency`, `registry_or_provisioning_drift` und `database_mapping_or_membership_inconsistency`-Symptome; die Fehlercodes reichen aktuell von `IDP_FORBIDDEN` über `IDP_UNAVAILABLE` bis `DB_WRITE_FAILED`. Der neuere Online-Stand reduziert dabei harte Laufzeitabbrüche und macht Reconcile-Ergebnisse explizit sichtbar, behebt aber die fachlichen Sync-Probleme nicht.
- Sekundäre Zuordnung: leichter Befund im Bereich `legacy_workaround_or_regression` bzw. Observability-Transport, weil die Evidenzschicht hinter der Laufzeitfunktion zurückbleibt
- Zusätzlicher Konfigurationsbefund: `hb-meinquartier` ist beobachtbar gesund, ist aber im aktuellen `studio`-Profil nicht Teil von `SVA_ALLOWED_INSTANCE_IDS` und damit nicht automatisch Teil des vorhandenen `tenant-auth-proof`-Scopes
- Struktureller Folgearbeitsbefund: `SVA_ALLOWED_INSTANCE_IDS` ist nicht mehr die führende Freigabequelle, beeinflusst aber weiterhin Fallback-Hostableitung und Triage-Scoping. Diese Doppelrolle sollte im Folgechange gezielt aufgelöst werden.
- Historischer Zusatzbefund: `hb-meinquartier` zeigt alte, heute nicht mehr aktive Provisioning- und Reset-Fehler rund um Secret-Drift, Realm-Kollisionen und vorhandene Benutzerkonten; diese Historie gehört in die Folgearbeit, weil sie auf wiederkehrende Drift- und Legacy-Migrationsmuster hinweist.

#### Nächste notwendige Live-Schritte

- den degradierten Self-Service- und Admin-Zustand von `de-musterhausen` gegen Registry-, Membership- und Tenant-Admin-Daten korrelieren
- den partiellen Profil-/Rollenbefund von `hb-meinquartier` gegen die erfolgreiche Admin-Sicht und die historische Drift-Historie korrelieren
- die User- und Rollen-Sync-Pfade gegen Keycloak als eigenen Fehlerraum korrelieren: Reconcile-Endpunkte, Fehlermeldungen, Rechtebild des technischen Clients und DB-Schreibpfade
- Warnbefund `observability_probe_empty` separat als Evidenz-/Transportproblem gegen aktuelle Runtime-Funktion abgrenzen
- bei allen drei Tenants explizit festhalten, ob Registry-Realität und `SVA_ALLOWED_INSTANCE_IDS`-basierte Ops-Sicht auseinanderlaufen

## 9. Entscheidungsvorlage für den Folgechange-Zuschnitt

### Option A: Backend-/Diagnosevertrag zuerst

- Scope: Fehlerklassen, öffentliche Diagnosefelder, Server-zu-Browser-Transport, gemeinsame Klassifikation für Auth/IAM/Provisioning-nahe Fehler
- Risiko: UI bleibt kurzfristig noch konservativ, gewinnt aber sofort bessere Grundlagen
- Abhängigkeiten: `packages/auth`, `apps/sva-studio-react/src/lib/iam-api.ts`, relevante Contracts in `@sva/core`
- Testbedarf: Unit-Tests für Fehlerklassifikation, API-Contracts, Browser-Parsing, Regressionen in Auth-/IAM-Endpoints
- Reihenfolge: zuerst diese Option

### Option B: UI-/Statusbilder zuerst

- Scope: Self-Service- und Admin-Fehlerdarstellung, degradierte Zustände, Recovery-Anzeigen
- Risiko: Ohne sauberen Vertragskern entsteht UI-seitig erneut Logikduplikation
- Abhängigkeiten: belastbare Fehlerfelder aus Server und Browser-API
- Testbedarf: Seiten-/Hook-Tests plus E2E für degradierte Zustände
- Reihenfolge: erst nach oder gemeinsam mit Option A

### Option C: Daten-/Drift-/Bereinigungspfad zuerst

- Scope: Membership-, Mapping- und Registry-/Provisioning-Drift, Bereinigungshilfen, zielgerichtete Diagnose für Altlasten
- Risiko: Hoher Wirkungsgrad, aber ohne Diagnosevertrag nur begrenzt sichtbar
- Abhängigkeiten: belastbare Trennschärfe zwischen Schema-, Mapping-, Actor- und Provisioning-Fehlern
- Testbedarf: DB-/Repository-Tests, Drift-Szenarien, Reconcile-/Preflight-Tests
- Reihenfolge: nach Option A oder gekoppelt an einen kleineren diagnostischen Kern

### Empfehlung

Empfohlen wird **Option A: Backend-/Diagnosevertrag zuerst**. Sie reduziert das Risiko, dass UI, Betriebsdiagnostik und Datenbereinigung erneut unterschiedliche Begriffswelten aufbauen.

Unabhängig vom Zuschnitt ist zusätzlich festzuhalten:

- die Folgearbeit sollte die verbliebene Doppelrolle von `SVA_ALLOWED_INSTANCE_IDS` explizit behandeln
- Zielbild ist eine registrygeführte Runtime- und Ops-Sicht ohne implizite Env-Allowlist als produktionsnahe Freigabequelle
- sofern `SVA_ALLOWED_INSTANCE_IDS` erhalten bleibt, dann nur als klar dokumentierter lokaler oder migrationsbezogener Fallback

## 10. Vorbereiteter Folgechange

Als empfohlene Folgearbeit wurde dieser vorbereitete Change angelegt:

- `openspec/changes/refactor-iam-runtime-diagnostics-contract/`

Er bündelt:

- Proposal
- Design
- Tasks
- Spec-Deltas für `iam-core`, `account-ui` und `instance-provisioning`

## 11. ADR-Bedarf

Der aktuelle Analysechange führt **noch keine neue ADR** ein. Dafür gibt es derzeit keinen belastbaren Anlass, weil noch keine endgültige Architekturentscheidung über:

- den finalen öffentlichen Diagnosevertrag
- die Sichtbarkeit einzelner Recovery-Pfade
- die dauerhafte Behandlung historischer Workarounds

getroffen wurde.

Eine neue ADR wird erforderlich, wenn die Folgearbeit einen verbindlichen, cross-cutting Diagnosevertrag oder eine neue sichtbare Recovery-Policy dauerhaft festschreibt.

## 12. Umsetzungsbefund zum Folgechange `refactor-iam-runtime-consistency-remediation`

Stand dieses Folgechanges:

- Reconcile- und User-Sync-Berichte liefern jetzt deterministische Abschlusszustände mit expliziten Zählwerten statt stillschweigender Teilergebnisse.
- blockerrelevanter Tenant-Admin- oder Provisioning-Drift blockiert tenantlokale Reconcile-/Sync-Starts fail-closed.
- Profil-, User- und Admin-Read-Pfade nutzen denselben kanonischen Projektionskern für Rollen- und Profildarstellung.
- Browser- und UI-Pfade behalten `classification`, `requestId` und `safeDetails` für drift- und reconcile-nahe Fehler sichtbar.

Verbleibende operatorpflichtige Restfälle:

- fachlich mehrdeutige `manual_review`-Fälle werden bewusst nicht automatisch korrigiert
- reale Tenant-Datenzustände aus `de-musterhausen`, `bb-guben` und `hb-meinquartier` bleiben als Referenzmatrix für weitere produktnahe Verifikation relevant
