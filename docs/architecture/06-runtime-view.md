# 06 Laufzeitsicht

## Zweck

Dieser Abschnitt beschreibt kritische Laufzeitszenarien und Interaktionen.

## Mindestinhalte

- Mindestens 3 kritische End-to-End-Szenarien
- Sequenz der beteiligten Bausteine pro Szenario
- Fehler- und Ausnahmeverhalten für kritische Flows

## Aktueller Stand

### Szenario 1: App-Start + Route-Komposition

1. App lädt `getRouter()` in `apps/sva-studio-react/src/router.tsx`
2. Core-Route-Factories werden client- oder serverseitig geladen
3. Plugin-Route-Factories werden mit Core-Factories gemerged
4. `buildRouteTree(...)` erzeugt Runtime-RouteTree
5. Router wird mit RouteTree und SSR-Kontext erstellt

Fehlerpfad:

- Fehlerhafte Route-Factory oder server-only Import im Client kann Build/Runtime brechen.

### Szenario 2: OIDC Login-Flow

1. Browser ruft `/auth/login` auf
2. `loginHandler()` erstellt PKCE-LoginState, setzt signiertes State-Cookie und redirectet zum IdP
3. IdP redirectet nach `/auth/callback?code=...&state=...`
4. `callbackHandler()` validiert State, tauscht Code gegen Tokens und erstellt Redis-Session
5. Session-Cookie wird gesetzt, Redirect zur App
6. App ruft `/auth/me` fuer User-Kontext

Fehlerpfad:

- Fehlender/abgelaufener State -> Redirect mit Fehlerstatus
- Token-/Refresh-Fehler -> Session invalidiert oder unauthorized Antwort

### Szenario 3: Logging/Observability bei Server-Requests

1. Server-Code loggt via `createSdkLogger(...)`
2. Context (workspace/request) wird über AsyncLocalStorage injiziert
3. Direct OTEL Transport emittiert LogRecords an globalen LoggerProvider
4. OTEL Processor redacted und filtert Labels
5. Export via OTLP an Collector -> Loki/Prometheus

Fehlerpfad:

- OTEL nicht initialisiert: Console-Fallback bleibt aktiv
- fehlender LoggerProvider: OTEL-Emission no-op, App bleibt lauffähig

### Szenario 4: Initialer Shell-Ladezustand mit Skeleton UI

1. Root-Shell rendert initial in einem kurzen Loading-Zustand
2. `Header` zeigt Skeleton für Auth-Aktion in der Kopfzeile
3. `Sidebar` zeigt Skeleton-Navigation
4. `AppShell` zeigt Skeleton-Platzhalter im Contentbereich
5. Nach Abschluss des initialen Zustands wird auf regulären Inhalt gewechselt

Fehlerpfad:

- Falls Route-/Inhaltsdaten verzögert verfügbar sind, bleibt die Shell strukturell stabil (kein Layout-Springen), bis regulärer Inhalt rendert.

### Szenario 5: IAM Authorize mit ABAC, Hierarchie und Snapshot-Cache

1. Client ruft `POST /iam/authorize` mit `instanceId`, `action`, `resource` und optionalem ABAC-Kontext auf.
2. Server erzwingt Instanzgrenze und wertet Hard-Deny-Regeln zuerst aus.
3. Permission-Snapshot wird über User-/Instanz-/Org-Kontext im Cache gesucht.
4. Bei Cache-Hit wertet die Engine die Entscheidung in fester Reihenfolge aus: RBAC-Basis, danach ABAC-Regeln und Hierarchie-Restriktionen.
5. Bei Miss/Stale erfolgt Recompute aus Postgres als fachlicher Quelle und anschließende Snapshot-Aktualisierung.
6. Bei Recompute-Fehler im Stale-Pfad greift Fail-Closed (`cache_stale_guard`).

Fehlerpfad:

- Eventverlust bei Invalidation: TTL/Recompute begrenzen Stale-Dauer.
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

### Szenario 7: Cache-Invalidierung nach Rollen-/Policy-Änderung

1. Änderung an Rollen, Permission-Zuordnung oder Policy wird in Postgres persistiert.
2. Writer emittiert ein Invalidation-Ereignis über `NOTIFY` mit `instanceId` und betroffenem Scope.
3. Cache-Worker in `packages/auth` empfängt das Ereignis und invalidiert passende Snapshots.
4. Nachfolgende `POST /iam/authorize`-Aufrufe erzwingen Recompute für invalidierte Einträge.
5. Invalidation und Recompute werden mit `request_id`/`trace_id` strukturiert geloggt.

Fehlerpfad:

- Event kommt verspätet oder gar nicht an: TTL + Recompute-Fallback begrenzen Stale-Dauer.
- Invalidation schlägt fehl: `cache_invalidate_failed` wird geloggt, Entscheidungspfad bleibt fail-closed.

Referenzen:

- `apps/sva-studio-react/src/router.tsx`
- `apps/sva-studio-react/src/routes/__root.tsx`
- `packages/auth/src/routes.server.ts`
- `packages/auth/src/iam-authorization.server.ts`
- `packages/auth/src/iam-governance.server.ts`
- `packages/auth/src/iam-authorization.cache.ts`
- `packages/sdk/src/logger/index.server.ts`
- `packages/monitoring-client/src/otel.server.ts`
- `docs/architecture/iam-service-architektur.md`

### Szenario 8: Login -> JIT-Provisioning -> Profilpflege

1. User meldet sich über `/auth/login` und `/auth/callback` an.
2. `handleCallback()` erstellt Session und triggert `jitProvisionAccount(...)`.
3. Account wird per `INSERT ... ON CONFLICT (keycloak_subject, instance_id)` idempotent angelegt/aktualisiert.
4. Erstanlage wird als `user.jit_provisioned` auditierbar protokolliert.
5. User öffnet `/account`, Profil wird über `GET /api/v1/iam/users/me/profile` geladen.
6. Änderungen werden über `PATCH /api/v1/iam/users/me/profile` gespeichert.

Fehlerpfad:

- JIT-Fehler blockiert den Login nicht, wird aber strukturiert geloggt.
- Profil-Update ohne gültigen CSRF-Header wird serverseitig abgewiesen.

### Szenario 9: Admin-Flow User- und Rollenverwaltung

1. `system_admin`/`app_manager` öffnet `/admin/users`.
2. Liste wird paginiert über `GET /api/v1/iam/users` geladen.
3. Bearbeitung erfolgt in `/admin/users/$userId` per Tabs und `PATCH /api/v1/iam/users/$userId`.
4. Rollen-Änderungen triggern Permission-Invalidierung über `pg_notify`.
5. `system_admin` verwaltet Custom-Rollen auf `/admin/roles` mit `POST/PATCH/DELETE /api/v1/iam/roles`.
6. Der Backend-Service führt Rollen-CRUD Keycloak-First aus und schreibt danach das lokale Mapping.
7. Bei Erfolg werden `role.sync_succeeded` und `role.created|updated|deleted` auditierbar protokolliert.
8. Bei Fehlern werden `sync_state`, `last_error_code`, Metriken und `role.sync_failed` aktualisiert.

Fehlerpfad:

- Nicht autorisierte Rollen werden via Route-Guard umgeleitet.
- Last-Admin-/Self-Protection wird serverseitig mit Konfliktantwort geschützt.
- Schlägt der DB-Schritt nach erfolgreichem Keycloak-Write fehl, läuft eine Compensation; misslingt auch diese, bleibt der Vorgang als `COMPENSATION_FAILED` sichtbar.

### Szenario 10: Geplanter oder manueller Rollen-Reconcile-Lauf

1. `system_admin` triggert `POST /api/v1/iam/admin/reconcile` oder der Scheduler startet den Lauf über `IAM_ROLE_RECONCILE_INTERVAL_MS`.
2. Der Service lädt studio-verwaltete Rollen aus `iam.roles` und den aktuellen Realm-Rollenbestand aus Keycloak.
3. Fehlende Keycloak-Rollen werden erstellt, abweichende Beschreibungen oder Anzeigenamen werden aktualisiert.
4. Orphaned, studio-markierte Keycloak-Rollen werden nur als `requires_manual_action` gemeldet.
5. Das Ergebnis wird als Report zurückgegeben, über Audit-Events geschrieben und über `iam_role_drift_backlog` messbar gemacht.

Fehlerpfad:

- Fehlt die Keycloak-Verbindung oder der Service-Account hat zu wenige Rechte, endet der Lauf mit `keycloak_unavailable`.
- Einzelne Rollen können im Report als `failed` auftauchen, ohne den gesamten Drift-Kontext zu verlieren.

### Szenario 11: Modulare Server-Fassade delegiert in Fachkern

1. Routing oder ein externer Konsument importiert eine stabile Fassade wie `@sva/auth/server` oder `iam-account-management.server.ts`.
2. Die Fassade delegiert in einen fachlichen Unterordner wie `routes/*`, `iam-authorization/*` oder `iam-account-management/*`.
3. Der Fachbaustein orchestriert Request-Handling, Authentifizierung und Response-Mapping.
4. Verbleibende Altlogik liegt gezielt im jeweiligen `core.ts`, bis Folge-Refactorings sie weiter zerlegen.

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
6. Nachgelagerte UI- und Backend-Pfade lesen den aktiven Organisationskontext aus dem kanonischen Sessionzustand.

Fehlerpfad:

- Ungültige oder deaktivierte Zielorganisationen liefern einen stabilen Fehlercode; der bisherige Kontext bleibt unverändert.
- Technische Fehler werden im Org-Switcher verständlich, internationalisiert und ohne inkonsistenten Zwischenzustand angezeigt.
