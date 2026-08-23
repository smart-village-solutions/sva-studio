# Change: IAM-Content-List-Projektion modularisieren

## Why

Die hostseitige Inhaltsprojektion bündelt Datenbankzugriff, Mainserver-Reads,
Scope- und Autorisierungsentscheidungen, Refresh-Orchestrierung und
Mutationsfolgen in einer einzelnen, häufig geänderten Serverdatei. Fallow und
Sonar weisen mehrere kritische Komplexitätsbefunde aus; dadurch sind Änderungen
an mandanten- und berechtigungskritischen Pfaden unnötig riskant.

## What Changes

- Bestehende Read-, Sync-, Scope-, Retry-, Fehler- und Mutationsverträge werden
  vor der Zerlegung durch Characterization-Tests festgehalten.
- Modell, Persistenz, Mainserver-Quelle, Synchronisation und gezielte
  Mutationsnachführung erhalten klar getrennte interne Module.
- Die bestehende Projektionsdatei bleibt die kompatible Serverfassade für
  Listen-, Refresh- und Mutation-Follow-up-Aufrufe.
- Fallow- und Sonar-Befunde werden durch vereinfachte Entscheidungen und
  entfernte echte Duplikation behoben, nicht durch Suppressions oder neue
  Parallelabstraktionen.
- Es gibt keine neue öffentliche API, Dependency oder Datenbankmigration.

## Impact

- Affected specs:
  - `sva-mainserver-integration`
- Affected code:
  - `apps/sva-studio-react/src/lib/iam-content-list-projection*.server.ts`
  - zugehörige Server-Tests und Test-Fixtures
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
