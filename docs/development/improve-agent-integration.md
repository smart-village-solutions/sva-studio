# Improve-Integration für Agenten

## Ziel

Diese Repository-Integration bindet `shadcn/improve` bewusst parallel zu `fallow` für den lokalen Agenten-Workflow ein. Der Scope dieser ersten Stufe umfasst:

- den im Repo eingecheckten Agent-Skill-Snapshot unter `.agents/skills/improve`
- ein lokales Sync-Skript für reproduzierbare Updates des Snapshots
- eine feste Upstream-Revision, damit Team und Reviews denselben Skill-Stand sehen

Nicht Teil dieser Stufe sind CI-Gates, PR-Checks oder verpflichtende Improve-Läufe.

## Bausteine

### Agent-Skill-Snapshot

Der aktive Repo-Skill liegt unter `.agents/skills/improve`.

Die Dateien stammen aus dem GitHub-Repository:

```text
https://github.com/shadcn/improve
```

Konkret wird aktuell die feste Commit-Revision `03369ee6d7cafbfcecc4346539b05b3dc0a603bb` synchronisiert. Zusätzlich schreibt das Sync-Skript eine `.upstream.json` mit Repository-URL, Quellpfad und Revision. Damit bleibt nachvollziehbar, aus welchem Upstream-Stand der Snapshot erzeugt wurde.

### Sync-Skript

Der Workspace stellt dafür das Root-Skript `pnpm improve:sync-skills` bereit.

Das Skript:

- klont `shadcn/improve` temporär lokal
- checkt die gepinnte Revision aus
- kopiert `skills/improve` nach `.agents/skills/improve`
- entfernt veraltete Dateien aus älteren Snapshots
- schreibt die Metadatei `.upstream.json`

## Skill-Snapshot aktualisieren

Wenn der Snapshot auf einen neueren Upstream-Stand gehoben werden soll, zuerst die gewünschte Commit-Revision in `scripts/ops/sync-improve-skills.ts` aktualisieren und danach synchronisieren:

```bash
pnpm improve:sync-skills
```

Nach einem Skill-Update den Agenten bzw. Codex neu starten, damit der neue Snapshot sicher geladen wird.

## Team-Workflow

Empfohlener Ablauf:

1. `pnpm improve:sync-skills`, wenn der Snapshot erstmalig eingezogen oder aktualisiert werden soll
2. Snapshot und `.upstream.json` im Review mitprüfen
3. Codex neu starten

Der Snapshot ist bewusst im Repo eingecheckt, damit das Team denselben Skill-Stand reviewen und reproduzierbar parallel zu `fallow` verwenden kann.

## Quellen

- Upstream-Repository: <https://github.com/shadcn/improve>
- Referenz-Skill: <https://github.com/shadcn/improve/tree/main/skills/improve>
