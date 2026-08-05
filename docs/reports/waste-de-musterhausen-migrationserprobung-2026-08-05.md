# Waste-Migration: Erkenntnisse aus der lokalen De-Musterhausen-Erprobung vom 5. August 2026

## Ergebnis

Die lokale Übernahme der Prignitz-Waste-Daten in den Tenant `de-musterhausen` war als Ende-zu-Ende-Test wertvoll, weil sie mehrere Probleme sichtbar gemacht hat, die ein reiner Tabellenvergleich oder ein grüner Healthcheck nicht erkennt.

Die Supabase-Quelle wurde während der gesamten Erprobung ausschließlich gelesen und nicht verändert. In der lokalen Tenant-Datenbank stehen weiterhin alle 7.494 inventarisierten Quelldatensätze zur Verfügung. Nach den Korrekturen liefern sowohl das Studio als auch der öffentliche Abfallkalender die erwarteten Daten.

Dieser Bericht ergänzt:

- [Quellinventar der Waste-Supabase](./waste-supabase-source-inventory-2026-08-02.md)
- [Lokaler PostgreSQL-Migrationstrockenlauf](./waste-postgresql-migration-dry-run-2026-08-02.md)

## Testaufbau

- fachlicher Test-Tenant: `de-musterhausen`
- lokale Studio-App: Dev-Server auf Port 3000
- öffentlicher Abfallkalender: Dev-Server auf Port 3002
- Infrastruktur in Docker: PostgreSQL und Redis
- Quellbestand: 13 `public.waste_*`-Tabellen mit insgesamt 7.494 Datensätzen
- Tenant-Datenbank: `sva_w_de_musterhausen_3543907377a6_db`
- Provisionierungsstand: `ready`, gewünschte und abgeschlossene Generation 5

Zugangsdaten, Secret-Werte und fachliche Einzelinhalte sind nicht Bestandteil dieses Berichts.

## Festgestellte Probleme

### 1. Veraltetes Docker-Image verdeckte den aktuellen Anwendungsstand

#### Symptom

Die lokale De-Musterhausen-Instanz zeigte ein deutlich veraltetes Layout, obwohl der Workspace bereits den aktuellen Stand enthielt.

#### Ursache

Port 3000 wurde noch von einem älteren Docker-Image der Studio-App belegt. Der aktuelle lokale Dev-Server war deshalb auf Port 3001 ausgewichen und wurde nicht über die erwartete URL aufgerufen.

#### Korrektur

Das Image wurde einmal aktualisiert. Anschließend wurden die Docker-Container für App und Provisioner gestoppt und Studio sowie öffentlicher Abfallkalender als lokale Dev-Prozesse gestartet. PostgreSQL und Redis blieben in Docker aktiv.

#### Lehre für `bb-prignitz`

Vor fachlichen Smokes muss eindeutig nachgewiesen werden, welcher Prozess und welches Image den geprüften Port bedienen. Ein HTTP-200-Healthcheck allein beweist nicht, dass die erwartete Anwendungsversion läuft.

### 2. Redis verwendete wörtlich `${REDIS_PASSWORD}` als Passwort

#### Symptom

`/auth/login` antwortete mit HTTP 503 und leitete nicht zu Keycloak weiter. Das Studio-Log meldete `WRONGPASS` und `session_store_unavailable`.

#### Ursache

Der Redis-Befehl im lokalen Compose-Override wurde nicht über eine Shell ausgeführt. Dadurch erhielt Redis den Text `${REDIS_PASSWORD}` als tatsächliches Passwort, während Studio den aufgelösten Secret-Wert verwendete. Der Healthcheck war zusätzlich irreführend, weil `redis-cli` trotz fehlgeschlagener Authentifizierung mit Exit-Code 0 endete.

#### Korrektur

Der Redis-Startbefehl wird nun explizit über `sh -ec` ausgeführt. Redis, Studio und der lokale Worker wurden danach mit einer konsistenten Konfiguration neu gestartet. Der Login erzeugte anschließend einen OIDC-State und leitete mit HTTP 302 zu `keycloak.smart-village.app/realms/de-musterhausen` weiter.

#### Lehre für `bb-prignitz`

- Redis-Smokes müssen eine authentifizierte Antwort `PONG` prüfen und dürfen sich nicht ausschließlich auf den Containerstatus `healthy` verlassen.
- Nach Runtime-Neustarts ist ein vollständiger Login mit State-Cookie, Redirect, Callback und authentifizierter `/auth/me`-Abfrage erforderlich.
- Lokale Compose-Besonderheiten sind vom eigentlichen Produktions-Cutover zu trennen, müssen aber vor einem lokalen Generalprobelauf stabil sein.

### 3. Der Datenimport lief nach dem Schema-Backfill

#### Symptom

Die Standortauswahl des öffentlichen Abfallkalenders funktionierte, nach der Straßenauswahl wurden aber keine Termine angezeigt.

#### Ursache

Die Quelle enthält 160 Datensätze in `waste_location_tour_pickup_dates`. Die aktuelle Anwendung liest konkrete Termine aus:

- `waste_tour_assignments`
- `waste_tour_assignment_locations`

Das aktuelle Schema enthält einen idempotenten Backfill von der Legacy-Tabelle in diese beiden Tabellen. Im lokalen Tenant war das Schema jedoch bereits vor dem Datenimport aufgebaut worden. Der Import füllte danach nur die Legacy-Tabelle; der Backfill wurde nicht erneut ausgeführt. Daher standen 160 Legacy-Termine, aber null aktuelle Assignments und null Assignment-Standortverknüpfungen bereit.

143 der 160 Legacy-Termine lagen zum Testzeitpunkt noch in der Zukunft. Fehlende Termine waren deshalb kein Problem des Anzeigezeitraums.

#### Korrektur

Der vorhandene idempotente Backfill wurde transaktional erneut angewandt:

- 160 Tour-Assignments erzeugt
- 160 Assignment-Standortverknüpfungen erzeugt

#### Lehre für `bb-prignitz`

Die verbindliche Reihenfolge muss lauten:

1. leeres Tenant-Ziel provisionieren und Schema aufbauen,
2. Quelldaten importieren,
3. alle aktuellen idempotenten Waste-Schema- und Datenmigrationen erneut anwenden,
4. Legacy- und Zieltabelle separat zählen,
5. erst danach Studio und öffentlichen Kalender starten.

Der frühere isolierte Trockenlauf hatte diese Reihenfolge bereits korrekt verwendet und deshalb 160 Legacy-Termine sowie 160 Assignments nachgewiesen. Der lokale Tenant-Test belegt, dass dieser Nachlauf im operativen Cutover nicht optional ist.

### 4. Öffentliche Kalenderabfrage scheiterte an `SELECT DISTINCT ... ORDER BY`

#### Symptom

Nach dem Assignment-Backfill antwortete `/api/public-waste/calendar` weiterhin mit HTTP 400 `invalid_request`.

#### Ursache

Die Assignment-Abfrage verwendete `SELECT DISTINCT`, sortierte aber nach Tabellen-Ausdrücken statt nach den projizierten Aliasnamen. PostgreSQL brach mit folgendem Fehler ab:

```text
for SELECT DISTINCT, ORDER BY expressions must appear in select list
```

Der öffentliche HTTP-Handler wandelte die Exception in eine generische 400-Antwort um und protokollierte die Ursache nicht. Deshalb blieb das lokale Public-Waste-Log ohne fachlichen Fehlerhinweis.

#### Korrektur

Die Sortierung verwendet nun die projizierten Aliasnamen `pickup_date`, `tour_name`, `fraction_label` und `assignment_id`.

#### Verifikation

- gezielter Repository-Test: 14 Tests bestanden
- TypeScript-Typecheck des öffentlichen Abfallkalenders: bestanden
- realer Kalenderaufruf: HTTP 200
- Antwort enthält Termine aus 2026

#### Lehre für `bb-prignitz`

- Der Smoke darf nicht bei der Standortauswahl enden.
- Mindestens eine reale Kombination aus Region, Ort, Straße und gegebenenfalls Hausnummer muss bis zu einer nicht leeren Terminantwort geprüft werden.
- Generische HTTP-400-Antworten müssen über Serverlogs oder einen direkten Repository-Lauf auf ihre eigentliche Datenbankursache zurückverfolgt werden.
- Für den produktiven Cutover muss eine Anwendungsversion mit dieser SQL-Korrektur verwendet werden.

### 5. Studio-App sah den vorhandenen Provisionierungsstatus wegen RLS nicht

#### Symptom

Im Studio unter `/plugins/waste-management` blieben Stammdaten leer. Die API-Endpunkte für Einstellungen und Stammdaten antworteten mit HTTP 503 und meldeten, die Waste-Datenbank sei noch nicht betriebsbereit.

#### Ursache

Der Datensatz in `iam.instance_waste_provisioning` war tatsächlich `ready` mit Generation 5. Die Tabelle verwendet jedoch erzwungene Row-Level-Security über `iam.current_instance_id()`.

Der Provisionierungs-Repository-Pfad setzte vor dem Zugriff nicht `app.instance_id`. Mit dem eingeschränkten App-Benutzer `sva_app` lieferte die Abfrage deshalb keinen sichtbaren Datensatz. Ein Kontrollzugriff mit dem Datenbank-Owner sah den Datensatz und hatte das Problem zunächst verdeckt.

#### Korrektur

Der Repository-Pfad führt den Provisionierungszugriff nun in einer Transaktion aus und setzt vorher lokal:

```sql
SELECT set_config('app.instance_id', :instanceId, true);
```

Das gilt für Lesen, Anfordern, Claim, Abschluss und Fehlerstatus der Waste-Provisionierung.

#### Verifikation

- Provisionierungs-Lookup mit `sva_app`: `ready`, Generation 5
- vollständiger Studio-Waste-Loader: 7 Fraktionen geladen
- gezielter Repository-Test: 10 Tests bestanden
- TypeScript-Typecheck von `data-repositories`: bestanden

#### Lehre für `bb-prignitz`

- Readiness muss mit derselben Datenbankrolle geprüft werden, die die Anwendung verwendet.
- Owner- oder Admin-Abfragen sind notwendige Diagnosemittel, aber kein Laufzeitnachweis.
- Für den Cutover muss eine Anwendungsversion mit der RLS-Kontextkorrektur verwendet werden.
- Der Studio-Smoke muss mindestens Fraktionen, Touren, Standorte und Planung über die echten authentifizierten API-Pfade laden.

### 6. Zu breite lokale Umgebungsüberlagerung verfälschte einen Neustart

#### Symptom

Nach einer Zwischenkorrektur entstanden erneut 503-Antworten und bestehende Sessions konnten zeitweise nicht entschlüsselt werden.

#### Ursache

Beim manuellen Neustart war die allgemeine Root-`.env` vollständig über das Profil `local-keycloak` gelegt worden. Dadurch wurden unter anderem Datenbank- und Auth-Werte überschrieben, obwohl nur die Redis-Konfiguration betrachtet werden sollte.

#### Korrektur

Studio und Worker wurden ausschließlich mit `buildProfileEnv('local-keycloak')` neu gestartet. Danach funktionierten Login, Provisionierungs-Lookup und Waste-Loader wieder konsistent.

#### Lehre für `bb-prignitz`

- Ein Runtime-Profil darf nicht pauschal mit einer anderen `.env` überlagert werden.
- Für jeden Prozess muss vor dem Start eine kanonische Konfigurationsquelle feststehen.
- Konfigurationsprüfungen dürfen nur Vorhandensein, Zielhost, Datenbankname und Fingerprints vergleichen; Secret-Werte gehören weder in Logs noch in Reports.

## Lokale Logpfade

- Studio: `artifacts/runtime/logs/local-keycloak.log`
- Provisionierungs-Worker: `artifacts/runtime/logs/local-keycloak.worker.log`
- öffentlicher Abfallkalender: `artifacts/runtime/logs/public-waste-calendar-web.log`

Der öffentliche Kalender protokollierte den SQL-Fehler nicht, weil sein Handler Exceptions derzeit in generische 400-Antworten umwandelt. Für den Cutover muss deshalb entweder die Fehlerprotokollierung vorab verbessert oder ein direkter, read-only Repository-Smoke als Diagnosepfad vorbereitet werden.

## Verbindliche Vorabprüfungen für `bb-prignitz`

### Vor dem Betriebsstopp

- freigegebenen Anwendungscode und unveränderlichen Image-Digest festlegen
- sicherstellen, dass SQL- und RLS-Korrektur enthalten sind
- Quellinventar und Prüfsummen aktualisieren
- Ziel-Tenant und leere Tenant-Datenbank provisionieren
- Zielstatus mit Owner und Anwendungskonto prüfen
- ausreichend freien Speicherplatz nachweisen
- Backup- und Restore-Drill abschließen
- kanonische Konfigurationsquellen für Studio, Worker und Public Waste festlegen

### Während des Offline-Cutovers

- Studio, Public Waste und alle schreibenden Worker stoppen
- aktive Quell- und Zielsessions kontrollieren
- Quelle ausschließlich lesen
- explizit inventarisierte Waste-Tabellen importieren
- aktuelle idempotente Schema- und Datenmigrationen nach dem Import erneut ausführen
- Import- und Backfill-Zeilenzahlen vergleichen
- Ziel zunächst ohne fachliche Schreibfreigabe starten

### Pflichtnachweise vor Schreibfreigabe

- alle 13 Quelltabellen mit exakten Zeilenzahlen verglichen
- insgesamt 7.494 Datensätze beziehungsweise aktualisierter Quellstand nachgewiesen
- Legacy-Abholtermine und erzeugte Assignments vollständig abgeglichen
- Assignment-Standortverknüpfungen vollständig abgeglichen
- Provisionierungsstatus mit Anwendungskonto `ready`
- Studio lädt Fraktionen, Touren, Standorte und Planung
- öffentlicher Kalender lädt die Auswahlkaskade
- mindestens eine reale Auswahl liefert zukünftige Termine
- Login, Callback und authentifizierte Session funktionieren
- authentifizierter Redis-Smoke erfolgreich
- lokale beziehungsweise zentrale Logs enthalten keine neuen Waste-, Datenbank- oder Auth-Fehler

## Abgrenzung

Diese Erprobung war kein produktiver Cutover von `bb-prignitz`. Sie beweist den lokalen Zielpfad und dokumentiert konkrete Fehlerklassen. Der produktive Umzug bleibt ein kontrollierter Offline-Cutover mit unveränderter, anschließend schreibgeschützt aufbewahrter Supabase-Quelle und separater Freigabe der Zielschreibzugriffe.
