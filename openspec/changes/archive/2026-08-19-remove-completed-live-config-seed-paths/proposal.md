# Change: Abgeschlossene Live-Config-Seed-Pfade entfernen

## Why

Die einmaligen H4-/H5-Übergänge haben ihre Aufgabe erfüllt. Ihre weiterhin erreichbaren Dispatch-Eingaben und bedingten Workflowzweige vergrößern den operativen Zustandsraum, obwohl Staging und Production inzwischen eine gültige Config-Revision besitzen.

## What Changes

- Die H4-/H5-Eingaben und alle aktiven Prepare-, Authorize-, Recheck- und Seed-Deploy-Zweige werden aus `Promote` entfernt.
- Standard- und Recovery-Promotes verwenden wieder denselben linearen Phasen- und Gategraphen.
- Evidence-Schema v2 bleibt kompatibel; `seedPreparation` und `seedAuthorization` werden bei neuen Promotes explizit als `null` geschrieben.
- Die bisherige Seed-Implementierung und die Controller-Kopierliste bleiben in dieser ersten Stufe erhalten, sind aber vom Workflow aus nicht mehr erreichbar.
- Die kanonische Rollout-Anleitung beschreibt H4/H5 nicht mehr als bedienbaren Pfad. Eine fehlende oder ungültige Live-Config-Revision stoppt weiterhin vor Mutation und verlangt einen neuen geprüften Recovery-Change.

## Impact

- Affected specs: `deployment-topology`
- Affected code: `.github/workflows/promote.yml`, `scripts/ci/promote-workflow-contract.test.ts`, Promote-Evidence-Vertrag
- Affected docs: `docs/guides/studio-rollout-process.md`, `docs/architecture/07-deployment-view.md`, `docs/architecture/08-cross-cutting-concepts.md`
- Affected arc42 sections: 07 Deployment View, 08 Cross-Cutting Concepts
