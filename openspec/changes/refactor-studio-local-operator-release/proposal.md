# Change: Studio-Release in Build/Verify und lokalen Operator-Deploy schneiden

## Why

Der Build- und Verify-Pfad fuer `studio` ist inzwischen reproduzierbar in GitHub Actions, der mutierende Deploy-Schritt auf einem lokalen self-hosted Runner bleibt aber zu stark von Host-Zustand, Docker Desktop und macOS-Credentials abhaengig. Dadurch entstehen Betriebsfehler, die nichts mit dem eigentlichen Release-Artefakt zu tun haben.

## What Changes

- GitHub Actions bleiben fuer `studio` der kanonische Pfad fuer finalen Runtime-Artifact-Verify, Image-Build und Image-Verify.
- Der finale `studio`-Deploy wechselt auf einen expliziten lokalen Operator-Einstieg mit verifiziertem Digest als Pflichtparameter.
- `studio-release.yml` wird zu einem nicht-mutierenden Vorbereitungsworkflow reduziert.
- `studio-deploy.yml` bleibt hoechstens als Legacy-/Fallback-Pfad erhalten und ist nicht mehr Teil des offiziellen Zielbilds.
- Die zentrale Dokumentation beschreibt `Build once -> Verify in GitHub -> Deploy locally by verified digest` als neuen Standardpfad.

## Impact

- Affected specs: `deployment-topology`, `monorepo-structure`
- Affected code: `.github/workflows/studio-release.yml`, `.github/workflows/studio-deploy.yml`, `scripts/ops/studio-release-local.ts`, `scripts/ops/runtime-env.shared.ts`, `package.json`
- Affected arc42 sections: `06-runtime-view`, `07-deployment-view`, `08-cross-cutting-concepts`, `10-quality-requirements`
