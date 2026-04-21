# Change: Governance für verschiedene Erweiterungstiefen von Packages einführen

## Why

Nicht jedes Workspace-Package sollte dieselben Erweiterungsrechte im Studio erhalten. Mit zunehmender Zahl fachlicher, administrativer und plattformnaher Packages wird eine Governance für unterschiedliche Erweiterungstiefen sinnvoll, damit der Host-Vertrag kontrollierbar bleibt.

## What Changes

- Einführung eines Zielbilds für unterschiedliche Klassen von Studio-Erweiterungen
- Abgrenzung zwischen normalen Fachpackages, Admin-Erweiterungen und plattformnahen Infrastruktur-Packages
- Klärung, welche SDK-Oberflächen und Host-Fähigkeiten je Erweiterungstiefe zulässig sind
- Vorbereitung technischer und governance-seitiger Schutzmechanismen gegen überprivilegierte Packages
- Dokumentation der langfristigen Skalierungsstrategie für die Plugin-Architektur des Studios

## Impact

- Affected specs:
  - `monorepo-structure`
  - `content-management`
  - `routing`
  - `iam-access-control`
- Affected code:
  - `packages/sdk`
  - `packages/plugin-news`
  - potenziell weitere `packages/plugin-*`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
