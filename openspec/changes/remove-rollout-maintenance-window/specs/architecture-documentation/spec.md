## MODIFIED Requirements

### Requirement: Architektur dokumentiert GitHub Actions als kanonischen Studio-Promote-Pfad

Die Architektur- und Betriebsdokumentation SHALL GitHub Actions `Build` und `Promote` als einzigen kanonischen Rolloutpfad von Dev über Staging nach Production und lokale Operatorpfade ausschließlich als Diagnose-/Recovery-Werkzeuge beschreiben.

#### Scenario: Staging- und Production-Grenzen sind nachvollziehbar

- **WHEN** ein Teammitglied den Studio-Rollout nachschlägt
- **THEN** beschreiben `07-deployment-view`, der kanonische Rollout-Leitfaden und das Swarm-Runbook die Reihenfolge Build, Dev, Staging und Production mit demselben Digest
- **AND** beschreiben sie bei Staging- und Production-One-shots die Reihenfolge Preflight, Backup, Migration, optional Bootstrap, Postconditions, App-Deploy und Verifikation
- **AND** beschreibt `08-cross-cutting-concepts` Environment-Freigabe, Geheimnisredaktion und Artefaktbindung als wirksame Sicherheitsbarrieren ohne Wartungsfenster-Pflichtfeld
- **AND** dokumentieren sie Production-`run` nur nach erfolgreicher mutierender Staging-Parität desselben Digests, Production-Freigabe und verifiziertem Backup

#### Scenario: Rollout-Evidenz und Recovery sind dokumentiert

- **WHEN** ein Staging- oder Production-Promote fehlschlägt oder eine Verifikation verletzt
- **THEN** beschreibt die Betriebsdokumentation die redigierten Evidenzartefakte, den vorherigen App-Digest, das Cleanup-Verhalten und den lokalen Recovery-Pfad
- **AND** grenzt sie automatisches Datenbank-Rollback ausdrücklich aus
