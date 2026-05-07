# Boundary-Audit Instanzverwaltung

## Anlass

Im Zuge des Refactors der Instanzverwaltung wurde geprüft, ob die aktuellen Komplexitäts-Hotspots nur strukturelle Größe oder bereits fachlich riskante Altlasten enthalten.

## Zentrale Befunde

### 1. Doppelte Persistence-Ownership zwischen `@sva/data` und `@sva/data-repositories`

- `packages/data/src/instance-registry/index.ts`
- `packages/data-repositories/src/instance-registry/index.ts`
- `packages/data/src/instance-registry/server.ts`
- `packages/data-repositories/src/instance-registry/server.ts`

Diese Paare waren nicht nur ähnlich, sondern faktisch parallel gepflegte Implementierungen derselben Instanz-Registry-Persistenz.

### 2. Bereits eingetretene fachliche Divergenz

`@sva/data-repositories` enthielt zusätzliche Tenant-IAM-Evidenzzugriffe, die in `@sva/data` noch nicht nachgezogen waren:

- `getLatestTenantIamAccessProbe`
- `getRoleReconcileSummary`

Damit war die bisherige Parallelpflege kein theoretisches Risiko mehr, sondern bereits eine echte Verhaltensdivergenz.

### 3. Zu breite Root-API in `@sva/instance-registry`

Der Root-Entry exportierte neben stabilen Verträgen auch interne Service- und Provisioning-Helfer. Dadurch war die öffentliche Fläche größer als die tatsächlich beabsichtigte Capability-Grenze.

## Führende Ownership nach dem ersten Refactor-Stream

### Persistenz und SQL

Führend ist jetzt `@sva/data-repositories`.

- SQL-Statements
- Row-Mapping
- Repository-Verträge
- servernahe Host-/Pool-Helfer der Instanz-Registry

### Fassade und Paketkante

`@sva/data` dient für die Instanz-Registry jetzt nur noch als Shim/Fassade auf die führende Persistence-Schicht.

### Fach- und HTTP-Orchestrierung

`@sva/instance-registry` bleibt führend für:

- Service-Komposition
- HTTP-Handler
- Keycloak-/Provisioning-Orchestrierung
- Runtime-Wiring

## Im ersten Stream aktiv bereinigte Altlasten

1. Die lokale Instanz-Registry-Implementierung in `@sva/data` wurde auf Re-Exports der führenden `@sva/data-repositories`-Bausteine zurückgeführt.
2. Die Root-API von `@sva/instance-registry` exportiert keine internen Service-Helfer mehr.
3. `service.ts`, `http-mutation-handlers.ts` und `http-instance-handlers.ts` wurden entlang fachlicher Flows in kleinere Kompositionsmodule zerlegt.
4. Die Keycloak-Orchestrierung wurde in getrennte Bausteine für Secrets/Reader sowie Payload/Sync/Finalize aufgeteilt; die bisherigen Sammeldateien dienen nur noch als Fassaden.
5. Die Admin-UI der Instanzverwaltung wurde entlang fachlicher Arbeitsmodelle getrennt:
   - Shared-Toolkit als Fassade mit separaten Modellen, Status- und Fehlermappings
   - Detailroute als Orchestrator mit getrennten Cockpit-, Konfigurations-, Operations- und History-Sektionen
   - Detailmodell getrennt nach Cockpit, Configuration, Workflow, Tenant-IAM und Status

## Aktualisierter Zielzustand nach dem Umsetzungsstream

- `@sva/data-repositories` ist die führende Persistenzschicht der Instanzverwaltung.
- `@sva/data` hält für die Instanz-Registry nur noch dünne Fassaden und Re-Exports.
- `@sva/instance-registry` trennt Root-API, HTTP-Handler, Service-Komposition und Keycloak-Ausführung deutlicher entlang fachlicher Ownership.
- `apps/sva-studio-react` bildet die Instanz-Detailoberfläche entlang von Arbeitsmodellen statt Sammelrouten und Sammel-Shared-Dateien ab.

## Verbleibende Folgearbeit

1. `scripts/ops/instance-registry.ts` von source-internalen Imports auf saubere Paketkanten und Command-Module umstellen
2. Prüfen, ob zusätzliche Root-Exports in `@sva/instance-registry` noch zu breit sind, insbesondere bei Input-Buildern
3. `-instance-create-page.tsx` nur dann weiter schneiden, wenn die nächste Complexity-Auswertung dort noch echten fachlichen Gewinn signalisiert
4. `provisioning-auth-state.ts` nur bei belegtem Boundary-Bruch weiter zerlegen; aktuell ist der Block eher Adapter als Mischzustand

## Beibehaltene Annahmen

- Die bestehende Fachlogik war durch grüne Tests nicht offensichtlich defekt.
- Die Parallelimplementierung in `@sva/data` war jedoch nicht mehr akzeptabel, weil Divergenz bereits eingetreten war.
- Organisationsverwaltung bleibt außerhalb dieses Streams, solange keine harte Shared-Infrastruktur den Schnitt blockiert.
