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

## Fortschreibung 2026-03: Subdomain-Ableitung und Env-Allowlist

Im Rahmen des Changes `add-swarm-portainer-deployment` wird die `instanceId`-Ableitung für den HTTP-Betrieb konkretisiert:

### Subdomain-Mapping

Die `instanceId` wird aus der Subdomain des eingehenden Hosts abgeleitet:

```
<instanceId>.<SVA_PARENT_DOMAIN>  →  instanceId = "<instanceId>"
```

- Genau ein DNS-Label links der Parent-Domain.
- Erlaubtes Format: `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$` (RFC-952-kompatibel, maximal 63 Zeichen).
- IDN/Punycode-Labels (`xn--`-Präfix) sind ausgeschlossen.
- Die Root-Domain (`SVA_PARENT_DOMAIN`) liefert `null` als `instanceId` und dient als kanonischer Auth-Host.

### Env-Allowlist als lokaler oder migrationsbezogener Fallback

Die Umgebungsvariable `SVA_ALLOWED_INSTANCE_IDS` (kommagetrennt) ist nicht mehr die autoritative Quelle gültiger `instanceId`s für produktiven Tenant-Traffic. Diese Rolle liegt bei der zentralen Instanz-Registry. Die Allowlist bleibt für lokale oder migrationsbezogene Fallback-Pfade bestehen und wird dort weiterhin beim Startup gegen das `instanceId`-Regex validiert; ungültige Einträge führen zum Abbruch (fail-fast).

- Lookup erfolgt in den verbleibenden Fallback-Pfaden weiter über `Set` (O(1)).
- Hosts mit unbekannter oder ungültiger `instanceId` erhalten weiterhin eine identische `403`-Antwort (kein erläuternder Ablehnungsgrund).
- Für den produktiven Multi-Tenant-Betrieb ist die DB-gestützte Registry die führende Datenquelle; die Allowlist dient nur noch der lokalen Reproduzierbarkeit oder dem kontrollierten Übergang.

### Bezug zu weiteren ADRs

- ADR-019: Swarm-/Traefik-Referenz-Betriebsprofil (HostRegexp-Routing)
- ADR-020: Kanonischer Auth-Host und Multi-Host-Grenze (Root-Domain als Auth-Einstiegspunkt)

## Verwandte ADRs

- ADR-009: Keycloak als zentraler Identity Provider
- ADR-010: Verschlüsselungsstrategie für IAM Core Data Layer
- ADR-019: Swarm-/Traefik-Referenz-Betriebsprofil
- ADR-020: Kanonischer Auth-Host und Multi-Host-Grenze

## Gültigkeitsdauer

Diese ADR ist gültig, bis ein neues Mandantenmodell beschlossen wird.
