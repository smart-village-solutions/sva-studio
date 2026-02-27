# ADR-013: RBAC+ABAC-Hybridmodell für IAM-Authorize

**Status:** Accepted  
**Entscheidungsdatum:** 2026-02-27  
**Entschieden durch:** IAM/Core Team  
**GitHub Issue:** TBD  
**GitHub PR:** TBD

---

## Kontext

Im IAM-Programm wird die Autorisierung in Child C und Child D stufenweise geliefert:

- Child C: RBAC v1 mit stabiler API (`POST /iam/authorize`, `GET /iam/me/permissions`)
- Child D: ABAC, Hierarchie-Vererbung, Cache-Invalidierung

Ohne klare Leitplanke zwischen RBAC und ABAC entsteht Risiko für Scope-Bleeding, widersprüchliche Entscheidungen und unklare Verantwortlichkeiten zwischen den Children.

## Entscheidung

Wir verwenden ein **Hybridmodell** mit klarer Evaluationsreihenfolge und Stage-Grenzen:

1. `instanceId`-Scope prüfen (fail-closed)
2. RBAC-Basisentscheidung aus Child C auswerten
3. ABAC-/Hierarchie-Regeln aus Child D anwenden (einschränkend/erweiternd nach Regeldefinition)
4. Finale Entscheidung mit `allowed` + `reason` zurückgeben

Zusätzlich gilt:

- Child C ist ohne ABAC lauffähig und liefert reproduzierbare Entscheidungen.
- Child D erweitert den gleichen `authorize`-Pfad kompatibel, ohne Contract-Bruch.
- Reason-Codes werden in Child C eingeführt und in Child D nur erweitert, nicht semantisch gebrochen.

## Begründung

1. Schrittweise Lieferung reduziert Risiko und hält frühe Integrationen stabil.
2. API- und SDK-Consumer erhalten einen konsistenten Einstiegspunkt.
3. Komplexität aus ABAC/Hierarchie/Cache wird isoliert nachgelagert statt in Child C vorzuziehen.
4. Performance-Optimierung bleibt planbar: erst RBAC-Baseline, dann ABAC+Cache-Härtung.

## Verantwortungsgrenzen

### Child C (RBAC v1)

- Rollenauflösung im aktiven `instanceId`-Kontext
- Permission-Komposition gemäß ADR-012
- Grundlegende Allow/Denial-Reason-Codes
- Baseline-Messung für `authorize` (P95)

### Child D (ABAC + Hierarchie + Cache)

- ABAC-Attributkatalog und Regel-Auswertung
- Vererbungslogik über Organisations-/Geo-Hierarchien
- Cache-Snapshots, Event-Invalidierung, TTL/Recompute-Fallback
- Erweiterte Reason-Codes für ABAC-/Hierarchie-spezifische Denials

## Alternativen

### Alternative A: Vollständiges ABAC direkt in Child C

**Vorteile:**
- Weniger Übergangsphasen

**Nachteile:**
- Sehr hoher Scope für Child C
- Größeres Risiko für Verzögerungen und instabile Contracts

**Warum verworfen:**
Widerspricht der Masterplan-Strategie mit klaren Child-Grenzen.

### Alternative B: Dauerhaft nur RBAC ohne ABAC

**Vorteile:**
- Geringere Laufzeitkomplexität

**Nachteile:**
- Fachliche Anforderungen (Hierarchie/Kontextattribute) nicht erfüllbar
- Höheres Risiko für Workarounds in Fachmodulen

**Warum verworfen:**
Erfüllt die Zielarchitektur nicht.

## Konsequenzen

### Positive Konsequenzen

- Stabiler API-Rollout mit klarer Evolutionslinie
- Saubere Trennung von Basis- und Erweiterungslogik
- Bessere Testbarkeit pro Child (RBAC separat, ABAC separat)

### Negative Konsequenzen

- Übergangsphase mit begrenzter Ausdrucksstärke in Child C
- Erweiterte Reason-Code-Menge über mehrere Childs zu pflegen

### Mitigationen

- Versionierter Reason-Code-Katalog im API-Contract
- Klare Dokumentation der Evaluationsreihenfolge in Design/OpenAPI
- Regressionstests, die RBAC-Baseline bei ABAC-Einführung absichern

## Verwandte ADRs

- ADR-011: `instanceId` als kanonischer Mandanten-Scope
- ADR-012: Permission-Kompositionsmodell für RBAC v1

## Gültigkeitsdauer

Diese ADR ist gültig, bis ein alternatives Policy- oder Engine-Modell beschlossen wird.
