## MODIFIED Requirements

### Requirement: Kanonischer Studio-Rollout-Pfad

Das System SHALL fuer das Runtime-Profil `studio` genau einen offiziellen Rollout-Pfad ueber verifizierte Digests und einen expliziten lokalen Operator-Schritt bereitstellen.

#### Scenario: Studio-Release wird in Vorbereitung und lokalen Final-Deploy getrennt

- **WHEN** ein Operator `studio` ausrollen moechte
- **THEN** liefern GitHub Actions nur `Final Runtime Artifact Verify`, `Studio Image Build` und `Studio Artifact Verify`
- **AND** der finale mutierende Rollout laeuft lokal ueber einen expliziten Operator-Einstieg mit `env:precheck:studio`, `env:deploy:studio`, `env:smoke:studio` und `env:feedback:studio`
- **AND** GitHub-Deployworkflows gelten hoechstens als dokumentierter Legacy-Fallback und nicht mehr als offizieller Standardpfad

#### Scenario: Lokaler Operator-Deploy verwendet einen expliziten Digest

- **WHEN** der lokale `studio`-Release-Einstieg aufgerufen wird
- **THEN** ist `--image-digest=sha256:...` verpflichtend
- **AND** der Einstieg loest keinen Digest still aus GitHub-Runs, Branches oder Tags auf
- **AND** `schema-and-app` erfordert weiterhin ein explizites Wartungsfenster
