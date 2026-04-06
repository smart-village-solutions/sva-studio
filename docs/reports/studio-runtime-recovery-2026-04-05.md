# Studio Runtime Recovery 2026-04-05

## Ziel

Dieser Bericht hält die Erkenntnisse aus der Reparatur des `studio`-Stacks fest. Fokus waren:

- kaputter Deploy durch falsche Image-Plattform
- Schema-Drift zwischen laufender App und IAM-Datenbank
- Tenant-Login-Fehler auf `bb-guben.studio.smart-village.app` und `de-musterhausen.studio.smart-village.app`
- flakey Nachweise im `precheck` durch verzögerte Loki-Ingestion

## Technische Root Causes

### 1. Falsche Container-Plattform

Das zuerst ausgerollte Image war nicht sauber für den Linux-Swarm gebaut. Der Swarm quittierte das mit `unsupported platform`. Die eigentliche Lücke war, dass der Deploy-Prozess nur einen Digest ausrollte, aber die Zielplattform nicht hart validierte.

### 2. Schema-Drift trotz formalem Migrationsstand

Der Tenant-Auth-Pfad brach zuerst an fehlenden Spalten wie `iam.instances.auth_client_secret_ciphertext` und später `iam.instances.auth_realm`. Die Datenbank war also nicht kompatibel zum laufenden Code, obwohl Teile des Migrationsverlaufs bereits fortgeschrieben waren.

### 3. Unvollständige Registry-/Auth-Daten für aktive Instanzen

Nach Wiederherstellung der Tabellen fehlten für `bb-guben` und `de-musterhausen` noch:

- `auth_realm`
- `auth_client_id`
- `auth_issuer_url`

Dadurch wurde erst `tenant_not_found` und danach ein generischer Auth-Fehler ausgelöst.

### 4. Aktive RLS auf Runtime-Registry-Tabellen

`iam.instances` und `iam.instance_hostnames` hatten auf `studio` noch `ENABLE/FORCE ROW LEVEL SECURITY`. Für `iam.instance_hostnames` existierte dabei keine passende Runtime-Policy. Aus Sicht von `sva_app` war die Registry dadurch effektiv leer.

### 5. Operativer Transport war instabil

Größere `quantum-cli exec`-Aufrufe kippten mehrfach mit `broken pipe`, `connection reset by peer` oder kaputten Marker-Ausgaben. Das erschwerte schrittweises Nachziehen von Migrationen erheblich.

## Was behoben wurde

- Plattform-Gate für Deploys ergänzt, damit `linux/amd64` vor dem Rollout validiert wird
- Schema-Guard erweitert, damit kritische IAM-Drifts früher auffallen
- Remote-Goose-/SQL-Pfad für `studio` robuster gemacht
- fehlende Migrationsteile bis `0027` nachgezogen
- RLS auf `iam.instances` und `iam.instance_hostnames` auf `studio` in den erwarteten Runtime-Zustand gebracht
- Tenant-Auth-Felder für aktive Instanzen korrekt backfilled
- `instance-auth-config` und `instance-hostnames` im `precheck` näher an der Sicht des App-Users ausgerichtet
- Loki-Nachweis im `precheck` gegen Ingest-Verzögerungen mit Retry gehärtet

## Was wir gelernt haben

### 1. `goose_db_version` allein ist kein verlässlicher Wahrheitsbeweis

Ein fortgeschriebener Versionsstand reicht nicht, wenn:

- einzelne Migrationen wegen Abhängigkeiten faktisch nicht sauber angewendet wurden
- spätere Objekte frühzeitig existieren
- Runtime-relevante Tabellen oder Policies in einem halbfertigen Zustand bleiben

Deshalb braucht es zusätzlich konkrete Schema-Sentinels.

### 2. Runtime-Checks müssen in der Rolle des App-Users denken

Superuser-Checks waren hier irreführend. Der Cluster sah gesund aus, der Superuser sah Tabellen und Hostnames, aber `sva_app` bekam wegen RLS und fehlender Runtime-Policies effektiv andere Ergebnisse. Kritische `doctor`-/`precheck`-Checks sollten immer an der realen Laufzeitrolle ausgerichtet sein.

### 3. Registry-Tabellen sind Teil des Login-Critical-Path

`iam.instances` und `iam.instance_hostnames` sind nicht nur Verwaltungsdaten. Wenn diese Tabellen oder deren Policies kaputt sind, fällt Tenant-Login sofort aus. Sie müssen deshalb im selben Schutzgrad wie Session Store, DB-Health und OIDC-Basisparameter behandelt werden.

### 4. Remote-SQL über Websocket braucht kleine, deterministische Schritte

Große One-Shot-Kommandos waren auf `studio` zu fehleranfällig. Kleine SQL-Dateien mit klaren Marker-Ausgaben und expliziter Verifikation danach waren deutlich robuster als lange Inline-Kommandos.

### 5. Observability-Evidence und harte Funktionsfähigkeit sind zwei verschiedene Gates

Der Login war bereits wieder korrekt, während der Loki-Nachweis noch hinterherhing. Das ist ein valider Warnzustand, aber kein funktionaler Incident mehr. Diese Unterscheidung muss im Betrieb klar bleiben.

### 6. Manuelle Stack-Updates koennen Runtime-Flags vom Soll entkoppeln

Der spaetere Observability-Befund war kein Codefehler, sondern ein Drift zwischen erwartetem Profil und effektiv laufendem Container:

- `config/runtime/studio.vars` erwartete `SVA_ENABLE_SERVER_CONSOLE_LOGS=true`
- der laufende `studio_app` hatte zwischenzeitlich effektiv `SVA_ENABLE_SERVER_CONSOLE_LOGS=false`
- erst ein erneuter kanonischer `env:deploy:studio`-Rollout stellte die Runtime-Flags wieder konsistent her

Fazit: Nach Notfall-Rollbacks oder manuellen `quantum-cli stack update`-Pfaden muss immer ein kanonischer Profil-Deploy folgen, damit Stack-Variablen und lokale Runtime-Vertraege wieder zusammenlaufen.

## Empfehlungen für zukünftige Migrationen

### Kurzfristig

- `schema-guard` weiter als harte Kompatibilitätsprüfung pflegen, nicht nur als Diagnosehilfe
- `precheck`-Abfragen konsequent in der Rolle `APP_DB_USER` ausführen
- für Runtime-kritische Tabellen den Sollzustand von RLS explizit prüfen
- Migrationen mit `UPDATE ... RETURNING` oder anschließender Lesekontrolle verifizieren, statt nur Exit Codes zu vertrauen
- eine explizite `runtime-env-live`-Prüfung beibehalten, damit Drift zwischen Profil und effektiv laufendem Container sofort sichtbar wird

### Mittelfristig

- einen dedizierten `runtime:migrate:remote`-Pfad bauen, der SQL-Dateien hochlädt, ausführt und danach strukturiert validiert
- Migrationsstatus und Schema-Sentinels in einem gemeinsamen Report bündeln
- für kritische Migrationen eine „post migration assertions“-Datei einführen
- Migrationspakete in kleine, idempotente Remote-Batches schneiden, statt große Inline-SQL-Blöcke über `quantum-cli exec` zu streamen
- pro Migration eine maschinenlesbare Minimal-Sollbeschreibung pflegen, damit `doctor` und `precheck` gezielt sagen koennen, welche fachlichen Artefakte noch fehlen

### Langfristig

- Baseline-/Squash-Migration für Neuinstallationen einführen
- historische Einzelmigrationen für Bestandsumgebungen behalten
- neue Migrationen ab einer stabilen Baseline fortführen

Ein sinnvoller Zielzustand wäre:

1. `baseline/0001_iam_baseline.sql` für frische Setups
2. inkrementelle Migrationen nur noch ab dieser Baseline
3. Bestands-Upgrades weiter über die alte Kette
4. ein Kompatibilitäts-Gate, das Code-Version und Minimal-Schema explizit zusammenführt

## Empfohlene nächste Schritte

- den Remote-Migrationspfad aus den gewonnenen Hilfsskripten in ein offizielles Ops-Command überführen
- die hier gefundenen RLS-/Registry-Anforderungen in die Runtime- und Deploy-Guides übernehmen
- nach manuellen Notfalleingriffen immer einen kanonischen `env:deploy:*`-Abgleich fahren, auch wenn das Image selbst unverändert bleibt
