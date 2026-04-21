## MODIFIED Requirements
### Requirement: Kanonischer Acceptance-Deploypfad

Das System SHALL fuer das Runtime-Profil `studio` einen offiziellen Deploypfad mit `precheck`, digest-basiertem Verify und `deploy` bereitstellen, der Migration, Rollout und Verifikation in fixer Reihenfolge ausfuehrt.

#### Scenario: Root-Scripts bilden den Studio-Releasepfad ab

- **WHEN** `package.json` im Repository geprueft wird
- **THEN** existieren `env:precheck:studio` und `env:deploy:studio`
- **AND** beide delegieren an dieselbe gemeinsame `runtime-env`-Implementierung

#### Scenario: Schemaaenderung erfordert Wartungsfenster

- **WHEN** `env:deploy:studio` mit `--release-mode=schema-and-app` ausgefuehrt wird
- **THEN** verlangt das System ein dokumentiertes Wartungsfenster
- **AND** startet ohne dieses Wartungsfenster keinen Rollout

### Requirement: Standardisierte Deploy-Evidenz fuer Acceptance

Das System SHALL fuer jeden orchestrierten Studio-Deploy maschinenlesbare und menschenlesbare Evidenz erzeugen.

#### Scenario: Deploy schreibt Evidenz-Artefakte

- **WHEN** `env:deploy:studio` ausgefuehrt wird
- **THEN** schreibt das System JSON- und Markdown-Artefakte unter `artifacts/runtime/deployments/`
- **AND** die Artefakte enthalten mindestens Image-Referenz, Actor, Workflow, Release-Modus, Schrittstatus und Stack-Zusammenfassung
- **AND** die Artefakte enthalten keine Secrets oder PII

#### Scenario: Migrations-Evidenz enthaelt Goose-Status

- **WHEN** ein Studio-Deploy mit oder ohne Migrationsschritt dokumentiert wird
- **THEN** enthalten die Artefakte den `goose`-Status der Migration
- **AND** die Migrationsevidenz kann die verwendete `goose`-Version ausweisen

### Requirement: Direkte Acceptance-`up`/`update`-Deploys sind gesperrt

Das System SHALL direkte Serverdeploys fuer `studio` ueber die Kommandos `up` und `update` standardmaessig verhindern.

#### Scenario: Legacy-Deploypfad wird blockiert

- **WHEN** `runtime-env.ts up studio` oder `runtime-env.ts update studio` ausgefuehrt wird
- **THEN** beendet das System den Lauf mit einer klaren Fehlermeldung
- **AND** verweist auf den orchestrierten Studio-Releasepfad als einzigen kanonischen Einstiegspunkt

### Requirement: Einheitliche Runtime-Profile fuer Entwicklungs- und Betriebsmodi

Das System SHALL drei kanonische Runtime-Profile (`local-keycloak`, `local-builder`, `studio`) bereitstellen und deren nicht-sensitive Konfiguration versioniert im Repository fuehren.

#### Scenario: Profildefinitionen sind versioniert

- **WHEN** das Repository geprueft wird
- **THEN** existieren versionierte Runtime-Profile fuer `local-keycloak`, `local-builder` und `studio`
