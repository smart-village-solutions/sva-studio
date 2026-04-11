## Context

`studio` nutzt in der fruehen Betriebsphase bewusst `console_to_loki` statt eines OTEL-only-Pfads. Gleichzeitig muessen tenant-spezifische Keycloak-Secrets, Redirects und Callback-Fehler ohne Live-Try-&-Error sichtbar werden.

## Decisions

### Logger-Vertrag

- `console_to_loki` ist fuer `studio` der fuehrende Diagnosepfad
- `otel_to_loki` bleibt fuer produktionsnahe OTEL-Pfade erhalten
- wenn weder OTEL noch produktives Console-Logging aktiv sind, meldet die App `degraded` und erzeugt einen expliziten Bootstrap-Event

### Strukturierte Tenant-Auth-Diagnostik

- jeder Tenant-Login loggt einen kompakten `tenant_auth_resolution_summary`
- jeder Callback loggt einen `tenant_auth_callback_result` mit OIDC-Fehlerdetails ohne Secrets oder Token
- das Keycloak-Reconcile loggt einen `keycloak_reconcile_summary` mit Secret-Alignment, Mapper- und Rollenstatus

### Rollout-Gates

- `observability-readiness` prueft Logger-Modus und Loki-Sichtbarkeit
- `tenant-auth-proof` prueft mindestens den tenant-spezifischen Redirect und die zugehoerigen Loki-Ereignisse
- ein technisch gruener Stack reicht fuer `studio` nicht; Observability und Tenant-Auth muessen gemeinsam gruen sein
