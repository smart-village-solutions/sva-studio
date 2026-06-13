# Plugin-Architecture-Boundary-Baseline

## Zweck

Dieser Report dokumentiert nur noch die Brownfield-Historie des ersten Boundary-Guard-Rollouts. Die fuehrende maschinenlesbare Quelle fuer importkantenbezogene Guard-Ausnahmen ist `config/plugin-architecture-allowlist.json`; die primaeren Governance-Regeln stehen in `docs/guides/plugin-development.md`, `docs/architecture/package-zielarchitektur.md` und `docs/development/review-agent-governance.md`.

## Historischer Altbestand

- `@sva/plugin-waste-management` ist derzeit der bekannte Brownfield-Fall.
- Die heutige Allowlist deckt nur importkantenbezogene Ausnahmen ab; fruehere Baseline-Klassen wie Workspace-Dependencies oder Dateipfad-Signale werden hier nicht vollstaendig eins zu eins nachmodelliert.
- Fuer den aktuellen Brownfield-Bestand ist die tolerierte Importkante nach `@sva/studio-module-iam` in `config/plugin-architecture-allowlist.json` gepflegt.
- Folgechange fuer den Ownership-Schlupfloch-Abbau: `refactor-studio-module-iam-public-contract`

## Review-Regeln

- Jede Aenderung an diesem Report ist weiter ein Architekturereignis und braucht Review durch `Architecture`, `Documentation` und `Code Quality`.
- Neue oder geaenderte Altfaelle werden nicht mehr in diesem Dokument gepflegt, sondern in `config/plugin-architecture-allowlist.json`.
- Das Entfernen historischer Hinweise aus diesem Report ist jederzeit erlaubt und erwuenscht, wenn der zugrunde liegende Verstoss beseitigt wurde oder die Historie an anderer Stelle ausreichend belegt ist.
