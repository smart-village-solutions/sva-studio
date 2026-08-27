# Change: Katalog-Driftcheck vom Studio-Build entkoppeln

## Why

Ein nicht reproduzierbarer Anwenderdokumentationskatalog blockiert derzeit transitiv den Studio-App-Build und damit den regulären Deploymentpfad. Die Abweichung soll sichtbar bleiben, darf aber die Auslieferung der fachlichen Anwendung nicht stoppen.

## What Changes

- `check:documentation-catalog` wird aus den Abhängigkeiten von `sva-studio-react:build` entfernt.
- Repository Hygiene führt den Driftcheck weiterhin als sichtbare, nicht blockierende Diagnose aus.
- Der eingecheckte `page-catalog.json` bleibt ein Build-Input und wird weiterhin vom Studio konsumiert.
- Dokumentation und Vertrag stellen klar, dass Katalogdrift im separaten Dokumentationsflow behoben wird.

## Impact

- Affected specs: `contextual-user-documentation`
- Affected code: `apps/sva-studio-react/project.json`, `.github/workflows/repository-hygiene.yml`, CI-Vertragstests
- Affected arc42 sections: `docs/architecture/07-deployment-view.md`
