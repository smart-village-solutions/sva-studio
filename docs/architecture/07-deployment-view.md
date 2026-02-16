# 07 Verteilungssicht

## Zweck

Dieser Abschnitt beschreibt die technische Verteilung auf Umgebungen und
Laufzeitknoten auf Basis des aktuellen Repos.

## Mindestinhalte

- Deployment-Topologie (lokal, CI, staging, production)
- Abhängigkeiten zu externen Diensten
- Sicherheits- und Betriebsaspekte je Umgebung

## Aktueller Stand

### Lokale Entwicklungsverteilung

- App: `pnpm nx run sva-studio-react:serve` auf `localhost:3000`
- Workspace-Pakete werden über `workspace:*` aufgelöst
- Es gibt aktuell keine verbindlichen Compose-Manifeste für Runtime-Services in diesem Branch

### CI-Verteilung

- Pull Requests: Coverage und Integration laufen über GitHub Actions
- Coverage auf PRs wird mit `nx affected` gegen den Base-Branch berechnet
- Main/Schedule fuehren die komplette Coverage-Suite aus

### Deployment-Bausteine (logisch)

- Web-App Runtime (TanStack Start / Node)
- Nx-/pnpm-basierte Build- und Test-Pipeline
- Externe Plattform (GitHub Actions) für CI-Ausführung

### Noch offen (Stand heute)

- Produktions-Topologie (z. B. K8s vs. VM) ist nicht repo-verbindlich dokumentiert
- Betriebsdokumentation für produktive Infrastruktur ist als Folgeschritt vorgesehen

Referenzen:

- `.github/workflows/test-coverage.yml`
- `apps/sva-studio-react/package.json`
- `pnpm-workspace.yaml`
- `nx.json`
