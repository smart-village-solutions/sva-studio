# Change: Plattform-Scope als First-Class-Runtime-Kontext

## Why
Der Root-Host `studio.*` steuert tenantübergreifende Funktionen wie Instanzverwaltung und globale Auth-Auflösung. Bisher wurde dieser Pfad technisch nur als impliziter Fallback über `global`/`default`/`platform` behandelt. Das führte zu unklaren Scopes, inkonsistentem Logging und Audit-Fehlern gegen `iam.activity_logs`, obwohl der Root-Host keinen tenantgebundenen `iam.instances`-Eintrag hat.

## What Changes
- führt einen expliziten Runtime-Scope `platform | instance` für Auth-, Session- und Audit-Pfade ein
- trennt tenantgebundenes Audit (`iam.activity_logs`) von Plattform-Audit (`iam.platform_activity_logs`)
- harmonisiert Root-Host-Auflösung, Logging-Felder und `reason_code`-basiertes Error-Handling auf `platform`
- erweitert Schema-Guard, Architektur-Doku und ADRs um die neue Scope-Grenze

## Impact
- Affected specs: `iam-core`, `iam-auditing`, `architecture-documentation`
- Affected code: `packages/auth/src/{types,scope,config,config-request,audit-*,routes/*,redis-session.server}.ts`, `packages/auth/src/iam-account-management/{schema-guard,diagnostics}.ts`, `packages/data/migrations/0028_iam_platform_activity_logs.sql`
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `11-risks-and-technical-debt`, `iam-service-architektur`
