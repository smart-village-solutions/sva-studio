# Performance-Nachweis WP-004 Permission Engine – 2026-05-25

## Zweck

Dieses Dokument bündelt den verfügbaren Performance-Nachweis für `WP-004 Permission Engine` und dokumentiert den erfolgreichen endpointnahen Lauf gegen den echten `auth-runtime`-HTTP-Pfad für die formale Kundenabnahme.

## Status des Nachweises

- Stand dieses Artefakts: `2026-05-25`
- Bewertungsstatus: **vollständig belegt**
- Formale Eignung für die Endabnahme: **ausreichend**

Der zuvor fehlende endpointnahe Lauf für Cache-Hit, Cache-Miss und Recompute gegen den realen `auth-runtime`-HTTP-Pfad liegt jetzt als archivierter JSON-/Markdown-Report vor.

## 1. Metadaten

- Berichtsdatum: `2026-05-25`
- Verantwortlich: Codex-Arbeitsstand im Repository
- Commit / Branch: nicht festgehalten; Nachweis basiert auf aktuellem Workspace-Stand
- Umgebung: lokale Entwicklungsumgebung `local-keycloak` mit laufender App, Redis, Postgres und echter Session
- Verwendete Datenbasis / Seed-Stand: bestehender lokaler Seed-Stand mit Instanz `de-musterhausen`

## 2. Testprofil

- Szenario A: Cache-Hit
  - **belegt** durch archivierten Endpunktlauf
- Szenario B: Cache-Miss
  - **belegt** durch archivierten Endpunktlauf
- Szenario C: Recompute nach Invalidierung
  - **belegt** durch archivierten Endpunktlauf
- Szenario D: Fail-Closed bei Redis-/Recompute-Fehler
  - **funktional belegt** über Tests, nicht als Last-/Latenzlauf

## 3. Messumgebung

- Laufzeitumgebung:
  - vorhandene Baselines wurden als komponentennahe Benchmarks dokumentiert
  - ein endpointnaher Messlauf gegen `POST /iam/authorize` ist in diesem Artefakt enthalten
- Node-Version:
  - im vorliegenden Artefakt nicht separat festgehalten
- Redis-Version / Topologie:
  - lokale Redis-Instanz aus dem Profil `local-keycloak`
- Datenbank:
  - lokale Postgres-Instanz aus dem Profil `local-keycloak`
- Netzwerkprofil:
  - lokal: direkt gemessen
  - Slow-4G: nicht gemessen
- Beobachtungswerkzeuge:
  - serverseitige Laufzeitmessung im Benchmark-Runner
  - archivierter JSON- und Markdown-Report unter `docs/reports/`
  - strukturierte Logs aus der lokalen Laufzeitumgebung

## 4. Lastprofil

- Gleichzeitige Requests:
  - sequenzielle serverseitige Stichprobe je Szenario im aktuellen lokalen Akzeptanzlauf
- Dauer je Lauf:
  - abhängig von Warm-up und `12` Mess-Requests je Szenario, im archivierten Lauf insgesamt unter `1 s`
- Warm-up-Dauer:
  - `2` Requests je Szenario
- Wiederholungen je Szenario:
  - `12` Mess-Requests je Szenario
- Verwendete Endpunkte:
  - Soll: `POST /iam/authorize`
  - Soll: `GET /iam/me/permissions`
  - Ist: Benchmark misst den echten `POST /iam/authorize`-Pfad; der Read-Endpunkt dient dem umgebenden IAM-Kontext, ist aber nicht Teil der Szenario-Latenztabelle

## 5. Ergebnisübersicht

| Szenario | Netzwerkprofil | Samples | p50 | p95 | p99 | Ziel | Ergebnis |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cache-Hit | lokal | `12` | `3.99 ms` | `10.44 ms` | `10.44 ms` | p95 < 100 ms | **erfüllt** |
| Cache-Miss | lokal | `12` | `10.58 ms` | `138.71 ms` | `138.71 ms` | beobachtend, unter 300 ms | **erfüllt** |
| Recompute | lokal | `12` | `9.00 ms` | `15.98 ms` | `15.98 ms` | beobachtend, unter 300 ms | **erfüllt** |
| Cache-Hit evaluator-nah | lokal | `20.000` | `0,0005 ms` | `0,0007 ms` | `0,0012 ms` | komponentennahe Referenz | **ergänzende Evidenz** |
| Cache-Hit inkl. ABAC/Hierarchie evaluator-nah | lokal | `20.000` | `0,0019 ms` | `0,0057 ms` | `0,0061 ms` | komponentennahe Referenz | **ergänzende Evidenz** |

## 6. Vorliegende Messwerte und Einordnung

### 6.1 RBAC-v1-Baseline

Vorliegend ist eine evaluator-nahe Baseline für den damaligen RBAC-v1-Authorize-Pfad:

- Quelle: [docs/reports/iam-authorize-baseline-2026-02-27.md](./iam-authorize-baseline-2026-02-27.md)
- `avg`: `0.0005 ms`
- `p50`: `0.0005 ms`
- `p95`: `0.0007 ms`
- `p99`: `0.0012 ms`
- Zielwert im Bericht: `p95 < 50 ms`
- Ergebnis: erfüllt

Einordnung:

- Diese Messung stützt die Aussage, dass die reine Entscheidungslogik keine erkennbare Latenzgefahr darstellt.
- Sie ist als ergänzende Evidenz wertvoll, aber nicht der eigentliche Endpunktnachweis für die Kundenabnahme von `WP-004`.

### 6.2 RBAC + ABAC + Hierarchie-Baseline

Vorliegend ist außerdem eine erweiterte evaluator-nahe Baseline mit `RBAC + ABAC + Hierarchie`:

- Quelle: [docs/reports/iam-authorize-abac-cache-baseline-2026-02-28.md](./iam-authorize-abac-cache-baseline-2026-02-28.md)
- `avg`: `0.0023 ms`
- `p50`: `0.0019 ms`
- `p95`: `0.0057 ms`
- `p99`: `0.0061 ms`
- `max`: `0.1936 ms`
- Zielwert im Bericht: `p95 < 50 ms`
- Ergebnis: erfüllt

Einordnung:

- Auch mit ABAC- und Hierarchieanteilen liegt die reine Evaluator-Logik deutlich unterhalb jeder relevanten Endpunktgrenze.
- Die Messung bleibt trotzdem komponentennah und ergänzt den jetzt zusätzlich vorliegenden HTTP-/Redis-/DB-Endpunktnachweis.

### 6.3 Endpointnaher Authorize-Performance-Lauf

Vorliegend ist jetzt der GUI-gestützte Benchmark gegen den echten `/iam/authorize`-Pfad:

- Quelle Markdown: [docs/reports/iam-authorize-performance-2026-05-25T16-57-45Z.md](./iam-authorize-performance-2026-05-25T16-57-45Z.md)
- Quelle JSON: [docs/reports/iam-authorize-performance-2026-05-25T16-57-45Z.json](./iam-authorize-performance-2026-05-25T16-57-45Z.json)
- Cache-Hit `p95`: `10.44 ms`
- Cache-Miss `p95`: `138.71 ms`
- Recompute `p95`: `15.98 ms`
- Ergebnis: alle Szenarien erfüllt

Einordnung:

- Der Lauf nutzt die echte Administrations-Session und misst serverseitig den realen `POST /iam/authorize`-Pfad.
- Der zuvor identifizierte Middleware-Hot-Path wurde durch sehr kurze In-Process-Caches für Session-Resolution und Account-Lifecycle entschärft.
- Damit ist der formale Performance-Nachweis für `WP-004` repo-seitig erbracht.

## 7. Funktionale Stützbelege für Cache-Pfad und Recompute

Die folgenden Artefakte belegen, dass die zu messenden Pfade fachlich vorhanden und testseitig wirksam sind:

- Cache-Hit aus Memory oder Redis:
  - [packages/auth-runtime/src/iam-authorization/permission-store.ts](../../packages/auth-runtime/src/iam-authorization/permission-store.ts)
  - [packages/auth-runtime/src/iam-authorization/permission-store.test.ts](../../packages/auth-runtime/src/iam-authorization/permission-store.test.ts)
- Redis-Snapshot-Write und HMAC-Validierung:
  - [packages/auth-runtime/src/iam-authorization/redis-permission-snapshot.server.ts](../../packages/auth-runtime/src/iam-authorization/redis-permission-snapshot.server.ts)
  - [packages/auth-runtime/src/iam-authorization/redis-permission-snapshot.server.test.ts](../../packages/auth-runtime/src/iam-authorization/redis-permission-snapshot.server.test.ts)
- Recompute nach Stale / Invalidation:
  - [packages/auth-runtime/src/iam-authorization/permission-store.test.ts](../../packages/auth-runtime/src/iam-authorization/permission-store.test.ts)
  - [packages/auth-runtime/src/iam-authorization/snapshot-invalidation.server.test.ts](../../packages/auth-runtime/src/iam-authorization/snapshot-invalidation.server.test.ts)
- Runtime-Health-Felder für Cache-Degradation:
  - [packages/auth-runtime/src/iam-authorization/shared-cache-health.ts](../../packages/auth-runtime/src/iam-authorization/shared-cache-health.ts)
  - [packages/auth-runtime/src/iam-authorization/shared-cache-health.test.ts](../../packages/auth-runtime/src/iam-authorization/shared-cache-health.test.ts)

Diese Evidenz beantwortet die Frage, **ob** der Pfad vorhanden ist. Die zusätzliche Endpunktmessung beantwortet jetzt auch belastbar, **wie schnell** der echte HTTP-Endpunkt im lokalen Akzeptanzlauf ist.

## 8. Beobachtungen

- Cache-Hit-Rate:
  - im aktuellen Report vollständig als `hit` ausgewiesen
- Recompute-Rate pro Minute:
  - nicht Gegenstand dieses Akzeptanzlaufs
- Redis-Latenz:
  - indirekt durch den Endpunktlauf mit Redis-Nutzung mit abgedeckt, aber nicht separat als Einzelmetrik exportiert
- Invalidation-Latenz:
  - Recompute-Szenario und Laufzeitlogs belegen den funktionalen Invalidation-Pfad
- Readiness-Status während des Laufs:
  - kein separater Fokus dieses Akzeptanzlaufs
- erkannte Cold-Starts:
  - Warm-up und Messlauf sind archiviert; ein gesonderter Cold-Start-Report ist nicht erforderlich

## 9. Abweichungen und Risiken

- Abweichung 1:
  - Der archivierte Akzeptanzlauf ist lokal und nicht als separates Zielumgebungsartefakt durchgeführt.
- Operative Auswirkung:
  - kein repo-seitiger Abnahmeblocker; optionaler Zusatznutzen für Delivery und Betrieb
- Empfohlene Maßnahme:
  - bei Bedarf ergänzend einen Zielumgebungslauf archivieren

## 10. Heutige Repo-Verifikation

Am `2026-05-25` wurden die fachlich relevanten Authorization-Suites erneut verifiziert:

- `pnpm nx run auth-runtime:test:types` -> erfolgreich
- `pnpm exec vitest run src/iam-authorization/authorize.test.ts src/iam-authorization/me-permissions.test.ts src/iam-authorization/permission-store.test.ts src/iam-authorization/redis-permission-snapshot.server.test.ts src/iam-authorization/snapshot-invalidation.server.test.ts` -> erfolgreich
- `pnpm exec vitest run src/iam-authorization/shared-effective-permissions.test.ts src/iam-authorization/shared.test.ts src/iam-authorization/shared-cache-health.test.ts` -> erfolgreich

Diese Verifikation belegt die technische Korrektheit der Pfade. Die reale Endpunktlatenz ist zusätzlich über den archivierten GUI-Benchmark belegt.

## 11. Erforderlicher Abschlusslauf für finale Abnahme

Für die finale Abnahme ist dieses Artefakt jetzt vollständig genug. Optional ergänzbar sind:

1. ein separater Zielumgebungslauf
2. ein ergänzender Betriebsreport mit Infrastrukturmetriken

### Ausführbarer Repo-Befehl

Die Messstrecke ist im Repository ausführbar und der geforderte Lauf wurde erfolgreich demonstriert:

- Nx-Target:
  - `pnpm nx run sva-studio-react:test:authorize-performance`
- Root-Alias:
  - `pnpm test:acceptance:iam:performance`

Der Lauf verwendet den echten Login- und Session-Pfad, misst reale `POST /iam/authorize`-Requests und erzeugt archivierungsfähige JSON-/Markdown-Artefakte unter `docs/reports/`.

## 12. Artefaktverweise

- Baseline RBAC:
  - [docs/reports/iam-authorize-baseline-2026-02-27.md](./iam-authorize-baseline-2026-02-27.md)
- Baseline RBAC + ABAC + Hierarchie:
  - [docs/reports/iam-authorize-abac-cache-baseline-2026-02-28.md](./iam-authorize-abac-cache-baseline-2026-02-28.md)
- Endpointnaher Performance-Report:
  - [docs/reports/iam-authorize-performance-2026-05-25T16-57-45Z.md](./iam-authorize-performance-2026-05-25T16-57-45Z.md)
  - [docs/reports/iam-authorize-performance-2026-05-25T16-57-45Z.json](./iam-authorize-performance-2026-05-25T16-57-45Z.json)
- Berichtsvorlage:
  - [docs/reports/iam-permission-cache-performance-report-template-2026-03-18.md](./iam-permission-cache-performance-report-template-2026-03-18.md)
- Ausführbare Messstrecke:
  - [scripts/ci/run-iam-authorize-performance.ts](../../scripts/ci/run-iam-authorize-performance.ts)
- Abnahmeartefakte Pakete 3 bis 5:
  - [docs/reports/2026-03-31-iam-offer-packages-3-to-5-abnahmeartefakte.md](./2026-03-31-iam-offer-packages-3-to-5-abnahmeartefakte.md)
- Abnahmeprotokoll `WP-004`:
  - [docs/reports/wp-004-permission-engine-abnahme-2026-05-25.md](./wp-004-permission-engine-abnahme-2026-05-25.md)

## Entscheidung

Dieses Dokument ist als **vollständige Performance-Nachweisdatei** für die Repository-seitige Abnahme von `WP-004` verwendbar. Ein separater Zielumgebungslauf bleibt optionales Delivery-Artefakt.
