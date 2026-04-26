## MODIFIED Requirements

### Requirement: Finaler Runtime-Artefaktvertrag fuer Studio

Das System SHALL fuer `studio` den finalen Node-Output unter `apps/sva-studio-react/.output/server/**` als einzigen technischen Freigabegegenstand vor dem Image-Build behandeln.

#### Scenario: Release-Gate bündelt Runtime- und PR-Prüfungen

- **WHEN** ein Operator oder CI-Pfad eine produktionsnahe Studio-Freigabe vorbereitet
- **THEN** steht ein Script `test:release:studio` zur Verfügung
- **AND** dieses Script führt `test:pr` und anschließend `verify:runtime-artifact` aus

#### Scenario: Lokaler Studio-Precheck dokumentiert Image-Verify-Evidenz

- **WHEN** `env:precheck:studio` mit einem Image-Digest ausgeführt wird
- **THEN** dokumentiert der Precheck den Digest und die passende Studio-Image-Verify-Evidenz, sofern sie im Artefaktverzeichnis vorhanden ist
- **AND** fehlende Evidenz wird als Warnung oder Blocker sichtbar, nicht still ignoriert
