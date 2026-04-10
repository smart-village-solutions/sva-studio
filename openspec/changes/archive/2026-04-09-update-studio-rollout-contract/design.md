## Context

`studio` ist noch kein voll ausgebauter Produktionsbetrieb, muss aber bereits reproduzierbar und diagnosetauglich ausgerollt werden. Die größten Risiken liegen aktuell nicht in komplexen Governance-Prozessen, sondern in Drift, unklaren Laufzeitverträgen, stillen Fallbacks und fehlender Fehlerdiagnostik.

## Decisions

### 1. Frühe Testphase: kleiner, harter Contract statt Maximalautomatisierung

Für `studio` wird ein verbindlicher Minimalvertrag definiert:

- ein kanonischer Rollout-Pfad
- feste Stack-/Endpoint-Zuordnung
- klar getrennte Pflichtwerte, ableitbare Werte und Secrets
- image-digest-basierter Deploy
- maschinenlesbare Diagnose und Reports

Komplexe Betriebsfunktionen wie vollautomatische Secret-Rotation, vollumfängliche RBAC-Governance oder vollständige Realm-Provisionierung bleiben bewusst außerhalb dieses Changes.

### 2. Ableitbare Verbindungswerte werden nicht mehr als harte Pflicht-URLs behandelt

`IAM_DATABASE_URL` und optional `REDIS_URL` bleiben unterstützt, gelten für `studio` aber nicht mehr als einzige zulässige Konfiguration. Wenn sie fehlen, muss der Runtime-Pfad aus den vorhandenen DB-/Redis-Bausteinen einen belastbaren Verbindungswert ableiten oder mit klarer Diagnose abbrechen.

### 3. Diagnostik wird als primärer Stabilitätshebel behandelt

Der Rollout gewinnt Stabilität vor allem durch früh sichtbare, deterministische Fehler:

- Runtime-Contract-Fehler
- Digest-/Image-Fehler
- Hostname-/Tenant-Fehler
- Schema-/Migrationsfehler
- Live-Drift

Daher werden Precheck, Deploy-Report und Smoke-Pfad ausgebaut, statt für die frühe Phase bereits eine schwere Betriebsplattform einzuführen.

### 4. Hostname-Bestand wird pragmatisch synchronisiert

Für die Testphase reicht ein idempotenter Bootstrap-/Reset-Pfad, der erlaubte Instanzen und ihre primären Hostnames sicherstellt. Eine vollständige Orchestrierung des gesamten Instanz- und Realm-Lebenszyklus ist bewusst nicht Teil dieses Changes.

## Consequences

Vorteile:

- klarere Fehlerbilder bei Rollout-Fehlschlägen
- weniger versteckte Defaults und weniger Drift
- reproduzierbarerer Studio-Rollout ohne zusätzliche Plattform

Trade-offs:

- einige pragmatische Hilfskonstrukte bleiben bestehen, solange `studio` in der frühen Testphase ist
- der Change ersetzt keine spätere produktionsreife Betriebsgovernance
