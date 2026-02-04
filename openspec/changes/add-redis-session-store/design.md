## Context
Das aktuelle Session-Handling ist In-Memory und daher nicht persistent oder skalierbar. Die Roadmap sieht ein IAM und einen Permission-Cache (Redis) vor, wodurch ein Redis-basierter Session-Store naheliegt.

## Goals / Non-Goals
- Goals:
  - Persistente Sessions über Restarts
  - Horizontal skalierbar für Multi-Instance-Betrieb
  - Security-Anforderungen (TTL, Revocation, Token-Schutz)
  - Betriebsfähigkeit mit Monitoring, Backup/Restore
- Non-Goals:
  - Vollständiger IAM-Service (separates Vorhaben)
  - UI/UX-Flows (Login/Logout) neu designen

## Decisions
- Entscheidung: Redis als primärer Session-Store.
- Begründung: Sehr geringe Latenz, passt zur geplanten Redis-Nutzung für Permission-Cache, Open-Source-fähig.

## Alternatives considered
- DB-only Sessions (persistenter, aber langsamer und höhere DB-Last)
- Cookie-only Sessions (stateless, aber Revocation/Token-Größe problematisch)
- Hybrid Redis + DB (später für Audit/Compliance)

## Risks / Trade-offs
- Externe Abhängigkeit (Redis) → erfordert HA/Monitoring/Runbooks.
- Token-Schutz muss sauber gelöst werden (Verschlüsselung/TTL/Rotation).

## Migration Plan
1. Lokales Redis in Dev hinzufügen.
2. Session-API auf Redis umstellen.
3. Staging mit Managed Redis.
4. Production mit HA-Setup.

## Open Questions
- Wer betreibt Redis (Managed vs Self-Hosted)?
- RTO/RPO-Vorgaben für Sessions?
- Retention-Policy für Session-/Audit-Daten?
