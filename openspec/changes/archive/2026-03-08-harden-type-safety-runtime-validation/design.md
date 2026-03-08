## Context

Die Codebase enthält ~15 `any`-Verwendungen in sicherheitsrelevanten Pfaden (OTEL-Logger, SDK-Bootstrap, Redis-Client, Route-Config). Zusätzlich fehlt an allen API-Grenzen eine Schema-basierte Runtime-Validierung – Input wird entweder manuell geparst (mit duplizierten Helfern) oder blind gecastet.

**Stakeholder:** Alle Entwickler; Security-Reviewer; CI-Pipeline
**Constraints:** Rückwärtskompatibilität wahren; Zod bereits im Ökosystem üblich; keine neuen ungeprüften Dependencies

## Goals / Non-Goals

**Goals:**
- Alle `any`-Casts in SDK und Auth durch typisierte Interfaces ersetzen
- Runtime-Validierung mit Zod an allen Trust Boundaries einführen
- Duplizierte Validierungs-Helfer konsolidieren
- Sensitive-Keys-Redaktion im Logger vervollständigen

**Non-Goals:**
- Zod in Client-Komponenten einführen (nur Server/API-Grenzen)
- Bestehende API-Signaturen brechen (Schema-Parameter werden optional eingeführt)
- Voll-automatische Schema-Generierung aus bestehenden Types

## Decisions

### Zod als Runtime-Validierungs-Bibliothek
- **Entscheidung:** Zod (nicht Valibot, nicht io-ts)
- **Begründung:** De-facto-Standard im TypeScript-Ökosystem; gute Integration mit TanStack Router (Search-Param-Schemas); kleine Bundle-Size auf Server; bereits in vielen Projekten erprobt
- **Alternativen:** Valibot (kleiner, aber weniger verbreitet), manuelle Parser (bereits vorhanden, schwer wartbar), io-ts (veraltetes API)

### Optionaler Schema-Parameter für DataClient
- **Entscheidung:** Schema-Parameter in `get<T>()` ist optional mit Deprecation-Log für Aufrufe ohne Schema
- **Begründung:** Ermöglicht schrittweise Migration; bestehender Code bricht nicht sofort
- **Risiko:** Entwickler könnten den Schema-Parameter ignorieren → Coverage-Gate / Lint-Regel als Ratchet einführen

### Lazy-Logger für Observability
- **Entscheidung:** Lazy-Initialisierung des SDK-Loggers in `context.server.ts` statt Import-Time-Initialisierung
- **Begründung:** Löst die dokumentierte zirkuläre Abhängigkeit ohne Architekturbruch

## Risks / Trade-offs

| Risiko | Mitigation |
|---|---|
| Zod erhöht Bundle im Server-Build | Nur auf Server-Pfaden einsetzen; Tree-Shaking prüfen |
| Optionaler Schema-Parameter wird ignoriert | Lint-Regel + Deprecation-Log; mittelfristig als `required` setzen |
| Auth-Utility-Konsolidierung kann Import-Pfade brechen | In derselben PR alle Imports umstellen; `pnpm nx affected` prüft |
| OTEL-Logger-Interface kann sich upstream ändern | Interface versionieren; bei OTEL-Update prüfen |

## Migration Plan

1. **Phase 1 (SDK):** Interfaces definieren, `any`-Casts ersetzen, Sensitive-Keys erweitern – ändert keine Public API
2. **Phase 2 (Auth):** Redis-Typisierung, Utility-Konsolidierung – interne Refactorings
3. **Phase 3 (Zod):** Dependency hinzufügen, Schemas definieren, manuelle Parser ersetzen – größter Scope, aber abwärtskompatibel
4. **Rollback:** Jede Phase kann einzeln reverted werden; keine Cross-Phase-Dependencies

## Open Questions

- Soll Zod auch für TanStack-Router Search-Param-Schemas genutzt werden (würde Finding R-3 adressieren)?
- Gibt es im Projekt eine Präferenz für Valibot statt Zod?
