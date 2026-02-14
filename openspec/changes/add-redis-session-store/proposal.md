# Change: Add Redis-backed Session Store

## Why
Die aktuelle In-Memory-Session-Logik verliert Sessions bei HMR/Neustarts und ist nicht horizontal skalierbar. Für die Roadmap (IAM, Mandantenfähigkeit, Permission-Cache) ist ein persistenter, schneller Session-Store erforderlich.

## What Changes
- Einführung eines Redis-basierten Session-Stores als Standard für Auth-Sessions.
- Definition von Sicherheits- und Betriebsanforderungen (TTL, Revocation, Monitoring, Backups).
- Phasenweiser Rollout (Dev → Staging → Production) im Einklang mit der Roadmap.

## Impact
- Affected specs: auth (neu)
- Affected code: packages/auth, Deployment/Runtime-Config
- **BREAKING**: keine (Fallback-Strategie für lokale Dev vorgesehen)
