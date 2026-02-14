## Context
Das aktuelle Session-Handling ist In-Memory und daher nicht persistent oder skalierbar. Die Roadmap sieht ein IAM und einen Permission-Cache (Redis) vor, wodurch ein Redis-basierter Session-Store naheliegt.

### Aktueller Stand & Probleme (Feb 2026)

**Tests bestätigen: Session-Logik funktioniert korrekt**
- 33 Unit-Tests für Session-Management und Cookie-Handling (alle grün)
- Sessions werden korrekt erstellt, gespeichert und abgerufen
- Cookie-Serialisierung mit HttpOnly/Secure/SameSite funktioniert einwandfrei
- Server-Logs zeigen: Set-Cookie Headers werden korrekt gesetzt

**Root Cause identifiziert: TanStack Router/Start Framework-Limitation**
```
[AUTH] Session created: a78dcf72-f4d5-467f-bfa7-2645cfcdf530
[AUTH] Setting session cookie: sva_auth_session=a78dcf72-f4d5-467f-bfa7-2645cfcdf530; Path=/; HttpOnly; SameSite=Lax
[AUTH] Returning 302 redirect
[AUTH] Headers: [
  [ 'location', '/?auth=ok' ],
  [ 'set-cookie', 'sva_auth_session=...; Path=/; HttpOnly; SameSite=Lax' ]
]

// Nach Redirect:
[AUTH] /auth/me request
[AUTH] Cookie header from browser:
[AUTH] Session ID: undefined  ❌ Browser hat Cookie nie erhalten
```

**Problem**: TanStack Router/Start interceptiert SSR-Responses und transmittiert Set-Cookie Headers nicht zum Browser. Dies ist eine bekannte Architektur-Einschränkung des Frameworks.

**Versuchte Lösungen (alle fehlgeschlagen)**:
1. ❌ 302 HTTP Redirect mit Set-Cookie → Headers werden geblockt
2. ❌ Meta-Refresh HTML → Gleicher Effekt
3. ❌ HTML + JavaScript Redirect → Headers in Response, aber Browser erhält sie nicht
4. ❌ `createServerFn` von TanStack Start → Verursacht SSR-Hängprobleme
5. ❌ `@tanstack/start-server-core` setCookie API → Nicht verfügbar in separaten Packages

**Implikationen für Redis-Implementierung**:
- Redis-Session-Store muss Cookie-Problem umgehen
- Lösung: Session-ID über alternative Mechanismen übertragen (z.B. URL-basiert während OAuth-Flow, dann persistent in Redis)
- Oder: Warten auf Framework-Update, das Set-Cookie korrekt unterstützt
- Tests bleiben wertvoll zur Validierung der Session-Logik unabhängig vom Transport-Mechanismus

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
- **Wie wird Session-ID ohne funktionierende Set-Cookie Headers übertragen?**
  - Option A: URL-basierte Session-ID im OAuth-Flow (z.B. `/?session=<id>`)
  - Option B: LocalStorage/SessionStorage als Client-Side-Speicher
  - Option C: Framework-Update abwarten oder zu anderem Framework wechseln
  - Option D: Custom HTTP-Header für Session-Transport (non-standard)
