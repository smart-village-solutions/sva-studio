# Change: Bot-Kommentar-Sondergate entfernen

## Why

Der nicht verpflichtende Workflow ist technisch ungültig und verlangt proprietäre Marker zusätzlich zum nativen GitHub-Review-Status. Der reguläre Review-Prozess mit fachlicher Prüfung und aufgelösten Threads bleibt die maßgebliche Merge-Governance.

## What Changes

- Das separate Bot-Kommentar-Gate und seine maschinenlesbaren Abschlussmarker entfallen.
- Bot-Kommentare werden wie andere Review-Hinweise fachlich geprüft und über native GitHub-Threads abgeschlossen.
- Workflow, Prüfscript, Tests und aktive Dokumentationsverweise werden entfernt.

## Impact

- Affected specs: `review-governance`
- Affected code: `.github/workflows/`, `scripts/ci/`, `package.json`, `tooling/quality/`
- Affected arc42 sections: `docs/architecture/08-cross-cutting-concepts.md`, `docs/architecture/10-quality-requirements.md`
