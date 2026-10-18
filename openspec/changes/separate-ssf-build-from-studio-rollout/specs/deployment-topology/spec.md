## ADDED Requirements

### Requirement: SSF-Build ist vom zentralen Studio-Rollout unabhängig

Das System SHALL die SSF-Distribution nur nach manuellem Start eines eigenständigen Builds aus `main` erzeugen und verifizieren. Der zentrale Main-Build und die automatische Studio-Dev-Promotion SHALL weder den SSF-Build ausführen noch von dessen Status abhängen.

#### Scenario: Main-Push veröffentlicht Studio unabhängig von SSF

- **WHEN** ein Commit nach `main` gepusht wird
- **THEN** baut und verifiziert der zentrale Workflow das Studio-Image und führt die reguläre Dev-Promotion aus
- **AND** startet er keinen SSF-Image-Build
- **AND** wartet die Dev-Promotion auf keinen SSF-Build oder dessen Image-Verifikation

#### Scenario: SSF-Kandidat wird manuell gebaut

- **WHEN** ein Operator den SSF-Build auf `main` startet
- **THEN** bindet der Workflow Quellcommit, SSF-Distribution, OCI-Revision und unveränderlichen Image-Digest
- **AND** ist der Digest erst nach terminal erfolgreicher Image-Verifikation als Kassel-Kandidat zulässig
- **AND** löst er kein Deployment nach Kassel oder in die zentralen Studio-Umgebungen aus

#### Scenario: SSF-Build schlägt fehl

- **WHEN** der manuelle SSF-Build oder seine Image-Verifikation fehlschlägt
- **THEN** liegt kein freigegebener neuer Kassel-Kandidat vor
- **AND** bleibt der zentrale Studio-Rollout davon unabhängig
