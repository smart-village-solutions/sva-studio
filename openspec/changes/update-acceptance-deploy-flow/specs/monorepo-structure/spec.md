## ADDED Requirements

### Requirement: Kanonischer Acceptance-Deploypfad

Das System SHALL für das Runtime-Profil `acceptance-hb` einen offiziellen Deploypfad mit `precheck` und `deploy` bereitstellen, der Migration, Rollout und Verifikation in fixer Reihenfolge ausführt.

#### Scenario: Root-Scripts bilden den Acceptance-Releasepfad ab

- **WHEN** `package.json` im Repository geprüft wird
- **THEN** existieren `env:precheck:acceptance-hb` und `env:deploy:acceptance-hb`
- **AND** beide delegieren an dieselbe gemeinsame `runtime-env`-Implementierung

#### Scenario: Schemaänderung erfordert Wartungsfenster

- **WHEN** `env:deploy:acceptance-hb` mit `--release-mode=schema-and-app` ausgeführt wird
- **THEN** verlangt das System ein dokumentiertes Wartungsfenster
- **AND** startet ohne dieses Wartungsfenster keinen Rollout

### Requirement: Standardisierte Deploy-Evidenz für Acceptance

Das System SHALL für jeden orchestrierten Acceptance-Deploy maschinenlesbare und menschenlesbare Evidenz erzeugen.

#### Scenario: Deploy schreibt Evidenz-Artefakte

- **WHEN** `env:deploy:acceptance-hb` ausgeführt wird
- **THEN** schreibt das System JSON- und Markdown-Artefakte unter `artifacts/runtime/deployments/`
- **AND** die Artefakte enthalten mindestens Image-Referenz, Actor, Workflow, Release-Modus, Schrittstatus und Stack-Zusammenfassung
- **AND** die Artefakte enthalten keine Secrets oder PII

### Requirement: Direkte Acceptance-`up`/`update`-Deploys sind gesperrt

Das System SHALL direkte Serverdeploys für `acceptance-hb` über die Kommandos `up` und `update` standardmäßig verhindern.

#### Scenario: Legacy-Deploypfad wird blockiert

- **WHEN** `runtime-env.ts up acceptance-hb` oder `runtime-env.ts update acceptance-hb` ausgeführt wird
- **THEN** beendet das System den Lauf mit einer klaren Fehlermeldung
- **AND** verweist auf `env:deploy:acceptance-hb` als einzigen kanonischen Einstiegspunkt
