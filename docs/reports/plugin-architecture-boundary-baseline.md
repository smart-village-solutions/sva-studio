# Plugin-Architecture-Boundary-Baseline

## Zweck

Dieser Report dokumentiert nur noch die Brownfield-Historie des ersten Boundary-Guard-Rollouts. Die fuehrende maschinenlesbare Quelle fuer bewusst tolerierte Altfaelle ist `config/plugin-architecture-allowlist.json`.

## Guard-Status im Rollout

- `pnpm check:plugin-architecture-boundary` laeuft im ersten Rollout warn-only.
- Der Scope bleibt auf `packages/plugin-*` begrenzt.
- Geprueft werden direkte, relative, Runtime-, Type- und Re-Export-Kanten.
- `@sva/plugin-sdk` und `@sva/studio-ui-react` sind die einzigen erlaubten internen Plugin-Einstiegspunkte.

## Historischer Altbestand

- `@sva/plugin-waste-management` ist derzeit der bekannte Brownfield-Fall.
- Die tolerierten Eintraege liegen jetzt fuehrend in `config/plugin-architecture-allowlist.json` und decken nur die bereits vorhandene Kopplung an `@sva/core`, `@sva/studio-module-iam` und die review-pflichtigen Runtime-Signale des bestehenden Dateibaums ab.
- Jeder Eintrag ist dateischarf ueber `relativePath`; dieselbe Regel mit demselben `subject` in einer neuen Datei bleibt deshalb eine neue Drift.
- Folgechange fuer den Ownership-Schlupfloch-Abbau: `refactor-studio-module-iam-public-contract`

## Review-Regeln

- Jede Aenderung an diesem Report ist weiter ein Architekturereignis und braucht Review durch `Architecture`, `Documentation` und `Code Quality`.
- Neue oder geaenderte Altfaelle werden nicht mehr in diesem Dokument gepflegt, sondern in `config/plugin-architecture-allowlist.json`.
- Das Entfernen historischer Hinweise aus diesem Report ist jederzeit erlaubt und erwuenscht, wenn der zugrunde liegende Verstoss beseitigt wurde oder die Historie an anderer Stelle ausreichend belegt ist.
