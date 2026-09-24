# Change: Production-Tenant-Scope aus der Env-Konfiguration entfernen

## Why

Die Registry ist laut ADR-030 die führende Lifecycle-Quelle für Production-Tenants. Der verbleibende Gebrauch von `SVA_ALLOWED_INSTANCE_IDS` im Bootstrap und Candidate-Preflight kann aktive Tenants dennoch bei jedem Promote überschreiben oder blockieren.

## What Changes

- Candidate-Preflight prüft alle aktiven Registry-Tenants auf lesbare Secrets.
- Bootstrap reconciled Berechtigungen und Hostname-Integrität für vorhandene aktive Registry-Tenants, legt aber keine Tenant-Datensätze aus Runtime-Konfiguration an.
- Remote-Config und Production-Stack übergeben keine Tenant-Allowlist mehr.
- Die statische Traefik-Hostliste bleibt unverändert Teil der Netzwerk- und TLS-Freigabe.

## Impact

- Affected specs: `deployment-topology`
- Affected code: Remote-Config, One-shot-Preflight, Bootstrap und Deployment-Compose
- Affected arc42 sections: 06 Runtime View, 07 Deployment View
