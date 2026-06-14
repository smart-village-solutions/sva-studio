# Plugin-Architecture-Boundary-Baseline

## Zweck

Dieser Report dokumentiert nur noch die Brownfield-Historie des ersten Boundary-Guard-Rollouts. Die fuehrende maschinenlesbare Quelle fuer importkantenbezogene Guard-Ausnahmen ist `config/plugin-architecture-allowlist.json`; die primaeren Governance-Regeln stehen in `docs/guides/plugin-development.md`, `docs/architecture/package-zielarchitektur.md` und `docs/development/review-agent-governance.md`.

## Historischer Altbestand

- `@sva/plugin-waste-management` war zum Start des ersten Guard-Rollouts der bekannte Brownfield-Fall.
- Die heutige Allowlist deckt nur importkantenbezogene Ausnahmen ab; fruehere Baseline-Klassen wie Workspace-Dependencies oder Dateipfad-Signale werden hier nicht vollstaendig eins zu eins nachmodelliert.
- Die frueher tolerierte Importkante nach `@sva/studio-module-iam` war zeitweise in `config/plugin-architecture-allowlist.json` gepflegt, ist nach der Runtime-Extraktion fuer Waste Management aber nicht mehr aktiv.
- Folgechange fuer den Ownership-Schlupfloch-Abbau: `refactor-studio-module-iam-public-contract`

## Historische Warn-Baseline fuer `@sva/plugin-waste-management`

Stand dieser Baseline beim Einfrieren der Ausgangslage fuer den Refactor:

- 2 Workspace-Dependencies in `packages/plugin-waste-management/package.json`: `@sva/core`, `@sva/studio-module-iam`
- 1 Runtime-Signal-Datei: `packages/plugin-waste-management/src/server.ts`
- 1 Metadaten-/Definitionsdatei mit ungeeignetem Namen: `packages/plugin-waste-management/src/plugin-operations.ts`
- 15 Browser-Signal-Dateien:
  - `*.controller.*`: `waste-management.master-data.controller.ts`, `waste-management.scheduling.controller.ts`, `waste-management.tools.controller.ts`, `waste-management.tours.controller.ts`
  - `*.loaders.*`: `waste-management.master-data.loaders.ts`, `waste-management.scheduling.loaders.ts`, `waste-management.tours.loaders.parts.ts`, `waste-management.tours.loaders.ts`
  - `*.state.*`: `waste-management.master-data.state.ts`, `waste-management.scheduling.state.ts`, `waste-management.tools.state.ts`, `waste-management.tours.state.ts`
  - `*.submissions.*`: `waste-management.master-data.submissions.ts`, `waste-management.scheduling.submissions.ts`, `waste-management.tours.submissions.ts`

Diese 19 Warnungen waren zum damaligen Startpunkt bewusst nur dokumentierte Brownfield-Signale. Task 1 des Boundary-Refactors zog hier noch keine Guard- oder Allowlist-Logik nach, sondern fror nur die Ausgangslage fuer die folgenden Entkopplungsschritte ein.

## Aktueller Waste-Management-Stand

- `@sva/plugin-waste-management` ist nach Tasks 2-6 auf den browserseitigen Plugin-Schnitt reduziert.
- `@sva/waste-management-runtime` traegt die host-owned Waste-Job-Runtime ausserhalb des Plugin-Packages.
- Fuer `packages/plugin-waste-management` besteht aktuell kein aktiver Allowlist-Eintrag mehr.
- Dieser Report bleibt damit reine Brownfield-Historie; die aktuelle Guard-Wahrheit liegt in `config/plugin-architecture-allowlist.json` und den laufenden Check-Ergebnissen.

## Review-Regeln

- Jede Aenderung an diesem Report ist weiter ein Architekturereignis und braucht Review durch `Architecture`, `Documentation` und `Code Quality`.
- Neue oder geaenderte Altfaelle werden nicht mehr in diesem Dokument gepflegt, sondern in `config/plugin-architecture-allowlist.json`.
- Das Entfernen historischer Hinweise aus diesem Report ist jederzeit erlaubt und erwuenscht, wenn der zugrunde liegende Verstoss beseitigt wurde oder die Historie an anderer Stelle ausreichend belegt ist.
