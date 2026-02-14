# 08 Querschnittliche Konzepte

## Zweck

Dieser Abschnitt sammelt uebergreifende Konzepte, die mehrere Bausteine
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
- Optionale Verschluesselung von Tokens im Redis-Store via `ENCRYPTION_KEY`
- Redaction sensibler Logfelder im SDK und im OTEL Processor

### Logging und Observability

- Einheitlicher Server-Logger ueber `@sva/sdk/server`
- AsyncLocalStorage fuer `workspace_id`/request context
- OTEL Pipeline fuer Logs + Metrics
- Label-Whitelist und PII-Blockliste in OTEL/Promtail

### Fehlerbehandlung und Resilienz

- OTEL-Init ist fehlertolerant (App laeuft weiter ohne Telemetrie)
- Redis-Reconnect mit Backoff und Max-Retry Logik
- Auth-Flow mit klaren Redirect-Fehlerpfaden (`auth=error`, `auth=state-expired`)

### i18n und Accessibility

- UI-Texte sind derzeit ueberwiegend direkt im Code und noch nicht durchgaengig i18n-basiert
- A11y wird pro Review/Template eingefordert, aber noch nicht zentral automatisiert

Referenzen:

- `packages/auth/src/routes.server.ts`
- `packages/auth/src/redis-session.server.ts`
- `packages/sdk/src/logger/index.server.ts`
- `packages/monitoring-client/src/otel.server.ts`
