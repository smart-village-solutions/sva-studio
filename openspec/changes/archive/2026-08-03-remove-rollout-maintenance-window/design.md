## Context

Ein Wartungsfenster-Verweis ist derzeit ein Pflichtfeld für mutierende Promotes und wird vom Production-Backup-Submitter sogar bei reinen App-Deployments verlangt. Das Feld bewirkt keine zeitliche Sperre und keine zusätzliche Autorisierung. Dadurch ist es eine formale, aber keine wirksame Sicherheitsbarriere.

## Goals / Non-Goals

- Goals: Wartungsfenster vollständig aus dem Promote- und Backup-Auftragsvertrag entfernen; bestehende wirksame Rollout-Gates unverändert erhalten; Dokumentation und Tests konsistent machen.
- Non-Goals: Restore-Aufträge ändern; Backup-Pflicht lockern; Production-Freigabe, Staging-Parität oder Postconditions verändern.

## Decisions

- Decision: `maintenance_window` wird nicht durch ein anderes Pflichtfeld ersetzt.
- Decision: Die revisionsfähige Nachvollziehbarkeit erfolgt weiterhin über Workflow-Run-ID, Commit, Ziel-Digest, Environment-Freigabe und Evidenzartefakte.
- Decision: Der Backup-Request enthält keinen Wartungsfenster-Verweis mehr; Agent und Submitter akzeptieren den entsprechend verkleinerten allowlisteten Vertrag.
- Alternatives considered: Einen generischen Change-/Ticket-Verweis einzuführen würde dieselbe nicht wirksame Pflicht unter anderem Namen erhalten und wird deshalb verworfen.

## Risks / Trade-offs

- Ein eigenständiger organisatorischer Hinweis entfällt. Die technische Audit-Kette bleibt über GitHub-Run, Commit, Digest, Backup-Ergebnis und Environment-Approval vollständig nachvollziehbar.
- Restore bleibt absichtlich unberührt, da dort ein separater, ausdrücklich autorisierter Recovery-Vertrag gilt.

## Migration Plan

Der Backup-Agent wird zuerst mit einem abwärtskompatiblen Vertrag ausgerollt: Er akzeptiert weiterhin alte Version-1-Aufträge und zusätzlich neue Version-2-Aufträge ohne Wartungsfenster-Verweis. Danach wechseln Submitter und Workflows auf Version 2. Alte Backup-Ergebnisobjekte mit Wartungsfenster-Verweis bleiben lesbar; neue Requests erzeugen das Feld nicht mehr.
