## Context

Der Seitenkatalog ist ein eingecheckter Cross-Repository-Vertrag für die unabhängig veröffentlichte Anwenderdokumentation. Sein Driftcheck hängt aktuell am Studio-App-Build. Dadurch verhindert redaktionelle oder generatorbedingte Katalogdrift auch Image-Build und Promotion, obwohl das Studio den zuletzt eingecheckten Katalog weiterhin korrekt konsumieren kann.

## Goals / Non-Goals

- Goals:
  - Katalogdrift in GitHub sichtbar halten.
  - App-Build und Deployment von dieser Diagnose entkoppeln.
  - Den eingecheckten Katalog weiterhin als Build-Input behandeln.
- Non-Goals:
  - Den Kataloggenerator oder den Cross-Repository-Sync reparieren.
  - Den Driftcheck entfernen oder dessen Validierungsregeln abschwächen.
  - Einen alternativen Deploymentpfad einführen.

## Decisions

### Der Driftcheck läuft advisory in Repository Hygiene

`check:documentation-catalog` wird aus `sva-studio-react:build.dependsOn` entfernt. Repository Hygiene führt das bestehende Nx-Target in einem eigenen Job aus. Der Prüf-Schritt verwendet `continue-on-error: true`; sein tatsächliches Ergebnis wird anschließend als Annotation und Step-Summary veröffentlicht. Damit bleibt Drift sichtbar, während Workflow, Merge und Deployment nicht von diesem Ergebnis abhängen.

`docs/user-documentation/page-catalog.json` bleibt expliziter Input des App-Builds. Die Änderung entkoppelt nur die Reproduzierbarkeitsprüfung, nicht das konsumierte Runtime-Artefakt.

## Risks / Trade-offs

- Katalogdrift kann länger bestehen bleiben. Die sichtbare Annotation und Summary weisen deshalb auf den Regenerierungsbefehl hin.
- Ein grüner Repository-Hygiene-Workflow bedeutet künftig nicht, dass der Advisory-Schritt erfolgreich war. Der Jobname und die Summary kennzeichnen diese Semantik ausdrücklich.
