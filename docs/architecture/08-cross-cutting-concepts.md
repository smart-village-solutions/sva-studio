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
- Redaction sensibler Logfelder im SDK und im OTEL Processor
- Governance-Gates: Ticketpflicht, Vier-Augen-Prinzip, keine Self-Approvals
- Harte Laufzeitgrenzen: Impersonation max. 120 Minuten, Delegation max. 30 Tage
- `support_admin`-Impersonation benötigt zusätzlichen Security-Approver
- DSGVO-Betroffenenrechte im IAM: Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch
- Löschprozess zweistufig: Soft-Delete (SLA <= 48h) und finale Anonymisierung nach Retention
- Legal Hold blockiert irreversible Löschschritte bis zur Freigabe
- Art.-19-Nachweisdaten für Empfängerbenachrichtigung werden revisionssicher persistiert

### Logging und Observability

- Einheitlicher Server-Logger über `@sva/sdk/server`
- AsyncLocalStorage für `workspace_id`/request context
- OTEL Pipeline für Logs + Metrics
- Label-Whitelist und PII-Blockliste in OTEL/Promtail
- IAM-Authorize/Cache-Logs nutzen strukturierte Operations (`cache_lookup`, `cache_invalidate`, `cache_stale_detected`, `cache_invalidate_failed`)
- Korrelationsfelder `request_id` und `trace_id` sind im IAM-Pfad verpflichtend
- Governance-Logs nutzen `component: iam-governance` und strukturierte Events:
  `impersonate_start`, `impersonate_end`, `impersonate_timeout`, `impersonate_abort`
- Governance-Audit folgt Dual-Write: DB (`iam.activity_logs`) + OTEL-Pipeline
- PII-Schutz in Governance-Events: nur pseudonymisierte Actor-/Target-Referenzen
- DSR-Wartungslauf emittiert strukturierte Audit-Events (`dsr_maintenance_executed`, `dsr_deletion_sla_escalated`)
- Finale Löschung pseudonymisiert Audit-Referenzen (`subject_pseudonym`) statt Klartext-PII

### Fehlerbehandlung und Resilienz

- OTEL-Init ist fehlertolerant (App läuft weiter ohne Telemetrie)
- Redis-Reconnect mit Backoff und Max-Retry Logik
- Auth-Flow mit klaren Redirect-Fehlerpfaden (`auth=error`, `auth=state-expired`)
- IAM-Cache-Invalidierung folgt Event-first (Postgres NOTIFY) mit TTL/Recompute-Fallback
- Bei stale + Recompute-Fehler gilt fail-closed (`cache_stale_guard`)
- DSR-Resilienz über asynchrones Export-Statusmodell (`queued|processing|completed|failed`)
- Restore-Sanitization nach Backup-Restore stellt DSGVO-konforme Nachbereinigung sicher

### i18n und Accessibility

- UI-Texte sind derzeit überwiegend direkt im Code und noch nicht durchgängig i18n-basiert
- A11y wird pro Review/Template eingefordert, aber noch nicht zentral automatisiert

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
- `docs/development/iam-schluesselmanagement-strategie.md`
- `docs/guides/iam-governance-runbook.md`
- `docs/guides/iam-governance-freigabematrix.md`
- `docs/guides/iam-data-subject-rights-runbook.md`
- `apps/sva-studio-react/src/routes/__root.tsx`
- `apps/sva-studio-react/src/components/AppShell.tsx`
