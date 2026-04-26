# Runbook SVA Mainserver

## Zweck

Dieses Runbook beschreibt Betrieb, Fehlerdiagnose und Notfallmaßnahmen für die serverseitige SVA-Mainserver-Integration in Studio.

## Betriebsgrenzen

- Studio greift ausschließlich serverseitig auf den Mainserver zu.
- Credentials liegen pro Benutzer in Keycloak-Attributen.
- Instanzgebundene Endpunkte liegen in `iam.instance_integrations`.
- Der Kill-Switch pro Instanz ist das Feld `enabled` in `iam.instance_integrations`.

## Fehlercodes

| Fehlercode | Bedeutung | Typische Ursache | Sofortmaßnahme |
| --- | --- | --- | --- |
| `config_not_found` | Keine Mainserver-Konfiguration zur Instanz gefunden | fehlender Datensatz in `iam.instance_integrations` | Datensatz prüfen/anlegen |
| `integration_disabled` | Integration ist betriebsseitig deaktiviert | `enabled = false` | nur nach Freigabe wieder aktivieren |
| `invalid_config` | Upstream-URL verletzt das erlaubte Schema | `http` auf externen Hosts, URL mit Credentials/Fragment | URL korrigieren, erneute Diagnostik |
| `database_unavailable` | Instanzkonfiguration konnte nicht aus der IAM-DB geladen werden | Postgres nicht erreichbar, Connection-Fehler | Postgres/Netzwerk prüfen, Logs korrelieren |
| `identity_provider_unavailable` | Keycloak-Attribute konnten nicht gelesen werden | Keycloak-Ausfall, Rechteproblem, Admin-API-Störung | Keycloak/API-Fehler prüfen |
| `missing_credentials` | API-Key/Secret fehlen für den Benutzer | leere oder unvollständige Keycloak-Attribute | Credentials für den Benutzer neu setzen |
| `token_request_failed` | OAuth2-Tokenabruf schlug mit Nicht-Auth-Status fehl | 5xx/4xx vom OAuth-Endpunkt | Upstream-Status und Retry-Logs prüfen |
| `unauthorized` | Upstream lehnt Credentials/Token ab | falscher API-Key/Secret, ungültiges Token | Credentials rotieren und Benutzer testen |
| `forbidden` | Lokale oder Upstream-Berechtigung fehlt | fehlende Studio-Rolle oder Mainserver-Rechte | lokale Rollen und Mainserver-Rechte prüfen |
| `network_error` | Netzwerk- oder Timeout-Fehler | DNS/Netzwerk/Timeout/503 trotz Retry | Upstream-Erreichbarkeit und Timeout-Logs prüfen |
| `graphql_error` | GraphQL antwortet mit fachlichem Fehlerarray | Schema-/Resolver-Fehler upstream | Response-Details und Snapshot-Drift prüfen |
| `invalid_response` | OAuth2- oder GraphQL-Body verletzt den erwarteten Contract | HTML statt JSON, unvollständige Antwort, Schema-Drift | Upstream-Response und Snapshot prüfen |

## News-Operationen

Das News-Plugin nutzt produktiv keine lokalen IAM-Content-Datensätze mehr. Der Browser ruft ausschließlich die hostgeführte Fassade unter `/api/v1/mainserver/news` und `/api/v1/mainserver/news/$newsId` auf; die App prüft Session, Instanzkontext, lokale Content-Primitive und Mainserver-Credentials, bevor ein Upstream-Call erfolgt.

| Studio-Methode | Lokale Primitive | Mainserver-Operation | Hinweis |
| --- | --- | --- | --- |
| `GET /api/v1/mainserver/news` | `content.read` | `newsItems` | Nur sichtbare Mainserver-News werden als veröffentlichte Plugin-Items abgebildet. |
| `GET /api/v1/mainserver/news/$newsId` | `content.read` | `newsItem(id)` | `not_found` wird als stabiler Fehlercode an die Plugin-Fassade zurückgegeben. |
| `POST /api/v1/mainserver/news` | `content.create` | `createNewsItem` | `publishedAt` ist verpflichtend; `contentBlocks` sind das führende Inhaltsmodell; `pushNotification` ist nur beim Erstellen erlaubt. |
| `PATCH /api/v1/mainserver/news/$newsId` | `content.updateMetadata`, `content.updatePayload` | `createNewsItem(id, forceCreate: false)` | Update-Semantik ohne `payload` und mit vollständiger `contentBlocks`-Liste wurde gegen Staging bestätigt. |
| `DELETE /api/v1/mainserver/news/$newsId` | `content.delete` | `destroyRecord(id, recordType: "NewsItem")` | Fachlich ein harter Löschpfad; kein lokaler Soft-Delete und kein Dual-Write. |

Lokale Altinhalte mit `contentType = news.article` oder dem Legacy-Typ `news` werden nicht migriert und nicht mehr produktiv angezeigt. Falls solche Datensätze noch in der IAM-Content-Tabelle vorhanden sind, dienen sie nur noch als Altquelle für manuelle Analyse oder einen späteren operatorgeführten Export.

Das News-`payload` ist nur noch Legacy-Lesefallback. Neue und aktualisierte News schreiben dedizierte Mainserver-Felder wie `author`, `keywords`, `publicationDate`, `sourceUrl`, `address`, `categories`, `contentBlocks` und `pointOfInterestId`; `payload` wird bei Create/Update nicht mehr gesendet. Fehlen bei alten News `contentBlocks`, leitet der Adapter aus vorhandenen Payload-Werten einen virtuellen ersten Inhaltsblock für den Editor ab.

Rollback erfolgt über den Mainserver-Kill-Switch `iam.instance_integrations.enabled = false`. Das Plugin zeigt dann Mainserver-Fehler an, lokale IAM-News werden bewusst nicht als Fallback reaktiviert.

## Credential-Rotation

1. Betroffenen Benutzer in Keycloak identifizieren.
2. Attribute `mainserverUserApplicationId` und `mainserverUserApplicationSecret` neu setzen.
3. Falls der Benutzer noch nicht migriert wurde, werden `sva_mainserver_api_key` und `sva_mainserver_api_secret` zur Laufzeit weiterhin als Fallback gelesen; neue Schreibvorgänge sollen aber nur noch die kanonischen Attribute verwenden.
4. Anschließend die Mainserver-Diagnostik aus Studio erneut ausführen.
5. Falls weiterhin `unauthorized` oder `forbidden` auftritt, lokale Studio-Rollen und Mainserver-Rechte gegentesten.
6. Alte Credentials nach erfolgreicher Validierung endgültig invalidieren.

## Notfallabschaltung

### Pro Instanz

```sql
UPDATE iam.instance_integrations
SET enabled = false,
    updated_at = NOW()
WHERE instance_id = 'de-musterhausen'
  AND provider_key = 'sva_mainserver';
```

### Prüfung nach Abschaltung

- Diagnostik muss `integration_disabled` liefern.
- Logs müssen den Deny-/Fehlerpfad mit `workspace_id` der Instanz zeigen.
- Keine weiteren erfolgreichen OAuth2-/GraphQL-Hops für die Instanz sollten auftreten.

## Export der Instanzkonfiguration

### CSV-Export

```sql
COPY (
  SELECT
    instance_id,
    provider_key,
    graphql_base_url,
    oauth_token_url,
    enabled,
    last_verified_at,
    last_verified_status,
    updated_at
  FROM iam.instance_integrations
  WHERE provider_key = 'sva_mainserver'
  ORDER BY instance_id
) TO STDOUT WITH CSV HEADER;
```

### JSON-Extrakt

```sql
SELECT json_agg(row_to_json(t))
FROM (
  SELECT
    instance_id,
    provider_key,
    graphql_base_url,
    oauth_token_url,
    enabled,
    last_verified_at,
    last_verified_status,
    updated_at
  FROM iam.instance_integrations
  WHERE provider_key = 'sva_mainserver'
  ORDER BY instance_id
) AS t;
```

## LogQL-Abfragen

### Fehlpfade der Mainserver-Integration

```logql
{component=~"sva-mainserver|sva-mainserver-config|data-instance-integrations|sva-mainserver-route"}
| json
| error_code!=""
```

### Cache-Hit/Miss-Verhalten

```logql
{component=~"sva-mainserver|data-instance-integrations"}
| json
| cache=~"hit|miss|hit_or_store|custom_hit_or_store|custom_miss"
```

### Zugriffsverweigerungen in der App-Grenze

```logql
{component="sva-mainserver-route"}
| json
| decision="deny"
```

## Schema-Snapshot und Drift

- Der Snapshot unter `packages/sva-mainserver/src/generated/schema.snapshot.json` enthält ein vollständiges JSON-Introspection-Ergebnis.
- Der CI-Workflow `SVA Mainserver Schema Gate` vergleicht Snapshot und Staging per `graphql-inspector diff`.
- Der Workflow ist blockierend und veröffentlicht zusätzlich ein Drift-Artefakt (`sva-mainserver-schema-diff-*`).
- Für die Ausführung in GitHub Actions müssen folgende Repository-Secrets gesetzt sein:
  - `SVA_MAINSERVER_SCHEMA_GRAPHQL_URL`
  - `SVA_MAINSERVER_SCHEMA_OAUTH_TOKEN_URL`
  - `SVA_MAINSERVER_SCHEMA_CLIENT_ID`
  - `SVA_MAINSERVER_SCHEMA_CLIENT_SECRET`
- Lokaler Lauf ist möglich über:

```bash
pnpm schema-diff:sva-mainserver
```

Für lokale Läufe müssen `SVA_MAINSERVER_SCHEMA_GRAPHQL_URL`, `SVA_MAINSERVER_SCHEMA_OAUTH_TOKEN_URL`, `SVA_MAINSERVER_SCHEMA_CLIENT_ID` und `SVA_MAINSERVER_SCHEMA_CLIENT_SECRET` gesetzt sein. Fehlen diese Variablen, ist die lokale Schema-Diff-Prüfung nicht aussagekräftig und muss in CI oder Staging nachgeholt werden.

## Benchmark vor Produktivbetrieb

Vor einem produktiven Rollout sind zwei Messreihen verpflichtend:

1. Cold Path: erster Aufruf ohne gefüllte Credential-/Token-Caches.
2. Warm Path: wiederholter Aufruf mit vorhandenen Credential-/Token-Caches.

Zu erfassen:

- End-to-End-Latenz der Studio-Server-Funktion
- Hop-Latenz für DB, Keycloak, OAuth2 und GraphQL aus OTEL
- Retry-Anteil und Timeout-Quote
- Cache-Hit/Miss-Verhältnis

Empfohlene Freigaberegel:

- Kein Rollout, solange Cold/Warm-Path nicht dokumentiert und fachlich bewertet wurden.

### Benchmark-Vorbereitung (lokal/CI)

Es steht ein ausführbares Skript für die Messvorbereitung bereit:

```bash
pnpm benchmark:sva-mainserver
```

Erforderliche Umgebungsvariablen:

- `SVA_MS_BENCH_GRAPHQL_URL`
- `SVA_MS_BENCH_OAUTH_TOKEN_URL`
- `SVA_MS_BENCH_CLIENT_ID`
- `SVA_MS_BENCH_CLIENT_SECRET`

Optionale Umgebungsvariablen:

- `SVA_MS_BENCH_COLD_RUNS` (Default: `3`)
- `SVA_MS_BENCH_WARM_RUNS` (Default: `20`)
- `SVA_MS_BENCH_QUERY` (Default: `{ __typename }`)
- `SVA_MS_BENCH_OUTPUT` (Default: `artifacts/benchmark/sva-mainserver-benchmark.json`)

Der Report enthält p50/p95/min/max für OAuth- und GraphQL-Latenzen getrennt nach Cold Path und Warm Path.

### Letzte Messung (Staging, de-musterhausen)

Messzeitpunkt: `2026-03-15T11:46:34.428Z`

Konfiguration:

- Cold Runs: `3`
- Warm Runs: `20`
- Query: `{ __typename }`

Ergebnisse:

- Cold Path OAuth p95: `99.65 ms`
- Cold Path GraphQL p95: `58.03 ms`
- Warm Path OAuth p95: `23.37 ms`
- Warm Path GraphQL p95: `33.29 ms`

Report-Datei:

- `artifacts/benchmark/sva-mainserver-benchmark.json`
