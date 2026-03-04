# Change: IAM ABAC, Hierarchie-Vererbung und Cache-Invalidierung

## Why

RBAC allein deckt die fachliche Komplexität (Org-/Geo-Hierarchie, Kontextattribute, Laufzeitbedingungen) nicht vollständig ab. Für Ziel-Performance und Skalierung ist zusätzlich ein konsistenter Caching-Ansatz nötig.

## Kontext

Child D erweitert die in Child C etablierte RBAC-Basis um ABAC-Regeln, Vererbungslogik und einen belastbaren Cache-Ansatz. Ziel ist eine performante und nachvollziehbare Entscheidungslogik für komplexe fachliche Kontexte, ohne die Governance-Workflows von Child E vorwegzunehmen.

## What Changes

- ABAC-Erweiterung mit Kontextattributen
- Vererbungslogik über Organisations- und Geo-Hierarchien
- Redis-Caching-Strategie explizit erarbeiten (Key-Design, TTL, Invalidation, Fallback)
- Permission-Snapshots im Cache + Event-basierte Invalidierung
- Performance-Härtung für `authorize` mit Ziel < 50 ms
- Primärer Mandanten-Scope `instanceId`; Organisation als untergeordneter Kontext

### In Scope

- ABAC-Regeln auf Basis definierter Kontextattribute
- Hierarchie- und Vererbungslogik für Org-/Geo-Kontexte
- Cache-Strategie inkl. Invalidierung, Fallback und Recompute
- Performance- und Konsistenzverifikation für `authorize`

### Out of Scope

- Governance-Workflows (Delegation, Impersonation, Approval)
- Rechtstext-Akzeptanz und Compliance-Exports
- Externe IdP-Integrationen und 2FA-spezifische Policies

### Delivery-Slices

1. **Policy Slice:** ABAC-Attributkatalog + Evaluationsregeln
2. **Hierarchy Slice:** Vererbung und Restriktionsregeln (Org/Geo)
3. **Cache Slice:** Strategieentscheidung + Snapshot-/Invalidierungsimplementierung
4. **Quality Slice:** Performance-, Konsistenz- und Failure-Mode-Tests

## Impact

- Affected specs: `iam-access-control`, `iam-organizations`
- Affected code: `packages/core`, `packages/data`, ggf. Infra-Integration
- Affected arc42 sections: `06-runtime-view`, `08-cross-cutting-concepts`, `10-quality-requirements`

## arc42-Referenzen (Dateien)

- `docs/architecture/06-runtime-view.md`
- `docs/architecture/08-cross-cutting-concepts.md`
- `docs/architecture/09-architecture-decisions.md`
- `docs/architecture/10-quality-requirements.md`

## Dependencies

- Requires: `add-iam-authorization-rbac-v1`
- Blocks: `add-iam-governance-workflows` (teilweise)

## Risiken und Gegenmaßnahmen

- **Policy-Komplexität wächst unkontrolliert:** klarer ABAC-Attributkatalog + Reviewpflicht je Regelklasse
- **Stale Permissions im Cache:** Event-basierte Invalidierung + TTL-Fallback + Recompute-Pfade
- **Nicht-deterministische Entscheidungen:** deterministische Evaluationsreihenfolge und Testmatrix

## Approval Gate

Vor Start der Implementierung müssen folgende Punkte geklärt sein:

1. ✅ Child-C-Authorize-Contract inkl. `reason`-Codes steht stabil
2. ✅ ABAC-Attributkatalog und minimale Regelmenge freigegeben
3. ✅ Cache-Strategieentscheidung (Keys/TTL/Invalidation/Fallback) dokumentiert
4. ✅ Performance- und Konsistenz-Metriken für Verifikation festgelegt

## Akzeptanzkriterien (Change-Ebene)

- ABAC-Regeln werden im aktiven Instanzkontext deterministisch ausgewertet.
- Vererbung über Org-/Geo-Hierarchie funktioniert inkl. Restriktionslogik untergeordneter Ebenen.
- Cache-Invalidierung verhindert dauerhaft veraltete Berechtigungsentscheidungen.
- `authorize`-Performance bleibt unter Last im vereinbarten Zielkorridor (P95-Referenz).
- Failure-Modes (z. B. Event-Verlust, Cache-Miss, Stale-Entry) sind getestet und beherrscht.

## Status

🟡 Draft Proposal (inhaltlich vervollständigt, bereit für Review)
