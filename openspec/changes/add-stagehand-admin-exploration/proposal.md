# Change: Stagehand-gestützte lokale Admin-Explorationstests hinzufügen

## Why

Die bestehende Testlandschaft deckt deterministische App-Smokes und reproduzierbare IAM-Acceptance-Läufe ab, bietet aber keine eigene explorative Testschicht für reale lokale IAM-Flows über den gesamten Story-Katalog. Für Rollen-, Rechte-, Benutzer-, Mandanten-, Consent- und Audit-Themen soll eine agentische Browser-Automation ergänzt werden, die echte IAM-/Backend-Pfade lokal erkundet, ihre Ergebnisse als reviewbares Overlay neben dem kanonischen User-Story-Katalog ablegt und trotzdem die bestehenden Qualitätsgates nicht destabilisiert.

## What Changes

- Einführung einer neuen Stagehand-basierten Explorationsschicht für lokale IAM-Story-Loops in `apps/sva-studio-react`
- Bereitstellung eines eigenen Nx-Targets für nicht CI-blockende Stagehand-Explorationsläufe
- Definition eines lokalen Env-Kontrakts für Ziel-URL, Admin-Credentials und LLM-Zugang
- Einführung eines Story-Cluster-Modells für die Verarbeitung des vollständigen IAM-User-Story-Katalogs
- Result-Overlay für `concepts/konzeption-cms-v2/02_Anforderungen/user-stories.json` statt direkter Fortschreibung im Lauf
- Erzeugung strukturierter Artefakte wie Aggregatstatus, Story-Bericht, Screenshots und Transcript
- Dokumentation der Abgrenzung zu `test:e2e` und `test:acceptance`

## Impact

- Affected specs:
  - `exploratory-admin-testing` (neu)
  - `app-e2e-integration-testing` (inhaltliche Abgrenzung in Doku, keine Gate-Änderung)
- Affected code:
  - `apps/sva-studio-react/project.json`
  - `apps/sva-studio-react/package.json`
  - `apps/sva-studio-react/stagehand/**`
  - `scripts/ci/**` oder wiederverwendbare lokale Runtime-Helfer
  - `docs/development/**`
  - `docs/architecture/**`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
