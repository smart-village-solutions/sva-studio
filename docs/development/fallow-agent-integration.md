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

## Lokaler Export-Loop auf dem Z640

`scripts/ops/fallow-local-llm-loop.ts` verarbeitet Fallow-Befunde ohne Einzel-Issues. Die erste Aufgabenart umfasst ausschließlich Gruppen von zwei bis sechs ungenutzten Exports in derselben App-Datei unter `src/lib` oder `src/components/ui`; sensible Auth-, IAM-, Plugin-, Server- und Vertragsbereiche sind ausgeschlossen. Der Controller erzeugt höchstens zwei Draft-PRs pro Lauf und führt keinen Merge aus. Einzelbefunde bleiben liegen, bis ein sinnvoller gemeinsamer Scope vorliegt.

Voraussetzungen auf dem Z640: ein Clone dieses Repositories, `pnpm install --frozen-lockfile`, ein laufender lokaler `llama-server` mit OpenAI-kompatiblem Endpoint unter `http://127.0.0.1:8080/v1/chat/completions`, sowie ein dort installiertes `gh`. Mac-Zugangsdaten gehören nicht auf den Server. Für `gh` wird einmalig ein auf `smart-village-solutions/sva-studio` begrenzter Fine-grained GitHub-Token eingerichtet. Er braucht Schreibrechte für Contents, Pull requests und Issues (PR-Label); Metadaten-Lesen ist automatisch enthalten. Eine separate Checks-Berechtigung ist im Fine-grained-Token-Dialog nicht auswählbar. Vor dem Lauf muss `gh pr checks` mit diesem Token für einen bestehenden PR funktionieren. Der Token liegt ausschließlich auf dem Z640 in `~/.config/sva-fallow-loop/github.env` (Modus 0600), nicht im Repository. Das Label `local-llm` muss im Repository existieren. Der vorhandene `sva-llama-server.service` startet das Modell nach einem Reboot.

Die Token-Einrichtung erfolgt in einer interaktiven SSH-Sitzung, ohne den Wert in Chat, Shell-History oder Logs zu kopieren:

```bash
install -d -m 700 ~/.config/sva-fallow-loop
read -rs 'token?GitHub-Token: '
printf 'GH_TOKEN=%s\n' "$token" > ~/.config/sva-fallow-loop/github.env
chmod 600 ~/.config/sva-fallow-loop/github.env
GH_TOKEN="$token" gh auth setup-git
unset token
```

In Bash statt zsh lautet die `read`-Zeile `read -r -s -p 'GitHub-Token: ' token; echo`. Für einen manuellen Probelauf wird die Umgebungsdatei in die aktuelle Shell geladen: `set -a; . ~/.config/sva-fallow-loop/github.env; set +a`. Der `systemd`-Dienst liest sie selbst.

Im Clone zuerst Kandidaten ohne Modell- oder GitHub-Mutation prüfen:

```bash
pnpm exec tsx scripts/ops/fallow-local-llm-loop.ts --dry-run
```

Danach einen begrenzten Lauf starten:

```bash
pnpm exec tsx scripts/ops/fallow-local-llm-loop.ts
```

Der Lauf aktualisiert `origin/main`, scannt einen sauberen Worktree, überspringt Dateien offener PRs und bisherige Ergebnisse desselben Basis-SHA. Nach einem Reboot wartet er bis zu fünf Minuten auf einen gesunden `llama-server`, bevor er ein Bündel beginnt. Die Modellantwort wird auf die exakte Entfernung des `export`-Schlüsselworts oder eines einzelnen Eintrags aus einem benannten Exportblock begrenzt. Vor einem Push müssen Fallow, Diff-Prüfung, Projekt-Unit- und Type-Targets sowie `check:file-placement` bestehen. Nach dem Draft-PR ergänzt der Controller dessen Changelog-Eintrag und wartet auf den CI-Gates-Workflow und die PR-Checks am finalen HEAD. Bei roter CI endet der Lauf. Ergebnisse und Arbeits-Worktrees liegen unter `~/.local/state/sva-fallow-loop`; `SVA_FALLOW_STATE_DIR` kann diesen Ort ändern. Fehlgeschlagene Worktrees bleiben für die Diagnose erhalten. Nur saubere, nachweislich integrierte Worktrees werden manuell entfernt.

Nach einem erfolgreichen Testlauf startet der versionierte `systemd --user`-Timer den Befehl täglich um 22 Uhr; `Persistent=true` holt einen verpassten Start nach dem Reboot nach. Die Units unter `scripts/ops/systemd/` erwarten den Arbeits-Worktree in `~/sva-studio-worktrees/local-fallow-review-loop`. Zur Installation auf dem Z640:

```bash
mkdir -p ~/.config/systemd/user
ln -sfn ~/sva-studio-worktrees/local-fallow-review-loop/scripts/ops/systemd/sva-fallow-loop.service ~/.config/systemd/user/sva-fallow-loop.service
ln -sfn ~/sva-studio-worktrees/local-fallow-review-loop/scripts/ops/systemd/sva-fallow-loop.timer ~/.config/systemd/user/sva-fallow-loop.timer
systemctl --user daemon-reload
systemctl --user enable --now sva-fallow-loop.timer
systemctl --user list-timers sva-fallow-loop.timer
```

Der Dienst beendet sich nach höchstens acht Stunden; der Controller sperrt parallele Läufe selbst. Der Timer wird erst aktiviert, wenn GitHub-Authentifizierung, ein echter Draft-PR und dessen finale Checks auf dem Z640 nachgewiesen wurden. `systemctl --user stop sva-fallow-loop.timer` stoppt künftige Starts; `journalctl --user -u sva-fallow-loop.service` zeigt Laufmeldungen. Jeder Draft-PR benötigt weiterhin eine manuelle fachliche Prüfung.

## Quellen

- Fallow-Dokumentation: <https://docs.fallow.tools/>
- Agent-Integration: <https://docs.fallow.tools/integrations/mcp>
- Agent Skills: <https://docs.fallow.tools/integrations/agent-skills>
