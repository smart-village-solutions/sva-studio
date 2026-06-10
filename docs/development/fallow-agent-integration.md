# Fallow-Integration für Agenten

## Ziel

Diese Repository-Integration bindet Fallow bewusst nur für den lokalen Agenten-Workflow ein. Der Scope dieser ersten Stufe umfasst:

- die versionierte Workspace-Installation von `fallow`
- den lokalen Codex-MCP-Server für strukturierte Tool-Aufrufe
- den im Repo eingecheckten Agent-Skill-Snapshot unter `.agents/skills/fallow`

Nicht Teil dieser Stufe sind CI-Gates, PR-Checks oder verpflichtende Fallow-Qualitätsregeln.

## Bausteine

### Root-Dependency

Fallow ist im Root-Workspace als `devDependency` installiert. Damit kommen CLI, MCP-Server und der Skill-Snapshot aus derselben Paketversion.

Prüfen:

```bash
pnpm exec fallow --version
```

### MCP-Integration

Der Codex-MCP-Server ist in `.codex/config.toml` als lokaler Prozess eingetragen:

```toml
[mcp_servers.fallow]
command = "pnpm"
args = [ "exec", "fallow-mcp" ]
```

Dadurch nutzt Codex immer die im Workspace installierte Version statt einer globalen Installation.

Wichtig:

- Nach Änderungen an `.codex/config.toml` Codex neu starten.
- `fallow-mcp` findet `fallow` über `pnpm exec` automatisch im Workspace-Kontext.

### Agent-Skill-Snapshot

Der aktive Repo-Skill liegt unter `.agents/skills/fallow`.

Die Dateien stammen aus dem installierten npm-Paketpfad:

```text
node_modules/fallow/skills/fallow
```

Zusätzlich schreibt das Sync-Skript eine `.upstream.json` mit Paketname, Version und Quellpfad. Damit bleibt nachvollziehbar, aus welcher Fallow-Version der Snapshot erzeugt wurde.

## Skill-Snapshot aktualisieren

Wenn die Fallow-Version im Root-Workspace geändert wird, muss der Repo-Skill-Snapshot neu erzeugt werden:

```bash
pnpm install
pnpm fallow:sync-skills
```

Das Skript:

- liest den gebündelten Skill aus `node_modules/fallow/skills/fallow`
- ersetzt den Zielordner `.agents/skills/fallow` vollständig
- entfernt veraltete Dateien aus älteren Snapshots
- schreibt die Metadatei `.upstream.json`

Nach einem Skill-Update den Agenten bzw. Codex neu starten, damit der neue Snapshot sicher geladen wird.

## Team-Workflow

Empfohlener Ablauf:

1. `pnpm install`
2. `pnpm exec fallow --version`
3. `pnpm fallow:sync-skills`, falls der Snapshot nach einer Versionsänderung aktualisiert werden soll
4. Codex neu starten

Der Snapshot ist bewusst im Repo eingecheckt, damit das Team denselben Skill-Stand reviewen und reproduzierbar verwenden kann.

## Quellen

- Fallow-Dokumentation: <https://docs.fallow.tools/>
- Agent-Integration: <https://docs.fallow.tools/integrations/mcp>
- Agent Skills: <https://docs.fallow.tools/integrations/agent-skills>
