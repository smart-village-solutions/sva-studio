# ADR-011: `instanceId` als kanonischer Mandanten-Scope

**Status:** Accepted  
**Entscheidungsdatum:** 2026-02-27  
**Entschieden durch:** IAM/Core Team  
**GitHub Issue:** TBD  
**GitHub PR:** TBD

---

## Kontext

Im IAM-Programm werden Organisationen, Rollen, Berechtigungen und Audit-Daten mandantenfähig persistiert.
Für Child B (`add-iam-core-data-layer`) musste verbindlich festgelegt werden, welche Entität den primären Scope für Isolation, RLS und Autorisierung bildet.

Anforderungen:

- Eindeutiger Mandantenkontext für alle Laufzeitzugriffe
- Klare Zuordnung von Organisationen als Untereinheiten
- Einheitliches Modell für RLS, Seed-Daten und nachgelagerte Child-Changes

## Entscheidung

`instanceId` ist der **kanonische Mandanten-Scope**.

Konkret:

- Alle mandantenrelevanten IAM-Tabellen führen `instance_id` als Isolationsmerkmal.
- Organisationen sind Untereinheiten innerhalb einer Instanz.
- RLS-Policies prüfen durchgängig gegen den aktiven `app.instance_id`-Kontext.
- Ohne gültigen `instance_id`-Kontext gilt fail-closed (kein Zugriff auf mandantengebundene Daten).

## Begründung

1. Einheitlicher Scope über alle IAM-Bausteine reduziert Modellbrüche.
2. RLS-Regeln bleiben einfach und überprüfbar.
3. Nachgelagerte Changes (RBAC/ABAC/Governance) können den gleichen Primärkontext nutzen.
4. Migrations- und Seed-Läufe werden reproduzierbarer, weil Referenzen auf Instanzebene stabil sind.

## Alternativen

### Alternative A: Organisation als Primär-Scope

**Vorteile:**  
- Direkter Bezug zu fachlichen Einheiten

**Nachteile:**  
- Mehrdeutigkeit bei Multi-Org-Usern  
- Höhere Komplexität für Vererbungs-/Aggregationsregeln

**Warum verworfen:**  
Organisationen sind fachliche Unterstruktur, aber nicht der stabilste technische Isolationsanker.

### Alternative B: Kein DB-seitiger Scope, nur App-seitige Filter

**Vorteile:**  
- Weniger SQL-/Policy-Aufwand

**Nachteile:**  
- Hohes Bypass-Risiko  
- Schwächere Sicherheitsgarantien

**Warum verworfen:**  
Erfüllt Sicherheitsanforderungen (RLS-basierte Isolation) nicht ausreichend.

## Konsequenzen

### Positive Konsequenzen

- Konsistente Isolation über Tabellen und Abfragen
- Klare Leitlinie für Repositories, Tests und Audit-Events
- Bessere Nachvollziehbarkeit in Architektur- und Sicherheitsreviews

### Negative Konsequenzen

- Strikte Propagierung von `instanceId` in Laufzeitkontexten erforderlich
- Zusätzliche Negativtests für fehlenden oder falschen Scope nötig

## Verwandte ADRs

- ADR-009: Keycloak als zentraler Identity Provider
- ADR-010: Verschlüsselungsstrategie für IAM Core Data Layer

## Gültigkeitsdauer

Diese ADR ist gültig, bis ein neues Mandantenmodell beschlossen wird.
