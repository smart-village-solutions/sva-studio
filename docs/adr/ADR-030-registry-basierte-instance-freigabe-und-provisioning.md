# ADR-030: Registry-basierte Instance-Freigabe und Provisioning

**Status:** Accepted
**Entscheidungsdatum:** 2026-04-02
**Entschieden durch:** IAM/Plattform Team
**GitHub Issue:** TBD
**GitHub PR:** TBD

---

## Kontext

Die bisherige Multi-Host-Freigabe stützte sich für Tenant-Hosts auf eine Env-Allowlist (`SVA_ALLOWED_INSTANCE_IDS`). Dieses Modell reicht für die geplante Control Plane, lokale Reproduzierbarkeit und das kontrollierte Provisioning neuer Instanzen nicht mehr aus.

Es fehlt eine fachlich führende Quelle für:

- aktive, suspendierte und archivierte Instanzen
- primäre und zusätzliche Hostnamen
- idempotente Provisioning-Läufe
- auditierbare Plattformmutationen
- Root-Host-zentrierte Instanzverwaltung im Studio

ADR-020 bleibt gültig und definiert weiterhin den kanonischen Auth-Host. Neu zu entscheiden ist, wie Tenant-Freigabe, Status und Provisioning fachlich geführt werden.

## Entscheidung

Die Plattform führt eine zentrale Instanz-Registry in Postgres ein. Diese Registry ist die fachlich führende Freigabequelle für Tenant-Hosts und Provisioning.

### 1. Führende Datenquelle

Die Registry liegt im IAM-Schema und umfasst:

- `iam.instances` für Stammdaten und Lebenszyklusstatus
- `iam.instance_hostnames` für primäre und zusätzliche Hostnamen
- `iam.instance_provisioning_runs` für idempotente Läufe
- `iam.instance_audit_events` für append-only Audit-Ereignisse

Die Runtime bewertet Tenant-Hosts ausschließlich über diese Registry. Die Env-Allowlist bleibt nur als lokaler oder migrationsbezogener Kompatibilitätspfad dokumentiert.

### 2. Fail-closed und Statusmodell

Für Tenant-Traffic gilt im ersten Stand:

- nur `active` ist traffic-fähig
- `requested`, `validated`, `provisioning`, `failed`, `suspended` und `archived` werden identisch fail-closed behandelt
- unbekannte, ungültige und gesperrte Hosts liefern dasselbe Außenverhalten

### 3. Root-Host-zentrierte Control Plane

Globale Instanzverwaltung findet ausschließlich auf dem Root-Host statt. Tenant-Hosts rendern keine globale Control Plane.

Kritische Mutationen verlangen:

- dedizierte Rolle `instance_registry_admin`
- CSRF-Schutz
- frische Re-Authentisierung

### 4. Gemeinsame Provisioning-Fassade

HTTP-Handler, Studio-UI und CLI verwenden denselben fachlichen Provisioning-Vertrag. Dieser Vertrag modelliert:

- idempotente Neuanlage
- Statuswechsel `activate`, `suspend`, `archive`
- Audit-Ereignisse und Provisioning-Runs

### 5. Cache-Strategie

Postgres bleibt führend. Die Runtime nutzt einen kurzen In-Process-L1-Cache mit expliziter Invalidation auf Mutationen. Eine Stale-Serve-Strategie wird nicht eingeführt. Redis als zusätzlicher L2-Cache bleibt dokumentierte Folgearbeit.

### 6. Lokaler Hostvertrag

Der offiziell unterstützte lokale Multi-Tenant-Pfad verwendet:

- `studio.lvh.me` als Root-Host
- `<instanceId>.studio.lvh.me` als Tenant-Host

## Begründung

1. Die Registry ermöglicht fachlich saubere Tenant-Freigabe ohne Redeploys.
2. Status, Hostnamen, Audit und Provisioning werden an einer Stelle konsistent geführt.
3. Root-Host-zentrierte Administration reduziert Angriffsfläche und UI-Komplexität.
4. Eine gemeinsame Fassade verhindert Drift zwischen UI-, API- und CLI-Pfaden.
5. Fail-closed auf Basis einer führenden Datenquelle ist für Multi-Tenant-Betrieb robuster als eine statische Env-Allowlist.

## Alternativen

### Alternative A: Env-Allowlist beibehalten und nur dokumentieren

**Vorteile:**

- geringer initialer Implementierungsaufwand

**Nachteile:**

- keine auditierbare Plattformquelle
- keine idempotenten Provisioning-Läufe
- neue Instanzen benötigen weiterhin Konfigurations- oder Deploy-Eingriffe

**Warum verworfen:**

Erfüllt weder Control-Plane- noch Betriebsanforderungen.

### Alternative B: Redis als primäre Registry-Quelle

**Vorteile:**

- schnelle Lookups

**Nachteile:**

- zusätzliche betriebliche Komplexität
- schlechtere Nachvollziehbarkeit und schwächeres Source-of-Truth-Modell

**Warum verworfen:**

Für den ersten Stand soll Postgres die eindeutige Führungsquelle bleiben.

## Konsequenzen

### Positive Konsequenzen

- neue Instanzen sind ohne neues App-Deployment freischaltbar
- Host-Freigabe, Status und Audit sind fachlich konsistent
- Studio-UI und CLI können denselben Plattformvertrag verwenden

### Negative Konsequenzen

- zusätzlicher Migrations- und Betriebsaufwand für neue Registry-Tabellen
- L1-Cache muss sauber invalidiert werden
- lokale Entwicklung benötigt einen klar dokumentierten Hostvertrag

## Verwandte ADRs

- [ADR-020](ADR-020-kanonischer-auth-host-multi-host-grenze.md): Root-Host bleibt kanonischer Auth-Host
- [ADR-023](ADR-023-session-lifecycle-forced-reauth-und-silent-sso.md): frische Re-Authentisierung für kritische Mutationen
- [ADR-027](ADR-027-rechtstext-fail-closed-und-blockierte-session.md): fail-closed als Sicherheitsprinzip

## Gültigkeitsdauer

Diese ADR ist gültig, bis ein alternatives Plattformmodell mit separater Registry-Führungsquelle oder instanzspezifischer Control Plane beschlossen wird.
