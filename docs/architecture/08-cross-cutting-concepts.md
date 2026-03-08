# 08 Querschnittliche Konzepte

## Zweck

Dieser Abschnitt sammelt übergreifende Konzepte, die mehrere Bausteine
gleichzeitig beeinflussen.

## Mindestinhalte

- Security- und Privacy-Konzepte
- Logging/Observability-Konzept
- Fehlerbehandlung, Resilienz, i18n und Accessibility-Leitlinien

## Aktueller Stand

### Security und Privacy

- OIDC Authorization Code Flow mit PKCE
- Signiertes Login-State-Cookie (HMAC)
- Session-Cookies: `httpOnly`, `sameSite=lax`, `secure` in Production
- Optionale Verschlüsselung von Tokens im Redis-Store via `ENCRYPTION_KEY`
- Application-Level Column Encryption für IAM-PII-Felder (`email_ciphertext`, `display_name_ciphertext`)
- Schlüsselverwaltung über `IAM_PII_ACTIVE_KEY_ID` + `IAM_PII_KEYRING_JSON` (außerhalb der DB)
- Fehlertexte der Feldverschlüsselung enthalten keine internen Key-IDs; technische Key-Kontexte werden nur als strukturierter Fehlerkontext geführt
- Redaction sensibler Logfelder im SDK und im OTEL Processor
- Governance-Gates: Ticketpflicht, Vier-Augen-Prinzip, keine Self-Approvals
- Harte Laufzeitgrenzen: Impersonation max. 120 Minuten, Delegation max. 30 Tage
- `support_admin`-Impersonation benötigt zusätzlichen Security-Approver
- DSGVO-Betroffenenrechte im IAM: Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch
- Löschprozess zweistufig: Soft-Delete (SLA <= 48h) und finale Anonymisierung nach Retention
- Legal Hold blockiert irreversible Löschschritte bis zur Freigabe
- Art.-19-Nachweisdaten für Empfängerbenachrichtigung werden revisionssicher persistiert
- Trust-Boundary-Validierung mit Zod in IAM-Endpoints (`authorize`, `governance`, `data-subject-rights`)
- DataClient unterstützt optionale Runtime-Schema-Validierung (`get(path, schema)`) für API-Responses

### IAM Multi-Tenancy, Caching und Audit-Logging

- Mandantenisolation basiert auf kanonischem Scope `instanceId` (inkl. Mapping zu `workspace_id` in Logs)
- Autorisierungspfade erzwingen `instanceId`-Filterung vor Rollen-/Policy-Evaluation
- RLS-Policies und service-seitige Guards verhindern organisationsfremde Datenzugriffe
- Permission-Snapshot-Cache ist instanz- und kontextgebunden; Invalidation erfolgt event-first (Postgres `NOTIFY`) mit TTL-Fallback
- Audit-Logging für IAM-Ereignisse folgt Dual-Write (`iam.activity_logs` + OTEL via SDK Logger)
- Audit-Daten enthalten korrelierbare IDs (`request_id`, `trace_id`) und pseudonymisierte Actor-Referenzen
- Studio-verwaltete Rollen werden über `managed_by = 'studio'` und `instance_id` gegen fremdverwaltete Keycloak-Rollen abgegrenzt
- `role_key` ist die stabile technische Identität, `display_name` der editierbare UI-Name
- Rollen-Alias-Mapping für erhöhte Berechtigungen (z. B. `Admin -> system_admin`) wird ausschließlich aus `realm_access` übernommen; `resource_access`-Rollen bleiben client-spezifisch und erhalten keine globalen Privileg-Aliasse
- Idempotency-Schlüssel für mutierende IAM-Endpoints sind mandantenspezifisch gescoped: (`instance_id`, `actor_account_id`, `endpoint`, `idempotency_key`)

### Logging und Observability

- Einheitlicher Server-Logger über `@sva/sdk/server`
- AsyncLocalStorage für `workspace_id`/request context
- OTEL Pipeline für Logs + Metrics
- Label-Whitelist und PII-Blockliste in OTEL/Promtail
- IAM-Authorize/Cache-Logs nutzen strukturierte Operations (`cache_lookup`, `cache_invalidate`, `cache_stale_detected`, `cache_invalidate_failed`)
- Korrelationsfelder `request_id` und `trace_id` sind im IAM-Pfad verpflichtend
- Role-Sync- und Reconcile-Pfade verwenden ausschließlich den SDK-Logger; `console.*` ist serverseitig ausgeschlossen
- Role-Sync-Audit nutzt ein einheitliches Schema mit `workspace_id`, `operation`, `result`, `error_code?`, `request_id`, `trace_id?`, `span_id?`
- Zusätzliche Metriken für den Rollenpfad: `iam_role_sync_operations_total` und `iam_role_drift_backlog`
- Governance-Logs nutzen `component: iam-governance` und strukturierte Events:
  `impersonate_start`, `impersonate_end`, `impersonate_timeout`, `impersonate_abort`
- Governance-Audit folgt Dual-Write: DB (`iam.activity_logs`) + OTEL-Pipeline
- PII-Schutz in Governance-Events: nur pseudonymisierte Actor-/Target-Referenzen
- DSR-Wartungslauf emittiert strukturierte Audit-Events (`dsr_maintenance_executed`, `dsr_deletion_sla_escalated`)
- Finale Löschung pseudonymisiert Audit-Referenzen (`subject_pseudonym`) statt Klartext-PII
- SDK-Logger nutzt typisierte OTEL-Bridge (keine `any`-Casts in Transport/Bootstrap)
- Sensitive-Keys-Redaction umfasst zusätzlich Cookie-, Session-, CSRF- und API-Key-Header/Felder
- Workspace-Context-Warnungen erfolgen über lazy `process.emitWarning` statt `console.warn`

### Fehlerbehandlung und Resilienz

- OTEL-Init ist fehlertolerant (App läuft weiter ohne Telemetrie)
- Redis-Reconnect mit Backoff und Max-Retry Logik
- Auth-Flow mit klaren Redirect-Fehlerpfaden (`auth=error`, `auth=state-expired`)
- Root-Route nutzt ein zentrales `errorComponent` für unbehandelte Laufzeitfehler mit Retry-Option
- IAM-Cache-Invalidierung folgt Event-first (Postgres NOTIFY) mit TTL/Recompute-Fallback
- Bei stale + Recompute-Fehler gilt fail-closed (`cache_stale_guard`)
- DSR-Resilienz über asynchrones Export-Statusmodell (`queued|processing|completed|failed`)
- Restore-Sanitization nach Backup-Restore stellt DSGVO-konforme Nachbereinigung sicher

### i18n und Accessibility

- UI-Texte sind derzeit überwiegend direkt im Code und noch nicht durchgängig i18n-basiert
- A11y wird pro Review/Template eingefordert, aber noch nicht zentral automatisiert
- Rollen-Statusindikatoren in `/admin/roles` verwenden i18n-Labels für `synced`, `pending` und `failed`
- Retry- und Reconcile-Aktionen bleiben über semantische Buttons und Testabdeckung tastatur- und screenreader-freundlich prüfbar

### Review-Governance

- Proposal-Reviews werden über einen dedizierten Proposal-Orchestrator konsolidiert
- PR- und Code-Reviews werden über einen separaten PR-Orchestrator konsolidiert
- Spezialisierte Review-Agents decken ergänzend Testqualität, i18n/Content, User Journey & Usability und Performance ab
- Zentrale und kritische Module werden zusätzlich über ein eigenes Komplexitäts-Gate mit Ticketpflicht überwacht
- Das Modulregister und die Schwellwerte liegen versioniert unter `tooling/quality/complexity-policy.json`
- Bekannte Überschreitungen bleiben nur dann zulässig, wenn sie in `trackedFindings` mit Refactoring-Ticket hinterlegt sind
- Kritische Coverage-Hotspots werden in `tooling/testing/coverage-policy.json` als `hotspotFloors` geführt
- Normative Accessibility und heuristische Nutzersicht sind bewusst getrennt:
  - `ux-accessibility.agent.md` für WCAG/BITV, Fokus, Tastatur und Screenreader
  - `user-journey-usability.agent.md` für Friktion, Verständlichkeit und Aufgabenbewältigung
- i18n/harte Strings werden als eigener Governance-Strang behandelt und nicht nur implizit im Code-Review geprüft
- Konflikte zwischen Review-Perspektiven werden auf Orchestrator-Ebene explizit gemacht, die Entscheidung bleibt beim Menschen

### UI-Shell, Responsivität und Skeleton UX

- Die Root-Shell trennt die Bereiche Kopfzeile, Seitenleiste und Hauptinhalt explizit
- Ein Skip-Link ermöglicht direkten Sprung in den Contentbereich (`#main-content`)
- Skeleton-Zustände werden konsistent über alle drei Kernbereiche bereitgestellt
- Mobile-first Layout: Sidebar bleibt auf kleinen Viewports nutzbar, auf großen Viewports als feste Seitenleiste

Referenzen:

- `packages/auth/src/routes.server.ts`
- `packages/auth/src/iam-authorization.server.ts`
- `packages/auth/src/iam-governance.server.ts`
- `packages/auth/src/iam-data-subject-rights.server.ts`
- `packages/auth/src/redis-session.server.ts`
- `packages/auth/src/audit-db-sink.server.ts`
- `packages/sdk/src/logger/index.server.ts`
- `packages/monitoring-client/src/otel.server.ts`
- `docs/adr/ADR-014-postgres-notify-cache-invalidierung.md`
- `docs/architecture/iam-datenklassifizierung.md`
- `docs/development/complexity-quality-governance.md`
- `docs/development/review-agent-governance.md`
- `docs/development/iam-schluesselmanagement-strategie.md`
- `docs/guides/iam-governance-runbook.md`
- `docs/guides/iam-governance-freigabematrix.md`
- `docs/guides/iam-data-subject-rights-runbook.md`
- `apps/sva-studio-react/src/routes/__root.tsx`
- `apps/sva-studio-react/src/components/AppShell.tsx`

### Ergänzung 2026-03: AuthProvider-Pattern und Permission-Checking

- `AuthProvider` kapselt Session-Status zentral in der Root-Shell.
- UI-Bausteine konsumieren Auth-Daten ausschließlich über `useAuth()`.
- Route-Guards (`createProtectedRoute`, `createAdminRoute`) erzwingen Auth/Rollenprüfung vor Seitenrendering.
- Bei `403` in IAM-Hooks wird `invalidatePermissions()` ausgelöst, um Session-/Rollenkontext konsistent zu halten.

### Ergänzung 2026-03: CSRF-Strategie in IAM-v1

- Alle mutierenden IAM-Endpunkte prüfen serverseitig den Header `X-Requested-With: XMLHttpRequest`.
- Client-Hooks setzen den Header standardisiert über gemeinsame API-Utilities.
- Fehlercode bei Verstoß: `csrf_validation_failed`.
