## ADDED Requirements

### Requirement: Kanonischer Studio-Rollout-Pfad

Das System SHALL fuer das Runtime-Profil `studio` genau einen offiziellen Rollout-Pfad ueber die Runtime-CLI bereitstellen.

#### Scenario: Studio-Deploy wird regulär vorbereitet und ausgerollt

- **WHEN** ein Operator `studio` ausrollen moechte
- **THEN** verwendet der offizielle Pfad `env:precheck:studio`, `env:deploy:studio` und `env:smoke:studio`
- **AND** direkte Service- oder Portainer-Manipulationen gelten nur als dokumentierter Notfallpfad
- **AND** der Rollout-Vertrag benennt den festen Stack- und Endpoint-Kontext fuer `studio`

### Requirement: Pragmaticher Runtime-Contract fuer Studio

Das System SHALL fuer `studio` einen kleinen, expliziten Runtime-Contract bereitstellen, der harte Pflichtwerte von ableitbaren Verbindungswerten trennt.

#### Scenario: Ableitbare Laufzeitverbindungen fuer Studio

- **WHEN** `IAM_DATABASE_URL` oder `REDIS_URL` im `studio`-Profil nicht explizit gesetzt sind
- **THEN** darf der Rollout-Pfad diese Werte aus den vorhandenen Datenbank- und Redis-Bausteinen ableiten
- **AND** bei fehlenden Ableitungsgrundlagen bricht der Rollout mit klarer Diagnose ab
- **AND** lokale Profile duerfen weiterhin explizite Verbindungs-URLs als Pflicht verlangen

#### Scenario: Kein stiller Fallback auf fremde Profile oder Stack-Namen

- **WHEN** das `studio`-Profil geladen wird
- **THEN** verwendet der Runtime-Pfad den konfigurierten `SVA_STACK_NAME`, `QUANTUM_ENDPOINT` und `SVA_RUNTIME_PROFILE`
- **AND** er faellt fuer Remote-Operationen nicht still auf andere Profile oder Stack-Namen zurueck

### Requirement: Diagnostischer Deploy-Report fuer Studio

Das System SHALL fuer `studio` einen belastbaren Deploy-Report mit technischen Gates und Rollout-Kontext erzeugen.

#### Scenario: Studio-Deploy-Report wird erzeugt

- **WHEN** ein `studio`-Deploy oder Precheck ausgefuehrt wird
- **THEN** enthalten die Artefakte mindestens Commit-SHA, Image-Ref/Digest, Stack, Endpoint, Runtime-Profil und Gate-Ergebnisse
- **AND** Fehler werden mit stabilen Codes und menschenlesbaren Kurzbeschreibungen dokumentiert
- **AND** die Artefakte liegen unter `artifacts/runtime/deployments/`

### Requirement: Studio-Drift- und Tenant-Gates

Das System SHALL fuer `studio` vor und nach dem Rollout minimale Drift- und Tenant-Gates auswerten.

#### Scenario: Drift-Check fuer Live-Service und Runtime-Contract

- **WHEN** `env:precheck:studio` oder `env:deploy:studio` laeuft
- **THEN** prueft der Prozess mindestens den Ziel-Digest gegen den Live-Service
- **AND** er prueft den effektiven Runtime-Kontext fuer den App-Service ohne Secrets offenzulegen
- **AND** er meldet Abweichungen als deterministische Diagnose statt als stillen Best-Effort-Fallback

#### Scenario: Tenant- und Hostname-Smokes fuer Studio

- **WHEN** die externen Smokes fuer `studio` ausgefuehrt werden
- **THEN** pruefen sie den Root-Host und mindestens die freigegebenen Tenant-Hosts
- **AND** sie validieren, dass `/auth/login` tenant-spezifische Redirects erzeugt
- **AND** sie pruefen, dass IAM-API-Pfade keine HTML-Fallback-Antworten liefern

### Requirement: Pragmaticher Migrations- und Bootstrap-Pfad fuer Studio

Das System SHALL fuer `studio` einen fruehphasen-tauglichen Migrations- und Bootstrap-Pfad fuer Schema und Hostname-Bestand bereitstellen.

#### Scenario: Schema-and-App-Deploy fuer Studio

- **WHEN** ein `studio`-Deploy im Modus `schema-and-app` ausgefuehrt wird
- **THEN** laufen Migrationen kontrolliert vor dem App-Rollout oder innerhalb des dokumentierten Flow
- **AND** der Deploy-Report dokumentiert den Modus und das Wartungsfenster
- **AND** Rollback bleibt fuer das Schema pragmatisch auf dokumentierten Roll-forward oder App-Digest-Rollback beschraenkt

#### Scenario: Hostname-Bootstrap fuer erlaubte Testinstanzen

- **WHEN** der Reset- oder Bootstrap-Pfad fuer `studio` laeuft
- **THEN** werden erlaubte Testinstanzen und ihre primaeren Hostnames idempotent sichergestellt
- **AND** fehlende Hostname-Mappings werden als Diagnose sichtbar
