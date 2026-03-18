# ADR-022: IAM Groups, Geo-Hierarchie und erweitertes Permission-Caching (Pakete 3–5)

**Status:** Accepted
**Entscheidungsdatum:** 2025-01-01
**Entschieden durch:** Core Platform Team
**GitHub PR:** (offen)

---

## Kontext

Das SVA Studio IAM-System bestand bisher aus einem RBAC-Modell mit direkten Rollen-Zuweisungen und einfachen Delegierungen. Mit den OpenSpec-Änderungspaketen 3–5 wurden folgende Erweiterungen notwendig:

- **Paket 3 – IAM Groups**: Benutzergruppen mit eigenen Rollenzuweisungen als zusätzliche Quelle für effektive Berechtigungen (neben direkten Account-Rollen und Delegierungen)
- **Paket 3 – Geo-Hierarchie**: Closure-Table für räumlich strukturierte Organisationsknoten (Tiefen 0–5) mit `BEFORE INSERT`-Trigger
- **Paket 4 – Redis Permission Snapshot Cache**: Verteilter L2-Cache für effektive Berechtigungen mit HMAC-SHA-256-Integritätsschutz, TTL 900 s und strukturierten Invalidierungsereignissen
- **Paket 5 – Legal-Text-Enforcement**: Middleware zur Pflichtakzeptanz aktiver Rechtstexte sowie DSGVO-konformes Consent-Export-API

---

## Entscheidung

### 1. IAM Groups (3-arm UNION in SQL)

Die SQL-Abfragen `listScopedPermissionRows` und `listUnscopedPermissionRows` verwenden einen **3-arm UNION** als `source`-Unterabfrage:

```sql
SELECT ar.account_id, ar.role_id, ar.instance_id, NULL::uuid AS group_id, NULL::text AS group_key
FROM iam.account_roles ar
UNION
SELECT d.delegatee_account_id, d.role_id, d.instance_id, NULL::uuid, NULL::text
FROM iam.delegations d  WHERE d.status = 'active' AND now() BETWEEN d.starts_at AND d.ends_at
UNION
SELECT ag.account_id, gr.role_id, ag.instance_id, ag.group_id, g.group_key
FROM iam.account_groups ag
JOIN iam.group_roles gr ...
JOIN iam.groups g ...
WHERE (ag.valid_until IS NULL OR ag.valid_until > now())
```

Die neuen Spalten `group_id` und `group_key` werden direkt in `PermissionRow` und `EffectivePermission` weitergeleitet, sodass auf Anwendungsebene erkennbar ist, welche Berechtigung aus einer Gruppe stammt.

### 2. Geo-Hierarchie als Closure-Table

Statt einer rekursiven CTE-Lösung verwenden wir eine materialisierende Closure-Table (`iam.geo_hierarchy`) mit expliziter Tiefenspalte (`depth`). Ein `BEFORE INSERT`-Trigger füllt diese automatisch. Maximal 5 Hierarchieebenen.

**Begründung:**
- Lesezugriffe deutlich effizienter als rekursive CTEs bei tiefen Hierarchien
- Gut kompatibel mit PostgreSQL RLS-Policies

### 3. Redis Snapshot Cache mit HMAC-Integritätsprüfung und lokalem L1

- **Schlüsselformat**: `perm:v1:{instanceId}:{userId}:{orgCtxHash}:{geoCtxHash}`
- **TTL**: 900 Sekunden
- **Shared-Read-Path**: lokaler In-Memory-L1 zuerst, danach Redis als geteilter Snapshot-Store
- **Integrität**: HMAC-SHA-256 auf dem JSON-Payload mit `schema_version`, `signed_at`, `permissions`, `version` und `hmac` aus `REDIS_SNAPSHOT_HMAC_SECRET`
- **Fehlerbehandlung**: Bei `integrity_error` wird der Schlüssel sofort evicted und als Cache-Miss behandelt
- **Fail-Closed**: Bei Redis-Ausfall, Snapshot-Write-Fehler oder fehlgeschlagenem Recompute wird kein fachlicher Zugriff aus einem stale oder nur lokal vorhandenen Zustand abgeleitet; der Pfad endet mit HTTP `503`

### 4. Strukturierte Cache-Invalidierung (Event-ID + zielgerichtete Scopes)

| Event-Typ | Scope der Invalidierung |
|---|---|
| `role_permission_changed` | Alle Snapshots der Instance |
| `group_membership_changed` | Snapshots des betroffenen Accounts |
| `group_deleted` | Snapshots aller im Event referenzierten Accounts |
| `delegation_changed` | Snapshots des Delegationsempfängers |
| `organization_membership_changed` | Snapshots des betroffenen Accounts |
| `account_role_assignment_changed` | Snapshots des betroffenen Accounts |
| `org_hierarchy_changed` | Potenziell betroffene Instanz-Snapshots im Batch |
| `geo_assignment_changed` | Potenziell betroffene Instanz-Snapshots im Batch |
| `instance_settings_changed` | Alle Snapshots der Instance |

### 5. Legal-Text-Enforcement als Fail-Open-Middleware

Die Middleware `withLegalTextCompliance` prüft, ob der Nutzer alle aktiven Rechtstexte akzeptiert hat. Bei DB-Fehler wird **fail-open** verfahren (d.h., der Request wird nicht blockiert), da ein Datenbankausfall kein Grund sein soll, alle API-Aufrufe zu sperren.

---

## Alternativen verworfen

| Alternative | Grund für Ablehnung |
|---|---|
| Gruppen als eigenständiger Auth-Pfad (kein UNION) | Zu viel Duplizierung in Query-Logik; keine saubere Aggregierung in `EffectivePermission` |
| Adjacency-List für Geo-Hierarchie (rekursive CTEs) | Performance-Einbußen bei tiefen Hierarchien; nicht RLS-freundlich |
| Redis-Snapshot ohne HMAC | Integritätsverlust bei Speicherkorruption oder externen Zugriffen nicht erkennbar |
| Legal-Text-Enforcement als Fail-Closed (Hard-Block bei DB-Fehler) | Zu aggressiv; würde bei DB-Wartung alle Nutzer aussperren |

---

## Konsequenzen

### Positiv
- Berechtigungsquellen (Rolle, Gruppe, Delegation) sind transparent in `EffectivePermission.sourceGroupIds` und `groupName` sichtbar
- Redis-L2-Cache reduziert DB-Last bei häufigen `/authorize`-Aufrufen erheblich
- Consent-Export-API ermöglicht DSGVO-Auskunftsanfragen ohne manuelle DB-Queries

### Negativ / zu beachten
- `REDIS_SNAPSHOT_HMAC_SECRET` muss in Produktion ein starkes Secret sein (nicht der Default)
- Die Geo-Hierarchie-Closure-Table muss bei Import von Organisationsstrukturen explizit befüllt werden
- Maximal 2 Import-Typen für `LegalAcceptanceActionType` (`accepted`, `revoked`, `prompted`) – Erweiterungen erfordern ADR-Revision

---

## Bezug zu arc42-Abschnitten

- **Abschnitt 6 (Laufzeitsicht)**: Ergänzung des Berechtigungsflusses um Gruppen-Arm und Redis-L2-Cache
- **Abschnitt 8 (Querschnittliche Konzepte)**: Erweiterung des IAM-Kapitels um Groups, Geo-Scope, Legal Compliance
- **Abschnitt 9 (Architekturentscheidungen)**: Dieses ADR

---

## Migrations-Referenz

| Migration | Inhalt |
|---|---|
| `0014_iam_groups` | Tabellen `iam.groups`, `iam.group_roles`, `iam.account_groups` mit RLS |
| `0015_iam_geo_hierarchy` | Tabellen `iam.geo_nodes`, `iam.geo_hierarchy` (Closure-Table) mit Trigger |
| `0016_iam_legal_acceptance_audit` | ALTER TABLE `iam.legal_text_acceptances`: neue Spalten für Consent-Export |
